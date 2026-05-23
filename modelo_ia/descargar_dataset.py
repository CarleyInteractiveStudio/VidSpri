import os
import hashlib
import io
from tqdm import tqdm
from PIL import Image
try:
    from datasets import load_dataset
except ImportError:
    print("Error: La librería 'datasets' no está instalada. Ejecuta: pip install datasets")
    exit(1)

# --- CONFIGURACIÓN ---
DATASET_NAME = "juju/pixel-art" # Dataset recomendado de alta calidad
SAVE_DIR = "vidspri_dataset"
MAX_SAMPLES = 50000
hashes = set()

def prepare_environment():
    if not os.path.exists(SAVE_DIR):
        os.makedirs(SAVE_DIR)
        print(f"Carpeta '{SAVE_DIR}' creada.")

def download_dataset():
    print(f"🚀 Iniciando descarga masiva desde {DATASET_NAME}...")

    # Cargamos el dataset en modo streaming para ahorrar RAM en Colab
    try:
        ds = load_dataset(DATASET_NAME, split="train", streaming=True)
    except Exception as e:
        print(f"Error al cargar el dataset: {e}")
        return

    count = 0
    pbar = tqdm(total=MAX_SAMPLES, desc="Descargando sprites")

    for item in ds:
        if count >= MAX_SAMPLES:
            break

        try:
            # Extraer imagen y descripción
            img = item['image']
            caption = item.get('text', 'pixel art character sprite')

            # Verificación de duplicados exactos (MD5)
            img_byte_arr = io.BytesIO()
            img.save(img_byte_arr, format='PNG')
            img_hash = hashlib.md5(img_byte_arr.getvalue()).hexdigest()

            if img_hash not in hashes:
                hashes.add(img_hash)

                # Guardar imagen con nombre correlativo
                img_filename = f"sprite_{count:05d}.png"
                img.save(os.path.join(SAVE_DIR, img_filename))

                # Guardar etiqueta (Label) para el entrenamiento
                # Agregamos tags consistentes para que el modelo aprenda el estilo
                clean_caption = caption.replace("\n", " ").strip()
                with open(os.path.join(SAVE_DIR, f"sprite_{count:05d}.txt"), "w") as f:
                    f.write(f"{clean_caption}, pixel art, animation frame, detailed sprite")

                count += 1
                pbar.update(1)
        except Exception as e:
            # Si hay un error con una imagen, saltamos a la siguiente
            continue

    pbar.close()
    print(f"\n✅ ¡Proceso completado! Se han guardado {count} pares de imagen/texto en /{SAVE_DIR}")

if __name__ == "__main__":
    prepare_environment()
    download_dataset()
