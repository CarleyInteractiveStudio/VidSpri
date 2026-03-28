document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const mainMenu = document.getElementById('main-menu');
    const videoSection = document.getElementById('video-section');
    const videoSpriteBtn = document.getElementById('video-sprite-btn');
    const unavailableModal = document.getElementById('unavailable-modal');
    const form = document.getElementById('sprite-form');
    const generateSpriteBtn = document.getElementById('generate-sprite-btn');
    const queueStatusContainer = document.getElementById('queue-status-container');
    const queueStatusText = document.getElementById('queue-status-text');
    const priorityCodeInput = document.getElementById('priority-code-input');
    const applyPriorityCodeBtn = document.getElementById('apply-priority-code-btn');
    const priorityCodeMessage = document.getElementById('priority-code-message');
    const resultContainer = document.getElementById('result-container');
    const spriteImage = document.getElementById('sprite-image');
    const downloadLink = document.getElementById('download-link');
    const errorMessage = document.getElementById('error-message');

    let currentJobId = null;
    let pollingIntervalId = null;

    // --- Server URLs ---
    const serverBaseUrl = 'http://localhost:8000'; // Using local for dev
    const submitUrl = `${serverBaseUrl}/submit`;
    const statusUrlBase = `${serverBaseUrl}/status/`;
    const applyCodeUrlBase = `${serverBaseUrl}/apply_priority/`;
    const processUrlBase = `${serverBaseUrl}/process/`;

    // --- Event Listeners ---
    videoSpriteBtn.addEventListener('click', () => {
        mainMenu.classList.add('hidden');
        videoSection.classList.remove('hidden');
    });

    document.querySelectorAll('.coming-soon').forEach(button => {
        button.addEventListener('click', e => {
            e.preventDefault();
            unavailableModal.classList.remove('hidden');
        });
    });

    // This button starts the whole process
    generateSpriteBtn.addEventListener('click', submitNewJob);

    applyPriorityCodeBtn.addEventListener('click', async () => {
        if (!currentJobId) return;
        const code = priorityCodeInput.value.trim();
        if (!code) {
            priorityCodeMessage.textContent = "Por favor, introduce un código.";
            return;
        }
        priorityCodeMessage.textContent = "Aplicando código...";

        try {
            const response = await fetch(`${applyCodeUrlBase}${currentJobId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code })
            });
            const result = await response.json();
            priorityCodeMessage.textContent = response.ok ? result.message : `Error: ${result.detail}`;
        } catch (error) {
            priorityCodeMessage.textContent = "Error de conexión.";
        }
    });

    // --- Core Logic ---
    async function submitNewJob() {
        hideAllSections();
        queueStatusContainer.classList.remove('hidden');
        queueStatusText.textContent = "Enviando trabajo al servidor...";

        try {
            const response = await fetch(submitUrl, { method: 'POST' });
            if (!response.ok) throw new Error('El servidor no pudo aceptar el trabajo.');

            const jobData = await response.json();
            currentJobId = jobData.job_id;

            updateUIForStatus(jobData);
            startPolling(currentJobId);
        } catch (error) {
            showError(error.message);
        }
    }

    function startPolling(jobId) {
        if (pollingIntervalId) clearInterval(pollingIntervalId);
        pollingIntervalId = setInterval(async () => {
            try {
                const response = await fetch(`${statusUrlBase}${jobId}`);
                if (!response.ok) {
                    stopPolling();
                    showError(`No se pudo obtener el estado del trabajo.`);
                    return;
                }
                const data = await response.json();
                updateUIForStatus(data);
            } catch (error) {
                stopPolling();
                showError("Error de red al comprobar el estado.");
            }
        }, 3000); // Poll every 3 seconds
    }

    function stopPolling() {
        clearInterval(pollingIntervalId);
        pollingIntervalId = null;
    }

    async function handleProcessingState(jobId) {
        stopPolling();
        hideAllSections();
        queueStatusContainer.classList.remove('hidden');
        queueStatusText.textContent = "¡Es tu turno! Enviando fotogramas para procesar...";

        try {
            // Simulate sending frame data
            const processResponse = await fetch(`${processUrlBase}${jobId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ frame_count: 12 }) // Dummy data
            });

            if (!processResponse.ok) {
                 const errorResult = await processResponse.json();
                 throw new Error(errorResult.detail);
            }

            // Now, we can be pretty sure it's completed
            hideAllSections();
            resultContainer.classList.remove('hidden');
            spriteImage.src = "https://via.placeholder.com/400x100.png?text=Spritesheet+Generado";
            downloadLink.href = spriteImage.src;

        } catch(error) {
            showError(`El procesamiento final falló: ${error.message}`);
        }
    }

    function updateUIForStatus(data) {
        switch(data.status) {
            case 'queued':
                queueStatusText.textContent = `Estás en la posición #${data.queue_position} en la cola.`;
                break;
            case 'processing':
                handleProcessingState(data.job_id);
                break;
            case 'completed':
                stopPolling();
                hideAllSections();
                resultContainer.classList.remove('hidden');
                spriteImage.src = "https://via.placeholder.com/400x100.png?text=Spritesheet+Generado";
                downloadLink.href = spriteImage.src;
                break;
            case 'failed':
                stopPolling();
                showError("El trabajo de procesamiento ha fallado en el servidor.");
                break;
        }
    }

    // --- Helper Functions ---
    function hideAllSections() {
        videoSection.classList.add('hidden');
        queueStatusContainer.classList.add('hidden');
        resultContainer.classList.add('hidden');
        errorMessage.classList.add('hidden');
    }

    function showError(message) {
        hideAllSections();
        errorMessage.classList.remove('hidden');
        errorMessage.querySelector('p').textContent = `Error: ${message}`;
    }

    // Dummy logic for frame extraction for UI flow
    document.getElementById('extract-frames-btn').addEventListener('click', () => {
        document.getElementById('frame-preview-container').classList.remove('hidden');
        document.getElementById('video-section').classList.add('hidden');
    });
});
