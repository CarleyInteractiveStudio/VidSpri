# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Copy the entire project into the container
COPY . .

# Install the dependencies for the secretario application
RUN pip install --no-cache-dir -r secretario/requirements.txt

# Make port 8000 available to the world outside this container
EXPOSE 8000

# Run uvicorn as a Python module, pointing to the app object within the secretario package
CMD ["python", "-m", "uvicorn", "secretario.app:app", "--host", "0.0.0.0", "--port", "8000"]
