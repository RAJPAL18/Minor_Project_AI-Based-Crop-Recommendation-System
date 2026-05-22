/* ═══════════════════════════════════════════════════════════
   KisanConnect – auth.js
   Handles: Supabase client-side authentication (Login & Sign Up)
   ═══════════════════════════════════════════════════════════ */

// ── CONFIG & GLOBALS ─────────────────────────────────────────
const SUPABASE_URL = "https://fhkzhmrpnunbwzhktopi.supabase.co";
const SUPABASE_KEY = "sb_publishable_tRRjWDDU6CtJVmvDciqMgg_VX7MPKCo";

// Safe localStorage wrapper to prevent crashes in environments with disabled storage
const safeStorage = {
    getItem: (key) => {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn("Storage read blocked:", e);
            return null;
        }
    },
    setItem: (key, value) => {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn("Storage write blocked:", e);
        }
    },
    removeItem: (key) => {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn("Storage delete blocked:", e);
        }
    }
};

const getMockSupabase = () => {
    return {
        auth: {
            signInWithPassword: async () => {
                throw new Error("Supabase auth is unavailable (connection failed).");
            },
            signUp: async () => {
                throw new Error("Supabase auth is unavailable (connection failed).");
            }
        }
    };
};

let supabase = null;
if (window.supabase && typeof window.supabase.createClient === 'function') {
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        if (!supabase || !supabase.auth) {
            throw new Error("Created client lacks auth methods.");
        }
    } catch (err) {
        console.error("Failed to initialize Supabase client:", err);
        supabase = getMockSupabase();
    }
} else {
    console.warn("Supabase SDK failed to load. Authentication will run in offline/mock mode.");
    supabase = getMockSupabase();
}

// ── Utility: show banner ─────────────────────────────────────────
function showBanner(message, type = 'error') {
    const banner = document.getElementById('auth-banner');
    if (banner) {
        banner.textContent = message;
        banner.className = `auth-banner ${type}`;
        banner.style.display = 'block';
        if (type === 'success') {
            setTimeout(() => { banner.style.display = 'none'; }, 5000);
        }
    }
}

function hideBanner() {
    const banner = document.getElementById('auth-banner');
    if (banner) banner.style.display = 'none';
}

// ── Tab switching ────────────────────────────────────────────────
function switchTab(tab) {
    hideBanner();
    const indicator = document.getElementById('tab-indicator');
    const loginTab = document.getElementById('tab-login');
    const signupTab = document.getElementById('tab-signup');
    const loginForm = document.getElementById('form-login');
    const signupForm = document.getElementById('form-signup');

    if (tab === 'login') {
        if (loginTab) loginTab.classList.add('active');
        if (signupTab) signupTab.classList.remove('active');
        if (loginForm) loginForm.classList.add('active');
        if (signupForm) signupForm.classList.remove('active');
        if (indicator) indicator.classList.remove('right');
    } else {
        if (signupTab) signupTab.classList.add('active');
        if (loginTab) loginTab.classList.remove('active');
        if (signupForm) signupForm.classList.add('active');
        if (loginForm) loginForm.classList.remove('active');
        if (indicator) indicator.classList.add('right');
    }
}

// ── Password toggle ──────────────────────────────────────────────
function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input) {
        if (input.type === 'password') {
            input.type = 'text';
            btn.textContent = '🙈';
        } else {
            input.type = 'password';
            btn.textContent = '👁️';
        }
    }
}

// ── Save auth data & redirect ────────────────────────────────────
function saveAuthAndRedirect(session, user) {
    safeStorage.setItem('kc_token', session.access_token);
    safeStorage.setItem('kc_user', JSON.stringify(user));
    window.location.href = 'index.html';
}

// Make functions globally available for inline onclicks
window.switchTab = switchTab;
window.togglePassword = togglePassword;

