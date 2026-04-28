
// --- Supabase Configuration ---
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {
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
    // Moved to the end to ensure all functions are defined first
    async function cleanupStuckJobs() {
        try {
            // Only clean up 'video' jobs on main pages to allow concurrent audio/video jobs if needed,
            // or just clean up everything to avoid queue bloat.
            // Let's stick to cleaning up everything for stability.
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
    window.applyTranslations = function(lang) {
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
        let sessionReceived = false;
        const loginBtn = document.getElementById('login-btn');
        const logoutBtn = document.getElementById('logout-btn');
        const userInfo = document.getElementById('user-info');
        const userEmailEl = document.getElementById('user-email');

        // Helper: Decode JWT to get user metadata if bridge fails
        function parseJwt(token) {
            try {
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                return JSON.parse(jsonPayload);
            } catch (e) {
                return null;
            }
        }

        // 1. Initial State from LocalStorage
        const savedName = localStorage.getItem('vidspri_user_name');
        const hasToken = localStorage.getItem('vidspri_sso_token');

        console.log("Auth Init:", { hasToken: !!hasToken, savedName });

        if (hasToken) {
            const decoded = parseJwt(hasToken);
            if (decoded && decoded.user_metadata) {
                const meta = decoded.user_metadata;
                const name = meta.username || meta.display_name || meta.full_name || decoded.email || "Usuario";
                localStorage.setItem('vidspri_user_name', name);
                updateAuthUI(name);
            } else {
                updateAuthUI(savedName || "...");
            }
        } else if (savedName) {
            updateAuthUI(savedName);
        }

        // 2. Listen for bridge responses
        window.addEventListener('message', (event) => {
            if (event.origin !== 'https://carleystudio.com') return;

            if (event.data.type === 'BRIDGE_READY') {
                requestSessionCheck();
            }

            if (event.data.type === 'SESSION_RESPONSE') {
                sessionReceived = true;
                const session = event.data.payload;
                console.log("Bridge Session Response:", session ? "Session found" : "No session");

                if (session && session.user) {
                    const user = session.user;
                    userId = user.id;
                    localStorage.setItem('vidspri_user_id', userId);

                    const meta = user.user_metadata || {};
                    const displayName = meta.username || meta.display_name || meta.full_name || user.email || userId;
                    localStorage.setItem('vidspri_user_name', displayName);
                    updateAuthUI(displayName);
                } else {
                    // Only revert if we really don't have a token in localStorage
                    if (!localStorage.getItem('vidspri_sso_token')) {
                        console.log("Cleaning auth UI due to no session and no token.");
                        updateAuthUI(null);
                    } else {
                        console.log("Keeping local session despite empty bridge response.");
                    }
                }
            }
        });

        function requestSessionCheck() {
            if (bridgeIframe && bridgeIframe.contentWindow) {
                bridgeIframe.contentWindow.postMessage({
                    type: 'CHECK_SESSION',
                    requestId: 'poll-' + Date.now()
                }, '*');
            }
        }

        // 3. Handle incoming data from URL redirect (fast-path)
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const ssoToken = params.get('sso_token');
        const userIdFromHash = params.get('user_id');

        if (ssoToken) {
            localStorage.setItem('vidspri_sso_token', ssoToken);
            if (userIdFromHash) {
                userId = userIdFromHash;
                localStorage.setItem('vidspri_user_id', userId);
            }

            // Fast-path: decode name immediately from token
            const decoded = parseJwt(ssoToken);
            let name = "...";
            if (decoded && decoded.user_metadata) {
                const meta = decoded.user_metadata;
                name = meta.username || meta.display_name || meta.full_name || decoded.email || "Usuario";
                localStorage.setItem('vidspri_user_name', name);
            }

            // Use replaceState to clear hash without triggering scroll or history bloat
            history.replaceState(null, null, window.location.pathname + window.location.search);

            updateAuthUI(name);
            showToast("login_success", "success");
            requestSessionCheck(); // Request full metadata
        }

        function updateAuthUI(name) {
            const welcomeMsg = document.getElementById('welcome-msg');
            const welcomeName = document.getElementById('welcome-name');

            if (name) {
                // Logged in state
                if (welcomeMsg) welcomeMsg.classList.remove('hidden');
                if (welcomeName) welcomeName.textContent = name;

                if (loginBtn) loginBtn.classList.add('hidden');
                if (userInfo) userInfo.classList.remove('hidden');
                if (userEmailEl) userEmailEl.textContent = name;
            } else {
                // Logged out state
                if (welcomeMsg) welcomeMsg.classList.add('hidden');

                if (loginBtn) loginBtn.classList.remove('hidden');
                if (userInfo) userInfo.classList.add('hidden');
            }
        }

        // 4. Action Handlers
        if (loginBtn) {
            loginBtn.onclick = () => {
                const domain = "carleyinteractivestudio.github.io";
                const redirectTo = window.location.href.split('#')[0];
                window.location.href = `https://carleystudio.com/sso.html?domain=${domain}&redirect_to=${encodeURIComponent(redirectTo)}`;
            };
        }

        if (logoutBtn) {
            logoutBtn.onclick = () => {
                localStorage.removeItem('vidspri_user_id');
                localStorage.removeItem('vidspri_user_name');
                localStorage.removeItem('vidspri_sso_token');
                location.reload();
            };
        }

        // 5. Robust initialization
        if (bridgeIframe) {
            bridgeIframe.onload = requestSessionCheck;
        }

        let pollCount = 0;
        const pollInterval = setInterval(() => {
            if (sessionReceived || pollCount > 5) {
                clearInterval(pollInterval);
                return;
            }
            requestSessionCheck();
            pollCount++;
        }, 1000);
    }

    // --- Toast Notifications ---
    window.showToast = function(messageKey, type = 'info', isLiteral = false) {
        const dict = window.translations[currentLang] || window.translations['es'];
        const message = isLiteral ? messageKey : (dict[messageKey] || messageKey);

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${message}</span>`;
        const container = document.getElementById('toast-container');
        if (container) {
            container.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 300);
            }, 5000);
        }
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

    // --- Execute Initialization ---
    window.applyTranslations(currentLang);
    subscribeToGlobalNotifications();
    initSSO();
    cleanupStuckJobs();
});
