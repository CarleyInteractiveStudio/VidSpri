
document.addEventListener('DOMContentLoaded', () => {
    // --- Supabase Configuration ---
    const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

    // --- Global State ---
    let extractedFrames = [];
    let processedFrameBlobs = []; // Store raw blobs from server for re-processing logic
    let isSecondPassMode = false;
    let currentJobId = null;
    let heartbeatInterval = null;
    let positionTimer = null;
    let isSending = false;
    let currentProcessingStep = 'idle'; // 'idle', 'waiting', 'uploading', 'processing'
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
    const resultContainer = document.getElementById('result-container');
    const stepperContainer = document.getElementById('stepper-container');
    const steps = document.querySelectorAll('.step');

    const progressContainer = document.getElementById('progress-container');
    const progressText = document.getElementById('progress-text');
    const etaText = document.getElementById('eta-text');
    const progressBarInner = document.getElementById('progress-bar-inner');
    const spriteImage = document.getElementById('sprite-image');
    const downloadLink = document.getElementById('download-link');
    const downloadLinkQuick = document.getElementById('download-link-quick');
    const previewAnimBtn = document.getElementById('preview-anim-btn');
    const reprocessBtn = document.getElementById('reprocess-btn');
    const resultFramesOutput = document.getElementById('result-frames-output');
    const toastContainer = document.getElementById('toast-container');
    const priorityActions = document.getElementById('queue-priority-actions');
    const priorityBalanceInfo = document.getElementById('priority-balance-info');
    const usePriorityBtn = document.getElementById('use-priority-btn');
    const getPriorityLink = document.getElementById('get-priority-link');

    const generateBtn = document.getElementById('generate-sprite-btn');

    // Video elements
    const videoPreview = document.getElementById('video-preview');
    const videoFileInput = document.getElementById('video-file');
    const dragDropArea = document.getElementById('drag-drop-area-video');

    // Editor Elements
    const thumbnailsTrack = document.getElementById('thumbnails-track');
    const rangeHighlight = document.getElementById('range-highlight');
    const rangeStartInput = document.getElementById('range-start-video');
    const rangeEndInput = document.getElementById('range-end-video');
    const timelineMarker = document.getElementById('timeline-marker');
    const manualInputToggle = document.getElementById('manual-input-toggle');
    const manualTimeInputs = document.getElementById('manual-time-inputs');
    const startTimeInput = document.getElementById('start-time');
    const endTimeInput = document.getElementById('end-time');

    const smartCropCheck = document.getElementById('smart-crop-check');
    const pixelArtCheck = document.getElementById('pixel-art-check');
    const exportSizeSelect = document.getElementById('export-size');
    const customSizeInputs = document.getElementById('custom-size-inputs');
    const customWidthInput = document.getElementById('custom-width');
    const customHeightInput = document.getElementById('custom-height');
    const exportScaleSelect = document.getElementById('export-scale');

    // SSO bridge
    const bridgeIframe = document.getElementById('sso-bridge');

    // --- Initialization ---
    applyTranslations(currentLang);
    initSSO();
    cleanupPreviousJobs();
    checkForPendingFrames();

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
        function requestSessionCheck() {
            if (bridgeIframe && bridgeIframe.contentWindow) {
                bridgeIframe.contentWindow.postMessage({ type: 'CHECK_SESSION' }, '*');
            }
        }

        window.addEventListener('message', (event) => {
            if (event.origin !== 'https://carleystudio.com') return;

            if (event.data.type === 'BRIDGE_READY') {
                requestSessionCheck();
            }

            if (event.data.type === 'SESSION_RESPONSE') {
                const session = event.data.payload;
                if (session && session.user) {
                    userId = session.user.id;
                    localStorage.setItem('vidspri_user_id', userId);
                }
            }
        });

        if (bridgeIframe) {
            bridgeIframe.onload = requestSessionCheck;
        }

        // Fallback
        if (bridgeIframe && bridgeIframe.contentWindow) {
            requestSessionCheck();
        }
    }

    // --- Pending Frames from AI Animation ---
    function checkForPendingFrames() {
        const request = indexedDB.open("VidSpriBuffer", 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('temp_frames')) {
                db.createObjectStore('temp_frames', { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = (e) => {
            const db = e.target.result;
            const tx = db.transaction('temp_frames', 'readwrite');
            const store = tx.objectStore('temp_frames');
            const getAll = store.getAll();
            getAll.onsuccess = () => {
                const frames = getAll.result;
                if (frames && frames.length > 0) {
                    extractedFrames = frames.map((item, index) => ({
                        id: index,
                        blob: base64StringToBlob(item.data.replace(/^data:image\/(png|jpeg);base64,/, ''))
                    }));
                    store.clear();
                    displayFramePreviews();
                    goToStep(3);
                    showToast("frames_loaded_from_ai", "success");
                }
            };
        };
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
        resultContainer.classList.add('hidden');

        if (stepNumber === 1) videoSection.classList.remove('hidden');
        else if (stepNumber === 2) editorSection.classList.remove('hidden');
        else if (stepNumber === 3) framePreviewContainer.classList.remove('hidden');
        else if (stepNumber === 4) resultContainer.classList.remove('hidden');
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

        rangeStartInput.max = duration;
        rangeEndInput.max = duration;
        rangeStartInput.value = 0;
        rangeEndInput.value = duration;
        startTimeInput.value = 0;
        endTimeInput.value = duration.toFixed(2);

        const thumbCount = 10;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 160;
        canvas.height = 90;
        ctx.imageSmoothingEnabled = false;

        for (let i = 0; i < thumbCount; i++) {
            video.currentTime = (duration / thumbCount) * i;
            await new Promise(r => video.onseeked = r);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = document.createElement('img');
            img.src = canvas.toDataURL('image/jpeg', 0.5);
            img.style.width = `${100 / thumbCount}%`;
            thumbnailsTrack.appendChild(img);
        }
        updateRangeUI();
    }

    function updateRangeUI() {
        const dur = videoPreview.duration || 1;
        let start = parseFloat(rangeStartInput.value);
        let end = parseFloat(rangeEndInput.value);

        if (start > end) [start, end] = [end, start];

        startTimeInput.value = start.toFixed(2);
        endTimeInput.value = end.toFixed(2);

        rangeHighlight.style.left = `${(start / dur) * 100}%`;
        rangeHighlight.style.right = `${100 - (end / dur) * 100}%`;
    }

    rangeStartInput.oninput = () => {
        updateRangeUI();
        videoPreview.currentTime = parseFloat(rangeStartInput.value);
    };
    rangeEndInput.oninput = () => {
        updateRangeUI();
        videoPreview.currentTime = parseFloat(rangeEndInput.value);
    };

    videoPreview.addEventListener('timeupdate', () => {
        const p = videoPreview.currentTime / videoPreview.duration;
        timelineMarker.style.left = `${p * 100}%`;
    });

    manualInputToggle.addEventListener('change', () => {
        manualTimeInputs.classList.toggle('hidden', !manualInputToggle.checked);
    });

    startTimeInput.addEventListener('change', updateRangeUI);
    endTimeInput.addEventListener('change', updateRangeUI);

    exportSizeSelect.addEventListener('change', () => {
        customSizeInputs.classList.toggle('hidden', exportSizeSelect.value !== 'custom');
        updateFinalSpriteSheet();
    });

    smartCropCheck.addEventListener('change', updateFinalSpriteSheet);
    pixelArtCheck.addEventListener('change', updateFinalSpriteSheet);
    customWidthInput.addEventListener('change', updateFinalSpriteSheet);
    customHeightInput.addEventListener('change', updateFinalSpriteSheet);
    exportScaleSelect.addEventListener('change', updateFinalSpriteSheet);

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
        progressText.textContent = (isSecondPassMode ? 'Segunda pasada: ' : '') + (dict['joining'] || 'Conectando...');
        updateProgressBar(5);

        try {
            // First, cancel any previous jobs from this user
            await cleanupPreviousJobs();

            const { data, error } = await supabaseClient
                .from('processing_queue')
                .insert([{
                    user_id: userId,
                    is_priority: false, // Default to false, user will decide in queue
                    total_frames: extractedFrames.length,
                    processed_frames: 0,
                    last_heartbeat: new Date().toISOString()
                }])
                .select();

            if (error) throw error;

            currentJobId = data[0].id;
            isSending = false;
            currentProcessingStep = 'waiting';
            startHeartbeat(currentJobId);
            startQueueTracking(currentJobId, data[0]);

            // Immediate check in case it was authorized instantly
            if (data[0].status === 'authorized') {
                isSending = true;
                sendToProcessingServer(data[0].assigned_server_url, currentJobId, isSecondPassMode);
            }
        } catch (e) {
            showToast(e.message, "error", true);
            progressContainer.classList.add('hidden');
            generateBtn.disabled = false;
            stopHeartbeat();
        }
    });

    usePriorityBtn.onclick = async () => {
        if (!currentJobId) return;
        usePriorityBtn.disabled = true;
        const { data, error } = await supabaseClient.rpc('use_priority_credit', {
            user_id_param: userId,
            job_id_param: currentJobId
        });

        if (error) {
            showToast(error.message, "error", true);
        } else if (!data.success) {
            showToast(data.message, "error");
        } else {
            showToast("priority_active", "success");
            updatePriorityUI();
        }
        usePriorityBtn.disabled = false;
    };

    async function updatePriorityUI() {
        if (currentProcessingStep !== 'waiting') {
            priorityActions.classList.add('hidden');
            return;
        }

        const { data: userP } = await supabaseClient
            .from('user_priorities')
            .select('*')
            .eq('user_id', userId)
            .single();

        const { data: jobP } = await supabaseClient
            .from('processing_queue')
            .select('is_priority')
            .eq('id', currentJobId)
            .single();

        if (jobP && jobP.is_priority) {
            priorityActions.classList.add('hidden');
            return;
        }

        priorityActions.classList.remove('hidden');
        const dict = window.translations[currentLang] || window.translations['es'];
        const uses = (userP && userP.remaining_uses) || 0;
        const hasTimePriority = userP && userP.priority_until && new Date(userP.priority_until) > new Date();

        if (hasTimePriority) {
            priorityBalanceInfo.textContent = dict['priority_active'];
            usePriorityBtn.style.display = 'flex';
            getPriorityLink.classList.add('hidden');
        } else if (uses > 0) {
            priorityBalanceInfo.textContent = (dict['priority_uses'] || 'Uses: ') + uses;
            usePriorityBtn.style.display = 'flex';
            getPriorityLink.classList.add('hidden');
        } else {
            priorityBalanceInfo.textContent = (dict['priority_uses'] || 'Uses: ') + 0;
            usePriorityBtn.style.display = 'none';
            getPriorityLink.classList.remove('hidden');
        }
    }

    function startQueueTracking(jobId, initialJob) {
        let jobState = initialJob || { id: jobId, status: 'waiting' };

        const channel = supabaseClient
            .channel(`job-${jobId}`)
            .on('postgres_changes', { event: 'UPDATE', table: 'processing_queue' }, payload => {
                if (payload.new.id !== jobId) return;

                // Merge new data into local state to handle partial payloads
                jobState = { ...jobState, ...payload.new };

                const job = jobState;
                console.log("Realtime Update for Job:", job.id, "Status:", job.status, "Progress:", job.processed_frames);

                if (job.status === 'authorized' && !isSending) {
                    isSending = true;
                    sendToProcessingServer(job.assigned_server_url, jobId, isSecondPassMode);
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
        // Once we get a 'processing' update from the server, we switch to processing mode
        currentProcessingStep = 'processing';

        const dict = window.translations[currentLang] || window.translations['es'];
        const total = job.total_frames || extractedFrames.length || 1;
        const processed = Math.min(job.processed_frames || 0, total);
        const remaining = total - processed;
        const percentage = Math.floor((processed / total) * 100);

        // Explicitly format the message
        const label = dict['processing'] || (currentLang === 'es' ? 'Procesando' : 'Processing');
        const unit = currentLang === 'es' ? 'fotogramas' : 'frames';
        const ofText = currentLang === 'es' ? 'de' : 'of';

        progressText.textContent = `${label}: ${processed} ${ofText} ${total} ${unit} (${percentage}%)`;

        updateProgressBar(percentage);

        if (processingStartTime && processed > 0) {
            const elapsed = (Date.now() - processingStartTime) / 1000;
            const rate = processed / elapsed;
            const eta = Math.ceil(remaining / rate);
            etaText.textContent = `ETA: ${eta}s`;
        } else if (!processingStartTime) {
            processingStartTime = Date.now();
        }

        // Ensure progress container is visible and active
        progressContainer.classList.remove('hidden');
        progressContainer.style.opacity = '1';
    }

    async function checkPosition(jobId) {
        if (currentJobId !== jobId) return;
        if (positionTimer) clearTimeout(positionTimer);

        const { data: jobData } = await supabaseClient.from('processing_queue').select('*').eq('id', jobId).single();
        if (!jobData) return;

        if (jobData.status === 'authorized') {
            if (!isSending) {
                isSending = true;
                sendToProcessingServer(jobData.assigned_server_url, jobId, isSecondPassMode);
            }
            return;
        }

        if (jobData.status === 'processing') {
            updateProcessingProgress(jobData);
        }

        if (jobData.status !== 'waiting') {
            priorityActions.classList.add('hidden');
            return;
        }

        updatePriorityUI();

        const { count } = await supabaseClient
            .from('processing_queue')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'waiting')
            .eq('job_type', 'video')
            .or(`is_priority.gt.${jobData.is_priority},and(is_priority.eq.${jobData.is_priority},queue_number.lt.${jobData.queue_number})`);

        const dict = window.translations[currentLang] || window.translations['es'];
        const position = (count || 0) + 1;

        if (position === 1) {
            progressText.textContent = (dict['your_turn'] || '¡Es tu turno! Preparando...') + " " + (dict['waking_server'] || 'Despertando servidor...');

            // Proactive wake-up: Ping all video servers
            const { data: servers } = await supabaseClient.from('server_status').select('url').eq('service_type', 'video');
            if (servers) {
                servers.forEach(s => {
                    console.log("Pinging server to wake up:", s.url);
                    fetch(s.url).catch(() => {});
                });
            }
        } else {
            progressText.textContent = (dict['position'] || 'Posición en cola: ') + position;
        }

        updateProgressBar(10);
        positionTimer = setTimeout(() => checkPosition(jobId), 3500);
    }

    // Add window unload listener to cleanup on close
    window.addEventListener('beforeunload', () => {
        stopHeartbeat();
    });

    async function sendToProcessingServer(serverUrl, jobId, isSecondPass = false) {
        currentProcessingStep = 'uploading';
        const dict = window.translations[currentLang] || window.translations['es'];
        progressText.textContent = (isSecondPass ? 'Segunda pasada: ' : '') + (dict['sending_frames'] || 'Enviando fotogramas...') + ' (0%)';
        updateProgressBar(0);
        processingStartTime = null; // Reset for processing phase

        // Wake up the server if it's sleeping (Hugging Face Spaces)
        fetch(serverUrl).catch(() => {});

        const formData = new FormData();
        extractedFrames.forEach(f => formData.append('images', f.blob, `frame_${f.id}.png`));
        if (isSecondPass) formData.append('second_pass', 'true');

        try {
            const result = await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', `${serverUrl}/process-batch/${jobId}`);

                xhr.upload.onprogress = (e) => {
                    if (currentProcessingStep === 'uploading' && e.lengthComputable) {
                        const percent = Math.floor((e.loaded / e.total) * 100);
                        const totalFrames = extractedFrames.length;
                        const currentSent = Math.floor((e.loaded / e.total) * totalFrames);
                        progressText.textContent = `${dict['sending_frames'] || 'Enviando'}... ${currentSent}/${totalFrames} (${percent}%)`;
                        updateProgressBar(percent);
                    }
                };

                xhr.upload.onload = () => {
                    // Switch to processing mode/message once upload is done
                    currentProcessingStep = 'processing';
                    const dict = window.translations[currentLang] || window.translations['es'];
                    const totalFrames = extractedFrames.length;

                    const label = dict['processing'] || (currentLang === 'es' ? 'Procesando' : 'Processing');
                    const unit = currentLang === 'es' ? 'fotogramas' : 'frames';
                    const ofText = currentLang === 'es' ? 'de' : 'of';

                    progressText.textContent = `${label}: 0 ${ofText} ${totalFrames} ${unit} (0%)`;
                    updateProgressBar(0);
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
        currentProcessingStep = 'idle';
        priorityActions.classList.add('hidden');
        const dict = window.translations[currentLang] || window.translations['es'];
        progressText.textContent = (isSecondPassMode ? 'Segunda pasada: ' : '') + (dict['done'] || '¡Listo!');
        updateProgressBar(100);
        etaText.textContent = '';

        // Store the original blobs from the server
        processedFrameBlobs = frames.map(base64StringToBlob);

        // Process UI
        await updateFinalSpriteSheet();

        progressContainer.classList.add('hidden');
        goToStep(4);

        // Reset mode after success
        isSecondPassMode = false;
    }

    async function updateFinalSpriteSheet() {
        if (processedFrameBlobs.length === 0) return;

        // Apply Smart Crop and Resize Logic to the original results
        const finalBlobs = await processSmartCropAndResize(processedFrameBlobs);

        displayResultFrames(finalBlobs);
        await createSpriteSheet(finalBlobs);
    }

    async function processSmartCropAndResize(blobs) {
        const smartCrop = smartCropCheck.checked;
        const pixelArtMode = pixelArtCheck.checked;
        const exportSizeValue = exportSizeSelect.value;

        let targetWidth = null, targetHeight = null;
        if (exportSizeValue === '16') { targetWidth = 16; targetHeight = 16; }
        else if (exportSizeValue === '32') { targetWidth = 32; targetHeight = 32; }
        else if (exportSizeValue === '64') { targetWidth = 64; targetHeight = 64; }
        else if (exportSizeValue === 'custom') {
            targetWidth = parseInt(customWidthInput.value) || 32;
            targetHeight = parseInt(customHeightInput.value) || 32;
        }

        const images = await Promise.all(blobs.map(blob => {
            return new Promise(res => {
                const img = new Image();
                img.onload = () => res(img);
                img.src = URL.createObjectURL(blob);
            });
        }));

        let globalBounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        let hasGlobalPixels = false;

        if (smartCrop) {
            // Find global bounding box across all frames
            for (const img of images) {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                let minX = img.width, minY = img.height, maxX = 0, maxY = 0;
                let hasPixels = false;

                for (let y = 0; y < img.height; y++) {
                    for (let x = 0; x < img.width; x++) {
                        const alpha = data[(y * img.width + x) * 4 + 3];
                        if (alpha > 10) { // Threshold for non-transparency
                            if (x < minX) minX = x;
                            if (x > maxX) maxX = x;
                            if (y < minY) minY = y;
                            if (y > maxY) maxY = y;
                            hasPixels = true;
                        }
                    }
                }

                if (hasPixels) {
                    if (minX < globalBounds.minX) globalBounds.minX = minX;
                    if (maxX > globalBounds.maxX) globalBounds.maxX = maxX;
                    if (minY < globalBounds.minY) globalBounds.minY = minY;
                    if (maxY > globalBounds.maxY) globalBounds.maxY = maxY;
                    hasGlobalPixels = true;
                }
            }

            if (hasGlobalPixels) {
                // Add 1px padding
                globalBounds.minX = Math.max(0, globalBounds.minX - 1);
                globalBounds.minY = Math.max(0, globalBounds.minY - 1);
                globalBounds.maxX = Math.min(images[0].width - 1, globalBounds.maxX + 1);
                globalBounds.maxY = Math.min(images[0].height - 1, globalBounds.maxY + 1);
            } else {
                globalBounds = { minX: 0, minY: 0, maxX: images[0].width - 1, maxY: images[0].height - 1 };
            }
        } else {
            globalBounds = { minX: 0, minY: 0, maxX: images[0].width - 1, maxY: images[0].height - 1 };
        }

        const cropWidth = Math.round(globalBounds.maxX - globalBounds.minX + 1);
        const cropHeight = Math.round(globalBounds.maxY - globalBounds.minY + 1);

        // Process each image (crop and resize)
        const processedBlobs = await Promise.all(images.map(img => {
            const canvas = document.createElement('canvas');

            const canvasWidth = Math.round(targetWidth || cropWidth);
            const canvasHeight = Math.round(targetHeight || cropHeight);

            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const ctx = canvas.getContext('2d');

            // Force Nearest Neighbor for sharp scaling
            if (pixelArtMode) {
                ctx.imageSmoothingEnabled = false;
                ctx.imageSmoothingQuality = 'low';
            } else {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
            }

            if (!targetWidth || (cropWidth === targetWidth && cropHeight === targetHeight)) {
                // Mode "Original" or already matches target: Simple crop/copy
                ctx.drawImage(
                    img,
                    globalBounds.minX, globalBounds.minY, cropWidth, cropHeight,
                    0, 0, canvasWidth, canvasHeight
                );
            } else {
                // Mode "C": Center the character in the target size without stretching
                // This adds "vacios" (empty space) around the character if it's smaller
                const destX = Math.floor((canvasWidth - cropWidth) / 2);
                const destY = Math.floor((canvasHeight - cropHeight) / 2);

                // If the character is larger than the target, we scale it down using nearest neighbor
                // to maintain pixel art style as much as possible, or just center-crop it.
                // Centering with scaling if it exceeds bounds:
                if (cropWidth > canvasWidth || cropHeight > canvasHeight) {
                    const ratio = Math.min(canvasWidth / cropWidth, canvasHeight / cropHeight);
                    const scaledW = Math.round(cropWidth * ratio);
                    const scaledH = Math.round(cropHeight * ratio);
                    const offX = Math.floor((canvasWidth - scaledW) / 2);
                    const offY = Math.floor((canvasHeight - scaledH) / 2);
                    ctx.drawImage(
                        img,
                        globalBounds.minX, globalBounds.minY, cropWidth, cropHeight,
                        offX, offY, scaledW, scaledH
                    );
                } else {
                    // No scaling needed, just center
                    ctx.drawImage(
                        img,
                        globalBounds.minX, globalBounds.minY, cropWidth, cropHeight,
                        destX, destY, cropWidth, cropHeight
                    );
                }
            }

            return new Promise(r => canvas.toBlob(r, 'image/png'));
        }));

        return processedBlobs;
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
        if (selectedElements.length === 0) return;

        const selectedBlobs = Array.from(selectedElements).map(el => {
            const imgSrc = el.querySelector('img').src;
            return fetch(imgSrc).then(r => r.blob());
        });

        extractedFrames = (await Promise.all(selectedBlobs)).map((blob, index) => ({ id: index, blob }));
        isSecondPassMode = true;

        resultContainer.classList.add('hidden');
        reprocessBtn.classList.add('hidden');

        // Trigger queue processing with these new frames (second pass)
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
            ctx.imageSmoothingEnabled = false;
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
        const scale = parseInt(exportScaleSelect.value) || 1;
        const images = await Promise.all(blobs.map(blob => {
            return new Promise(res => {
                const img = new Image();
                img.onload = () => res(img);
                img.src = URL.createObjectURL(blob);
            });
        }));

        if (images.length === 0) return;

        const baseFrameW = images[0].width;
        const baseFrameH = images[0].height;

        const scaledFrameW = Math.round(baseFrameW * scale);
        const scaledFrameH = Math.round(baseFrameH * scale);

        const totalWidth = scaledFrameW * images.length;
        const maxHeight = scaledFrameH;

        const canvas = document.createElement('canvas');
        canvas.width = totalWidth;
        canvas.height = maxHeight;
        const ctx = canvas.getContext('2d');

        // Ensure sharp rendering during sheet assembly/upscaling
        ctx.imageSmoothingEnabled = false;
        ctx.imageSmoothingQuality = 'low';

        images.forEach((img, index) => {
            ctx.drawImage(img, index * scaledFrameW, 0, scaledFrameW, scaledFrameH);
        });

        const cols = images.length;
        const rows = 1;

        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            spriteImage.src = url;
            downloadLink.href = url;

            // Add dimensions to download name if scaled
            if (scale > 1) {
                downloadLink.download = `sprite_${scaledFrameW}x${scaledFrameH}_${scale}x.png`;
            }

            // Save to localStorage for automatic loading in previsualizacion.html
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                try {
                    localStorage.setItem('vidspri_last_sprite', reader.result);
                    localStorage.setItem('vidspri_last_cols', cols);
                    localStorage.setItem('vidspri_last_rows', rows);

                    // Save to History (IndexedDB)
                    saveSpriteToHistory(reader.result);
                } catch (e) {
                    console.warn("Could not save to localStorage (quota exceeded?):", e);
                }
            };
        }, 'image/png');

        // Show metadata display
        updateMetadataUI(baseFrameW, baseFrameH, cols, rows, scale);
    }

    async function saveSpriteToHistory(dataUrl) {
        const dbName = "VidSpriHistory";
        const dbVersion = 1;
        const request = indexedDB.open(dbName, dbVersion);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('history')) {
                db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = (e) => {
            const db = e.target.result;
            const tx = db.transaction('history', 'readwrite');
            const store = tx.objectStore('history');
            const countReq = store.getAll();
            countReq.onsuccess = () => {
                const items = countReq.result.filter(i => i.type === 'sprite');
                if (items.length >= 10) {
                    items.sort((a, b) => a.timestamp - b.timestamp);
                    store.delete(items[0].id);
                }
                store.add({
                    type: 'sprite',
                    dataUrl: dataUrl,
                    prompt: "Sprite Sheet",
                    timestamp: Date.now(),
                    metadata: {
                        cols: parseInt(localStorage.getItem('vidspri_last_cols')) || 1,
                        rows: parseInt(localStorage.getItem('vidspri_last_rows')) || 1
                    }
                });
            };
        };
    }

    function updateProgressBar(percentage) {
        progressBarInner.style.width = `${percentage}%`;
    }

    function updateMetadataUI(w, h, c, r, s) {
        let metaDiv = document.getElementById('sprite-metadata-display');
        if (!metaDiv) {
            metaDiv = document.createElement('div');
            metaDiv.id = 'sprite-metadata-display';
            metaDiv.style.cssText = 'background: rgba(0,0,0,0.4); border-radius: 12px; padding: 15px; margin: 15px 0; text-align: left; font-size: 0.85rem; border: 1px solid var(--glass-border);';
            const target = document.querySelector('.result-actions');
            target.parentNode.insertBefore(metaDiv, target);
        }

        const dict = window.translations[currentLang] || window.translations['es'];
        const frameSizeLabel = dict['frame_size'] || 'Tamaño de cuadro';

        metaDiv.innerHTML = `
            <div style="color: var(--primary); font-weight: bold; margin-bottom: 8px;">${frameSizeLabel}: ${w}x${h}</div>
            <div style="opacity: 0.7;">Cols: ${c} | Rows: ${r} | Scale: ${s}x</div>
            <button id="download-readme-btn" class="pill-btn" style="margin-top: 10px; width: 100%; justify-content: center; font-size: 0.75rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                ${dict['download_metadata'] || 'Descargar README'}
            </button>
        `;

        document.getElementById('download-readme-btn').onclick = () => {
            const content = `VidSpri - Sprite Metadata
---------------------------
Frame Width: ${w}
Frame Height: ${h}
Columns: ${c}
Rows: ${r}
Export Scale: ${s}x
Final Frame Width: ${Math.round(w * s)}
Final Frame Height: ${Math.round(h * s)}

Generated by VidSpri.com`;
            const blob = new Blob([content], { type: 'text/plain' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'README_SPRITE.txt';
            link.click();
        };
    }
});
