import os
import io
import asyncio
import base64
import datetime
import torch
import scipy.io.wavfile
import numpy as np
import tempfile
from pathlib import Path
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware

# --- OuteTTS ---
try:
    import outetts
    from supabase import create_client, Client
except ImportError:
    pass

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
SERVER_ID = os.environ.get("SERVER_ID", "voz-worker")
SERVER_URL = os.environ.get("SERVER_URL", "https://carley1234-voz.hf.space")
SERVICE_TYPE = "voice"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- Models Loading ---
model_interface = None
load_error = None

def load_models():
    global model_interface, load_error
    try:
        print("Loading OuteTTS model (Apache 2.0)...")
        # Initialize the model interface
        model_config = outetts.GGUFModelConfig_v1(
            model_path=None, # Downloads automatically
            language="es",
            n_gpu_layers=0 # CPU optimized
        )
        model_interface = outetts.InterfaceGGUF(model_config)
        print("OuteTTS Model loaded successfully.")
        load_error = None
    except Exception as e:
        load_error = str(e)
        print(f"Error loading OuteTTS model: {e}")

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
    asyncio.create_task(asyncio.to_thread(load_models))
    await update_status("free")
    asyncio.create_task(heartbeat_loop())

@app.get("/")
async def root():
    return {"message": "VidSpri Voice Worker (OuteTTS) is running", "status": "ok"}

@app.post("/process-voice/{job_id}")
async def process_voice(job_id: str, audio_file: UploadFile = File(None), text_override: str = Form(None)):
    global is_processing, model_interface, load_error

    if is_processing:
        raise HTTPException(status_code=503, detail="Server is busy")

    if not model_interface:
        msg = f"Voice model not loaded yet. Error: {load_error}" if load_error else "Model is still loading..."
        raise HTTPException(status_code=500, detail=msg)

    await update_status("busy")
    supabase.table("processing_queue").update({"status": "processing"}).eq("id", job_id).execute()

    temp_ref_path = None
    try:
        text_to_speak = text_override or "Hola, bienvenido a VidSpri."

        # 1. Handle Voice Cloning if audio is provided
        speaker = None
        if audio_file:
            # Save ref audio to temp
            audio_bytes = await audio_file.read()
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                tmp.write(audio_bytes)
                temp_ref_path = tmp.name

            # Create speaker from audio
            speaker = model_interface.create_speaker(temp_ref_path)

        def run_tts():
            # Generate audio using the cloned speaker or default
            output = model_interface.generate(
                text=text_to_speak,
                speaker=speaker,
                temperature=0.1,
                repetition_penalty=1.1
            )
            return output.audio_np, output.sample_rate

        audio_data, sample_rate = await asyncio.to_thread(run_tts)

        if audio_data is None:
            raise Exception("No audio generated")

        # --- High Quality Audio Processing ---
        audio_data = np.nan_to_num(audio_data)

        # 1. Remove DC offset
        if audio_data.size > 0:
            audio_data = audio_data - np.mean(audio_data)

        # 2. Soft-clipping/Limiting to prevent digital harshness
        audio_data = np.tanh(audio_data * 1.5)

        # 3. Final normalization with 0.9 headroom
        max_val = np.abs(audio_data).max()
        if max_val > 0:
            audio_data = (audio_data / (max_val + 1e-6)) * 0.9

        # Convert to 16-bit PCM
        audio_data = np.clip(audio_data * 32767, -32768, 32767).astype(np.int16)

        # Write to buffer
        out_buf = io.BytesIO()
        scipy.io.wavfile.write(out_buf, sample_rate, audio_data)
        audio_result = base64.b64encode(out_buf.getvalue()).decode('utf-8')

        supabase.table("processing_queue").update({"status": "completed"}).eq("id", job_id).execute()
        await update_status("free")
        return {"status": "success", "audio": audio_result, "transcription": text_to_speak}

    except Exception as e:
        print(f"Error in process_voice: {e}")
        await update_status("free")
        supabase.table("processing_queue").update({"status": "failed"}).eq("id", job_id).execute()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_ref_path and os.path.exists(temp_ref_path):
            os.remove(temp_ref_path)
