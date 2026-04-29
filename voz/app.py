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

# --- Kokoro TTS ---
try:
    from kokoro import KPipeline
    from supabase import create_client, Client
except ImportError:
    # Diagnostic message will be shown via load_error
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
tts_pipeline = None
load_error = None

def load_models():
    global tts_pipeline, load_error
    try:
        print("Loading Kokoro TTS model (Apache 2.0)...")
        # 'es' for Spanish, 'a' for American English
        tts_pipeline = KPipeline(lang_code='es')
        print("Kokoro Model loaded successfully.")
        load_error = None
    except Exception as e:
        load_error = str(e)
        print(f"Error loading Kokoro model: {e}")

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
    return {"message": "VidSpri Voice Worker (Kokoro) is running", "status": "ok"}

@app.post("/process-voice/{job_id}")
async def process_voice(job_id: str, audio_file: UploadFile = File(None), text_override: str = Form(None)):
    global is_processing, tts_pipeline, load_error

    if is_processing:
        raise HTTPException(status_code=503, detail="Server is busy")

    if not tts_pipeline:
        msg = f"Voice model not loaded yet. Error: {load_error}" if load_error else "Model is still loading..."
        raise HTTPException(status_code=500, detail=msg)

    await update_status("busy")
    supabase.table("processing_queue").update({"status": "processing"}).eq("id", job_id).execute()

    try:
        # For Kokoro, we mainly generate from text.
        # If user provides audio, we ignore it for now as cloning is a restricted feature in many libs,
        # but Kokoro provides high quality presets.
        text_to_speak = text_override or "Hola, bienvenido a VidSpri."

        def run_tts():
            # Voice choices: 'af_heart', 'af_bella', 'am_adam', 'es_male', 'es_female'
            # 'es' language code supports specific voices
            generator = tts_pipeline(
                text_to_speak, voice='ef_dora', # Dora is a good Spanish female voice
                speed=1, split_pattern=r'\n+'
            )

            all_chunks = []
            for _, _, audio in generator:
                all_chunks.append(audio)
            return np.concatenate(all_chunks) if all_chunks else None

        combined_audio = await asyncio.to_thread(run_tts)

        if combined_audio is None:
            raise Exception("No audio generated")

        # Clean audio data
        combined_audio = np.nan_to_num(combined_audio)

        # Remove DC offset
        if combined_audio.size > 0:
            combined_audio = combined_audio - np.mean(combined_audio)

        # Normalize audio with headroom
        max_val = np.abs(combined_audio).max()
        if max_val > 0:
            combined_audio = (combined_audio / (max_val + 1e-6)) * 0.9

        combined_audio = np.clip(combined_audio * 32767, -32768, 32767).astype(np.int16)

        # Write to buffer
        out_buf = io.BytesIO()
        scipy.io.wavfile.write(out_buf, 24000, combined_audio) # Kokoro native rate is 24k
        audio_result = base64.b64encode(out_buf.getvalue()).decode('utf-8')

        supabase.table("processing_queue").update({"status": "completed"}).eq("id", job_id).execute()
        await update_status("free")
        return {"status": "success", "audio": audio_result, "transcription": text_to_speak}

    except Exception as e:
        print(f"Error in process_voice: {e}")
        await update_status("free")
        supabase.table("processing_queue").update({"status": "failed"}).eq("id", job_id).execute()
        raise HTTPException(status_code=500, detail=str(e))
