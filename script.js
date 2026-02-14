document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selection ---
    const mainMenu = document.getElementById('main-menu');
    const videoSection = document.getElementById('video-section');
    const videoSpriteBtn = document.getElementById('video-sprite-btn');
    const imageSpriteBtn = document.getElementById('image-sprite-btn');
    const soundGenerationBtn = document.getElementById('sound-generation-btn');
    const textToSpriteBtn = document.getElementById('text-to-sprite-btn');
    const spritePreviewBtn = document.getElementById('sprite-preview-btn');

    // Text to Sprite Section elements
    const textToSpriteSection = document.getElementById('text-to-sprite-section');
    const videoTypeButtons = document.querySelectorAll('.video-type-btn');
    const textPrompt = document.getElementById('text-prompt');
    const videoInspirationButtonsContainer = document.getElementById('video-inspiration-buttons');
    const generateVideoBtn = document.getElementById('generate-video-btn');

    // Sound Generation Section elements
    const soundGenerationSection = document.getElementById('sound-generation-section');
    const soundTypeButtons = document.querySelectorAll('.sound-type-btn');
    const soundPrompt = document.getElementById('sound-prompt');
    const inspirationButtonsContainer = document.getElementById('inspiration-buttons');
    const generateSoundBtn = document.getElementById('generate-sound-btn');
    const audioResultContainer = document.getElementById('audio-result-container');
    const generationInfo = document.getElementById('generation-info');
    const audioPlayer = document.getElementById('audio-player');


    // Image Animation Section elements
    const imageAnimationSection = document.getElementById('image-animation-section');
    const animationForm = document.getElementById('animation-form');
    const dragDropArea = document.getElementById('drag-drop-area');
    const imageFileInput = document.getElementById('image-file');
    const imagePreviewContainerAnim = document.getElementById('image-preview-container-anim');
    const imagePreviewAnim = document.getElementById('image-preview-anim');

    const form = document.getElementById('sprite-form');
    const videoFileInput = document.getElementById('video-file');
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
    const errorMessage = document.getElementById('error-message');
    const errorMessageParagraph = errorMessage.querySelector('p');
    const serverMessage = document.getElementById('server-message');
    const bannerAdContainer = document.getElementById('banner-ad-container');

    // Premium Modal elements
    const premiumModal = document.getElementById('premium-modal');
    const premiumCodeBtn = document.getElementById('premium-code-btn');
    const closePremiumBtn = document.querySelector('.close-premium-btn');
    const premiumCodeInput = document.getElementById('premium-code-input');
    const savePremiumCodeBtn = document.getElementById('save-premium-code-btn');
    const premiumStatus = document.getElementById('premium-status');

    // Unavailable Feature Modal elements
    const unavailableModal = document.getElementById('unavailable-modal');
    const closeUnavailableBtn = document.querySelector('.close-unavailable-btn');

    // Share/Donate Modal elements
    const shareModal = document.getElementById('share-modal');
    const closeShareBtn = document.querySelector('.close-share-btn');
    const shareAppBtn = document.getElementById('share-app-btn');

    // Download App Modal elements
    const downloadAppModal = document.getElementById('download-app-modal');
    const closeDownloadBtn = document.querySelector('.close-download-btn');
    const downloadBtnHeader = document.getElementById('download-app-btn-header');
    const downloadBtnResult = document.getElementById('download-app-btn-result');

    // Premium Feature Modal elements
    const premiumFeatureModal = document.getElementById('premium-feature-modal');
    const closePremiumFeatureBtn = document.querySelector('.close-premium-feature-btn');
    const supportBtn = document.getElementById('support-btn');

    // Footer buttons
    const donateBtnFooter = document.getElementById('donate-btn-footer');
    const shareBtnFooter = document.getElementById('share-btn-footer');

    let extractedFrames = []; // To store the extracted frame blobs

    const dragDropAreaVideo = document.getElementById('drag-drop-area-video');

    // Sprite Previewer Logic ---
    const spritePreviewSection = document.getElementById('sprite-preview-section');
    const spriteFileInput = document.getElementById('sprite-file');
    const dragDropAreaSprite = document.getElementById('drag-drop-area-sprite');
    const spriteFramesInput = document.getElementById('sprite-frames');
    const detectFramesBtn = document.getElementById('detect-frames-btn');
    const spriteSpeedInput = document.getElementById('sprite-speed');
    const speedValue = document.getElementById('speed-value');
    const spriteCanvas = document.getElementById('sprite-canvas');
    const playPauseBtn = document.getElementById('play-pause-animation-btn');
    const spriteCanvasContainer = document.getElementById('sprite-canvas-container');
    const downloadPreviewLink = document.getElementById('download-preview-link');
    const infoBubble = document.getElementById('sprite-info-bubble');
    const spriteDimensionsSpan = document.getElementById('sprite-dimensions');
    const spriteFrameCountSpan = document.getElementById('sprite-frame-count');


    // --- URLs de Servidores ---
    const serverBaseUrl = 'https://carley1234-vidspri.hf.space';
    const backgroundRemovalUrl = `${serverBaseUrl}/remove-background/`;
    const applyCodeUrl = `${serverBaseUrl}/apply-code`;
    const statusUrlBase = `${serverBaseUrl}/status/`;
    // URL del servidor para generar audio
    const audioGenerationUrl = 'https://TU-ESPACIO-DE-MUSICA-EN-HF.hf.space/generate-audio/';


    // --- App Detection Logic ---
    function showDownloadButtons() {
        // This function is called if the app is running in a web browser
        const buttons = document.querySelectorAll('.download-btn');
        buttons.forEach(btn => btn.classList.remove('hidden-by-default'));
    }

    if (typeof window.esAppNativa === 'undefined') {
        showDownloadButtons();
    }

    // --- Main Menu Logic ---

    if (videoSpriteBtn) {
        videoSpriteBtn.addEventListener('click', () => {
            mainMenu.classList.add('hidden');
            videoSection.classList.remove('hidden');
        });
    }

    if (imageSpriteBtn) {
        imageSpriteBtn.addEventListener('click', () => {
            mainMenu.classList.add('hidden');
            imageAnimationSection.classList.remove('hidden');
        });
    }

    if (soundGenerationBtn) {
        soundGenerationBtn.addEventListener('click', () => {
            mainMenu.classList.add('hidden');
            soundGenerationSection.classList.remove('hidden');
            updateInspirationButtons(); // Initialize with default selection
        });
    }

    if (textToSpriteBtn) {
        textToSpriteBtn.addEventListener('click', () => {
            mainMenu.classList.add('hidden');
            textToSpriteSection.classList.remove('hidden');
            updateVideoInspirationButtons(); // Initialize with default selection
        });
    }

    if (spritePreviewBtn) {
        spritePreviewBtn.addEventListener('click', () => {
            mainMenu.classList.add('hidden');
            spritePreviewSection.classList.remove('hidden');
        });
    }

    // --- Text to Sprite Logic ---

    const videoInspirationData = {
        effect: [
            { text: 'Explosión de Fuego', prompt: 'Una explosión de fuego realista, con humo y chispas.' },
            { text: 'Ataque de Rayo', prompt: 'Un rayo de energía azul brillante que golpea el suelo.' },
            { text: 'Aura Mágica', prompt: 'Un aura de energía pulsante de color púrpura alrededor de un objeto.' }
        ],
        animation: [
            { text: 'Correr a la Derecha', prompt: 'Un personaje de perfil corriendo hacia la derecha, estilo pixel art.' },
            { text: 'Salto', prompt: 'Un personaje saltando en el sitio, con anticipación y aterrizaje.' },
            { text: 'Ataque con Espada', prompt: 'Un personaje realizando un corte con la espada de izquierda a derecha.' }
        ]
    };

    let currentVideoType = 'effect'; // Default type

    function updateVideoInspirationButtons() {
        videoInspirationButtonsContainer.innerHTML = '';
        const buttonsData = videoInspirationData[currentVideoType];
        buttonsData.forEach(data => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = data.text;
            button.addEventListener('click', () => {
                textPrompt.value = data.prompt;
            });
            videoInspirationButtonsContainer.appendChild(button);
        });
    }

    videoTypeButtons.forEach(button => {
        button.addEventListener('click', () => {
            videoTypeButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentVideoType = button.dataset.type;
            updateVideoInspirationButtons();
        });
    });

    generateVideoBtn.addEventListener('click', () => {
        if (!textPrompt.value.trim()) {
            showError("Por favor, describe el video que quieres generar.");
            return;
        }

        // --- Simulation Logic ---
        hideAllSections();
        progressContainer.classList.remove('hidden');
        progressText.textContent = "Generando video con IA...";
        updateProgressBar(0);

        const duration = currentVideoType === 'effect' ? 3 : 5;
        // This is just for show, the actual video will have its own duration.

        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            updateProgressBar(progress);
            if (progress >= 100) {
                clearInterval(interval);
                progressContainer.classList.add('hidden');

                // --- Hand over to the existing video processing flow ---
                // For now, using a placeholder. Replace with a real video URL when backend is ready.
                // Using a generic placeholder video.
                const sampleVideoUrl = 'https://www.w3schools.com/html/mov_bbb.mp4';
                videoPreview.src = sampleVideoUrl;
                videoPreview.load();

                // Show the video processing section
                videoSection.classList.remove('hidden');
                videoPreviewContainer.classList.remove('hidden');
                dragDropAreaVideo.querySelector('p').style.display = 'none';
            }
        }, 300);
    });


    // --- Sound Generation Logic ---

    const inspirationData = {
        effect: [
            { text: 'Disparo Láser', prompt: 'Sonido de un disparo láser de ciencia ficción, agudo y rápido.' },
            { text: 'Explosión', prompt: 'Una gran explosión retumbante con eco.' },
            { text: 'Pasos en Grava', prompt: 'Sonido claro de pasos lentos caminando sobre grava.' },
            { text: 'Puerta Chirriante', prompt: 'Una puerta de madera vieja y pesada que chirría al abrirse lentamente.' },
            { text: 'Moneda Cayendo', prompt: 'Sonido metálico de una moneda cayendo sobre un suelo de baldosas.' }
        ],
        music: [
            { text: 'Melodía Relajante', prompt: 'Una melodía de piano suave y lenta, perfecta para relajarse o estudiar.' },
            { text: 'Ritmo de Acción', prompt: 'Música de percusión electrónica, enérgica y rápida, para una escena de acción.' },
            { text: 'Sonido de Bosque', prompt: 'Ambiente de un bosque tranquilo con canto de pájaros y un arroyo cercano.' },
            { text: 'Ambiente de Ciudad', prompt: 'Sonido de fondo de una ciudad bulliciosa con tráfico y sirenas lejanas.' },
            { text: 'Música de Suspenso', prompt: 'Una melodía de cuerdas de bajo tono, lenta y llena de suspenso.' }
        ]
    };

    let currentSoundType = 'effect'; // Default type

    function updateInspirationButtons() {
        inspirationButtonsContainer.innerHTML = '';
        const buttonsData = inspirationData[currentSoundType];
        buttonsData.forEach(data => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = data.text;
            button.addEventListener('click', () => {
                soundPrompt.value = data.prompt;
            });
            inspirationButtonsContainer.appendChild(button);
        });
    }

    soundTypeButtons.forEach(button => {
        button.addEventListener('click', () => {
            soundTypeButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentSoundType = button.dataset.type;
            updateInspirationButtons();
        });
    });

    generateSoundBtn.addEventListener('click', async () => {
        const prompt = soundPrompt.value.trim();
        if (!prompt) {
            showError("Por favor, describe el sonido que quieres generar.");
            return;
        }

        hideAllSections();
        progressContainer.classList.remove('hidden');
        progressText.textContent = "Conectando con el servidor...";
        updateProgressBar(10); // Initial progress

        const duration = currentSoundType === 'effect' ? 5 : 30;
        generationInfo.textContent = `Generando audio... (Duración máxima: ${duration}s). Esto puede tardar un momento.`;

        try {
            progressText.textContent = "Generando audio con IA...";
            updateProgressBar(50);

            const response = await fetch(audioGenerationUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: prompt,
                    duration: duration,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Error desconocido del servidor.' }));
                throw new Error(errorData.detail);
            }

            progressText.textContent = "Cargando audio...";
            updateProgressBar(90);

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            audioPlayer.src = audioUrl;

            updateProgressBar(100);
            progressContainer.classList.add('hidden');
            audioResultContainer.classList.remove('hidden');
            soundGenerationSection.classList.remove('hidden');

        } catch (error) {
            showError(`No se pudo generar el audio: ${error.message}`);
            // Show the sound generation section again on error
            soundGenerationSection.classList.remove('hidden');
        }
    });


    // --- Image Animation Logic ---

    // Function to handle file selection (from both dialog and drop)
    function handleImageFile(file) {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreviewAnim.src = e.target.result;
                imagePreviewContainerAnim.classList.remove('hidden');
                dragDropArea.classList.add('hidden'); // Hide the whole drop area
            };
            reader.readAsDataURL(file);
        } else {
            showError('Por favor, selecciona un archivo de imagen válido (.png, .jpg).');
            // Reset if invalid file
            imagePreviewContainerAnim.classList.add('hidden');
            dragDropArea.classList.remove('hidden');
        }
    }

    // Make the drag-drop area clickable to open the file dialog
    dragDropArea.addEventListener('click', () => {
        imageFileInput.click();
    });

    // Listen for file selection from the dialog
    imageFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleImageFile(e.target.files[0]);
        }
    });

    // Add drag-and-drop event listeners
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dragDropArea.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dragDropArea.addEventListener(eventName, () => {
            dragDropArea.classList.add('drag-over');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dragDropArea.addEventListener(eventName, () => {
            dragDropArea.classList.remove('drag-over');
        }, false);
    });

    dragDropArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            // Corregimos el bug: Asignamos el archivo arrastrado al input de archivo
            imageFileInput.files = files;
            // Ahora llamamos a la función que muestra la vista previa
            handleImageFile(files[0]);
        }
    });

    document.getElementById('generate-animation-btn').addEventListener('click', () => {
        premiumFeatureModal.classList.remove('hidden');
    });

    // --- Premium Code Logic ---

    premiumCodeBtn.addEventListener('click', () => {
        premiumModal.classList.remove('hidden');
    });

    closePremiumBtn.addEventListener('click', () => {
        premiumModal.classList.add('hidden');
    });

    savePremiumCodeBtn.addEventListener('click', () => {
        const code = premiumCodeInput.value.trim();
        if (code) {
            localStorage.setItem('vidspri_premium_code', code);
            updatePremiumStatus();
            alert('Código premium guardado.');
            premiumModal.classList.add('hidden');
        } else {
            localStorage.removeItem('vidspri_premium_code');
            updatePremiumStatus();
            alert('Código premium eliminado.');
        }
    });

    function updatePremiumStatus() {
        const savedCode = localStorage.getItem('vidspri_premium_code');
        if (savedCode) {
            premiumStatus.textContent = 'PRIORITARIO';
            premiumStatus.style.color = '#03dac6'; // Match the theme color
        } else {
            premiumStatus.textContent = 'ESTÁNDAR';
            premiumStatus.style.color = '#b0b0b0';
        }
    }

    updatePremiumStatus();

    // --- Modal Logic ---

    function closeModalOnClickOutside(event) {
        if (event.target === premiumModal) {
            premiumModal.classList.add('hidden');
        }
        if (event.target === unavailableModal) {
            unavailableModal.classList.add('hidden');
        }
        if (event.target === shareModal) {
            shareModal.classList.add('hidden');
        }
        if (event.target === downloadAppModal) {
            downloadAppModal.classList.add('hidden');
        }
        if (event.target === premiumFeatureModal) {
            premiumFeatureModal.classList.add('hidden');
        }
    }

    window.addEventListener('click', closeModalOnClickOutside);

    closeUnavailableBtn.addEventListener('click', () => {
        unavailableModal.classList.add('hidden');
    });

    closeShareBtn.addEventListener('click', () => {
        shareModal.classList.add('hidden');
    });

    closeDownloadBtn.addEventListener('click', () => {
        downloadAppModal.classList.add('hidden');
    });

    closePremiumFeatureBtn.addEventListener('click', () => {
        premiumFeatureModal.classList.add('hidden');
    });

    downloadBtnHeader.addEventListener('click', () => {
        downloadAppModal.classList.remove('hidden');
    });

    if (downloadBtnResult) {
        downloadBtnResult.addEventListener('click', () => {
            downloadAppModal.classList.remove('hidden');
        });
    }

    if (downloadBtnHeader) {
        downloadBtnHeader.addEventListener('click', () => {
            downloadAppModal.classList.remove('hidden');
        });
    }

    supportBtn.addEventListener('click', () => {
        window.open('https://www.paypal.com/donate/?hosted_button_id=SF9TB2TJLYL96', '_blank');
    });

    // --- Footer Buttons Logic ---
    donateBtnFooter.addEventListener('click', (e) => {
        e.preventDefault();
        window.open('https://www.paypal.com/donate/?hosted_button_id=SF9TB2TJLYL96', '_blank');
    });

    shareBtnFooter.addEventListener('click', (e) => {
        e.preventDefault();
        shareAppBtn.click(); // Simulate a click on the existing share button
    });

    // --- Share Logic ---

    shareAppBtn.addEventListener('click', async () => {
        const shareData = {
            title: 'VidSpri - Video to Sprite',
            text: '¡Crea hojas de sprites a partir de videos con esta increíble app!',
            url: window.location.href
        };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                // Fallback for browsers that don't support Web Share API
                navigator.clipboard.writeText(shareData.url);
                alert('¡Enlace copiado al portapapeles!');
            }
        } catch (err) {
            console.error('Error al compartir:', err);
        }
    });

    // --- Video Processing Logic ---

    function handleVideoFile(file) {
        if (file && file.type.startsWith('video/')) {
            const videoURL = URL.createObjectURL(file);
            videoPreview.src = videoURL;
            videoPreview.load();
            videoPreviewContainer.classList.remove('hidden');
            // Hide the drag-drop text and show the preview instead
            dragDropAreaVideo.classList.add('hidden');
            framePreviewContainer.classList.add('hidden');
            resultContainer.classList.add('hidden');
        } else {
            showError('Por favor, selecciona un archivo de video válido.');
            videoPreviewContainer.classList.add('hidden');
            dragDropAreaVideo.classList.remove('hidden');
        }
    }

    videoFileInput.addEventListener('change', () => {
        if (videoFileInput.files && videoFileInput.files[0]) {
            handleVideoFile(videoFileInput.files[0]);
        }
    });

    // Add drag-and-drop for video
    dragDropAreaVideo.addEventListener('click', () => videoFileInput.click());

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dragDropAreaVideo.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dragDropAreaVideo.addEventListener(eventName, () => {
            dragDropAreaVideo.classList.add('drag-over');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dragDropAreaVideo.addEventListener(eventName, () => {
            dragDropAreaVideo.classList.remove('drag-over');
        }, false);
    });

    dragDropAreaVideo.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            videoFileInput.files = files; // Assign dropped file to input
            handleVideoFile(files[0]);
        }
    });

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

    form.addEventListener('submit', (event) => event.preventDefault());

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
            return;
        }

        try {
            const frames = await extractFramesFromVideo(videoFile, frameCount, startTime, endTime);
            extractedFrames = frames.map((blob, index) => ({ id: index, blob }));
            displayFramePreviews();
            framePreviewContainer.classList.remove('hidden');
        } catch (error) {
            showError(`Error al extraer fotogramas: ${error.message}`);
        } finally {
            progressContainer.classList.add('hidden');
        }
    });

    generateSpriteBtn.addEventListener('click', processFramesAndGenerateSpriteSheet);

    // --- Refactored Sprite Generation Function ---
    async function processFramesAndGenerateSpriteSheet() {
        if (extractedFrames.length === 0) {
            showError("No hay fotogramas para procesar.");
            return;
        }

        hideAllSections();
        progressContainer.classList.remove('hidden');
        serverMessage.classList.remove('hidden');
        bannerAdContainer.classList.remove('hidden');
        progressText.textContent = "Enviando fotogramas al servidor...";
        updateProgressBar(0);

        const formData = new FormData();
        extractedFrames.forEach(frameData => {
            formData.append('images', frameData.blob, `frame_${frameData.id}.png`);
        });

        try {
            // 1. Submit the job
            const response = await fetch(backgroundRemovalUrl, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Error al enviar el trabajo al servidor.' }));
                throw new Error(errorData.detail);
            }

            const jobData = await response.json();
            const jobId = jobData.job_id;

            progressText.textContent = `En cola en la posición #${jobData.queue_position}...`;

            // 2. Apply premium code if it exists
            const premiumCode = localStorage.getItem('vidspri_premium_code');
            if (premiumCode) {
                progressText.textContent = "Aplicando código prioritario...";
                const codeFormData = new FormData();
                codeFormData.append('job_id', jobId);
                codeFormData.append('code', premiumCode);

                const codeResponse = await fetch(applyCodeUrl, {
                    method: 'POST',
                    body: codeFormData
                });
                if (codeResponse.ok) {
                    const codeResult = await codeResponse.json();
                    progressText.textContent = `¡Éxito! Nueva posición en la cola: #${codeResult.new_queue_position}.`;
                } else {
                     progressText.textContent += " (El código no fue válido, continuando con prioridad estándar)";
                }
            }


            // 3. Poll for status
            await pollStatus(jobId);

        } catch (error) {
            showError(error.message);
             progressContainer.classList.add('hidden');
             serverMessage.classList.add('hidden');
             bannerAdContainer.classList.add('hidden');
        }
    }

    async function pollStatus(jobId) {
        const statusUrl = `${statusUrlBase}${jobId}`;
        const intervalId = setInterval(async () => {
            try {
                const response = await fetch(statusUrl);
                 if (!response.ok) {
                    // Stop polling on server error
                    clearInterval(intervalId);
                    showError(`Error al obtener el estado del trabajo.`);
                    return;
                }
                const data = await response.json();

                if (data.status === 'queued') {
                    progressText.textContent = `En cola en la posición #${data.queue_position}...`;
                    updateProgressBar(5); // Small progress for being queued
                } else if (data.status === 'processing') {
                    const progress = data.total_frames > 0 ? (data.completed_frames / data.total_frames) * 100 : 0;
                    progressText.textContent = `Procesando... (${data.completed_frames}/${data.total_frames} fotogramas completados)`;
                    updateProgressBar(progress);
                } else if (data.status === 'completed') {
                    clearInterval(intervalId);
                    progressText.textContent = "Trabajo completado. Creando la hoja de sprites...";
                    updateProgressBar(100);

                    // Decode base64 frames to blobs
                    const processedBlobs = data.frames.map(base64String => {
                        const byteCharacters = atob(base64String);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) {
                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        return new Blob([byteArray], { type: 'image/png' });
                    });

                    await createSpriteSheet(processedBlobs);
                    resultContainer.classList.remove('hidden');
                    shareModal.classList.remove('hidden');
                    progressContainer.classList.add('hidden');
                    serverMessage.classList.add('hidden');
                    bannerAdContainer.classList.add('hidden');
                }
            } catch (error) {
                 clearInterval(intervalId);
                 showError(error.message);
                 progressContainer.classList.add('hidden');
                 serverMessage.classList.add('hidden');
                 bannerAdContainer.classList.add('hidden');
            }
        }, 3000); // Poll every 3 seconds
    }


    // --- Helper Functions ---

    function hideAllSections() {
        errorMessage.classList.add('hidden');
        resultContainer.classList.add('hidden');
        framePreviewContainer.classList.add('hidden');
        soundGenerationSection.classList.add('hidden');
        videoSection.classList.add('hidden');
        imageAnimationSection.classList.add('hidden');
        textToSpriteSection.classList.add('hidden');
    }

    function showError(message) {
        errorMessageParagraph.textContent = `Lo sentimos, ha ocurrido un error: ${message}`;
        errorMessage.classList.remove('hidden');
        progressContainer.classList.add('hidden');
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

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.onclick = () => {
                extractedFrames = extractedFrames.filter(f => f.id !== frameData.id);
                frameContainer.remove();
            };

            frameContainer.appendChild(img);
            frameContainer.appendChild(deleteBtn);
            framesOutput.appendChild(frameContainer);
        });
    }

    async function extractFramesFromVideo(videoFile, frameCount, startTime, endTime) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            const frames = [];
            const duration = endTime - startTime;
            const interval = duration / (frameCount > 1 ? frameCount - 1 : 1);

            video.muted = true;

            video.addEventListener('loadedmetadata', () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                video.currentTime = startTime;
            });

            video.addEventListener('seeked', () => {
                context.clearRect(0, 0, canvas.width, canvas.height);
                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                canvas.toBlob(blob => {
                    frames.push(blob);

                    if (frames.length < frameCount) {
                        const nextTime = video.currentTime + interval;
                        video.currentTime = Math.min(nextTime, endTime);
                    } else {
                        resolve(frames);
                    }
                }, 'image/png');
            });

            video.addEventListener('error', (e) => reject(new Error('Error al cargar el video.')));

            video.src = URL.createObjectURL(videoFile);
            video.load();
        });
    }

    async function createSpriteSheet(blobs) {
         return new Promise(async (resolve) => {
            const images = await Promise.all(blobs.map(blob => {
                return new Promise(resolveImg => {
                    const img = new Image();
                    img.onload = () => resolveImg(img);
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

    // --- Sprite Previewer Logic ---

    window.addEventListener('load-generated-sprite', () => {
        const url = sessionStorage.getItem('previewSpriteURL');
        const frameCount = sessionStorage.getItem('previewSpriteFrameCount');

        if (url && frameCount) {
            spriteImageSrc = url;
            spriteFramesInput.value = frameCount;

            // Hide the drag & drop and show the animation
            dragDropAreaSprite.classList.add('hidden');
            spriteCanvasContainer.classList.remove('hidden');

            // Update and show the download link
            downloadPreviewLink.href = spriteImageSrc;
            downloadPreviewLink.download = "generated_sprite.png";
            downloadPreviewLink.style.display = 'inline-block';

            stopAnimation();
            animationState.image = new Image();
            animationState.image.onload = () => {
                // Update Info Bubble
                spriteDimensionsSpan.textContent = `${animationState.image.width}px x ${animationState.image.height}px`;
                spriteFrameCountSpan.textContent = frameCount;
                infoBubble.classList.remove('hidden');

                drawFrame(0); // Show the first frame immediately
                startAnimation(); // Optionally, start playing right away
            };
            animationState.image.src = spriteImageSrc;
        }
    });

    let spriteImageSrc = null;
    let animationState = {
        isPlaying: false,
        frame: 0,
        fps: 12,
        then: 0,
        animationFrameId: null,
        image: null
    };

if (dragDropAreaSprite) {
    dragDropAreaSprite.addEventListener('click', () => spriteFileInput.click());

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dragDropAreaSprite.addEventListener(eventName, e => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });
    ['dragenter', 'dragover'].forEach(eventName => {
        dragDropAreaSprite.addEventListener(eventName, () => dragDropAreaSprite.classList.add('drag-over'), false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dragDropAreaSprite.addEventListener(eventName, () => dragDropAreaSprite.classList.remove('drag-over'), false);
    });

    dragDropAreaSprite.addEventListener('drop', e => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            spriteFileInput.files = files;
            handleSpriteFile(files[0]);
        }
    });
}

if (spriteFileInput) {
    spriteFileInput.addEventListener('change', e => {
        if (e.target.files && e.target.files[0]) {
            handleSpriteFile(e.target.files[0]);
        }
    });
}

    function handleSpriteFile(file) {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = e => {
                spriteImageSrc = e.target.result;
                // Hide the drag & drop area and show the canvas
                dragDropAreaSprite.classList.add('hidden');
                spriteCanvasContainer.classList.remove('hidden');

                // Update and show the download link
                downloadPreviewLink.href = spriteImageSrc;
                downloadPreviewLink.download = file.name; // Set the original filename
                downloadPreviewLink.style.display = 'inline-block';

                stopAnimation();
                animationState.image = new Image();
                animationState.image.onload = () => {
                    const frameCount = spriteFramesInput.value || 1;
                    // Update Info Bubble
                    spriteDimensionsSpan.textContent = `${animationState.image.width}px x ${animationState.image.height}px`;
                    spriteFrameCountSpan.textContent = frameCount; // Use value from input
                    infoBubble.classList.remove('hidden');

                    // Set canvas to first frame preview
                    drawFrame(0);
                };
                animationState.image.src = spriteImageSrc;
            };
            reader.readAsDataURL(file);
        }
    }

    spriteSpeedInput.addEventListener('input', e => {
        const newFps = parseInt(e.target.value, 10);
        animationState.fps = newFps;
        speedValue.textContent = newFps;
    });

    spriteFramesInput.addEventListener('input', () => {
        // When the user changes the frame count, stop the animation and redraw the first frame
        // to provide immediate visual feedback of the new dimensions.
        stopAnimation();
        animationState.frame = 0; // Reset to the first frame
        drawFrame(0);
        // Also update the info bubble
        spriteFrameCountSpan.textContent = spriteFramesInput.value;
    });

    playPauseBtn.addEventListener('click', () => {
        if (animationState.isPlaying) {
            stopAnimation();
        } else {
            startAnimation();
        }
    });

    function startAnimation() {
        if (!spriteImageSrc) {
            showError("Por favor, sube una imagen primero.");
            return;
        }
        playPauseBtn.textContent = "Pausar";
        animationState.isPlaying = true;
        animationState.then = performance.now();
        animationState.animationFrameId = requestAnimationFrame(animate);
    }

    function stopAnimation() {
        playPauseBtn.textContent = "Reproducir";
        animationState.isPlaying = false;
        if (animationState.animationFrameId) {
            cancelAnimationFrame(animationState.animationFrameId);
        }
    }

    function animate(now) {
        if (!animationState.isPlaying) return;

        animationState.animationFrameId = requestAnimationFrame(animate);

        const elapsed = now - animationState.then;
        const fpsInterval = 1000 / animationState.fps;

        if (elapsed > fpsInterval) {
            animationState.then = now - (elapsed % fpsInterval);

            const frameCount = parseInt(spriteFramesInput.value, 10);
            if (frameCount <= 0) return;

            drawFrame(animationState.frame);

            animationState.frame = (animationState.frame + 1) % frameCount;
        }
    }

    function drawFrame(frameIndex) {
        const img = animationState.image;
        if (!img || !img.complete || img.naturalWidth === 0) {
            // Don't draw if the image isn't loaded yet
            return;
        }

        const frameCount = parseInt(spriteFramesInput.value, 10);
        if (isNaN(frameCount) || frameCount <= 0) {
            // Don't draw if the frame count isn't a valid number
            return;
        }

        // --- CORE FIX: Correctly calculate frame dimensions ---
        const frameWidth = img.naturalWidth / frameCount;
        const frameHeight = img.naturalHeight;

        // --- CORE FIX: Set canvas size to the size of a SINGLE frame ---
        spriteCanvas.width = frameWidth;
        spriteCanvas.height = frameHeight;

        const ctx = spriteCanvas.getContext('2d');
        ctx.clearRect(0, 0, frameWidth, frameHeight);

        // Calculate the starting X position of the desired frame in the spritesheet
        const sourceX = frameIndex * frameWidth;

        // --- CORE FIX: Use the correct arguments for drawImage to clip the frame ---
        ctx.drawImage(
            img,
            sourceX, 0,           // The X and Y coordinates of the top-left corner of the sub-rectangle (the frame to cut out) on the source image.
            frameWidth, frameHeight, // The width and height of the sub-rectangle to cut out.
            0, 0,                // The X and Y coordinates where to place the image on the canvas.
            frameWidth, frameHeight  // The width and height to draw the image on the canvas.
        );
    }

    // --- Automatic Frame Detection ---
    detectFramesBtn.addEventListener('click', async () => {
        if (!spriteImageSrc) {
            showError("Sube una imagen antes de detectar los fotogramas.");
            return;
        }

        detectFramesBtn.textContent = "Procesando...";
        detectFramesBtn.disabled = true;

        try {
            const frameCount = await countFramesByColumnScan(spriteImageSrc);
            spriteFramesInput.value = frameCount;
            // Manually dispatch the event to trigger the feedback listener
            spriteFramesInput.dispatchEvent(new Event('input'));
        } catch (error) {
            showError("No se pudo detectar los fotogramas. " + error.message);
        } finally {
            detectFramesBtn.textContent = "Detección Automática";
            detectFramesBtn.disabled = false;
        }
    });

    async function countFramesByColumnScan(imageUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                try {
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const { data, width, height } = imageData;
                    let frameCount = 0;
                    let isInFrame = false;

                    // Scan from left to right
                    for (let x = 0; x < width; x++) {
                        let isColumnTransparent = true;
                        // Check every pixel in the current column
                        for (let y = 0; y < height; y++) {
                            const alpha = data[(y * width + x) * 4 + 3];
                            if (alpha > 0) { // If any pixel in the column is not transparent
                                isColumnTransparent = false;
                                break;
                            }
                        }

                        if (!isColumnTransparent && !isInFrame) {
                            // We've entered a new frame
                            isInFrame = true;
                            frameCount++;
                        } else if (isColumnTransparent && isInFrame) {
                            // We've just left a frame
                            isInFrame = false;
                        }
                    }
                    resolve(frameCount > 0 ? frameCount : 1); // Default to 1 if no frames are found
                } catch (e) {
                     reject(new Error("No se pudo analizar la imagen. Si la imagen proviene de otra web, prueba a descargarla y subirla directamente desde tu dispositivo para evitar problemas de CORS."));
                }
            };
            img.onerror = () => {
                reject(new Error("No se pudo cargar la imagen."));
            };
            img.src = imageUrl;
        });
    }


    // --- Result Preview Logic ---
    const previewSpriteBtn = document.getElementById('preview-sprite-btn');

    let generatedSprite = {
        url: null,
        frameCount: 0
    };

    previewSpriteBtn.addEventListener('click', () => {
        if (generatedSprite.url && generatedSprite.frameCount > 0) {
            // Store data for the main previewer to access
            sessionStorage.setItem('previewSpriteURL', generatedSprite.url);
            sessionStorage.setItem('previewSpriteFrameCount', generatedSprite.frameCount);

            // Navigate or show the main previewer
            mainMenu.classList.add('hidden');
            videoSection.classList.add('hidden');
            spritePreviewSection.classList.remove('hidden');

            // Scroll to the preview section smoothly
            spritePreviewSection.scrollIntoView({ behavior: 'smooth' });

            // Trigger a custom event to notify the previewer to load the new sprite
            window.dispatchEvent(new Event('load-generated-sprite'));

        } else {
            showError("No hay un sprite generado para previsualizar.");
        }
    });


    // Override original createSpriteSheet to store generated sprite info
    const originalCreateSpriteSheet = createSpriteSheet;
    createSpriteSheet = async function(blobs) {
        await originalCreateSpriteSheet(blobs); // Call original function
        generatedSprite.url = spriteImage.src;
        generatedSprite.frameCount = blobs.length;
    };
});

// --- Google Translate Initialization ---
function googleTranslateElementInit() {
    new google.translate.TranslateElement({
        pageLanguage: 'es',
        includedLanguages: 'es,en,zh-CN,hi,pt,ru,fr,ar,bn,de,ja,ko,it,id,tr',
        layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
        autoDisplay: false
    }, 'google_translate_element');
}
