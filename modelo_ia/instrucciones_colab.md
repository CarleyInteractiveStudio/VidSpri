# VidSpri AI - Guía de Entrenamiento en Google Colab

Esta carpeta contiene las herramientas para descargar un dataset de 50,000 imágenes y entrenar un modelo propio de Pixel Art.

## Pasos para usar en Google Colab

1. **Abrir Colab:** Ve a [colab.research.google.com](https://colab.research.google.com).
2. **Subir archivos:** Sube los archivos de esta carpeta (`descargar_dataset.py` y `entrenar_modelo.py`) a tu sesión de Colab.
3. **Instalar Dependencias:**
   Ejecuta esta celda en Colab:
   ```python
   !pip install datasets tqdm pillow torch torchvision
   ```
4. **Descargar el Dataset (50,000 imágenes):**
   Ejecuta esta celda:
   ```python
   !python descargar_dataset.py
   ```
   *Nota: Esto descargará unos 50,000 archivos. Asegúrate de tener espacio en el disco de la sesión (unos 10-20GB).*

5. **Iniciar Entrenamiento:**
   Ejecuta:
   ```python
   !python entrenar_modelo.py
   ```

## Detalles Técnicos del Modelo
- **Resolución:** Optimizado para **32x32**.
- **Dataset:** Utiliza el dataset `juju/pixel-art` de Hugging Face.
- **Etiquetas:** Genera archivos `.txt` automáticos con descripciones para que el modelo aprenda a asociar palabras con imágenes.
- **Evita Duplicados:** Usa MD5 Hashing para asegurar que cada sprite descargado sea único.

## Consejos
- Si la sesión de Colab se cierra, los archivos descargados se borrarán a menos que montes Google Drive.
- Para usar Drive, añade esta celda al principio:
  ```python
  from google.colab import drive
  drive.mount('/content/drive')
  ```
  Y cambia `SAVE_DIR` en el script a `/content/drive/MyDrive/vidspri_dataset`.
