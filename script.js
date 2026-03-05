
document.addEventListener('DOMContentLoaded', () => {
    // --- Server URLs ---
    // Make sure to replace this with your actual Hugging Face Space URL
    const secretarioBaseUrl = 'https://carley1234-vidspri-secretario.hf.space';
    const joinQueueUrl = `${secretarioBaseUrl}/join`;
    const prioritizeUrl = `${secretarioBaseUrl}/prioritize`;
    const statusUrlBase = `${secretarioBaseUrl}/status/`;
    const processUrlBase = `${secretarioBaseUrl}/process/`;

    // --- Global State ---
    let extractedFrames = []; // Stores { id, blob } of frames from the video
    let currentJobId = null; // Stores the ID of the current processing job
    let statusPollInterval = null; // Stores the interval ID for polling

    // --- DOM Element Selection ---
    const mainMenu = document.getElementById('main-menu');
    const videoSection = document.getElementById('video-section');
    const videoSpriteBtn = document.getElementById('video-sprite-btn');
    const imageSpriteBtn = document.getElementById('image-sprite-btn');
    const soundGenerationBtn = document.getElementById('sound-generation-btn');
    const textToSpriteBtn = document.getElementById('text-to-sprite-btn');
    const spritePreviewBtn = document.getElementById('sprite-preview-btn');

    const form = document.getElementById('sprite-form');
    const videoFileInput = document.getElementById('video-file');
    const dragDropAreaVideo = document.getElementById('drag-drop-area-video');
    const videoPreviewContainer = document.getElementById('video-preview-container');
    const videoPreview = document.getElementById('video-preview');
    const markStartBtn = document.getElementById('mark-start-btn');
    const markEndBtn = document.getElementById('mark-end-btn');
    const framesInput = document.getElementById('frames');
    const fullVideoCheckbox = document.getElementById('full-video-checkbox');
    const timeRangeInputs = document.getElementById('time-range-inputs');
    const startTimeInput = document.getElementById('start-time');
    const endTimeInput = document.getElementById('end-time');

    const extractFramesBtn = document.getElementById('extract-frames-btn');
    const framePreviewContainer = document.getElementById('frame-preview-container');
    const framesOutput = document.getElementById('frames-output');
    const generateSpriteBtn = document.getElementById('generate-sprite-btn');

    const progressContainer = document.getElementById('progress-container');
    const progressText = document.getElementById('progress-text');
    const progressBarInner = document.getElementById('progress-bar-inner');

    const resultContainer = document.getElementById('result-container');
    const spriteImage = document.getElementById('sprite-image');
    const downloadLink = document.getElementById('download-link');
    const previewSpriteBtnResult = document.getElementById('preview-sprite-btn');

    const errorMessage = document.getElementById('error-message');
    const errorMessageParagraph = errorMessage.querySelector('p');

    // Priority Access UI
    const premiumCodeBtn = document.getElementById('premium-code-btn');
    const premiumModal = document.getElementById('premium-modal');
    const closePremiumBtn = premiumModal.querySelector('.close-premium-btn');
    const premiumCodeInput = document.getElementById('premium-code-input');
    const savePremiumCodeBtn = document.getElementById('save-premium-code-btn');
    const premiumStatus = document.getElementById('premium-status');


    // --- Core Logic ---

    // 1. User clicks "Generate Sprite from Video"
    videoSpriteBtn.addEventListener('click', () => {
        mainMenu.classList.add('hidden');
        videoSection.classList.remove('hidden');
        resetUI(); // Reset state when entering the section
    });

    // 2. User uploads a video and extracts frames
    extractFramesBtn.addEventListener('click', async () => {
        const videoFile = videoFileInput.files[0];
        if (!videoFile) {
            showError("Por favor, sube un archivo de video.");
            return;
        }

        hideAllSections();
        progressContainer.classList.remove('hidden');
        progressText.textContent = "Extrayendo fotogramas del video...";
        updateProgressBar(50);

        const frameCount = parseInt(framesInput.value, 10);
        let startTime = 0;
        let endTime = videoPreview.duration;

        if (!fullVideoCheckbox.checked) {
            startTime = parseFloat(startTimeInput.value);
            endTime = parseFloat(endTimeInput.value);
        }

        if (isNaN(startTime) || isNaN(endTime) || startTime >= endTime) {
            showError("El rango de tiempo seleccionado no es válido.");
            progressContainer.classList.add('hidden');
            videoSection.classList.remove('hidden');
            return;
        }

        try {
            const frames = await extractFramesFromVideo(videoFile, frameCount, startTime, endTime);
            extractedFrames = frames.map((blob, index) => ({ id: index, blob }));
            displayFramePreviews();
            framePreviewContainer.classList.remove('hidden');
        } catch (error) {
            showError(`Error al extraer fotogramas: ${error.message}`);
            videoSection.classList.remove('hidden');
        } finally {
            progressContainer.classList.add('hidden');
        }
    });

    // 3. User clicks "Remove Background and Generate Sprite"
    generateSpriteBtn.addEventListener('click', async () => {
        if (extractedFrames.length === 0) {
            showError("No hay fotogramas para procesar.");
            return;
        }

        hideAllSections();
        progressContainer.classList.remove('hidden');
        progressText.textContent = "Conectando con el servidor para unirse a la cola...";
        updateProgressBar(0);

        try {
            // Step 3.1: Join the queue
            const joinResponse = await fetch(joinQueueUrl, { method: 'POST' });
            if (!joinResponse.ok) throw new Error('No se pudo conectar con el servidor.');

            const joinData = await joinResponse.json();
            currentJobId = joinData.job_id;

            // Step 3.2: Start polling for status
            startPollingStatus(currentJobId);

        } catch (error) {
            showError(error.message);
            progressContainer.classList.add('hidden');
            framePreviewContainer.classList.remove('hidden'); // Show frames again on error
        }
    });

    // 4. Polling function to check job status
    function startPollingStatus(jobId) {
        if (statusPollInterval) clearInterval(statusPollInterval); // Clear any existing poll

        statusPollInterval = setInterval(async () => {
            try {
                const statusResponse = await fetch(`${statusUrlBase}${jobId}`);
                if (!statusResponse.ok) {
                    // If the server returns an error (e.g., 404), stop polling
                    throw new Error('El trabajo ya no existe o el servidor ha fallado.');
                }
                const statusData = await statusResponse.json();

                handleStatusUpdate(statusData);

            } catch (error) {
                stopPolling();
                showError(error.message);
            }
        }, 3000); // Poll every 3 seconds
    }

    function stopPolling() {
        if (statusPollInterval) {
            clearInterval(statusPollInterval);
            statusPollInterval = null;
        }
    }

    // 5. Handle different statuses received from the server
    async function handleStatusUpdate(data) {
        console.log("Status update received:", data);
        switch (data.status) {
            case 'queued':
                progressText.textContent = `En cola... Posición: #${data.position}`;
                updateProgressBar(5);
                break;

            case 'processing':
                 if (data.total_frames === 0) {
                    // This is the initial "processing" state, it's our turn.
                    stopPolling();
                    progressText.textContent = `¡Es tu turno! Enviando fotogramas para procesar...`;
                    updateProgressBar(10);
                    console.log(`Job ${currentJobId} is now processing. Sending frames...`);
                    await sendFramesForProcessing(currentJobId);
                    // After sending, start polling again to get progress updates
                    startPollingStatus(currentJobId);
                } else {
                    // This is a progress update during processing
                    const progress = data.total_frames > 0 ? (data.completed_frames / data.total_frames) * 100 : 15;
                    progressText.textContent = `Procesando... (${data.completed_frames}/${data.total_frames} fotogramas)`;
                    updateProgressBar(progress);
                }
                break;

            case 'completed':
                stopPolling();
                progressText.textContent = "Procesamiento completado. Creando la hoja de sprites...";
                updateProgressBar(100);

                const processedBlobs = data.result_frames.map(base64StringToBlob);

                await createSpriteSheet(processedBlobs);

                progressContainer.classList.add('hidden');
                resultContainer.classList.remove('hidden');
                break;

            case 'failed':
                stopPolling();
                showError("El procesamiento falló en el servidor. Por favor, inténtalo de nuevo.");
                progressContainer.classList.add('hidden');
                break;
        }
    }

    // 6. Send frames to the '/process' endpoint
    async function sendFramesForProcessing(jobId) {
        const formData = new FormData();
        extractedFrames.forEach(frameData => {
            formData.append('images', frameData.blob, `frame_${frameData.id}.png`);
        });

        try {
            const processResponse = await fetch(`${processUrlBase}${jobId}`, {
                method: 'POST',
                body: formData,
            });

            if (!processResponse.ok) {
                let errorMsg = 'Error al enviar fotogramas al servidor.';
                try {
                    const errorData = await processResponse.json();
                    errorMsg = errorData.detail || errorMsg;
                } catch (e) {
                    console.error("Could not parse error response", e);
                }
                throw new Error(errorMsg);
            }
            // If successful, the polling will now start showing 'progress' updates
        } catch (error) {
            stopPolling();
            showError(error.message);
        }
    }

    // --- Priority Code UI Logic ---
    premiumCodeBtn.addEventListener('click', () => {
        premiumModal.classList.remove('hidden');
        const savedCode = localStorage.getItem('vidspri_priority_code');
        premiumCodeInput.value = savedCode || '';
    });

    closePremiumBtn.addEventListener('click', () => {
        premiumModal.classList.add('hidden');
    });

    savePremiumCodeBtn.addEventListener('click', async () => {
        const code = premiumCodeInput.value.trim();

        if (!currentJobId) {
            alert("Para aplicar un código, primero debes iniciar un trabajo (subir un video y hacer clic en 'Generar Sprite').");
            return;
        }

        if (!code) {
             alert("Por favor, introduce un código.");
             return;
        }

        savePremiumCodeBtn.disabled = true;
        savePremiumCodeBtn.textContent = 'Verificando...';

        try {
            const response = await fetch(prioritizeUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ job_id: currentJobId, code: code })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.detail || 'Código no válido.');
            }

            // On success
            localStorage.setItem('vidspri_priority_code', code);
            premiumStatus.textContent = 'PRIORITARIO';
            alert(`¡Éxito! Tu nueva posición en la cola es #${result.new_position}.`);
            progressText.textContent = `¡Prioridad aplicada! Nueva posición: #${result.new_position}`;
            premiumModal.classList.add('hidden');

        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            savePremiumCodeBtn.disabled = false;
            savePremiumCodeBtn.textContent = 'Guardar Código';
        }
    });

    // --- UI Helper Functions ---
    function resetUI() {
        // Reset forms and previews
        form.reset();
        videoPreviewContainer.classList.add('hidden');
        dragDropAreaVideo.classList.remove('hidden');
        framePreviewContainer.classList.add('hidden');
        framesOutput.innerHTML = '';
        resultContainer.classList.add('hidden');
        errorMessage.classList.add('hidden');
        progressContainer.classList.add('hidden');

        // Reset state
        extractedFrames = [];
        currentJobId = null;
        stopPolling();

        // Reset priority status display
        const savedCode = localStorage.getItem('vidspri_priority_code');
        premiumStatus.textContent = savedCode ? 'PRIORITARIO' : 'ESTÁNDAR';
    }

    function hideAllSections() {
        // Hide all major UI sections to focus on progress or results
        mainMenu.classList.add('hidden');
        videoSection.classList.add('hidden');
        framePreviewContainer.classList.add('hidden');
        errorMessage.classList.add('hidden');
    }

    function showError(message) {
        errorMessageParagraph.textContent = `Lo sentimos, ha ocurrido un error: ${message}`;
        errorMessage.classList.remove('hidden');
        progressContainer.classList.add('hidden'); // Ensure progress is hidden on error
    }

    function updateProgressBar(percentage) {
        progressBarInner.style.width = `${percentage}%`;
    }

    function displayFramePreviews() {
        framesOutput.innerHTML = '';
        extractedFrames.forEach(frameData => {
            const frameContainer = document.createElement('div');
            frameContainer.className = 'frame-container';

            const img = document.createElement('img');
            img.src = URL.createObjectURL(frameData.blob);
            img.onload = () => URL.revokeObjectURL(img.src); // Clean up memory

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.onclick = () => {
                // Remove from state and DOM
                extractedFrames = extractedFrames.filter(f => f.id !== frameData.id);
                frameContainer.remove();
            };

            frameContainer.appendChild(img);
            frameContainer.appendChild(deleteBtn);
            framesOutput.appendChild(frameContainer);
        });
    }

    function base64StringToBlob(base64, type = 'image/png') {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: type });
    }

    // --- Video File Handling and Frame Extraction (largely unchanged) ---
    videoFileInput.addEventListener('change', () => {
        if (videoFileInput.files && videoFileInput.files[0]) {
            handleVideoFile(videoFileInput.files[0]);
        }
    });
    dragDropAreaVideo.addEventListener('click', () => videoFileInput.click());
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dragDropAreaVideo.addEventListener(eventName, e => {
            e.preventDefault();
            e.stopPropagation();
            if (['dragenter', 'dragover'].includes(eventName)) {
                 dragDropAreaVideo.classList.add('drag-over');
            } else {
                 dragDropAreaVideo.classList.remove('drag-over');
            }
        }, false);
    });
    dragDropAreaVideo.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            videoFileInput.files = files;
            handleVideoFile(files[0]);
        }
    });

    function handleVideoFile(file) {
        if (file && file.type.startsWith('video/')) {
            const videoURL = URL.createObjectURL(file);
            videoPreview.src = videoURL;
            videoPreview.load();
            videoPreviewContainer.classList.remove('hidden');
            dragDropAreaVideo.classList.add('hidden');
        } else {
            showError('Por favor, selecciona un archivo de video válido.');
            videoPreviewContainer.classList.add('hidden');
            dragDropAreaVideo.classList.remove('hidden');
        }
    }

    markStartBtn.addEventListener('click', () => {
        startTimeInput.value = videoPreview.currentTime.toFixed(2);
        fullVideoCheckbox.checked = false;
        timeRangeInputs.classList.remove('hidden');
    });

    markEndBtn.addEventListener('click', () => {
        endTimeInput.value = videoPreview.currentTime.toFixed(2);
        fullVideoCheckbox.checked = false;
        timeRangeInputs.classList.remove('hidden');
    });

    fullVideoCheckbox.addEventListener('change', () => {
        timeRangeInputs.classList.toggle('hidden', fullVideoCheckbox.checked);
    });

    async function extractFramesFromVideo(videoFile, frameCount, startTime, endTime) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            const frames = [];

            video.src = URL.createObjectURL(videoFile);

            video.onloadedmetadata = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;

                const duration = endTime - startTime;
                const interval = duration / frameCount;
                let currentTime = startTime;

                let capturedFrames = 0;

                video.onseeked = async () => {
                    context.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
                    frames.push(blob);
                    capturedFrames++;

                    if (capturedFrames < frameCount) {
                        currentTime += interval;
                        video.currentTime = currentTime;
                    } else {
                        URL.revokeObjectURL(video.src); // Clean up
                        resolve(frames);
                    }
                };

                video.currentTime = currentTime; // Start the seeking process
            };

            video.onerror = () => {
                URL.revokeObjectURL(video.src);
                reject(new Error('Error al cargar el archivo de video.'));
            };
        });
    }

    async function createSpriteSheet(blobs) {
         return new Promise(async (resolve) => {
            const images = await Promise.all(blobs.map(blob => {
                return new Promise(resolveImg => {
                    const img = new Image();
                    img.onload = () => {
                        URL.revokeObjectURL(img.src); // Clean up memory
                        resolveImg(img);
                    };
                    img.src = URL.createObjectURL(blob);
                });
            }));

            if (images.length === 0) {
                spriteImage.src = '';
                downloadLink.href = '';
                return resolve();
            };

            const maxHeight = Math.max(...images.map(img => img.height));
            const totalWidth = images.reduce((sum, img) => sum + img.width, 0);

            const canvas = document.createElement('canvas');
            canvas.width = totalWidth;
            canvas.height = maxHeight;
            const context = canvas.getContext('2d');

            let currentX = 0;
            images.forEach(img => {
                context.drawImage(img, currentX, 0);
                currentX += img.width;
            });

            canvas.toBlob(blob => {
                const url = URL.createObjectURL(blob);
                spriteImage.src = url;
                downloadLink.href = url;
                resolve();
            }, 'image/png');
        });
    }

    // Initialize UI on load
    resetUI();
});
