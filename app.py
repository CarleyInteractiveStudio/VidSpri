
import io
import uuid
import time
import asyncio
import os
import base64
from typing import List
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, status, Form, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from rembg import remove, new_session
import database

app = FastAPI()

# --- App Initialization & Model Session ---
database.initialize_database()
session = new_session("isnet-anime")

# --- Security ---
ADMIN_API_KEY = os.environ.get("ADMIN_API_KEY", "_a_default_secret_key_that_should_be_changed_")
api_key_header = APIKeyHeader(name="X-Admin-API-Key", auto_error=False)

def get_api_key(api_key: str = Depends(api_key_header)):
    if not ADMIN_API_KEY or api_key != ADMIN_API_KEY:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

# --- CORS Configuration ---
origins = ["https://carleyinteractivestudio.github.io", "http://localhost:8002"] # Added localhost for local admin app
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
    try:
        if not images:
            # This check is slightly redundant as FastAPI would likely handle it, but it's good for clarity.
            raise HTTPException(status_code=400, detail="No images were provided.")

        job_id = str(uuid.uuid4())
        frames_data = [await image.read() for image in images]
        position = database.add_job_and_frames(job_id, frames_data)
        return {"job_id": job_id, "queue_position": position, "status": "queued", "total_frames": len(frames_data), "completed_frames": 0}
    except Exception as e:
        print(f"An error occurred during job queuing: {e}")
        raise HTTPException(status_code=500, detail=f"Error queuing job: {str(e)}")

@app.get("/status/{job_id}")
def get_status(job_id: str):
    job_info = database.get_job_status(job_id)
    if not job_info:
        raise HTTPException(status_code=404, detail="Job not found")

    if job_info['status'] == 'completed':
        # Encode frames in base64 to send them in a single JSON response
        encoded_frames = [base64.b64encode(frame_data).decode('utf-8') for frame_data in job_info['frames']]
        return JSONResponse(content={"status": "completed", "frames": encoded_frames})

    return job_info

@app.post("/apply-code")
async def apply_code(job_id: str = Form(...), code: str = Form(...)):
    job = database.get_job_status(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if not database.validate_code(code):
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    database.use_code(code)
    new_position = database.apply_priority_code_and_reorder(job_id)

    return {
        "message": f"Success! Your request has been moved to position #{new_position}.",
        "job_id": job_id,
        "new_queue_position": new_position
    }

# --- Admin API Endpoints ---

@app.get("/admin/codes", dependencies=[Depends(get_api_key)])
def get_all_codes_admin():
    return database.get_all_codes()

@app.post("/admin/codes", dependencies=[Depends(get_api_key)])
def create_code_admin(uses: int = Form(...)):
    if uses <= 0:
        raise HTTPException(status_code=400, detail="Uses must be a positive integer.")
    new_code = database.generate_code()
    database.add_code(new_code, uses)
    return {"code": new_code, "uses": uses, "total_uses": uses}

@app.delete("/admin/codes/{code}", dependencies=[Depends(get_api_key)])
def delete_code_admin(code: str):
    database.delete_code(code)
    return {"message": f"Code {code} deleted successfully."}

# --- Background Worker ---
async def process_queue():
    while True:
        frame_to_process = database.get_next_frame_to_process()
        if frame_to_process:
            job_id = frame_to_process['job_id']
            frame_order = frame_to_process['frame_order']
            try:
                database.update_frame_status(job_id, frame_order, "processing")
                output_bytes = remove(frame_to_process['image_data'], session=session)
                database.update_frame_as_completed(job_id, frame_order, output_bytes)
            except Exception as e:
                database.update_frame_status(job_id, frame_order, "failed")
        else:
            await asyncio.sleep(5)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(process_queue())

@app.get("/")
def read_root():
    return {"status": "VidSpri Backend is running"}
