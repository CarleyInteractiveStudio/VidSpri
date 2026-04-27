
document.addEventListener('DOMContentLoaded', () => {
    // --- Supabase Configuration ---
    const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

    // --- Global State ---
    let userId = localStorage.getItem('vidspri_user_id') || crypto.randomUUID();
    localStorage.setItem('vidspri_user_id', userId);
    let currentLang = localStorage.getItem('vidspri_lang') || 'es';

    // --- DOM Elements ---
    const toastContainer = document.getElementById('toast-container');
    const bridgeIframe = document.getElementById('sso-bridge');
    const notifBtn = document.getElementById('notif-btn');
    const notifModal = document.getElementById('notif-modal');
    const closeNotifModal = document.getElementById('close-notif-modal');
    const notifList = document.getElementById('notif-list');
    const notifBadge = document.querySelector('.notif-badge');

    // --- Initialization ---
    applyTranslations(currentLang);
    subscribeToGlobalNotifications();
    initSSO();
    cleanupStuckJobs();

    // --- Queue Management ---
    async function cleanupStuckJobs() {
        try {
            // Cancel any previous jobs from this user that might be stuck
            await supabaseClient
                .from('processing_queue')
                .update({ status: 'failed' })
                .eq('user_id', userId)
                .in('status', ['waiting', 'authorized', 'processing']);
        } catch (e) {
            console.error("Error cleaning up stuck jobs:", e);
        }
    }

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
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const ssoToken = params.get('sso_token');

        if (ssoToken) {
            console.log("¡Sesión iniciada con éxito!");
            localStorage.setItem('vidspri_sso_token', ssoToken);

            // Trigger a check via bridge to get user details
            if (bridgeIframe && bridgeIframe.contentWindow) {
                bridgeIframe.contentWindow.postMessage({
                    type: 'CHECK_SESSION',
                    token: ssoToken
                }, 'https://carleystudio.com');
            }

            window.location.hash = "";
            showToast("¡Sesión iniciada con éxito!", "success", true);
        }

        window.addEventListener('message', (event) => {
            if (event.origin !== 'https://carleystudio.com') return;
            if (event.data.type === 'SESSION_RESPONSE') {
                const user = event.data.payload;
                if (user) {
                    userId = user.id;
                    localStorage.setItem('vidspri_user_id', userId);
                    const displayName = user.display_name || user.username || user.email;
                    localStorage.setItem('vidspri_user_name', displayName);
                    updateWelcomeMessage(displayName);
                }
            }
        });

        if (bridgeIframe) {
            const checkSession = () => {
                const token = localStorage.getItem('vidspri_sso_token');
                if (token) {
                    bridgeIframe.contentWindow.postMessage({
                        type: 'CHECK_SESSION',
                        token: token,
                        requestId: 'initial-check'
                    }, 'https://carleystudio.com');
                }
            };
            if (bridgeIframe.contentWindow) checkSession();
            bridgeIframe.onload = checkSession;
        }

        const savedName = localStorage.getItem('vidspri_user_name');
        if (savedName) updateWelcomeMessage(savedName);
    }

    function updateWelcomeMessage(name) {
        const welcomeMsg = document.getElementById('welcome-msg');
        const welcomeName = document.getElementById('welcome-name');
        if (welcomeMsg && welcomeName) {
            welcomeName.textContent = name;
            welcomeMsg.classList.remove('hidden');
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

    // --- Supabase Logic ---
    async function subscribeToGlobalNotifications() {
        // Initial fetch
        const { data } = await supabaseClient
            .from('global_notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        if (data && data.length > 0) {
            renderNotifications(data);
        }

        supabaseClient
            .channel('global_notifications')
            .on('postgres_changes', { event: 'INSERT', table: 'global_notifications' }, payload => {
                showToast(payload.new.message, payload.new.type, true);
                if (notifBadge) notifBadge.classList.remove('hidden');
                refreshNotifications();
            })
            .subscribe();
    }

    async function refreshNotifications() {
        const { data } = await supabaseClient
            .from('global_notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);
        if (data) renderNotifications(data);
    }

    function renderNotifications(notifs) {
        if (!notifList) return;
        notifList.innerHTML = '';
        if (notifs.length === 0) {
            notifList.innerHTML = '<p style="text-align: center; opacity: 0.6;">No hay notificaciones nuevas</p>';
            return;
        }

        notifs.forEach(n => {
            const div = document.createElement('div');
            div.className = `notif-item ${n.type || 'info'}`;
            div.innerHTML = `
                <div style="font-size: 0.9rem; color: white;">${n.message}</div>
                <div style="font-size: 0.75rem; opacity: 0.5; margin-top: 5px;">${new Date(n.created_at).toLocaleString()}</div>
            `;
            notifList.appendChild(div);
        });
    }

    // --- Notification Modal ---
    if (notifBtn) {
        notifBtn.onclick = () => {
            if (notifModal) notifModal.classList.remove('hidden');
            if (notifBadge) notifBadge.classList.add('hidden');
        };
    }
    if (closeNotifModal) {
        closeNotifModal.onclick = () => notifModal.classList.add('hidden');
    }
    if (notifModal) {
        window.addEventListener('click', (e) => {
            if (e.target === notifModal) notifModal.classList.add('hidden');
        });
    }
});
