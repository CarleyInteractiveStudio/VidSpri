import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta

from database import (
    database, create_new_job, get_job_status, update_job_status, apply_priority_code,
    CREATE_JOBS_TABLE, CREATE_CODES_TABLE, INSERT_UNLIMITED_CODE, INSERT_LIMITED_CODE, INSERT_COOLDOWN_CODE
)
from worker import async_queue_worker

# --- Pydantic Models ---
class Job(BaseModel):
    job_id: str; status: str; is_priority: bool; queue_position: int; created_at: datetime; updated_at: Optional[datetime] = None
class PriorityRequest(BaseModel):
    code: str
class ProcessRequest(BaseModel):
    frame_count: int

# --- Lifespan Manager ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    await database.connect()
    await database.execute(CREATE_JOBS_TABLE)
    await database.execute(CREATE_CODES_TABLE)
    expires_date = (datetime.now() + timedelta(days=30)).isoformat()
    await database.execute(query=INSERT_LIMITED_CODE, values=[expires_date])
    await database.execute(INSERT_UNLIMITED_CODE)
    await database.execute(INSERT_COOLDOWN_CODE)
    worker_task = asyncio.create_task(async_queue_worker())

    yield  # Application runs here

    # Shutdown logic
    worker_task.cancel()
    await database.disconnect()

# --- FastAPI App ---
app = FastAPI(lifespan=lifespan)

# --- API Endpoints ---
@app.post("/submit", response_model=Job)
async def submit_job():
    return await create_new_job()

@app.get("/status/{job_id}", response_model=Job)
async def get_status(job_id: str):
    job = await get_job_status(job_id)
    if not job: raise HTTPException(status_code=404, detail="Job not found")
    return job

@app.post("/apply_priority/{job_id}")
async def apply_priority(job_id: str, request: PriorityRequest):
    result = await apply_priority_code(job_id, request.code)
    if not result["success"]: raise HTTPException(status_code=400, detail=result["message"])
    return result

@app.post("/process/{job_id}")
async def process_job(job_id: str, request: ProcessRequest):
    job = await get_job_status(job_id)
    if not job or job['status'] != 'processing':
        raise HTTPException(status_code=400, detail="Job not ready for processing.")
    await update_job_status(job_id, 'completed')
    return {"message": "Job completed."}
