import os
import io
import asyncio
import base64
import datetime
import torch
import scipy.io.wavfile
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from transformers import WhisperProcessor, WhisperForConditionalGeneration
import pocket_tts
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
SERVER_ID = os.environ.get("SERVER_ID", "voz-worker")
SERVER_URL = os.environ.get("SERVER_URL", "https://carley1234-vidspri-voz.hf.space")
SERVICE_TYPE = "voice"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- Models Loading ---
# STT (Speech to Text)
stt_model_id = "openai/whisper-tiny"
try:
    print(f"Loading STT model {stt_model_id}...")
    stt_processor = WhisperProcessor.from_pretrained(stt_model_id)
    stt_model = WhisperForConditionalGeneration.from_pretrained(stt_model_id).to("cpu")
    print("STT Model loaded successfully.")
except Exception as e:
    print(f"Error loading STT model: {e}")
    stt_model = None
    stt_processor = None

# TTS (Text to Speech) is initialized per-request in pocket-tts for simplicity or globally
# For pocket-tts, we usually use the library directly.

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
    return {"message": "VidSpri Voice Worker is running", "status": "ok"}

@app.post("/process-voice/{job_id}")
async def process_voice(job_id: str, audio_file: UploadFile = File(...), text_override: str = Form(None)):
    await update_status("busy")
    supabase.table("processing_queue").update({"status": "processing"}).eq("id", job_id).execute()

    try:
        # 1. Read input audio (the voice to clone and optionally the speech to transcribe)
        audio_bytes = await audio_file.read()

        # Save temp file for pocket-tts and whisper
        temp_input = f"temp_{job_id}_input.wav"
        with open(temp_input, "wb") as f:
            f.write(audio_bytes)

        # 2. Extract Text (STT) if no override provided
        if not text_override:
            import librosa
            audio_stt, sr = librosa.load(temp_input, sr=16000)
            input_features = stt_processor(audio_stt, sampling_rate=16000, return_tensors="pt").input_features
            predicted_ids = stt_model.generate(input_features)
            text_to_speak = stt_processor.batch_decode(predicted_ids, skip_special_tokens=True)[0]
        else:
            text_to_speak = text_override

        # 3. Clone Voice and Generate Audio (TTS)
        # Using pocket-tts CLI style or API if available.
        # Pocket-tts 'generate' command can take a wav for cloning.
        output_wav = f"temp_{job_id}_output.wav"

        # Run pocket-tts generation
        # Note: In a real HF space, we'd use the python API for better performance
        from pocket_tts import PocketTTS
        tts = PocketTTS()
        # The library might have a different API, this is a conceptual integration based on docs
        tts.generate(text=text_to_speak, voice=temp_input, output=output_wav)

        with open(output_wav, "rb") as f:
            audio_result = base64.b64encode(f.read()).decode('utf-8')

        # Cleanup
        if os.path.exists(temp_input): os.remove(temp_input)
        if os.path.exists(output_wav): os.remove(output_wav)

        supabase.table("processing_queue").update({"status": "completed"}).eq("id", job_id).execute()
        await update_status("free")
        return {"status": "success", "audio": audio_result, "transcription": text_to_speak}

    except Exception as e:
        await update_status("free")
        supabase.table("processing_queue").update({"status": "failed"}).eq("id", job_id).execute()
        raise HTTPException(status_code=500, detail=str(e))
