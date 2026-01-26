from databases import Database
import uuid
from datetime import datetime, timedelta

DATABASE_URL = "sqlite:///secretario/database.db"
database = Database(DATABASE_URL)

# --- Table Creation Queries ---
CREATE_JOBS_TABLE = """
CREATE TABLE IF NOT EXISTS processing_jobs (
    job_id TEXT PRIMARY KEY, status TEXT, is_priority BOOLEAN,
    queue_position INTEGER, created_at TIMESTAMP, updated_at TIMESTAMP
)"""
CREATE_CODES_TABLE = """
CREATE TABLE IF NOT EXISTS priority_codes (
    code TEXT PRIMARY KEY, max_uses INTEGER, uses_remaining INTEGER,
    expires_at TIMESTAMP, cooldown_seconds INTEGER, last_used_at TIMESTAMP
)"""
# Seed codes
INSERT_UNLIMITED_CODE = "INSERT OR IGNORE INTO priority_codes(code, max_uses, uses_remaining) VALUES ('UNLIMITED', -1, -1)"
INSERT_LIMITED_CODE = "INSERT OR IGNORE INTO priority_codes(code, max_uses, uses_remaining, expires_at) VALUES ('LIMITED10', 10, 10, ?)"
INSERT_COOLDOWN_CODE = "INSERT OR IGNORE INTO priority_codes(code, max_uses, uses_remaining, cooldown_seconds) VALUES ('COOLDOWN60', 5, 5, 60)"


# --- Job Management ---
async def create_new_job():
    job_id = str(uuid.uuid4())
    async with database.transaction():
        count_query = "SELECT COUNT(*) FROM processing_jobs WHERE status = :status"
        count = await database.fetch_val(count_query, {"status": "queued"})

        insert_query = """
        INSERT INTO processing_jobs(job_id, status, is_priority, queue_position, created_at)
        VALUES (:job_id, :status, :is_priority, :queue_position, :created_at)
        """
        values = {
            "job_id": job_id, "status": "queued", "is_priority": False,
            "queue_position": count + 1, "created_at": datetime.now()
        }
        await database.execute(insert_query, values)
    return await get_job_status(job_id)

async def get_job_status(job_id: str):
    query = "SELECT * FROM processing_jobs WHERE job_id = :job_id"
    return await database.fetch_one(query, {"job_id": job_id})

async def update_job_status(job_id: str, status: str):
    query = "UPDATE processing_jobs SET status = :status, updated_at = :now WHERE job_id = :job_id"
    await database.execute(query, {"job_id": job_id, "status": status, "now": datetime.now()})

async def get_next_job():
    async with database.transaction():
        query = "SELECT * FROM processing_jobs WHERE status = :status ORDER BY queue_position ASC, created_at ASC LIMIT 1"
        job = await database.fetch_one(query, {"status": "queued"})
        if job:
            await update_job_status(job['job_id'], 'processing')
    return job

# --- Priority Code Logic (Restored) ---
async def apply_priority_code(job_id: str, code: str):
    async with database.transaction():
        # 1. Validate Code
        code_query = "SELECT * FROM priority_codes WHERE code = :code"
        p_code = await database.fetch_one(code_query, {"code": code})
        if not p_code: return {"success": False, "message": "El código no es válido."}
        if p_code['expires_at'] and datetime.fromisoformat(p_code['expires_at']) < datetime.now():
            return {"success": False, "message": "El código ha expirado."}
        if p_code['uses_remaining'] == 0:
            return {"success": False, "message": "El código ya no tiene usos."}

        # 2. Validate Job
        job = await get_job_status(job_id)
        if not job or job['status'] != 'queued': return {"success": False, "message": "El trabajo no está en la cola."}
        if job['is_priority']: return {"success": False, "message": "El trabajo ya es prioritario."}

        # 3. Calculate new position (1P every 2N rule)
        all_jobs_q = "SELECT job_id, is_priority FROM processing_jobs WHERE status = 'queued' ORDER BY queue_position"
        all_jobs = await database.fetch_all(all_jobs_q)

        new_pos = len(all_jobs)
        for i, current_job in enumerate(all_jobs):
            if (i + 1) % 3 == 0 and not current_job['is_priority']:
                new_pos = i + 1
                break

        # 4. Update Database
        await database.execute("UPDATE processing_jobs SET queue_position = queue_position + 1 WHERE queue_position >= :new_pos", {"new_pos": new_pos})
        update_job_q = "UPDATE processing_jobs SET is_priority = 1, queue_position = :pos WHERE job_id = :job_id"
        await database.execute(update_job_q, {"pos": new_pos, "job_id": job_id})

        if p_code['uses_remaining'] > 0:
            await database.execute("UPDATE priority_codes SET uses_remaining = uses_remaining - 1 WHERE code = :code", {"code": code})

    new_job_details = await get_job_status(job_id)
    return {"success": True, "message": f"¡Éxito! Nueva posición: #{new_job_details['queue_position']}", "new_position": new_job_details['queue_position']}
