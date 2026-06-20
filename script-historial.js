let currentTab = 'sprite';
let db;

async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("VidSpriHistory", 1);
        request.onupgradeneeded = (e) => {
            db = e.target.result;
            if (!db.objectStoreNames.contains('history')) {
                db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve();
        };
        request.onerror = (e) => reject(e);
    });
}

async function loadHistory() {
    const grid = document.getElementById('history-grid');
    const emptyMsg = document.getElementById('empty-msg');
    if (!grid) return;
    grid.innerHTML = '';

    const tx = db.transaction('history', 'readonly');
    const store = tx.objectStore('history');
    const request = store.getAll();

    request.onsuccess = () => {
        const allItems = request.result || [];
        const filtered = allItems
            .filter(item => {
                if (currentTab === 'sprite') return item.type === 'sprite';
                return item.type === 'music' || item.type === 'sound' || item.type === 'voice' || item.type === 'audio';
            })
            .sort((a, b) => b.timestamp - a.timestamp);

        if (filtered.length === 0) {
            emptyMsg.classList.remove('hidden');
        } else {
            emptyMsg.classList.add('hidden');
            filtered.forEach(item => {
                const card = createHistoryCard(item);
                grid.appendChild(card);
            });
        }
    };
}

function createHistoryCard(item) {
    const div = document.createElement('div');
    div.className = 'history-card';

    const date = new Date(item.timestamp).toLocaleString();
    let previewContent = '';
    let typeLabel = item.type.toUpperCase();

    const dataUrl = item.dataUrl || item.data;
    if (item.type === 'sprite') {
        previewContent = `<img src="${dataUrl}" alt="Sprite Sheet">`;
        const meta = item.metadata || (item.cols ? {cols: item.cols, rows: item.rows} : {cols:1, rows:1});
        typeLabel = `SPRITE (${meta.cols}x${meta.rows})`;
    } else {
        previewContent = `
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.5;">
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
            </svg>
        `;
    }

    div.innerHTML = `
        <div class="history-preview">
            ${previewContent}
        </div>
        <div class="history-info">
            <strong>${typeLabel}</strong><br>
            <span style="font-size: 0.8rem; opacity: 0.6;">${date}</span>
        </div>
        <div class="history-actions">
            <button class="pill-btn history-btn" onclick="downloadItem(${item.id})">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                <span data-i18n="download">Descargar</span>
            </button>
            ${item.type === 'sprite' ? `
                <button class="pill-btn history-btn highlight-btn" onclick="useSprite(${item.id})">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    <span data-i18n="preview_anim">Probar</span>
                </button>
            ` : `
                <button class="pill-btn history-btn" onclick="playAudio(${item.id})">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    <span>Play</span>
                </button>
            `}
            <button class="pill-btn history-btn" onclick="deleteItem(${item.id})" style="background: rgba(255,0,0,0.1); flex: 0 0 auto;">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        </div>
    `;
    return div;
}

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.innerText.toLowerCase().includes(tab));
    });
    loadHistory();
}

async function downloadItem(id) {
    const tx = db.transaction('history', 'readonly');
    const store = tx.objectStore('history');
    const item = await new Promise(r => {
        const req = store.get(id);
        req.onsuccess = () => r(req.result);
    });

    if (!item) return;
    const dataUrl = item.dataUrl || item.data;

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = item.type === 'sprite' ? `vidspri_sheet_${id}.png` : `vidspri_audio_${id}.wav`;
    link.click();
}

async function useSprite(id) {
    const tx = db.transaction('history', 'readonly');
    const store = tx.objectStore('history');
    const item = await new Promise(r => {
        const req = store.get(id);
        req.onsuccess = () => r(req.result);
    });

    if (!item) return;
    const dataUrl = item.dataUrl || item.data;

    localStorage.setItem('vidspri_last_sprite', dataUrl);
    const meta = item.metadata || (item.cols ? {cols: item.cols, rows: item.rows} : {cols:1, rows:1});
    localStorage.setItem('vidspri_last_cols', meta.cols);
    localStorage.setItem('vidspri_last_rows', meta.rows);
    window.location.href = 'previsualizacion.html';
}

let currentAudio = null;
async function playAudio(id) {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    const tx = db.transaction('history', 'readonly');
    const store = tx.objectStore('history');
    const item = await new Promise(r => {
        const req = store.get(id);
        req.onsuccess = () => r(req.result);
    });

    if (!item) return;
    const dataUrl = item.dataUrl || item.data;
    currentAudio = new Audio(dataUrl);
    currentAudio.play();
}

async function deleteItem(id) {
    if (!confirm('¿Eliminar de historial?')) return;

    const tx = db.transaction('history', 'readwrite');
    const store = tx.objectStore('history');
    store.delete(id);
    tx.oncomplete = () => loadHistory();
}

document.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    loadHistory();
    if (window.applyTranslations) window.applyTranslations();
});
