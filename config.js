// VidSpri Global Configuration
const CONFIG = {
    // Supabase Credentials
    // Replace these with your actual Supabase project values
    SUPABASE_URL: 'https://tladrluezsmmhjbhupgb.supabase.co',
    SUPABASE_KEY: 'sb_publishable_zb8TGeURLnafHWDffG9DMg_PtFO_kmv',

    // Server Endpoints (for heartbeats/fallback)
    SECRETARIO_URL: 'https://carley1234-vidspri-secretario.hf.space',
    ESPECIALISTA_URL: 'https://carley1234-vidspri.hf.space',

    // SSO Config
    SSO_BRIDGE_URL: 'https://carleystudio.com/sso/vidspri'
};

if (typeof module !== 'undefined') {
    module.exports = CONFIG;
}
