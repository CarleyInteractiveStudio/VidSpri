import torch
from transformers import AutoProcessor, MusicgenForConditionalGeneration
import scipy.io.wavfile as wavfile
import io

# --- Model State ---
# Initialize model and processor as None. They will be loaded on startup.
model = None
processor = None

def load_model():
    """
    Loads the MusicGen model and processor and stores them in global variables.
    This function is intended to be called once at application startup.
    """
    global model, processor

    print("Loading model... This may take a moment.")
    processor = AutoProcessor.from_pretrained("facebook/musicgen-small")
    model = MusicgenForConditionalGeneration.from_pretrained("facebook/musicgen-small")
    print("Model loaded successfully.")
    # If you have a GPU, you can move the model to the GPU for faster inference
    # device = "cuda:0" if torch.cuda.is_available() else "cpu"
    # model.to(device)

def generate_audio(text: str, duration: int):
    """
    Generates audio from a text prompt using the pre-loaded MusicGen model.

    Args:
        text (str): The text prompt to generate audio from.
        duration (int): The duration of the audio to generate in seconds.

    Returns:
        io.BytesIO: A byte stream of the generated audio in WAV format, or None on error.
    """
    # Check if the model has been loaded
    if model is None or processor is None:
        print("Error: Model not loaded. Please call load_model() first.")
        return None

    try:
        inputs = processor(
            text=[text],
            padding=True,
            return_tensors="pt",
        )

        # Calculate max_new_tokens based on a heuristic (approx. 50 tokens per second of audio)
        max_new_tokens = int(duration * 50)

        audio_values = model.generate(**inputs, max_new_tokens=max_new_tokens)

        # --- Convert to WAV format ---
        sampling_rate = model.config.audio_encoder.sampling_rate
        audio_waveform = audio_values.cpu().numpy().squeeze()

        # Create an in-memory byte stream for the WAV file
        wav_buffer = io.BytesIO()
        wavfile.write(wav_buffer, rate=sampling_rate, data=audio_waveform)
        # Rewind the buffer to the beginning so it can be read
        wav_buffer.seek(0)

        return wav_buffer

    except Exception as e:
        # It's good practice to handle potential errors during model inference
        print(f"Error during audio generation: {e}")
        return None
