
import asyncio
import datetime
import math
import uuid
from contextlib import asynccontextmanager

import sqlalchemy
from databases import Database

DATABASE_URL = "sqlite:///database.db"

database = Database(DATABASE_URL)
metadata = sqlalchemy.MetaData()

processing_jobs = sqlalchemy.Table(
    "processing_jobs",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.String, primary_key=True),
    sqlalchemy.Column("status", sqlalchemy.String, default="queued"), # queued, processing, completed, failed
    sqlalchemy.Column("priority", sqlalchemy.Boolean, default=False),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.datetime.utcnow),
    sqlalchemy.Column("processing_started_at", sqlalchemy.DateTime, nullable=True),
    sqlalchemy.Column("queue_position", sqlalchemy.Integer, nullable=True),
    sqlalchemy.Column("total_frames", sqlalchemy.Integer, default=0),
    sqlalchemy.Column("completed_frames", sqlalchemy.Integer, default=0),
    sqlalchemy.Column("result_frames", sqlalchemy.Text, default="[]"), # JSON list of base64 strings
)

priority_codes = sqlalchemy.Table(
    "priority_codes",
    metadata,
    sqlalchemy.Column("code", sqlalchemy.String, primary_key=True),
    sqlalchemy.Column("uses_remaining", sqlalchemy.Integer, default=1),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.datetime.utcnow),
    sqlalchemy.Column("is_active", sqlalchemy.Boolean, default=True),
)

async def initialize_database():
    """Initializes the database and creates tables if they don't exist."""
    engine = sqlalchemy.create_engine(DATABASE_URL)
    metadata.create_all(engine)

    # Do NOT connect/disconnect here, as it's handled by the lifespan in app.py
    # or should be handled by the caller who already has a connection.

    # Seed with a default priority code for testing
    default_code = "TEST-CODE-123"
    query = sqlalchemy.select(priority_codes).where(priority_codes.c.code == default_code)
    exists = await database.fetch_one(query)
    if not exists:
        insert_query = priority_codes.insert().values(code=default_code, uses_remaining=999)
        await database.execute(insert_query)

async def get_job_status(job_id: str):
    """Retrieves the status and queue position of a specific job."""
    query = sqlalchemy.select(processing_jobs).where(processing_jobs.c.id == job_id)
    return await database.fetch_one(query)

async def create_new_job():
    """Adds a new non-priority job to the end of the queue."""
    async with database.transaction():
        # Get the maximum current queue position
        max_pos_query = sqlalchemy.select(sqlalchemy.func.max(processing_jobs.c.queue_position))
        max_pos = await database.fetch_val(max_pos_query) or 0

        new_job_id = str(uuid.uuid4())
        insert_query = processing_jobs.insert().values(
            id=new_job_id,
            queue_position=max_pos + 1,
            priority=False,
        )
        await database.execute(insert_query)
        return new_job_id

async def shift_queue_after_job(position: int):
    """Shifts all jobs after the given position one step forward in the queue."""
    update_query = sqlalchemy.update(processing_jobs).where(
        processing_jobs.c.queue_position > position
    ).values(queue_position=processing_jobs.c.queue_position - 1)
    await database.execute(update_query)

async def validate_priority_code(code: str):
    """Checks if a priority code is valid and has uses remaining."""
    query = sqlalchemy.select(priority_codes).where(
        priority_codes.c.code == code,
        priority_codes.c.is_active == True,
        priority_codes.c.uses_remaining > 0
    )
    return await database.fetch_one(query)

async def _find_next_priority_slot(current_priority_positions):
    """
    Finds the first available queue position for a priority job based on the 1P-2NP rule.
    Priority slots are at positions 3, 6, 9, etc.
    """
    slot = 1
    while True:
        target_pos = slot * 3
        if target_pos not in current_priority_positions:
            return target_pos
        slot += 1

async def upgrade_job_to_priority(job_id: str, code: str):
    """
    Upgrades a job to priority, recalculates its queue position,
    and updates the queue for all affected jobs.
    """
    async with database.transaction():
        # 1. Validate the code and decrement its use count
        code_record = await validate_priority_code(code)
        if not code_record:
            return None, "Invalid or expired code."

        update_code_query = sqlalchemy.update(priority_codes).where(
            priority_codes.c.code == code
        ).values(uses_remaining=priority_codes.c.uses_remaining - 1)
        await database.execute(update_code_query)

        # 2. Get the current job's details
        job = await get_job_status(job_id)
        if not job or job.priority:
            return None, "Job not found or is already priority."

        current_position = job.queue_position

        # 3. Temporarily "remove" the job by shifting subsequent jobs up
        shift_up_query = sqlalchemy.update(processing_jobs).where(
            processing_jobs.c.queue_position > current_position
        ).values(queue_position=processing_jobs.c.queue_position - 1)
        await database.execute(shift_up_query)

        # 4. Find the new target position for our priority job
        priority_jobs_query = sqlalchemy.select(processing_jobs).where(
            processing_jobs.c.priority == True
        ).order_by(processing_jobs.c.queue_position)

        current_priority_positions = {
            p.queue_position for p in await database.fetch_all(priority_jobs_query)
        }
        new_position = await _find_next_priority_slot(current_priority_positions)

        # 5. Make space for the job by shifting subsequent jobs down
        max_pos_query = sqlalchemy.select(sqlalchemy.func.max(processing_jobs.c.queue_position))
        max_pos = await database.fetch_val(max_pos_query) or 0

        if new_position > max_pos + 1:
            new_position = max_pos + 1 # It can't be further than the end

        shift_down_query = sqlalchemy.update(processing_jobs).where(
            processing_jobs.c.queue_position >= new_position
        ).values(queue_position=processing_jobs.c.queue_position + 1)
        await database.execute(shift_down_query)

        # 6. Update the job to be priority and place it in its new slot
        update_job_query = sqlalchemy.update(processing_jobs).where(
            processing_jobs.c.id == job_id
        ).values(priority=True, queue_position=new_position)
        await database.execute(update_job_query)

        return new_position, "Success"

async def get_current_queue():
    """Returns the entire job queue, ordered by position."""
    query = sqlalchemy.select(processing_jobs).order_by(processing_jobs.c.queue_position)
    return await database.fetch_all(query)

async def create_priority_code(uses: int = 1):
    """Generates a new unique priority code and adds it to the database."""
    # Generates a more user-friendly code than a full UUID
    new_code = f"PRIORITY-{str(uuid.uuid4())[:8].upper()}"
    insert_query = priority_codes.insert().values(
        code=new_code,
        uses_remaining=uses,
        is_active=True
    )
    await database.execute(insert_query)
    return new_code
