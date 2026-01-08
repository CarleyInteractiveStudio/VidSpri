document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selection ---
    const mainMenu = document.getElementById('main-menu');
    const videoSection = document.getElementById('video-section');
    const videoSpriteBtn = document.getElementById('video-sprite-btn');
    const imageSpriteBtn = document.getElementById('image-sprite-btn');
    const soundGenerationBtn = document.getElementById('sound-generation-btn');
    const textToSpriteBtn = document.getElementById('text-to-sprite-btn');

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

    // Action Bubble elements
    const actionBubble = document.getElementById('action-bubble');
    const bubbleDownloadBtn = document.getElementById('bubble-download-btn');
    const bubbleShareBtn = document.getElementById('bubble-share-btn');
    const bubbleDonateBtn = document.getElementById('bubble-donate-btn');

    // Footer buttons
    const donateBtnFooter = document.getElementById('donate-btn-footer');
    const shareBtnFooter = document.getElementById('share-btn-footer');

    let extractedFrames = []; // To store the extracted frame blobs

    const dragDropAreaVideo = document.getElementById('drag-drop-area-video');

    // --- URLs de Servidores ---
    // URL del servidor para quitar el fondo de las imágenes
    const backgroundRemovalUrl = 'https://carley1234-vidspri.hf.space/remove-background/';
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

    videoSpriteBtn.addEventListener('click', () => {
        mainMenu.classList.add('hidden');
        videoSection.classList.remove('hidden');
    });

    imageSpriteBtn.addEventListener('click', () => {
        mainMenu.classList.add('hidden');
        imageAnimationSection.classList.remove('hidden');
    });

    soundGenerationBtn.addEventListener('click', () => {
        mainMenu.classList.add('hidden');
        soundGenerationSection.classList.remove('hidden');
        updateInspirationButtons(); // Initialize with default selection
    });

    textToSpriteBtn.addEventListener('click', () => {
        mainMenu.classList.add('hidden');
        textToSpriteSection.classList.remove('hidden');
        updateVideoInspirationButtons(); // Initialize with default selection
    });

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
                dragDropArea.classList.add('hidden'); // Hide the entire drop area
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
        if (event.target === premiumModal) premiumModal.classList.add('hidden');
        if (event.target === unavailableModal) unavailableModal.classList.add('hidden');
        if (event.target === shareModal) shareModal.classList.add('hidden');
        if (event.target === downloadAppModal) downloadAppModal.classList.add('hidden');
        if (event.target === premiumFeatureModal) premiumFeatureModal.classList.add('hidden');

        // Close the action bubble if the click is outside of it and its trigger
        if (!actionBubble.classList.contains('hidden') && !actionBubble.contains(event.target) && event.target !== downloadLink) {
            actionBubble.classList.add('hidden');
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

    // The downloadBtnResult is removed, but we keep the listener to avoid errors if not cleaned up
    if (downloadBtnResult) {
        downloadBtnResult.addEventListener('click', () => {
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
            dragDropAreaVideo.classList.add('hidden'); // Hide the entire drop area
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
        // Ensure progress container is visible for this stage if not already
        progressContainer.classList.remove('hidden');
        serverMessage.classList.remove('hidden');
        bannerAdContainer.classList.remove('hidden');

        const totalFrames = extractedFrames.length;
        const processedFrames = [];
        const premiumCode = localStorage.getItem('vidspri_premium_code');

        try {
            for (let i = 0; i < totalFrames; i++) {
                const frameData = extractedFrames[i];
                progressText.textContent = `Procesando fotograma ${i + 1} de ${totalFrames}... (Quitando fondo)`;
                const progressPercentage = (i / totalFrames) * 100;
                updateProgressBar(progressPercentage);


                const formData = new FormData();
                formData.append('image', frameData.blob, `frame_${frameData.id}.png`);
                if (premiumCode) {
                    formData.append('premium_code', premiumCode);
                }

                const response = await fetch(backgroundRemovalUrl, {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ detail: `Error del servidor en el fotograma ${i + 1}.` }));
                    throw new Error(errorData.detail);
                }

                const processedBlob = await response.blob();
                processedFrames.push(processedBlob);
            }

            updateProgressBar(100);
            progressText.textContent = "Creando la hoja de sprites final...";
            await createSpriteSheet(processedFrames);
            resultContainer.classList.remove('hidden');
            shareModal.classList.remove('hidden');

        } catch (error) {
            showError(error.message);
        } finally {
            progressContainer.classList.add('hidden');
            serverMessage.classList.add('hidden');
            bannerAdContainer.classList.add('hidden');
        }
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

    // --- Action Bubble Logic ---

    downloadLink.addEventListener('click', (event) => {
        event.stopPropagation();
        actionBubble.classList.remove('hidden');
    });

    bubbleDownloadBtn.addEventListener('click', () => {
        downloadAppModal.classList.remove('hidden'); // Open the modal directly
        actionBubble.classList.add('hidden');
    });

    bubbleShareBtn.addEventListener('click', () => {
        const shareUrl = 'https://carleyinteractivestudio.github.io/VidSpri/';
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert('¡Enlace de la aplicación copiado al portapapeles!');
        }).catch(err => {
            console.error('Error al copiar el enlace: ', err);
            alert('No se pudo copiar el enlace.');
        });
        actionBubble.classList.add('hidden');
    });

    bubbleDonateBtn.addEventListener('click', () => {
        supportBtn.click(); // Simulate click on the main support button
        actionBubble.classList.add('hidden');
    });
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
