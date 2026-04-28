import os
import io
import asyncio
import base64
import datetime
import torch
import scipy.io.wavfile
from fastapi import FastAPI, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from transformers import pipeline
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
SERVER_ID = os.environ.get("SERVER_ID", "sonido-worker")
SERVER_URL = os.environ.get("SERVER_URL", "https://carley1234-vidsprisonido.hf.space")
SERVICE_TYPE = "sound"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- Model Loading ---
device = "cpu"
model_id = "facebook/musicgen-small"
try:
    print(f"Loading model {model_id} via pipeline...")
    audio_pipe = pipeline("text-to-audio", model=model_id, device=device)
    print("Model loaded successfully.")
except Exception as e:
    print(f"Error loading model: {e}")
    audio_pipe = None

is_processing = False

async def update_status(status: str = None):
    global is_processing
    try:
        if status:
            is_processing = (status == "busy")
        current_status = "busy" if is_processing else "free"
        data = {
            "id": SERVER_ID,
            "url": SERVER_URL,
            "status": current_status,
            "service_type": SERVICE_TYPE,
            "last_heartbeat": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        supabase.table("server_status").upsert(data).execute()
    except Exception as e:
        print(f"Error updating status: {e}")

async def heartbeat_loop():
    while True:
        await update_status()
        await asyncio.sleep(20)

@app.on_event("startup")
async def startup_event():
    await update_status("free")
    asyncio.create_task(heartbeat_loop())

@app.get("/")
async def root():
    return {"message": "VidSpri Sound Worker is running", "status": "ok"}

@app.post("/generate/{job_id}")
async def generate_sound(job_id: str, prompt: str = Form(...), duration: int = Form(10)):
    await update_status("busy")
    supabase.table("processing_queue").update({"status": "processing"}).eq("id", job_id).execute()

    try:
        if not audio_pipe:
            raise Exception("Model pipeline not loaded")

        # MusicGen-small: 50 tokens ~ 1 second of audio
        max_tokens = min(int(duration) * 50, 1500) # Max 30 seconds (1500 tokens)

        result = audio_pipe(prompt, forward_params={"max_new_tokens": max_tokens})

        # Convert to WAV in memory
        sampling_rate = result["sampling_rate"]
        audio_data = result["audio"]

        wav_buf = io.BytesIO()
        scipy.io.wavfile.write(wav_buf, rate=sampling_rate, data=audio_data[0])
        wav_buf.seek(0)

        audio_base64 = base64.b64encode(wav_buf.read()).decode('utf-8')

        supabase.table("processing_queue").update({"status": "completed"}).eq("id", job_id).execute()
        await update_status("free")
        return {"status": "success", "audio": audio_base64}

    except Exception as e:
        await update_status("free")
        supabase.table("processing_queue").update({"status": "failed"}).eq("id", job_id).execute()
        raise HTTPException(status_code=500, detail=str(e))
