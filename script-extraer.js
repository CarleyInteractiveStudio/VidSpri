
document.addEventListener('DOMContentLoaded', () => {
    // --- Supabase Configuration ---
    const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

    // --- Global State ---
    let extractedFrames = [];
    let currentJobId = null;
    let heartbeatInterval = null;
    let isSending = false;
    let userId = localStorage.getItem('vidspri_user_id') || crypto.randomUUID();
    localStorage.setItem('vidspri_user_id', userId);
    let currentLang = localStorage.getItem('vidspri_lang') || 'es';
    let startTimeValue = 0;
    let endTimeValue = 0;
    let processingStartTime = null;

    // --- DOM Elements ---
    const videoSection = document.getElementById('video-section');
    const editorSection = document.getElementById('editor-section');
    const framePreviewContainer = document.getElementById('frame-preview-container');
    const stepperContainer = document.getElementById('stepper-container');
    const steps = document.querySelectorAll('.step');

    const progressContainer = document.getElementById('progress-container');
    const progressText = document.getElementById('progress-text');
    const etaText = document.getElementById('eta-text');
    const progressBarInner = document.getElementById('progress-bar-inner');
    const resultContainer = document.getElementById('result-container');
    const spriteImage = document.getElementById('sprite-image');
    const downloadLink = document.getElementById('download-link');
    const previewAnimBtn = document.getElementById('preview-anim-btn');
    const reprocessBtn = document.getElementById('reprocess-btn');
    const resultFramesOutput = document.getElementById('result-frames-output');
    const toastContainer = document.getElementById('toast-container');

    const generateBtn = document.getElementById('generate-sprite-btn');

    // Video elements
    const videoPreview = document.getElementById('video-preview');
    const videoFileInput = document.getElementById('video-file');
    const dragDropArea = document.getElementById('drag-drop-area-video');

    // Editor Elements
    const thumbnailsTrack = document.getElementById('thumbnails-track');
    const rangeHighlight = document.querySelector('.range-highlight');
    const handleStart = document.getElementById('handle-start');
    const handleEnd = document.getElementById('handle-end');
    const timelineMarker = document.getElementById('timeline-marker');
    const manualInputToggle = document.getElementById('manual-input-toggle');
    const manualTimeInputs = document.getElementById('manual-time-inputs');
    const startTimeInput = document.getElementById('start-time');
    const endTimeInput = document.getElementById('end-time');

    // SSO bridge
    const bridgeIframe = document.getElementById('sso-bridge');

    // --- Initialization ---
    applyTranslations(currentLang);
    initSSO();
    cleanupPreviousJobs();

    // --- Translation Logic ---
    function applyTranslations(lang) {
        currentLang = lang;
        localStorage.setItem('vidspri_lang', lang);
        const dict = window.translations[lang] || window.translations['es'];

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) {
                if (el.children.length > 0) {
                    const textNode = Array.from(el.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
                    if (textNode) textNode.textContent = dict[key];
                    else el.appendChild(document.createTextNode(dict[key]));
                } else {
                    el.textContent = dict[key];
                }
            }
        });
    }

    // --- SSO Logic (Basic) ---
    function initSSO() {
        window.addEventListener('message', (event) => {
            if (event.origin !== 'https://carleystudio.com') return;
            if (event.data.type === 'SESSION_RESPONSE') {
                const user = event.data.payload;
                if (user) {
                    userId = user.id;
                    localStorage.setItem('vidspri_user_id', userId);
                }
            }
        });
        if (bridgeIframe) {
            bridgeIframe.onload = () => {
                bridgeIframe.contentWindow.postMessage({ type: 'CHECK_SESSION' }, 'https://carleystudio.com');
            };
        }
    }

    // --- Toast Notifications ---
    function showToast(messageKey, type = 'info', isLiteral = false) {
        const dict = window.translations[currentLang] || window.translations['es'];
        const message = isLiteral ? messageKey : (dict[messageKey] || messageKey);

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${message}</span>`;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    // --- Stepper Navigation ---
    function goToStep(stepNumber) {
        steps.forEach(s => {
            const sNum = parseInt(s.getAttribute('data-step'));
            s.classList.toggle('active', sNum <= stepNumber);
        });

        videoSection.classList.add('hidden');
        editorSection.classList.add('hidden');
        framePreviewContainer.classList.add('hidden');

        if (stepNumber === 1) videoSection.classList.remove('hidden');
        else if (stepNumber === 2) editorSection.classList.remove('hidden');
        else if (stepNumber === 3) framePreviewContainer.classList.remove('hidden');
    }

    // --- Drag & Drop ---
    dragDropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dragDropArea.classList.add('drag-over');
    });

    dragDropArea.addEventListener('dragleave', () => {
        dragDropArea.classList.remove('drag-over');
    });

    dragDropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dragDropArea.classList.remove('drag-over');
        if (e.dataTransfer.files.length) {
            videoFileInput.files = e.dataTransfer.files;
            handleVideoSelection();
        }
    });

    document.getElementById('custom-file-btn').addEventListener('click', () => videoFileInput.click());
    videoFileInput.addEventListener('change', handleVideoSelection);

    async function handleVideoSelection() {
        const file = videoFileInput.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            videoPreview.src = url;
            videoPreview.onloadedmetadata = () => {
                endTimeInput.value = videoPreview.duration.toFixed(2);
                generateEditorThumbnails(file);
                goToStep(2);
            };
        }
    }

    // --- Video Editor Logic ---
    async function generateEditorThumbnails(file) {
        thumbnailsTrack.innerHTML = '';
        const video = document.createElement('video');
        video.src = URL.createObjectURL(file);

        await new Promise(r => video.onloadedmetadata = r);
        const duration = video.duration;
        const thumbCount = 10;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 160;
        canvas.height = 90;

        for (let i = 0; i < thumbCount; i++) {
            video.currentTime = (duration / thumbCount) * i;
            await new Promise(r => video.onseeked = r);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = document.createElement('img');
            img.src = canvas.toDataURL('image/jpeg', 0.5);
            thumbnailsTrack.appendChild(img);
        }
        updateRangeUI();
    }

    let isDraggingStart = false;
    let isDraggingEnd = false;

    function getPercentageFromX(x) {
        const rect = thumbnailsTrack.getBoundingClientRect();
        let p = (x - rect.left) / rect.width;
        return Math.max(0, Math.min(1, p));
    }

    function updateRangeUI() {
        const startP = parseFloat(startTimeInput.value) / videoPreview.duration;
        const endP = parseFloat(endTimeInput.value) / videoPreview.duration;

        handleStart.style.left = `${startP * 100}%`;
        handleEnd.style.left = `${endP * 100}%`;
        rangeHighlight.style.left = `${startP * 100}%`;
        rangeHighlight.style.width = `${(endP - startP) * 100}%`;
    }

    handleStart.onmousedown = () => isDraggingStart = true;
    handleEnd.onmousedown = () => isDraggingEnd = true;

    window.addEventListener('mousemove', (e) => {
        if (!isDraggingStart && !isDraggingEnd) return;
        const p = getPercentageFromX(e.clientX);
        const time = p * videoPreview.duration;

        if (isDraggingStart) {
            startTimeInput.value = Math.min(time, parseFloat(endTimeInput.value) - 0.1).toFixed(2);
            videoPreview.currentTime = parseFloat(startTimeInput.value);
        } else if (isDraggingEnd) {
            endTimeInput.value = Math.max(time, parseFloat(startTimeInput.value) + 0.1).toFixed(2);
            videoPreview.currentTime = parseFloat(endTimeInput.value);
        }
        updateRangeUI();
    });

    window.addEventListener('mouseup', () => {
        isDraggingStart = false;
        isDraggingEnd = false;
    });

    videoPreview.addEventListener('timeupdate', () => {
        const p = videoPreview.currentTime / videoPreview.duration;
        timelineMarker.style.left = `${p * 100}%`;
    });

    manualInputToggle.addEventListener('change', () => {
        manualTimeInputs.classList.toggle('hidden', !manualInputToggle.checked);
    });

    startTimeInput.addEventListener('change', updateRangeUI);
    endTimeInput.addEventListener('change', updateRangeUI);

    // --- Frame Extraction ---
    document.getElementById('extract-frames-btn').addEventListener('click', async () => {
        const videoFile = videoFileInput.files[0];
        if (!videoFile) return;

        let frameCount = parseInt(document.getElementById('frames').value, 10);
        if (frameCount > 12) frameCount = 12; // Enforce limit

        const startTime = parseFloat(startTimeInput.value);
        const endTime = parseFloat(endTimeInput.value);

        progressContainer.classList.remove('hidden');
        const dict = window.translations[currentLang] || window.translations['es'];
        progressText.textContent = dict['processing'] || 'Procesando...';
        updateProgressBar(0);

        try {
            const frames = await extractFramesFromVideo(videoFile, frameCount, startTime, endTime, (p) => {
                updateProgressBar(p * 100);
            });
            extractedFrames = frames.map((blob, index) => ({ id: index, blob }));
            displayFramePreviews();
            goToStep(3);
        } catch (e) {
            showToast(e.message, "error", true);
        } finally {
            progressContainer.classList.add('hidden');
        }
    });

    function displayFramePreviews() {
        const output = document.getElementById('frames-output');
        output.innerHTML = '';
        extractedFrames.forEach(frame => {
            const container = document.createElement('div');
            container.className = 'frame-container';
            const img = document.createElement('img');
            img.src = URL.createObjectURL(frame.blob);
            const del = document.createElement('button');
            del.className = 'delete-btn';
            del.innerHTML = '&times;';
            del.onclick = () => {
                extractedFrames = extractedFrames.filter(f => f.id !== frame.id);
                container.remove();
                if(extractedFrames.length === 0) {
                    generateBtn.disabled = true;
                }
            };
            container.appendChild(img);
            container.appendChild(del);
            output.appendChild(container);
        });
        generateBtn.disabled = extractedFrames.length === 0;
    }

    // --- Queue and Processing ---
    async function cleanupPreviousJobs() {
        try {
            await supabaseClient
                .from('processing_queue')
                .update({ status: 'failed' })
                .eq('user_id', userId)
                .in('status', ['waiting', 'authorized', 'processing']);
        } catch (e) {
            console.error("Error cleaning up previous jobs:", e);
        }
    }

    function startHeartbeat(jobId) {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(async () => {
            const { error } = await supabaseClient.rpc('heartbeat_job', { job_id_param: jobId });

            if (error) {
                console.error("Heartbeat error:", error);
                stopHeartbeat();
            }
        }, 15000);
    }

    function stopHeartbeat() {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
    }

    generateBtn.addEventListener('click', async () => {
        if (extractedFrames.length === 0) return;

        generateBtn.disabled = true;
        progressContainer.classList.remove('hidden');
        const dict = window.translations[currentLang] || window.translations['es'];
        progressText.textContent = dict['joining'] || 'Conectando...';
        updateProgressBar(5);

        const isPriority = localStorage.getItem('vidspri_priority_active') === 'true';

        try {
            // First, cancel any previous jobs from this user
            await cleanupPreviousJobs();

            const { data, error } = await supabaseClient
                .from('processing_queue')
                .insert([{
                    user_id: userId,
                    is_priority: isPriority,
                    total_frames: extractedFrames.length,
                    processed_frames: 0,
                    last_heartbeat: new Date().toISOString()
                }])
                .select();

            if (error) throw error;

            currentJobId = data[0].id;
            isSending = false;
            startHeartbeat(currentJobId);
            startQueueTracking(currentJobId);

            // Immediate check in case it was authorized instantly
            if (data[0].status === 'authorized') {
                isSending = true;
                sendToProcessingServer(data[0].assigned_server_url, currentJobId);
            }
        } catch (e) {
            showToast(e.message, "error", true);
            progressContainer.classList.add('hidden');
            generateBtn.disabled = false;
            stopHeartbeat();
        }
    });

    function startQueueTracking(jobId) {
        const channel = supabaseClient
            .channel(`job-${jobId}`)
            .on('postgres_changes', { event: 'UPDATE', table: 'processing_queue', filter: `id=eq.${jobId}` }, payload => {
                const job = payload.new;
                const dict = window.translations[currentLang] || window.translations['es'];

                if (job.status === 'authorized' && !isSending) {
                    isSending = true;
                    sendToProcessingServer(job.assigned_server_url, jobId);
                } else if (job.status === 'processing') {
                    updateProcessingProgress(job);
                } else if (job.status === 'completed') {
                    updateProgressBar(100);
                    etaText.textContent = '';
                    stopHeartbeat();
                    supabaseClient.removeChannel(channel);
                } else if (job.status === 'failed') {
                    showToast('Error en el servidor', 'error', true);
                    progressContainer.classList.add('hidden');
                    generateBtn.disabled = false;
                    stopHeartbeat();
                    supabaseClient.removeChannel(channel);
                }
            })
            .subscribe();

        checkPosition(jobId);
    }

    function updateProcessingProgress(job) {
        const dict = window.translations[currentLang] || window.translations['es'];
        const processed = job.processed_frames || 0;
        const total = job.total_frames || extractedFrames.length;
        const remaining = total - processed;
        const percentage = Math.floor((processed / total) * 100);

        if (currentLang === 'es') {
            progressText.textContent = `Procesando cuadro ${processed} de ${total}... (${percentage}%)`;
        } else {
            progressText.textContent = `${dict['processing'] || 'Processing'} ${processed}/${total} (${percentage}%)`;
        }

        updateProgressBar(percentage);

        if (processingStartTime && processed > 0) {
            const elapsed = (Date.now() - processingStartTime) / 1000;
            const rate = processed / elapsed;
            const eta = Math.ceil(remaining / rate);
            etaText.textContent = `ETA: ${eta}s`;
        } else if (!processingStartTime) {
            processingStartTime = Date.now();
        }
    }

    async function checkPosition(jobId) {
        const { data: jobData } = await supabaseClient.from('processing_queue').select('*').eq('id', jobId).single();
        if (!jobData) return;

        if (jobData.status === 'authorized') {
            if (!isSending) {
                isSending = true;
                sendToProcessingServer(jobData.assigned_server_url, jobId);
            }
            return;
        }

        if (jobData.status !== 'waiting') return;

        const { count } = await supabaseClient
            .from('processing_queue')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'waiting')
            .or(`is_priority.gt.${jobData.is_priority},and(is_priority.eq.${jobData.is_priority},queue_number.lt.${jobData.queue_number})`);

        const dict = window.translations[currentLang] || window.translations['es'];
        const position = (count || 0) + 1;

        if (position === 1) {
            progressText.textContent = dict['your_turn'] || '¡Es tu turno! Preparando...';
        } else {
            progressText.textContent = (dict['position'] || 'Posición en cola: ') + position;
        }

        updateProgressBar(10);
        setTimeout(() => checkPosition(jobId), 3000);
    }

    // Add window unload listener to cleanup on close
    window.addEventListener('beforeunload', () => {
        stopHeartbeat();
    });

    async function sendToProcessingServer(serverUrl, jobId) {
        const dict = window.translations[currentLang] || window.translations['es'];
        progressText.textContent = (dict['sending_frames'] || 'Enviando fotogramas...') + ' (0%)';
        updateProgressBar(0);
        processingStartTime = null; // Reset for processing phase

        // Wake up the server if it's sleeping (Hugging Face Spaces)
        fetch(serverUrl).catch(() => {});

        const formData = new FormData();
        extractedFrames.forEach(f => formData.append('images', f.blob, `frame_${f.id}.png`));

        try {
            const result = await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', `${serverUrl}/process-batch/${jobId}`);

                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const percent = Math.floor((e.loaded / e.total) * 100);
                        const totalFrames = extractedFrames.length;
                        const currentSent = Math.floor((e.loaded / e.total) * totalFrames);
                        progressText.textContent = `${dict['sending_frames'] || 'Enviando'}... ${currentSent}/${totalFrames} (${percent}%)`;
                        updateProgressBar(percent);
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const response = JSON.parse(xhr.responseText);
                            resolve(response);
                        } catch (e) {
                            reject(new Error("Error al procesar respuesta del servidor"));
                        }
                    } else {
                        reject(new Error("Error en el servidor: " + xhr.status));
                    }
                };

                xhr.onerror = () => reject(new Error("Error de conexión con el servidor"));
                xhr.send(formData);
            });

            if (result.frames) {
                handleProcessingSuccess(result.frames);
            } else {
                throw new Error(result.error || "Error desconocido");
            }
        } catch (e) {
            console.error("Error sending to server:", e);
            await supabaseClient
                .from('processing_queue')
                .update({ status: 'failed' })
                .eq('id', jobId);

            showToast(e.message, "error", true);
            progressContainer.classList.add('hidden');
            generateBtn.disabled = false;
            stopHeartbeat();
        }
    }

    async function handleProcessingSuccess(frames) {
        const dict = window.translations[currentLang] || window.translations['es'];
        progressText.textContent = dict['done'] || '¡Listo!';
        updateProgressBar(100);
        etaText.textContent = '';

        const blobs = frames.map(base64StringToBlob);
        displayResultFrames(blobs);
        await createSpriteSheet(blobs);

        progressContainer.classList.add('hidden');
        resultContainer.classList.remove('hidden');
        framePreviewContainer.classList.add('hidden');
    }

    function displayResultFrames(blobs) {
        resultFramesOutput.innerHTML = '';
        blobs.forEach((blob, index) => {
            const container = document.createElement('div');
            container.className = 'result-frame';
            container.innerHTML = `
                <img src="${URL.createObjectURL(blob)}" alt="Result Frame ${index}">
                <div class="check-badge">✓</div>
            `;
            container.onclick = () => {
                container.classList.toggle('selected');
                updateReprocessButtonState();
            };
            resultFramesOutput.appendChild(container);
        });
    }

    function updateReprocessButtonState() {
        const selected = document.querySelectorAll('.result-frame.selected');
        reprocessBtn.classList.toggle('hidden', selected.length === 0);
    }

    reprocessBtn.addEventListener('click', async () => {
        const selectedElements = document.querySelectorAll('.result-frame.selected');
        const selectedBlobs = Array.from(selectedElements).map(el => {
            const imgSrc = el.querySelector('img').src;
            // Note: In a real app we might want to store the original blobs instead of fetching from URL
            return fetch(imgSrc).then(r => r.blob());
        });

        extractedFrames = (await Promise.all(selectedBlobs)).map((blob, index) => ({ id: index, blob }));

        resultContainer.classList.add('hidden');
        reprocessBtn.classList.add('hidden');
        // Trigger queue processing with these new frames
        generateBtn.click();
    });

    previewAnimBtn.addEventListener('click', () => {
        // We can pass the sprite sheet to the preview page via localStorage or similar
        // For now, let's just go there. In a real scenario we'd use a more robust state management.
        window.location.href = 'previsualizacion.html';
    });

    // --- Helpers ---
    async function extractFramesFromVideo(videoFile, frameCount, startTime, endTime, onProgress) {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(videoFile);
            video.onloadedmetadata = () => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                const frames = [];
                const duration = endTime - startTime;
                const interval = duration / frameCount;
                let count = 0;
                video.onseeked = async () => {
                    ctx.drawImage(video, 0, 0);
                    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
                    frames.push(blob);
                    count++;
                    if (onProgress) onProgress(count / frameCount);
                    if (count < frameCount) {
                        video.currentTime += interval;
                    } else {
                        resolve(frames);
                    }
                };
                video.currentTime = startTime;
            };
        });
    }

    function base64StringToBlob(base64) {
        const bin = atob(base64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return new Blob([arr], { type: 'image/png' });
    }

    async function createSpriteSheet(blobs) {
        const images = await Promise.all(blobs.map(blob => {
            return new Promise(res => {
                const img = new Image();
                img.onload = () => res(img);
                img.src = URL.createObjectURL(blob);
            });
        }));
        const totalWidth = images.reduce((sum, img) => sum + img.width, 0);
        const maxHeight = Math.max(...images.map(img => img.height));
        const canvas = document.createElement('canvas');
        canvas.width = totalWidth; canvas.height = maxHeight;
        const ctx = canvas.getContext('2d');
        let x = 0;
        images.forEach(img => { ctx.drawImage(img, x, 0); x += img.width; });

        const cols = images.length;
        const rows = 1;

        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            spriteImage.src = url;
            downloadLink.href = url;

            // Save to localStorage for automatic loading in previsualizacion.html
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                try {
                    localStorage.setItem('vidspri_last_sprite', reader.result);
                    localStorage.setItem('vidspri_last_cols', cols);
                    localStorage.setItem('vidspri_last_rows', rows);
                } catch (e) {
                    console.warn("Could not save to localStorage (quota exceeded?):", e);
                }
            };
        }, 'image/png');
    }

    function updateProgressBar(percentage) {
        progressBarInner.style.width = `${percentage}%`;
    }
});
