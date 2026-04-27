
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
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const ssoToken = params.get('sso_token');
        const ssoUserId = params.get('user_id');

        if (ssoToken && ssoUserId) {
            userId = ssoUserId;
            localStorage.setItem('vidspri_user_id', userId);
            localStorage.setItem('vidspri_sso_token', ssoToken);
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
                }
            }
        });

        if (bridgeIframe) {
            bridgeIframe.onload = () => {
                bridgeIframe.contentWindow.postMessage({
                    type: 'CHECK_SESSION',
                    requestId: 'initial-check'
                }, 'https://carleystudio.com');
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

    // --- Supabase Logic ---
    function subscribeToGlobalNotifications() {
        supabaseClient
            .channel('global_notifications')
            .on('postgres_changes', { event: 'INSERT', table: 'global_notifications' }, payload => {
                showToast(payload.new.message, payload.new.type, true);
            })
            .subscribe();
    }
});