// ── Event Listeners and Page Load Setup ──────────────────────────
function initAuth() {
    // 1. Check if already logged in and handle redirect
    const token = safeStorage.getItem('kc_token');
    if (token) {
        window.location.href = 'index.html';
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'signup') {
        switchTab('signup');
    }

    // 2. Password strength listener
    const signupPw = document.getElementById('signup-password');
    if (signupPw) {
        signupPw.addEventListener('input', function () {
            const val = this.value;
            const meter = document.getElementById('pw-strength');
            const fill = document.getElementById('pw-strength-fill');
            const label = document.getElementById('pw-strength-label');

            if (!meter) return;
            if (!val) { meter.style.display = 'none'; return; }
            meter.style.display = 'flex';

            let score = 0;
            if (val.length >= 8) score++;
            if (/[A-Z]/.test(val)) score++;
            if (/[0-9]/.test(val)) score++;
            if (/[^A-Za-z0-9]/.test(val)) score++;

            const levels = [
                { pct: '25%', color: '#ef4444', text: 'Weak' },
                { pct: '50%', color: '#f97316', text: 'Fair' },
                { pct: '75%', color: '#eab308', text: 'Good' },
                { pct: '100%', color: '#22c55e', text: 'Strong' },
            ];
            const lv = levels[score - 1] || levels[0];
            if (fill) {
                fill.style.width = lv.pct;
                fill.style.background = lv.color;
            }
            if (label) {
                label.textContent = lv.text;
                label.style.color = lv.color;
            }
        });
    }

    // 3. Login submit handler
    const loginForm = document.getElementById('form-login');
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            hideBanner();

            const email = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;

            if (!email || !password) {
                showBanner('Please fill in all fields.'); return;
            }

            const btn = document.getElementById('login-btn');
            const btnText = document.getElementById('login-btn-text');
            const spinner = document.getElementById('login-spinner');

            if (btn) btn.disabled = true;
            if (btnText) btnText.textContent = 'Logging in…';
            if (spinner) spinner.style.display = 'block';

            try {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password,
                });

                if (error) {
                    showBanner(error.message || 'Login failed. Please check your credentials.');
                    return;
                }

                showBanner('Login successful! Redirecting…', 'success');
                setTimeout(() => saveAuthAndRedirect(data.session, data.user), 800);

            } catch (err) {
                showBanner('Cannot reach authentication server.');
            } finally {
                if (btn) btn.disabled = false;
                if (btnText) btnText.textContent = 'Login to Dashboard';
                if (spinner) spinner.style.display = 'none';
            }
        });
    }

    // 4. Signup submit handler
    const signupForm = document.getElementById('form-signup');
    if (signupForm) {
        signupForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            hideBanner();

            const fullName = document.getElementById('signup-fullname').value.trim();
            const username = document.getElementById('signup-username').value.trim();
            const email = document.getElementById('signup-email').value.trim();
            const password = document.getElementById('signup-password').value;
            const confirm = document.getElementById('signup-confirm').value;

            if (!username || !email || !password || !confirm) {
                showBanner('Please fill in all required fields.'); return;
            }
            if (password !== confirm) {
                showBanner('Passwords do not match.'); return;
            }
            if (password.length < 8) {
                showBanner('Password must be at least 8 characters.'); return;
            }

            const btn = document.getElementById('signup-btn');
            const btnText = document.getElementById('signup-btn-text');
            const spinner = document.getElementById('signup-spinner');

            if (btn) btn.disabled = true;
            if (btnText) btnText.textContent = 'Creating account…';
            if (spinner) spinner.style.display = 'block';

            try {
                const { data, error } = await supabase.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            full_name: fullName,
                            username: username
                        }
                    }
                });

                if (error) {
                    showBanner(error.message || 'Registration failed.');
                    return;
                }

                if (data.session) {
                    showBanner('Account created! Redirecting…', 'success');
                    setTimeout(() => saveAuthAndRedirect(data.session, data.user), 800);
                } else {
                    showBanner('Account created! Please check your email to confirm registration, then log in.', 'success');
                    setTimeout(() => switchTab('login'), 3000);
                }

            } catch (err) {
                showBanner('Cannot reach authentication server.');
            } finally {
                if (btn) btn.disabled = false;
                if (btnText) btnText.textContent = 'Create My Account';
                if (spinner) spinner.style.display = 'none';
            }
        });
    }
}

// Safely execute initAuth regardless of whether DOMContentLoaded has already fired
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    initAuth();
}
