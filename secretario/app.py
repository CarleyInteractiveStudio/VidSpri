
import uuid
import asyncio
import os
import base64
import httpx
import threading
import time
from contextlib import asynccontextmanager
from typing import List
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, status, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
import database
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Lifespan Management ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan manager to start the background worker in a persistent thread.
    This ensures the worker is started only once, preventing issues with
    multiple Uvicorn workers on platforms like Hugging Face.
    """
    logger.info("Application startup...")
    database.initialize_database()
    logger.info("Database initialized.")

    logger.info("Starting background worker.")
    # Start the worker in a daemon thread.
    worker_thread = threading.Thread(target=worker, daemon=True)
    worker_thread.start()
    yield
    logger.info("Application shutdown.")

# Initialize the FastAPI app with the lifespan manager
app = FastAPI(lifespan=lifespan)

# --- Configuration ---
ESPECIALISTA_URL = "https://carley1234-vidspri.hf.space/remove-background/"

# --- Security ---
ADMIN_API_KEY = os.environ.get("ADMIN_API_KEY", "_a_default_secret_key_that_should_be_changed_")
api_key_header = APIKeyHeader(name="X-Admin-API-Key", auto_error=False)

def get_api_key(api_key: str = Depends(api_key_header)):
    if not ADMIN_API_KEY or api_key != ADMIN_API_KEY:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

# --- CORS Configuration ---
origins = ["https://carleyinteractivestudio.github.io", "http://localhost:8002", "null"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Public API Endpoints ---

@app.post("/remove-background/")
async def queue_job(images: List[UploadFile] = File(...)):
    if not images:
        raise HTTPException(status_code=400, detail="No images were provided.")
    job_id = str(uuid.uuid4())
    frames_data = [await image.read() for image in images]
    # Run synchronous DB code in a thread to not block the event loop
    position = await asyncio.to_thread(database.add_job_and_frames, job_id, frames_data)
    logger.info(f"Job {job_id} queued in position {position}.")
    return {"job_id": job_id, "queue_position": position, "status": "queued", "total_frames": len(frames_data), "completed_frames": 0}

@app.get("/status/{job_id}")
async def get_status(job_id: str):
    # Run synchronous DB code in a thread
    job_info = await asyncio.to_thread(database.get_job_status, job_id)
    if not job_info:
        raise HTTPException(status_code=404, detail="Job not found")
    if job_info['status'] == 'completed':
        encoded_frames = [base64.b64encode(frame_data).decode('utf-8') for frame_data in job_info['frames']]
        return JSONResponse(content={"status": "completed", "frames": encoded_frames})
    return job_info

@app.post("/apply-code")
async def apply_code(job_id: str = Form(...), code: str = Form(...)):
    # Run synchronous DB code in a thread
    if not await asyncio.to_thread(database.get_job_status, job_id):
        raise HTTPException(status_code=404, detail="Job not found")
    if not await asyncio.to_thread(database.validate_code, code):
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    await asyncio.to_thread(database.use_code, code)
    new_position = await asyncio.to_thread(database.apply_priority_code_and_reorder, job_id)
    return {"message": f"Success! Your request has been moved to position #{new_position}.", "job_id": job_id, "new_queue_position": new_position}

# --- Admin API Endpoints ---

@app.get("/admin/codes", dependencies=[Depends(get_api_key)])
async def get_all_codes_admin():
    return await asyncio.to_thread(database.get_all_codes)

@app.post("/admin/codes", dependencies=[Depends(get_api_key)])
async def create_code_admin(uses: int = Form(...)):
    if uses <= 0:
        raise HTTPException(status_code=400, detail="Uses must be a positive integer.")
    new_code = await asyncio.to_thread(database.generate_code)
    await asyncio.to_thread(database.add_code, new_code, uses)
    return {"code": new_code, "uses": uses, "total_uses": uses}

@app.delete("/admin/codes/{code}", dependencies=[Depends(get_api_key)])
async def delete_code_admin(code: str):
    await asyncio.to_thread(database.delete_code, code)
    return {"message": f"Code {code} deleted successfully."}

# --- Background Worker ---
def process_frame_remotely(image_data: bytes) -> bytes:
    """Sends a single frame to the specialist service using a synchronous client."""
    with httpx.Client(timeout=120.0) as client:
        files = {'file': ('image.png', image_data, 'image/png')}
        response = client.post(ESPECIALISTA_URL, files=files)
        response.raise_for_status()
        return response.content

def worker():
    """
    The main worker loop that polls for jobs and processes them.
    This function runs in a separate, persistent OS-level thread.
    """
    logger.info("Worker has started and is polling for jobs.")
    while True:
        frame_to_process = None
        try:
            # DB calls are synchronous, no need for asyncio.to_thread
            frame_to_process = database.get_next_frame_to_process()

            if frame_to_process:
                job_id = frame_to_process['job_id']
                frame_order = frame_to_process['frame_order']

                job_info = database.get_job_status(job_id)
                if job_info and job_info['status'] == 'queued':
                    logger.info(f"Job {job_id} picked up for processing.")
                    database.set_job_status(job_id, "processing")

                logger.info(f"Sending frame {frame_order} of job {job_id} to specialist.")
                output_bytes = process_frame_remotely(frame_to_process['image_data'])
                database.update_frame_as_completed(job_id, frame_order, output_bytes)
                logger.info(f"Successfully processed frame {frame_order} of job {job_id}.")
            else:
                # Use synchronous sleep
                time.sleep(2)

        except Exception as e:
            logger.error(f"An error occurred in the worker: {e}")
            if frame_to_process:
                job_id = frame_to_process['job_id']
                logger.error(f"Marking job {job_id} as failed.")
                database.set_job_status(job_id, "failed")
            # Use synchronous sleep on error
            time.sleep(10)

@app.get("/")
def read_root():
    return {"status": "Secretario Service is running"}
