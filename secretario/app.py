import os
import io
import asyncio
import base64
import datetime
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from rembg import remove, new_session
from supabase import create_client, Client

app = FastAPI()

# --- CORS Configuration ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Supabase Configuration ---
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://tladrluezsmmhjbhupgb.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "sb_publishable_zb8TGeURLnafHWDffG9DMg_PtFO_kmv")
# SERVER_ID and SERVER_URL should be set in the environment of each node
SERVER_ID = os.environ.get("SERVER_ID", "secretario")
SERVER_URL = os.environ.get("SERVER_URL", "https://carley1234-vidspri-secretario.hf.space")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- Model Session ---
session = new_session("isnet-anime")

async def update_status(status: str = None):
    try:
        data = {
            "id": SERVER_ID,
            "url": SERVER_URL,
            "last_heartbeat": datetime.datetime.utcnow().isoformat()
        }
        if status:
            data["status"] = status

        supabase.table("server_status").upsert(data).execute()
    except Exception as e:
        print(f"Error updating status to Supabase: {e}")

async def heartbeat_loop():
    while True:
        await update_status()
        await asyncio.sleep(20)

@app.on_event("startup")
async def startup_event():
    await update_status("free")
    asyncio.create_task(heartbeat_loop())

@app.on_event("shutdown")
async def shutdown_event():
    await update_status("offline")

@app.get("/")
async def root():
    return {"message": f"VidSpri Node ({SERVER_ID}) is running", "status": "ok"}

@app.post("/remove-background/")
async def remove_background_api(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File provided is not an image.")

    await update_status("busy")

    try:
        contents = await file.read()
        output_bytes = remove(contents, session=session)
        await update_status("free")
        return StreamingResponse(io.BytesIO(output_bytes), media_type="image/png")
    except Exception as e:
        await update_status("free")
        raise HTTPException(status_code=500, detail=f"Failed to process image: {str(e)}")

@app.post("/process-batch/{job_id}")
async def process_batch(job_id: str, images: list[UploadFile] = File(...)):
    total = len(images)
    # Update status to processing and set total_frames in DB
    supabase.table("processing_queue").update({
        "status": "processing",
        "total_frames": total,
        "processed_frames": 0
    }).eq("id", job_id).execute()

    await update_status("busy")

    processed_frames = []
    try:
        for i, image_file in enumerate(images):
            contents = await image_file.read()
            output_bytes = remove(contents, session=session)
            base64_encoded = base64.b64encode(output_bytes).decode('utf-8')
            processed_frames.append(base64_encoded)

            # Update progress one by one
            supabase.table("processing_queue").update({
                "processed_frames": i + 1
            }).eq("id", job_id).execute()

        supabase.table("processing_queue").update({"status": "completed"}).eq("id", job_id).execute()
        await update_status("free")
        return {"status": "success", "frames": processed_frames}
    except Exception as e:
        await update_status("free")
        supabase.table("processing_queue").update({"status": "failed"}).eq("id", job_id).execute()
        raise HTTPException(status_code=500, detail=str(e))
