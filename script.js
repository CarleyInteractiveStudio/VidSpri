
document.addEventListener('DOMContentLoaded', () => {
    // --- Supabase Configuration ---
    const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

    // --- Global State ---
    let extractedFrames = [];
    let currentJobId = null;
    let userId = localStorage.getItem('vidspri_user_id') || crypto.randomUUID();
    localStorage.setItem('vidspri_user_id', userId);
    let currentLang = localStorage.getItem('vidspri_lang') || 'es';

    // --- DOM Elements ---
    const mainMenu = document.getElementById('main-menu');
    const videoSection = document.getElementById('video-section');
    const editorSection = document.getElementById('editor-section');
    const framePreviewContainer = document.getElementById('frame-preview-container');
    const stepperContainer = document.getElementById('stepper-container');
    const steps = document.querySelectorAll('.step');

    const progressContainer = document.getElementById('progress-container');
    const progressText = document.getElementById('progress-text');
    const progressBarInner = document.getElementById('progress-bar-inner');
    const resultContainer = document.getElementById('result-container');
    const spriteImage = document.getElementById('sprite-image');
    const downloadLink = document.getElementById('download-link');
    const toastContainer = document.getElementById('toast-container');

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

    // Lang elements
    const langMenu = document.getElementById('lang-menu');
    const langOptions = document.querySelectorAll('.lang-option');

    // SSO elements
    const loginBtn = document.getElementById('login-btn');
    const userInfo = document.getElementById('user-info');
    const userNameEl = document.getElementById('user-name');
    const bridgeIframe = document.getElementById('sso-bridge');

    // --- Initialization ---
    applyTranslations(currentLang);
    subscribeToGlobalNotifications();
    initSSO();

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

    // --- SSO Logic ---
    function initSSO() {
        // Handle incoming SSO token from URL hash
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const ssoToken = params.get('sso_token');
        const ssoUserId = params.get('user_id');

        if (ssoToken && ssoUserId) {
            userId = ssoUserId;
            localStorage.setItem('vidspri_user_id', userId);
            localStorage.setItem('vidspri_sso_token', ssoToken);
            window.location.hash = ""; // Clean URL
            showToast("¡Sesión iniciada con éxito!", "success", true);
        }

        // Check session via Bridge
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

        // Request session check
        bridgeIframe.onload = () => {
            bridgeIframe.contentWindow.postMessage({
                type: 'CHECK_SESSION',
                requestId: 'initial-check'
            }, 'https://carleystudio.com');
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

    // --- Supabase Logic ---
    function subscribeToGlobalNotifications() {
        supabaseClient
            .channel('global_notifications')
            .on('postgres_changes', { event: 'INSERT', table: 'global_notifications' }, payload => {
                showToast(payload.new.message, payload.new.type, true);
            })
            .subscribe();
    }

    // --- Stepper Navigation ---
    function goToStep(stepNumber) {
        steps.forEach(s => {
            const sNum = parseInt(s.getAttribute('data-step'));
            s.classList.toggle('active', sNum <= stepNumber);
        });

        mainMenu.classList.add('hidden');
        videoSection.classList.add('hidden');
        editorSection.classList.add('hidden');
        framePreviewContainer.classList.add('hidden');
        stepperContainer.classList.remove('hidden');

        if (stepNumber === 1) videoSection.classList.remove('hidden');
        else if (stepNumber === 2) editorSection.classList.remove('hidden');
        else if (stepNumber === 3) framePreviewContainer.classList.remove('hidden');
    }

    // --- UI Interactions ---
    document.getElementById('video-sprite-btn').addEventListener('click', () => {
        goToStep(1);
    });

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

    const customFileBtn = document.getElementById('custom-file-btn');
    const fileStatus = document.getElementById('file-status');

    customFileBtn.addEventListener('click', () => videoFileInput.click());
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

    // Dual-handle range slider
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

    window.onmousemove = (e) => {
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
    };

    window.onmouseup = () => {
        isDraggingStart = false;
        isDraggingEnd = false;
    };

    videoPreview.ontimeupdate = () => {
        const p = videoPreview.currentTime / videoPreview.duration;
        timelineMarker.style.left = `${p * 100}%`;
    };

    manualInputToggle.onchange = () => {
        manualTimeInputs.classList.toggle('hidden', !manualInputToggle.checked);
    };

    startTimeInput.onchange = updateRangeUI;
    endTimeInput.onchange = updateRangeUI;

    // --- Frame Extraction ---
    document.getElementById('extract-frames-btn').addEventListener('click', async () => {
        const videoFile = videoFileInput.files[0];
        if (!videoFile) return;

        const frameCount = parseInt(document.getElementById('frames').value, 10);
        const startTime = parseFloat(startTimeInput.value);
        const endTime = parseFloat(endTimeInput.value);

        progressContainer.classList.remove('hidden');
        const dict = window.translations[currentLang] || window.translations['es'];
        progressText.textContent = dict['processing'];
        updateProgressBar(30);

        try {
            const frames = await extractFramesFromVideo(videoFile, frameCount, startTime, endTime);
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
            };
            container.appendChild(img);
            container.appendChild(del);
            output.appendChild(container);
        });
    }

    // --- Queue and Processing ---
    document.getElementById('generate-sprite-btn').addEventListener('click', async () => {
        if (extractedFrames.length === 0) return;

        progressContainer.classList.remove('hidden');
        const dict = window.translations[currentLang] || window.translations['es'];
        progressText.textContent = dict['joining'];
        updateProgressBar(10);

        const isPriority = localStorage.getItem('vidspri_priority_active') === 'true';

        try {
            const { data, error } = await supabaseClient
                .from('processing_queue')
                .insert([{ user_id: userId, is_priority: isPriority }])
                .select();

            if (error) throw error;

            currentJobId = data[0].id;
            startQueueTracking(currentJobId);
        } catch (e) {
            showToast(e.message, "error", true);
            progressContainer.classList.add('hidden');
        }
    });

    function startQueueTracking(jobId) {
        supabaseClient
            .channel(`job-${jobId}`)
            .on('postgres_changes', { event: 'UPDATE', table: 'processing_queue', filter: `id=eq.${jobId}` }, payload => {
                const job = payload.new;
                const dict = window.translations[currentLang] || window.translations['es'];

                if (job.status === 'authorized') {
                    sendToProcessingServer(job.assigned_server_url, jobId);
                } else if (job.status === 'completed') {
                    showToast('done', 'success');
                } else if (job.status === 'failed') {
                    showToast('Error', 'error', true);
                    progressContainer.classList.add('hidden');
                }
            })
            .subscribe();

        checkPosition(jobId);
    }

    async function checkPosition(jobId) {
        const { data: jobData } = await supabaseClient.from('processing_queue').select('*').eq('id', jobId).single();
        if (!jobData || (jobData.status !== 'waiting' && jobData.status !== 'authorized')) return;
        if (jobData.status === 'authorized') return; // Assignment handled by trigger

        const { count } = await supabaseClient
            .from('processing_queue')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'waiting')
            .or(`is_priority.gt.${jobData.is_priority},and(is_priority.eq.${jobData.is_priority},queue_number.lt.${jobData.queue_number})`);

        const dict = window.translations[currentLang] || window.translations['es'];
        progressText.textContent = dict['in_queue'] + count;
        updateProgressBar(15);

        setTimeout(() => checkPosition(jobId), 5000);
    }

    async function sendToProcessingServer(serverUrl, jobId) {
        const dict = window.translations[currentLang] || window.translations['es'];
        progressText.textContent = dict['sending_frames'];
        updateProgressBar(40);

        const formData = new FormData();
        extractedFrames.forEach(f => formData.append('images', f.blob, `frame_${f.id}.png`));

        try {
            const response = await fetch(`${serverUrl}/process-batch/${jobId}`, { method: 'POST', body: formData });
            const result = await response.json();
            handleProcessingSuccess(result.frames);
        } catch (e) {
            showToast(e.message, "error", true);
            progressContainer.classList.add('hidden');
        }
    }

    async function handleProcessingSuccess(frames) {
        const dict = window.translations[currentLang] || window.translations['es'];
        progressText.textContent = dict['done'];
        updateProgressBar(90);
        const blobs = frames.map(base64StringToBlob);
        await createSpriteSheet(blobs);
        progressContainer.classList.add('hidden');
        resultContainer.classList.remove('hidden');
        document.getElementById('frame-preview-container').classList.add('hidden');
    }


    // --- Helpers ---
    async function extractFramesFromVideo(videoFile, frameCount, startTime, endTime) {
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
        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            spriteImage.src = url;
            downloadLink.href = url;
        }, 'image/png');
    }

    function updateProgressBar(percentage) {
        progressBarInner.style.width = `${percentage}%`;
    }
});
