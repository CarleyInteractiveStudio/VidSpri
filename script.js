
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
    const startTimeInput = document.getElementById('start-time');
    const endTimeInput = document.getElementById('end-time');
    const fullVideoCheckbox = document.getElementById('full-video-checkbox');
    const timeRangeInputs = document.getElementById('time-range-inputs');

    // Lang elements
    const langBtn = document.getElementById('lang-btn');
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

    // --- UI Interactions ---
    document.getElementById('video-sprite-btn').addEventListener('click', () => {
        mainMenu.classList.add('hidden');
        videoSection.classList.remove('hidden');
    });

    const customFileBtn = document.getElementById('custom-file-btn');
    const fileStatus = document.getElementById('file-status');

    customFileBtn.addEventListener('click', () => videoFileInput.click());

    videoFileInput.addEventListener('change', () => {
        const file = videoFileInput.files[0];
        if (file) {
            const dict = window.translations[currentLang] || window.translations['es'];
            fileStatus.textContent = (dict['file_selected'] || "Archivo seleccionado: ") + file.name;
            videoPreview.src = URL.createObjectURL(file);
            document.getElementById('video-preview-container').classList.remove('hidden');
            // document.getElementById('drag-drop-area-video').classList.add('hidden'); // Keep it visible but updated
        }
    });

    document.getElementById('mark-start-btn').addEventListener('click', () => {
        startTimeInput.value = videoPreview.currentTime.toFixed(2);
        fullVideoCheckbox.checked = false;
        timeRangeInputs.classList.remove('hidden');
    });

    document.getElementById('mark-end-btn').addEventListener('click', () => {
        endTimeInput.value = videoPreview.currentTime.toFixed(2);
        fullVideoCheckbox.checked = false;
        timeRangeInputs.classList.remove('hidden');
    });

    fullVideoCheckbox.addEventListener('change', () => {
        timeRangeInputs.classList.toggle('hidden', fullVideoCheckbox.checked);
    });

    // --- Frame Extraction ---
    document.getElementById('extract-frames-btn').addEventListener('click', async () => {
        const videoFile = videoFileInput.files[0];
        if (!videoFile) {
            showToast("Selecciona un video", "error", true);
            return;
        }

        const frameCount = parseInt(document.getElementById('frames').value, 10);
        let startTime = 0;
        let endTime = videoPreview.duration;

        if (!fullVideoCheckbox.checked) {
            startTime = parseFloat(startTimeInput.value);
            endTime = parseFloat(endTimeInput.value);
        }

        progressContainer.classList.remove('hidden');
        const dict = window.translations[currentLang] || window.translations['es'];
        progressText.textContent = dict['processing'];
        updateProgressBar(30);

        try {
            const frames = await extractFramesFromVideo(videoFile, frameCount, startTime, endTime);
            extractedFrames = frames.map((blob, index) => ({ id: index, blob }));
            displayFramePreviews();
            document.getElementById('frame-preview-container').classList.remove('hidden');
            videoSection.classList.add('hidden');
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
