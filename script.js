
document.addEventListener('DOMContentLoaded', () => {
    // --- Supabase Configuration ---
    const SUPABASE_URL = 'https://tladrluezsmmhjbhupgb.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_zb8TGeURLnafHWDffG9DMg_PtFO_kmv';
    // The CDN version exposes 'supabase' as a global object
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // --- Global State ---
    let extractedFrames = [];
    let currentJobId = null;
    let userId = localStorage.getItem('vidspri_user_id') || crypto.randomUUID();
    localStorage.setItem('vidspri_user_id', userId);

    // --- DOM Elements ---
    const mainMenu = document.getElementById('main-menu');
    const videoSection = document.getElementById('video-section');
    const codesList = document.getElementById('priority-codes-list');
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

    // --- Initialization ---
    loadPriorityCodes();
    subscribeToGlobalNotifications();
    checkExistingPriorityStatus();

    // --- Toast Notifications ---
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${message}</span>`;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    // --- Supabase Logic ---
    async function loadPriorityCodes() {
        try {
            await supabaseClient.rpc('refresh_priority_codes');
            const { data, error } = await supabaseClient
                .from('priority_codes')
                .select('*')
                .eq('is_auto', true)
                .order('created_at', { ascending: false });

            if (error) throw error;

            codesList.innerHTML = '';
            data.slice(0, 7).forEach(code => {
                const codeEl = document.createElement('div');
                codeEl.className = `code-item ${code.is_used ? 'used' : ''}`;
                codeEl.textContent = code.code;
                if (!code.is_used) {
                    codeEl.title = 'Haz clic para copiar';
                    codeEl.onclick = () => {
                        navigator.clipboard.writeText(code.code);
                        showToast('¡Código copiado al portapapeles!', 'success');
                    };
                }
                codesList.appendChild(codeEl);
            });
        } catch (e) {
            console.error('Error loading codes:', e);
            codesList.innerHTML = '<p class="small-text">No se pudieron cargar los códigos.</p>';
        }
    }

    function subscribeToGlobalNotifications() {
        supabaseClient
            .channel('global_notifications')
            .on('postgres_changes', { event: 'INSERT', table: 'global_notifications' }, payload => {
                showToast(payload.new.message, payload.new.type);
            })
            .subscribe();
    }

    function checkExistingPriorityStatus() {
        const isPriority = localStorage.getItem('vidspri_priority_active') === 'true';
        if (isPriority) {
            document.getElementById('premium-status').textContent = 'Estado: PRIORITARIO 🚀';
        }
    }

    // --- UI Interactions ---
    document.getElementById('video-sprite-btn').addEventListener('click', () => {
        mainMenu.classList.add('hidden');
        videoSection.classList.remove('hidden');
    });

    videoFileInput.addEventListener('change', () => {
        const file = videoFileInput.files[0];
        if (file) {
            videoPreview.src = URL.createObjectURL(file);
            document.getElementById('video-preview-container').classList.remove('hidden');
            document.getElementById('drag-drop-area-video').classList.add('hidden');
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
            showToast("Por favor, sube un archivo de video.", "error");
            return;
        }

        const frameCount = parseInt(document.getElementById('frames').value, 10);
        let startTime = 0;
        let endTime = videoPreview.duration;

        if (!fullVideoCheckbox.checked) {
            startTime = parseFloat(startTimeInput.value);
            endTime = parseFloat(endTimeInput.value);
        }

        if (isNaN(startTime) || isNaN(endTime) || startTime >= endTime) {
            showToast("El rango de tiempo seleccionado no es válido.", "error");
            return;
        }

        progressContainer.classList.remove('hidden');
        progressText.textContent = "Extrayendo fotogramas del video...";
        updateProgressBar(30);

        try {
            const frames = await extractFramesFromVideo(videoFile, frameCount, startTime, endTime);
            extractedFrames = frames.map((blob, index) => ({ id: index, blob }));
            displayFramePreviews();
            document.getElementById('frame-preview-container').classList.remove('hidden');
            videoSection.classList.add('hidden');
        } catch (e) {
            showToast(`Error: ${e.message}`, "error");
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
        progressText.textContent = "Uniéndose a la cola de procesamiento...";
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
            showToast("Error al unirse a la cola: " + e.message, "error");
            progressContainer.classList.add('hidden');
        }
    });

    function startQueueTracking(jobId) {
        supabaseClient
            .channel(`job-${jobId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                table: 'processing_queue',
                filter: `id=eq.${jobId}`
            }, payload => {
                if (payload.new.status === 'completed') {
                    showToast("¡Procesamiento terminado!", "success");
                } else if (payload.new.status === 'failed') {
                    showToast("El procesamiento ha fallado.", "error");
                    progressContainer.classList.add('hidden');
                }
            })
            .subscribe();

        checkPosition(jobId);
    }

    async function checkPosition(jobId) {
        const { data: jobData, error } = await supabaseClient.from('processing_queue').select('*').eq('id', jobId).single();
        if (error || !jobData) return;

        if (jobData.status !== 'waiting') return;

        // Count jobs ahead:
        // 1. All priority jobs if I'm not priority.
        // 2. Only priority jobs with smaller queue_number if I am priority.
        // 3. All priority jobs + non-priority jobs with smaller queue_number if I'm not priority.

        let query = supabaseClient
            .from('processing_queue')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'waiting');

        if (jobData.is_priority) {
            query = query.eq('is_priority', true).lt('queue_number', jobData.queue_number);
        } else {
            // For non-priority: everyone who is priority OR (not priority and smaller queue_number)
            // Supabase client filters are ANDed. We need an OR.
            query = query.or(`is_priority.eq.true,and(is_priority.eq.false,queue_number.lt.${jobData.queue_number})`);
        }

        const { count, error: countError } = await query;
        if (countError) throw countError;

        progressText.textContent = `En cola... Personas delante: ${count}`;
        updateProgressBar(15 + (count === 0 ? 10 : 0));

        if (count === 0) {
            findFreeServerAndProcess(jobId);
        } else {
            setTimeout(() => checkPosition(jobId), 5000);
        }
    }

    async function findFreeServerAndProcess(jobId) {
        progressText.textContent = "Buscando un servidor libre...";

        const { data: servers } = await supabaseClient
            .from('server_status')
            .select('*')
            .eq('status', 'free')
            .gt('last_heartbeat', new Date(Date.now() - 30000).toISOString()); // Heartbeat within last 30s

        if (!servers || servers.length === 0) {
            progressText.textContent = "Todos los servidores están ocupados. Esperando...";
            setTimeout(() => findFreeServerAndProcess(jobId), 3000);
            return;
        }

        // Pick one (randomly or first available)
        const server = servers[Math.floor(Math.random() * servers.length)];
        sendToProcessingServer(server.url, jobId);
    }

    async function sendToProcessingServer(serverUrl, jobId) {
        progressText.textContent = "¡Servidor listo! Enviando fotogramas...";
        updateProgressBar(40);

        await supabaseClient.from('processing_queue').update({ status: 'processing' }).eq('id', jobId);

        const formData = new FormData();
        extractedFrames.forEach(f => formData.append('images', f.blob, `frame_${f.id}.png`));

        try {
            const response = await fetch(`${serverUrl}/process-batch/${jobId}`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error("El servidor de procesamiento devolvió un error.");

            const result = await response.json();
            handleProcessingSuccess(result.frames);
        } catch (e) {
            showToast("Error de procesamiento: " + e.message, "error");
            await supabaseClient.from('processing_queue').update({ status: 'failed' }).eq('id', jobId);
            progressContainer.classList.add('hidden');
        }
    }

    async function handleProcessingSuccess(frames) {
        progressText.textContent = "Creando tu hoja de sprites...";
        updateProgressBar(90);
        const blobs = frames.map(base64StringToBlob);
        await createSpriteSheet(blobs);
        progressContainer.classList.add('hidden');
        resultContainer.classList.remove('hidden');
        document.getElementById('frame-preview-container').classList.add('hidden');
        showToast("¡Hoja de sprites generada con éxito!", "success");
    }

    // --- Priority Codes ---
    document.getElementById('premium-code-btn').addEventListener('click', () => {
        document.getElementById('premium-modal').classList.remove('hidden');
    });

    document.querySelector('.close-premium-btn').addEventListener('click', () => {
        document.getElementById('premium-modal').classList.add('hidden');
    });

    document.getElementById('save-premium-code-btn').addEventListener('click', async () => {
        const code = document.getElementById('premium-code-input').value.trim();
        if (!code) return;

        const { data, error } = await supabaseClient
            .from('priority_codes')
            .select('*')
            .eq('code', code)
            .eq('is_used', false)
            .single();

        if (error || !data) {
            showToast("Código no válido o ya utilizado.", "error");
        } else {
            await supabaseClient.from('priority_codes').update({ is_used: true }).eq('code', code);
            localStorage.setItem('vidspri_priority_active', 'true');
            showToast("¡Acceso prioritario activado! Tus trabajos irán más rápido.", "success");
            document.getElementById('premium-modal').classList.add('hidden');
            document.getElementById('premium-status').textContent = 'Estado: PRIORITARIO 🚀';
            loadPriorityCodes();
        }
    });

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
                let current = startTime;
                let count = 0;

                video.onseeked = async () => {
                    ctx.drawImage(video, 0, 0);
                    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
                    frames.push(blob);
                    count++;
                    if (count < frameCount) {
                        current += interval;
                        video.currentTime = current;
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
        canvas.width = totalWidth;
        canvas.height = maxHeight;
        const ctx = canvas.getContext('2d');

        let x = 0;
        images.forEach(img => {
            ctx.drawImage(img, x, 0);
            x += img.width;
        });

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
