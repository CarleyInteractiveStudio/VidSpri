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
try:
    from transformers import WhisperProcessor, WhisperForConditionalGeneration
    from pocket_tts import TTSModel
    from supabase import create_client, Client
except ImportError as e:
    print(f"CRITICAL IMPORT ERROR: {e}")
    # Try to re-install at runtime as a last resort
    import subprocess
    import sys
    print("Attempting runtime install of pocket-tts...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pocket-tts"])
        from pocket_tts import TTSModel
        from supabase import create_client, Client
    except Exception as e2:
        print(f"Runtime install failed: {e2}")

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
stt_model = None
stt_processor = None
tts_model = None

def load_models():
    global stt_model, stt_processor, tts_model
    # STT (Speech to Text)
    stt_model_id = "openai/whisper-tiny"
    try:
        print(f"Loading STT model {stt_model_id}...")
        stt_processor = WhisperProcessor.from_pretrained(stt_model_id)
        stt_model = WhisperForConditionalGeneration.from_pretrained(stt_model_id).to("cpu")
        print("STT Model loaded successfully.")
    except Exception as e:
        print(f"Error loading STT model: {e}")

    # TTS (Text to Speech)
    try:
        print("Loading Pocket TTS model...")
        # We can specify language='spanish' or leave it for default English
        # For VidSpri, maybe we should detect language or use a default.
        tts_model = TTSModel.load_model(language="spanish")
        tts_model.to("cpu")
        print("Pocket TTS Model loaded successfully.")
    except Exception as e:
        print(f"Error loading Pocket TTS model: {e}")

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
    # Load models in background to avoid startup timeouts
    asyncio.create_task(asyncio.to_thread(load_models))
    await update_status("free")
    asyncio.create_task(heartbeat_loop())

@app.get("/")
async def root():
    return {"message": "VidSpri Voice Worker is running", "status": "ok"}

@app.post("/process-voice/{job_id}")
async def process_voice(job_id: str, audio_file: UploadFile = File(...), text_override: str = Form(None)):
    global is_processing, tts_model, stt_model, stt_processor

    if is_processing:
        raise HTTPException(status_code=503, detail="Server is busy")

    await update_status("busy")
    supabase.table("processing_queue").update({"status": "processing"}).eq("id", job_id).execute()

    temp_input_path = None
    try:
        # 1. Read input audio
        audio_bytes = await audio_file.read()

        # Save to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            tmp.write(audio_bytes)
            temp_input_path = tmp.name

        # 2. Extract Text (STT) if no override provided
        if not text_override:
            import librosa
            def run_stt():
                with torch.no_grad():
                    audio_stt, sr = librosa.load(temp_input_path, sr=16000)
                    input_features = stt_processor(audio_stt, sampling_rate=16000, return_tensors="pt").input_features
                    predicted_ids = stt_model.generate(input_features)
                    return stt_processor.batch_decode(predicted_ids, skip_special_tokens=True)[0]

            text_to_speak = await asyncio.to_thread(run_stt)
        else:
            text_to_speak = text_override

        # 3. Clone Voice and Generate Audio (TTS)
        if tts_model is None:
             raise Exception("TTS Model not loaded")

        def run_tts():
            with torch.no_grad():
                # Get voice embedding from the input audio
                model_state_for_voice = tts_model.get_state_for_audio_prompt(Path(temp_input_path))

                # Generate audio stream
                audio_chunks = tts_model.generate_audio_stream(
                    model_state=model_state_for_voice,
                    text_to_generate=text_to_speak
                )

                # Combine chunks
                return list(audio_chunks)

        all_audio = await asyncio.to_thread(run_tts)

        if not all_audio:
            raise Exception("No audio generated")

        combined_audio = np.concatenate(all_audio)
        sample_rate = tts_model.config.mimi.sample_rate

        # Clean audio data
        combined_audio = np.nan_to_num(combined_audio)

        # Normalize audio
        max_val = np.abs(combined_audio).max()
        if max_val > 0:
            combined_audio = combined_audio / (max_val + 1e-6) * 0.95

        combined_audio = np.clip(combined_audio * 32767, -32768, 32767).astype(np.int16)

        # Write to buffer
        out_buf = io.BytesIO()
        scipy.io.wavfile.write(out_buf, sample_rate, combined_audio)
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
        if temp_input_path and os.path.exists(temp_input_path):
            os.remove(temp_input_path)
