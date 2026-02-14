
import io
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from music_generator import generate_audio, load_model
from pydantic import BaseModel

# --- Lifespan Management for Model Loading ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages the application's lifespan. The model is loaded on startup.
    """
    print("Application startup...")
    load_model()
    yield
    # No cleanup is needed for this model.
    print("Application shutdown.")

app = FastAPI(lifespan=lifespan)

# --- CORS Configuration for Hugging Face ---
# Allow all origins to make this service accessible from any frontend.
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AudioRequest(BaseModel):
    text: str
    duration: int

@app.post("/generate-audio/")
async def generate_audio_endpoint(request: AudioRequest):
    """
    Accepts a text prompt and duration, generates audio, and returns it.
    """
    if not request.text or request.duration <= 0:
        raise HTTPException(status_code=400, detail="Text and a positive duration are required.")

    try:
        # Generate the audio file in memory
        audio_buffer = generate_audio(request.text, request.duration)
        if audio_buffer:
            # Return the audio file as a streaming response
            return StreamingResponse(audio_buffer, media_type="audio/wav")
        else:
            raise HTTPException(status_code=500, detail="Failed to generate audio.")
    except Exception as e:
        # Log the error for debugging purposes
        print(f"Error generating audio: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating audio: {str(e)}")

@app.get("/")
def read_root():
    """
    Root endpoint to confirm the server is running.
    """
    return {"status": "Music Generation Server is running"}
