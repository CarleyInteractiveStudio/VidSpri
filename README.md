# VidSpri - Proyecto de Conversión de Video a Sprite Sheets

Este proyecto está dividido en tres componentes principales para su despliegue:

1. **Frontend (Directorio Raíz)**:
   - Aloja la interfaz web estática en GitHub Pages.
   - Utiliza `script.js` para coordinar las peticiones entre los servidores.

2. **Servidor Secretario (`/secretario`)**:
   - Backend encargado de gestionar la cola de trabajos y la base de datos de usuarios prioritarios.
   - Despliegue: Copiar el contenido de esta carpeta a la raíz de un Space de Hugging Face configurado con **Docker**.

3. **Servidor Especialista (`/especialista`)**:
   - Backend especializado en el procesamiento de imágenes y eliminación de fondos mediante IA (`rembg`).
   - Despliegue: Copiar el contenido de esta carpeta a la raíz de un Space de Hugging Face configurado con **Docker**.

## Instrucciones de Despliegue en Hugging Face
Para que los servidores funcionen en Hugging Face Spaces, asegúrate de:
- Usar el SDK **Docker**.
- Exponer el puerto **7860**.
- Copiar los archivos directamente en la raíz de sus respectivos repositorios de Space.
