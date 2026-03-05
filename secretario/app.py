
import asyncio
import base64
import datetime
import json
import os
import threading
import time
from contextlib import asynccontextmanager

import httpx
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import database as db

# This asynccontextmanager is the modern way to handle lifespan events in FastAPI
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handles application startup and shutdown events.
    """
    print("Connecting to database...")
    await db.database.connect()
    # Initialize the database and tables if they don't exist.
    await db.initialize_database()
    print("Database connection established.")

    # Start the background worker
    worker_thread = threading.Thread(target=run_background_worker, daemon=True)
    worker_thread.start()

    yield  # The application runs while the yield is active

    print("Disconnecting from database...")
    await db.database.disconnect()
    print("Database connection closed.")


app = FastAPI(lifespan=lifespan)

@app.get("/")
async def root():
    return {"message": "VidSpri Secretario is running", "status": "ok"}

# --- CORS Configuration ---
# This allows the frontend hosted on GitHub Pages to communicate with this server.
origins = [
    "https://carleyinteractivestudio.github.io",
    "http://localhost",
    "http://localhost:8000",
    "http://127.0.0.1:8001" # For local testing
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Admin Security ---
# IMPORTANT: In a real production environment, this key should be loaded from a
# secure source like an environment variable, not hardcoded.
SECRET_ADMIN_KEY = os.environ.get("ADMIN_API_KEY", "vidspri-admin-2025")

async def require_admin_api_key(x_api_key: str = Header(...)):
    """Dependency to protect admin routes."""
    if x_api_key != SECRET_ADMIN_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing Admin API Key")

# --- Pydantic Models for Request Bodies ---
class PrioritizeRequest(BaseModel):
    job_id: str
    code: str

class NewCodeRequest(BaseModel):
    uses: int = 1

# --- Background Worker ---
def run_background_worker():
    """
    A simple worker that runs in a separate thread.
    It periodically checks the queue and marks the first job as "processing".
    """
    print("Background worker started.")
    while True:
        try:
            # Create a new event loop for this thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            # Run the async task
            loop.run_until_complete(process_queue())
            loop.close()
        except Exception as e:
            print(f"Error in background worker: {e}")

        time.sleep(10) # Wait for 10 seconds before checking again

async def process_queue():
    """
    The core logic of the background worker. It handles moving jobs to processing
    and timing out jobs that are stuck.
    """
    PROCESSING_TIMEOUT_SECONDS = 300 # 5 minutes

    if not db.database.is_connected:
        await db.database.connect()

    async with db.database.transaction():
        # 1. Check for and handle timed-out jobs
        timeout_threshold = datetime.datetime.utcnow() - datetime.timedelta(seconds=PROCESSING_TIMEOUT_SECONDS)

        stuck_jobs_query = db.processing_jobs.select().where(
            db.processing_jobs.c.status == "processing",
            db.processing_jobs.c.processing_started_at < timeout_threshold
        )
        stuck_jobs = await db.database.fetch_all(stuck_jobs_query)

        for job in stuck_jobs:
            print(f"Job {job.id} timed out. Marking as failed and shifting queue.")
            # Mark as failed and remove from queue
            fail_query = db.processing_jobs.update().where(db.processing_jobs.c.id == job.id).values(
                status="failed",
                queue_position=None
            )
            await db.database.execute(fail_query)
            # This job no longer holds a queue position, so we can shift others
            await db.shift_queue_after_job(job.queue_position)


        # 2. Check if a new job can be processed
        currently_processing_query = db.processing_jobs.select().where(db.processing_jobs.c.status == "processing")
        is_any_job_processing = await db.database.fetch_one(currently_processing_query)

        if is_any_job_processing:
            # A job is being actively worked on (or hasn't timed out yet), so we wait.
            return

        # 3. Get the next job from the queue
        next_job_query = db.processing_jobs.select().where(
            db.processing_jobs.c.queue_position == 1,
            db.processing_jobs.c.status == "queued"
        )
        job_to_process = await db.database.fetch_one(next_job_query)

        if job_to_process:
            print(f"Moving job {job_to_process.id} to 'processing' state.")
            # Set its status to "processing", record the start time, and remove from queue position
            update_query = db.processing_jobs.update().where(
                db.processing_jobs.c.id == job_to_process.id
            ).values(
                status="processing",
                processing_started_at=datetime.datetime.utcnow(),
                queue_position=None
            )
            await db.database.execute(update_query)
            # Shift the rest of the queue forward
            await db.shift_queue_after_job(1)

# --- API Endpoints ---
@app.post("/join")
async def join_queue():
    """
    Allows a user to join the processing queue.
    Returns a unique job_id.
    """
    try:
        job_id = await db.create_new_job()
        return {"job_id": job_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/remove-background/")
async def join_queue_alias():
    """Alias for /join to maintain compatibility with older frontend versions."""
    return await join_queue()

@app.get("/status/{job_id}")
async def get_status(job_id: str):
    """
    Retrieves the status and queue position of a job.
    """
    job = await db.get_job_status(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status == "processing":
        return {
            "status": "processing",
            "position": 0,
            "completed_frames": job.completed_frames,
            "total_frames": job.total_frames
        }

    if job.status == "completed":
        return {
            "status": "completed",
            "position": -1,
            "result_frames": json.loads(job.result_frames) # Return the final result
        }

    return {"status": job.status, "position": job.queue_position}

@app.post("/prioritize")
async def prioritize_job(request: PrioritizeRequest):
    """
    Applies a priority code to an existing job.
    """
    new_position, message = await db.upgrade_job_to_priority(request.job_id, request.code)

    if new_position is None:
        raise HTTPException(status_code=400, detail=message)

    return {"message": message, "new_position": new_position}

@app.get("/admin/queue", dependencies=[Depends(require_admin_api_key)])
async def get_full_queue():
    """A simple admin endpoint to view the current state of the queue."""
    queue = await db.get_current_queue()
    return queue

@app.post("/admin/codes", dependencies=[Depends(require_admin_api_key)])
async def create_new_priority_code(request: NewCodeRequest):
    """
    Admin endpoint to generate a new priority code.
    Requires a valid admin API key in the 'x-api-key' header.
    """
    try:
        new_code = await db.create_priority_code(uses=request.uses)
        return {"message": "New priority code created successfully", "code": new_code, "uses": request.uses}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create code: {e}")

# --- Image Processing Endpoint ---
ESPECIALISTA_URL = "https://carley1234-vidspri.hf.space/remove-background/"

@app.post("/process/{job_id}")
async def process_images(job_id: str, images: list[UploadFile] = File(...)):
    """
    Receives images from the frontend when it's their turn,
    sends them to the 'especialista' service, and stores the results.
    """
    print(f"Received process request for job: {job_id} with {len(images)} images")
    job = await db.get_job_status(job_id)
    if not job or job.status != "processing":
        raise HTTPException(status_code=400, detail="Job is not ready for processing.")

    # Set total frames for progress tracking
    total_frames = len(images)
    update_total_query = db.processing_jobs.update().where(
        db.processing_jobs.c.id == job_id
    ).values(total_frames=total_frames)
    await db.database.execute(update_total_query)

    processed_frames = []

    async with httpx.AsyncClient(timeout=60.0) as client:
        for i, image_file in enumerate(images):
            contents = await image_file.read()
            files = {'file': (image_file.filename, contents, image_file.content_type)}

            try:
                response = await client.post(ESPECIALISTA_URL, files=files)
                response.raise_for_status() # Raises an exception for 4XX/5XX responses

                # Store the processed image as a base64 string
                processed_image_bytes = response.content
                base64_encoded_image = base64.b64encode(processed_image_bytes).decode('utf-8')
                processed_frames.append(base64_encoded_image)

                # Update progress in the database
                update_progress_query = db.processing_jobs.update().where(
                    db.processing_jobs.c.id == job_id
                ).values(completed_frames=i + 1)
                await db.database.execute(update_progress_query)

            except httpx.HTTPStatusError as e:
                # Handle failure for a single frame
                # Mark the whole job as failed to avoid incomplete spritesheets
                fail_query = db.processing_jobs.update().where(db.processing_jobs.c.id == job_id).values(status="failed")
                await db.database.execute(fail_query)
                raise HTTPException(status_code=502, detail=f"Failed to process image with especialista: {e.response.text}")
            except Exception as e:
                 fail_query = db.processing_jobs.update().where(db.processing_jobs.c.id == job_id).values(status="failed")
                 await db.database.execute(fail_query)
                 raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

    # Once all frames are processed, update the job status to 'completed'
    final_update_query = db.processing_jobs.update().where(
        db.processing_jobs.c.id == job_id
    ).values(
        status="completed",
        queue_position=None,
        result_frames=json.dumps(processed_frames) # Store all results as a JSON string
    )
    await db.database.execute(final_update_query)

    return {"message": "Processing complete", "job_id": job_id}
