import os
import io
import asyncio
import base64
import datetime
import torch
import numpy as np
from PIL import Image
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from diffusers import AnimateDiffVideoToVideoPipeline, MotionAdapter, EulerDiscreteScheduler
from huggingface_hub import hf_hub_download
from safetensors.torch import load_file
from supabase import create_client, Client
import uvicorn

# --- Supabase Configuration ---
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://tladrluezsmmhjbhupgb.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "sb_publishable_zb8TGeURLnafHWDffG9DMg_PtFO_kmv")
SERVER_ID = os.environ.get("SERVER_ID", "animador-worker")
SERVER_URL = os.environ.get("SERVER_URL", "https://carley1234-animacion.hf.space")
SERVICE_TYPE = "animacion"

print(f"[{datetime.datetime.now()}] Initializing Supabase Client with URL: {SUPABASE_URL}", flush=True)
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"[{datetime.datetime.now()}] CRITICAL: Failed to initialize Supabase: {e}", flush=True)
    supabase = None

# --- Model Configuration ---
device = "cpu"
dtype = torch.float32
step = 4
repo = "ByteDance/AnimateDiff-Lightning"
ckpt = f"animatediff_lightning_{step}step_diffusers.safetensors"
anime_base = "frankjoshua/toonyou_beta6"

pipe = None
load_error = None
is_processing = False

def load_models():
    global pipe, load_error
    try:
        torch.set_num_threads(2)
        print(f"[{datetime.datetime.now()}] Loading AnimateDiff-Lightning Video-to-Video with {anime_base}...", flush=True)

        adapter = MotionAdapter().to(device, dtype)
        adapter.load_state_dict(load_file(hf_hub_download(repo, ckpt), device=device))

        pipe = AnimateDiffVideoToVideoPipeline.from_pretrained(
            anime_base,
            motion_adapter=adapter,
            torch_dtype=dtype
        ).to(device)

        pipe.scheduler = EulerDiscreteScheduler.from_config(
            pipe.scheduler.config,
            timestep_spacing="trailing",
            beta_schedule="linear"
        )

        pipe.enable_attention_slicing()

        print(f"[{datetime.datetime.now()}] Model loaded successfully.", flush=True)
        load_error = None
    except Exception as e:
        load_error = str(e)
        print(f"[{datetime.datetime.now()}] Error loading models: {e}", flush=True)

async def update_status(status: str = None):
    global is_processing
    if not supabase: return
    try:
        if status:
            is_processing = (status == "busy")
        current_status = "busy" if is_processing else "free"

        data = {
            "id": SERVER_ID,
            "url": SERVER_URL,
            "status": current_status,
            "service_type": "video",
            "last_heartbeat": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        supabase.table("server_status").upsert(data).execute()
    except Exception as e:
        print(f"[{datetime.datetime.now()}] Error updating status: {e}", flush=True)

async def heartbeat_loop():
    while True:
        await update_status()
        await asyncio.sleep(20)

@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"[{datetime.datetime.now()}] Starting VidSpri Animation Worker...", flush=True)
    asyncio.create_task(asyncio.to_thread(load_models))
    if supabase:
        await update_status("free")
        asyncio.create_task(heartbeat_loop())
    yield
    print(f"[{datetime.datetime.now()}] Shutting down...", flush=True)

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    model_status = "loaded" if pipe else ("error: " + load_error if load_error else "loading")
    return {
        "message": "VidSpri Animation Worker is running",
        "status": "ok",
        "model_status": model_status,
        "device": device
    }

@app.post("/animate/{job_id}")
async def animate_image(
    job_id: str,
    file: UploadFile = File(...),
    prompt: str = Form("anime character, high quality, masterpiece, moving"),
    num_frames: int = Form(16)
):
    global pipe, load_error, is_processing

    if is_processing:
        raise HTTPException(status_code=503, detail="Server is busy")

    if not pipe:
        msg = f"Model not loaded yet. Error: {load_error}" if load_error else "Model is still loading..."
        raise HTTPException(status_code=500, detail=msg)

    await update_status("busy")
    supabase.table("processing_queue").update({"status": "processing", "total_frames": num_frames}).eq("id", job_id).execute()

    try:
        contents = await file.read()
        input_image = Image.open(io.BytesIO(contents)).convert("RGB")
        input_image = input_image.resize((256, 256))
        video_input = [input_image] * num_frames

        def run_inference():
            with torch.no_grad():
                torch.set_num_threads(2)
                output = pipe(
                    video=video_input,
                    prompt=prompt,
                    negative_prompt="bad quality, blurry, distorted, lowres, ugly, deformed",
                    guidance_scale=1.5,
                    num_inference_steps=step,
                    strength=0.6,
                )
                return output.frames[0]

        frames = await asyncio.to_thread(run_inference)

        processed_frames = []
        for i, frame in enumerate(frames):
            buffered = io.BytesIO()
            frame.save(buffered, format="PNG")
            img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
            processed_frames.append(img_str)

            if (i + 1) % 2 == 0 or (i + 1) == len(frames):
                supabase.table("processing_queue").update({
                    "processed_frames": i + 1,
                    "last_heartbeat": datetime.datetime.now(datetime.timezone.utc).isoformat()
                }).eq("id", job_id).execute()

        supabase.table("processing_queue").update({"status": "completed"}).eq("id", job_id).execute()
        await update_status("free")

        return {"status": "success", "frames": processed_frames}

    except Exception as e:
        print(f"[{datetime.datetime.now()}] Animation error: {e}", flush=True)
        await update_status("free")
        supabase.table("processing_queue").update({"status": "failed"}).eq("id", job_id).execute()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)
