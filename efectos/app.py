import os
import io
import asyncio
import base64
import datetime
import torch
import numpy as np
import scipy.io.wavfile
from fastapi import FastAPI, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
try:
    from transformers import AutoProcessor, AudioGenForConditionalGeneration
except ImportError:
    # Fallback for some transformer versions or environment quirks
    from transformers import AutoProcessor, AutoModel as AudioGenForConditionalGeneration
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
SERVER_ID = os.environ.get("SERVER_ID", "efectos-worker")
SERVER_URL = os.environ.get("SERVER_URL", "https://carley1234-efectos.hf.space")
SERVICE_TYPE = "effect"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- Model Loading ---
device = "cpu"
model_id = "facebook/audiogen-medium"
processor = None
model = None
load_error = None
is_processing = False

def load_models():
    global processor, model, load_error
    try:
        # Limit CPU threads BEFORE loading to avoid killing the container
        torch.set_num_threads(1)
        print(f"Loading model {model_id}...")
        # Use explicit classes for better control on free CPU resources
        processor = AutoProcessor.from_pretrained(model_id)
        model = AudioGenForConditionalGeneration.from_pretrained(model_id)
        model.to(device)

        print("Model loaded successfully.")
        load_error = None
    except Exception as e:
        load_error = str(e)
        print(f"Error loading model: {e}")

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
    return {"message": "VidSpri Effects Worker is running", "status": "ok"}

@app.post("/generate/{job_id}")
async def generate_effect(job_id: str, prompt: str = Form(...), duration: int = Form(3)):
    await update_status("busy")
    supabase.table("processing_queue").update({"status": "processing"}).eq("id", job_id).execute()

    try:
        if model is None or processor is None:
            msg = f"Model not loaded. Error during startup: {load_error}" if load_error else "Model is still starting up..."
            raise Exception(msg)

        # AudioGen: 50 tokens ~ 1 second of audio
        max_tokens = min(int(duration) * 50, 250) # Max 5 seconds (250 tokens)

        def run_inference():
            with torch.no_grad():
                # Explicit generation for better control
                inputs = processor(text=[prompt], return_tensors="pt")
                audio_values = model.generate(
                    **inputs.to(device),
                    max_new_tokens=max_tokens,
                    do_sample=True,
                    temperature=1.0,
                    top_k=250,
                    top_p=0.99,
                    guidance_scale=3.0
                )
                return audio_values[0].cpu().numpy()

        audio_data = await asyncio.to_thread(run_inference)
        sampling_rate = model.config.audio_encoder.sampling_rate

        # Ensure audio_data is a numpy array and has correct type for scipy
        if isinstance(audio_data, torch.Tensor):
            audio_data = audio_data.cpu().numpy()

        # Clean data and ensure CPU numpy array
        audio_data = np.nan_to_num(audio_data)

        # Remove DC offset to eliminate "click" and constant hum
        if audio_data.size > 0:
            audio_data = audio_data - np.mean(audio_data)

        # 2. Soft-clipping to prevent digital artifacts on saturation
        audio_data = np.tanh(audio_data * 1.2)

        # Standardize shape
        if audio_data.ndim == 3:
            audio_data = audio_data[0]

        if audio_data.ndim == 2:
            audio_data = np.mean(audio_data, axis=0)

        audio_data = audio_data.flatten()

        # Fade out end of clip (0.2s for effects)
        fade_len = int(sampling_rate * 0.2)
        if len(audio_data) > fade_len:
            fade_window = np.linspace(1.0, 0.0, fade_len)
            audio_data[-fade_len:] *= fade_window

        # Normalize audio with headroom
        max_val = np.abs(audio_data).max()
        if max_val > 0:
            audio_data = (audio_data / (max_val + 1e-6)) * 0.9

        # Convert to 16-bit PCM with safety clamp
        audio_data = np.clip(audio_data * 32767, -32768, 32767).astype(np.int16)

        wav_buf = io.BytesIO()
        scipy.io.wavfile.write(wav_buf, rate=sampling_rate, data=audio_data)
        wav_buf.seek(0)

        audio_base64 = base64.b64encode(wav_buf.read()).decode('utf-8')

        supabase.table("processing_queue").update({"status": "completed"}).eq("id", job_id).execute()
        await update_status("free")
        return {"status": "success", "audio": audio_base64}

    except Exception as e:
        print(f"Generation error: {e}")
        await update_status("free")
        supabase.table("processing_queue").update({"status": "failed"}).eq("id", job_id).execute()
        raise HTTPException(status_code=500, detail=str(e))
