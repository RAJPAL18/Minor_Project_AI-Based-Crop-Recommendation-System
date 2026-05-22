/* ═══════════════════════════════════════════════════════════
   KisanConnect – script.js
   Handles: Supabase Auth/DB, dynamic weather fetching, crop recommendation API
   ═══════════════════════════════════════════════════════════ */

// ── CONFIG & GLOBALS ─────────────────────────────────────────
const API = 'http://localhost:8000';
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

// Language translations
const i18n = {
    en: {
        title: "KisanConnect",
        subtitle: "Smart, AI-Powered Crop Recommendations for Your Farm",
        form_title: "Enter Soil &amp; Location Details",
        n_label: "Nitrogen (N)",
        p_label: "Phosphorus (P)",
        k_label: "Potassium (K)",
        ph_label: "Soil pH",
        loc_label: "City / Location",
        loc_placeholder: "e.g., Indore, India",
        submit_btn: "Get Recommendation",
        result_title: "Recommended Crops",
        reset_btn: "Check Another",
        analyzing: "Analyzing...",
        weather_info: "Condition used for <b>{loc}</b>: Temp: {temp}°C, Humidity: {hum}%",
        geo_error: "Geolocation is not supported by your browser",
        city_error: "Could not determine city from location",
        fetch_error: "Error fetching location data",
        loc_unable: "Unable to retrieve your location",
        fetch_fail: "Failed to get recommendation. Please check if the backend is running.\n",
        why_suitable_title: "Why is this suitable?",
        explain_base: "<b>{crop}</b> is highly recommended because your soil has {reasons}. Furthermore, the local {weather_reason} climate perfectly supports its growth cycle.",
        reason_high_n: "high nitrogen",
        reason_low_n: "low nitrogen",
        reason_high_p: "rich phosphorus",
        reason_high_k: "high potassium",
        reason_acidic: "slightly acidic pH",
        reason_alkaline: "alkaline pH",
        reason_neutral: "optimal neutral pH",
        weather_warm: "warm", weather_cool: "cool", weather_rainy: "rainy", weather_dry: "dry", and: "and",
        temp_label: "Temperature", hum_label: "Humidity", rain_label: "Rainfall",
        history_title: "Your Prediction History",
        no_history: "No predictions yet. Try one!",
        history_date: "Date",
        history_crop: "Crop",
        history_inputs: "Inputs (N,P,K,pH)"
    },
    hi: {
        title: "किसान कनेक्ट",
        subtitle: "आपके खेत के लिए स्मार्ट, एआई-संचालित फसल की सिफारिशें",
        form_title: "मिट्टी और स्थान का विवरण दर्ज करें",
        n_label: "नाइट्रोजन (N)", p_label: "फॉस्फोरस (P)", k_label: "पोटेशियम (K)",
        ph_label: "मिट्टी का पीएच (pH)", loc_label: "शहर / स्थान",
        loc_placeholder: "जैसे, इंदौर, भारत", submit_btn: "सिफारिश प्राप्त करें",
        result_title: "अनुशंसित फसलें", reset_btn: "दूसरी जांच करें", analyzing: "विश्लेषण कर रहा है...",
        weather_info: "<b>{loc}</b> के लिए उपयोग की गई स्थिति: तापमान: {temp}°C, नमी: {hum}%",
        geo_error: "आपका ब्राउज़र जियोलोकेशन का समर्थन नहीं करता है",
        city_error: "स्थान से शहर का निर्धारण नहीं किया जा सका",
        fetch_error: "स्थान डेटा लाने में त्रुटि", loc_unable: "आपका स्थान प्राप्त करने में असमर्थ",
        fetch_fail: "सिफारिश प्राप्त करने में विफल।\n",
        why_suitable_title: "यह उपयुक्त क्यों है?",
        explain_base: "<b>{crop}</b> की अत्यधिक सिफारिश की जाती है क्योंकि आपकी मिट्टी में {reasons} है। इसके अलावा, स्थानीय {weather_reason} जलवायु इसके विकास चक्र का पूरी तरह से समर्थन करती है।",
        reason_high_n: "उच्च नाइट्रोजन", reason_low_n: "कम नाइट्रोजन", reason_high_p: "समृद्ध फॉस्फोरस",
        reason_high_k: "उच्च पोटेशियम", reason_acidic: "थोड़ा अम्लीय पीएच", reason_alkaline: "क्षारीय पीएच",
        reason_neutral: "इष्टतम तटस्थ पीएच", weather_warm: "गर्म", weather_cool: "ठंडी",
        weather_rainy: "बरसाती", weather_dry: "शुष्क", and: "और",
        temp_label: "तापमान", hum_label: "नमी", rain_label: "वर्षा",
        history_title: "आपका पिछला रिकॉर्ड",
        no_history: "अभी तक कोई रिकॉर्ड नहीं है।",
        history_date: "तारीख",
        history_crop: "फसल",
        history_inputs: "मिट्टी (N,P,K,pH)"
    }
};

// Application State variables
let authToken = safeStorage.getItem('kc_token') || null;
let authUser = null;
try {
    const storedUser = safeStorage.getItem('kc_user');
    if (storedUser && storedUser !== "undefined") {
        authUser = JSON.parse(storedUser);
    }
} catch (e) {
    console.error("Error parsing authUser from localStorage:", e);
}

let weatherMode = 'api'; // 'api' or 'manual'
let currentLang = 'en';
let lastWeatherParams = null;
let varshaSessionId = safeStorage.getItem('varsha_session_id') || null;
let isVarshaOpen = false;

// ── SUPABASE MOCK & INITIALIZATION ────────────────────────────
const makeDbChain = () => {
    const chain = {
        then: (onFulfilled) => Promise.resolve({ data: [], error: new Error("Supabase offline") }).then(onFulfilled)
    };
    const methods = ['select', 'eq', 'order', 'limit', 'insert'];
    methods.forEach(m => {
        chain[m] = () => chain;
    });
    return chain;
};

const getMockSupabase = () => {
    return {
        auth: {
            onAuthStateChange: (cb) => {
                console.log("Supabase offline: registered mock auth listener.");
                setTimeout(() => cb('SIGNED_OUT', null), 0);
                return { data: { subscription: { unsubscribe: () => {} } } };
            },
            signInWithPassword: async () => {
                throw new Error("Supabase auth is unavailable (connection failed).");
            },
            signUp: async () => {
                throw new Error("Supabase auth is unavailable (connection failed).");
            },
            signOut: async () => {
                console.log("Mock sign out done.");
            }
        },
        from: () => makeDbChain()
    };
};

let supabase;
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
    console.warn("Supabase SDK failed to load. Auth and Cloud DB functions will run in offline/mock mode.");
    supabase = getMockSupabase();
}

// ── AUTHENTICATION ACTIONS ────────────────────────────────────
function applyAuthUI() {
    const navAuthBtns = document.getElementById('nav-auth-btns');
    const navUser     = document.getElementById('nav-user');
    const navUserName = document.getElementById('nav-user-name');
    const historySection = document.getElementById('history-section');

    if (authUser && authToken) {
        if (navAuthBtns) navAuthBtns.style.display = 'none';
        if (navUser) navUser.style.display     = 'flex';
        const displayName = authUser.user_metadata?.full_name || authUser.user_metadata?.username || authUser.email;
        if (navUserName) navUserName.textContent = `👤 ${displayName}`;
        loadHistory(); // Load history when user is detected
    } else {
        if (navAuthBtns) navAuthBtns.style.display = 'flex';
        if (navUser) navUser.style.display     = 'none';
        if (historySection) historySection.style.display = 'none';
    }
}

function saveAuth(session, user) {
    authToken = session.access_token;
    authUser  = user;
    safeStorage.setItem('kc_token', authToken);
    safeStorage.setItem('kc_user',  JSON.stringify(authUser));
    applyAuthUI();
}

async function logout() {
    try {
        await supabase.auth.signOut();
    } catch (err) {
        console.error("Supabase signOut error:", err);
    }
    authToken = null;
    authUser  = null;
    safeStorage.removeItem('kc_token');
    safeStorage.removeItem('kc_user');
    applyAuthUI();
    location.reload();
}

// ── MODALS & INTERACTIVE ELEMENTS ─────────────────────────────
function openModal(tab) {
    const backdrop = document.getElementById('modal-backdrop');
    const modal = document.getElementById('auth-modal');
    if (backdrop) backdrop.classList.add('open');
    if (modal) modal.classList.add('open');
    hideBanner();
    switchModalTab(tab || 'login');
    setTimeout(() => {
        const firstInput = document.querySelector('#modal-form-login.active input, #modal-form-signup.active input');
        if (firstInput) firstInput.focus();
    }, 180);
}

function closeModal() {
    const backdrop = document.getElementById('modal-backdrop');
    const modal = document.getElementById('auth-modal');
    if (backdrop) backdrop.classList.remove('open');
    if (modal) modal.classList.remove('open');
    hideBanner();
}

function switchModalTab(tab) {
    hideBanner();
    const bar       = document.getElementById('modal-tab-bar');
    const tabLogin  = document.getElementById('modal-tab-login');
    const tabSignup = document.getElementById('modal-tab-signup');
    const fLogin    = document.getElementById('modal-form-login');
    const fSignup   = document.getElementById('modal-form-signup');

    if (tab === 'login') {
        if (tabLogin) tabLogin.classList.add('active');
        if (tabSignup) tabSignup.classList.remove('active');
        if (fLogin) fLogin.classList.add('active');
        if (fSignup) fSignup.classList.remove('active');
        if (bar) bar.classList.remove('right');
    } else {
        if (tabSignup) tabSignup.classList.add('active');
        if (tabLogin) tabLogin.classList.remove('active');
        if (fSignup) fSignup.classList.add('active');
        if (fLogin) fLogin.classList.remove('active');
        if (bar) bar.classList.add('right');
    }
}

function showBanner(msg, type = 'error') {
    const b = document.getElementById('modal-banner');
    if (b) {
        b.textContent = msg;
        b.className   = `modal-banner ${type}`;
        b.style.display = 'block';
    }
}

// Global scope bindings for inline onclick attributes
window.openModal = openModal;
window.closeModal = closeModal;
window.switchModalTab = switchModalTab;
window.logout = logout;

function hideBanner() {
    const b = document.getElementById('modal-banner');
    if (b) b.style.display = 'none';
}

function togglePw(inputId, btn) {
    const inp = document.getElementById(inputId);
    if (inp) {
        inp.type  = inp.type === 'password' ? 'text' : 'password';
        btn.textContent = inp.type === 'password' ? '👁️' : '🙈';
    }
}
window.togglePw = togglePw;

// ── WEATHER CORE ──────────────────────────────────────────────
function setWeatherMode(mode) {
    weatherMode = mode;
    
    const apiTab = document.getElementById('weather-tab-api');
    const manualTab = document.getElementById('weather-tab-manual');
    const fetchBtn = document.getElementById('fetch-weather-btn');
    const locationInput = document.getElementById('location');
    const tempInput = document.getElementById('temperature');
    const humInput = document.getElementById('humidity');
    const rainInput = document.getElementById('rainfall');
    const t = i18n[currentLang];

    if (mode === 'api') {
        if (apiTab) apiTab.classList.add('active');
        if (manualTab) manualTab.classList.remove('active');
        if (fetchBtn) fetchBtn.style.display = 'inline-block';
        if (locationInput) {
            locationInput.required = true;
            locationInput.placeholder = t.loc_placeholder;
        }

        // Set inputs to read-only
        if (tempInput) {
            tempInput.readOnly = true;
            tempInput.placeholder = currentLang === 'hi' ? "स्वचालित" : "Auto-filled";
        }
        if (humInput) {
            humInput.readOnly = true;
            humInput.placeholder = currentLang === 'hi' ? "स्वचालित" : "Auto-filled";
        }
        if (rainInput) {
            rainInput.readOnly = true;
            rainInput.placeholder = currentLang === 'hi' ? "स्वचालित" : "Auto-filled";
        }
    } else {
        if (manualTab) manualTab.classList.add('active');
        if (apiTab) apiTab.classList.remove('active');
        if (fetchBtn) fetchBtn.style.display = 'none';
        if (locationInput) {
            locationInput.required = false;
            locationInput.placeholder = currentLang === 'hi' ? "जैसे, पुणे (वैकल्पिक)" : "e.g. Pune, India (Optional)";
        }

        // Enable inputs
        if (tempInput) {
            tempInput.readOnly = false;
            tempInput.placeholder = "e.g. 28.5";
        }
        if (humInput) {
            humInput.readOnly = false;
            humInput.placeholder = "e.g. 65";
        }
        if (rainInput) {
            rainInput.readOnly = false;
            rainInput.placeholder = "e.g. 120.0";
        }
    }
}
window.setWeatherMode = setWeatherMode;

async function fetchWeatherFromAPI() {
    const locationInput = document.getElementById('location');
    if (!locationInput) return;
    const location = locationInput.value.trim();
    if (!location) {
        alert(currentLang === 'hi' ? "कृपया शहर का नाम दर्ज करें।" : "Please enter a city name.");
        locationInput.focus();
        return;
    }

    const fetchBtn = document.getElementById('fetch-weather-btn');
    const originalText = fetchBtn ? fetchBtn.textContent : '';
    if (fetchBtn) {
        fetchBtn.disabled = true;
        fetchBtn.textContent = '⏳';
    }

    try {
        const apiKey = "87462c78b0cad980926bae68a1b70eda";
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`;
        
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(currentLang === 'hi' ? "शहर नहीं मिला" : "City not found");
        }
        
        const data = await res.json();
        
        // Populate inputs
        const tempEl = document.getElementById('temperature');
        const humEl = document.getElementById('humidity');
        const rainEl = document.getElementById('rainfall');
        if (tempEl) tempEl.value = data.main.temp.toFixed(1);
        if (humEl) humEl.value = data.main.humidity;
        
        // Estimate monthly rainfall (mm)
        let rainfall = 100.0;
        if (data.rain && data.rain['1h']) {
            rainfall = data.rain['1h'] * 24 * 30;
        } else if (data.rain && data.rain['3h']) {
            rainfall = (data.rain['3h'] / 3) * 24 * 30;
        }
        if (rainEl) rainEl.value = rainfall.toFixed(1);

        // Success animation flash (adds green border briefly)
        const grid = document.getElementById('weather-inputs-grid');
        if (grid) {
            grid.style.borderColor = '#22c55e';
            grid.style.boxShadow = '0 0 15px rgba(34, 197, 94, 0.2)';
            setTimeout(() => {
                grid.style.borderColor = '';
                grid.style.boxShadow = '';
            }, 1200);
        }

    } catch (err) {
        alert((currentLang === 'hi' ? "मौसम जानकारी लाने में त्रुटि: " : "Error fetching weather data: ") + err.message);
    } finally {
        if (fetchBtn) {
            fetchBtn.disabled = false;
            fetchBtn.textContent = originalText;
        }
    }
}

// ── TRANSLATIONS & INTERPRETATION ────────────────────────────
function updateExplanationText(t) {
    if (!lastWeatherParams) return;
    const reasons = [];
    if (lastWeatherParams.N > 80)  reasons.push(t.reason_high_n);
    else if (lastWeatherParams.N < 40) reasons.push(t.reason_low_n);
    if (lastWeatherParams.P > 60)  reasons.push(t.reason_high_p);
    if (lastWeatherParams.K > 60)  reasons.push(t.reason_high_k);
    if (lastWeatherParams.ph < 6.0)     reasons.push(t.reason_acidic);
    else if (lastWeatherParams.ph > 7.5) reasons.push(t.reason_alkaline);
    else reasons.push(t.reason_neutral);

    let weatherReason = lastWeatherParams.temp > 28 ? t.weather_warm : t.weather_cool;
    if (lastWeatherParams.rain > 150)     weatherReason += ` ${t.and} ${t.weather_rainy}`;
    else if (lastWeatherParams.rain < 50) weatherReason += ` ${t.and} ${t.weather_dry}`;

    const expText = document.getElementById('explanation-text');
    if (expText) {
        expText.innerHTML = t.explain_base
            .replace('{crop}', lastWeatherParams.crop)
            .replace('{reasons}', reasons.join(', '))
            .replace('{weather_reason}', weatherReason);
    }
}

function setLanguage(lang) {
    currentLang = lang;
    const t = i18n[lang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.innerHTML = t[key];
    });

    const locationInput = document.getElementById('location');
    if (locationInput) {
        locationInput.placeholder = (weatherMode === 'api') 
            ? t.loc_placeholder 
            : (lang === 'hi' ? "जैसे, पुणे (वैकल्पिक)" : "e.g. Pune, India (Optional)");
    }

    const btnText = document.getElementById('btn-text');
    const submitBtn = document.getElementById('submit-btn');
    if (btnText && submitBtn && submitBtn.disabled) btnText.textContent = t.analyzing;
    if (lastWeatherParams) {
        const weatherInfoEl = document.getElementById('weather-info');
        if (weatherInfoEl) {
            weatherInfoEl.innerHTML = t.weather_info
                .replace('{loc}', lastWeatherParams.location)
                .replace('{temp}', lastWeatherParams.temp)
                .replace('{hum}', lastWeatherParams.hum);
        }
        updateExplanationText(t);
    }
    const btnEn = document.getElementById('btn-en');
    const btnHi = document.getElementById('btn-hi');
    if (btnEn) btnEn.classList.toggle('active', lang === 'en');
    if (btnHi) btnHi.classList.toggle('active', lang === 'hi');
}

// ── VARSHA CHATBOT CORE ───────────────────────────────────────
function toggleVarsha() {
    const panel = document.getElementById('varsha-panel');
    isVarshaOpen = !isVarshaOpen;
    
    if (isVarshaOpen) {
        if (panel) panel.classList.add('open');
        const inputEl = document.getElementById('varsha-input');
        setTimeout(() => { if (inputEl) inputEl.focus(); }, 300);
        
        const msgContainer = document.getElementById('varsha-messages');
        if (msgContainer && msgContainer.children.length <= 1) {
            if (varshaSessionId) {
                loadChatHistory();
            } else {
                const welcome = currentLang === 'hi' ? 
                    "नमस्ते! मैं वर्षा हूँ। मैं आपकी कैसे मदद कर सकती हूँ? 🌿" : 
                    "Namaste! I'm Varsha. How can I help you today? 🌿";
                addBotMessage(welcome);
            }
        }
    } else {
        if (panel) panel.classList.remove('open');
    }
}
window.toggleVarsha = toggleVarsha;

async function sendVarshaMessage() {
    const input = document.getElementById('varsha-input');
    if (!input) return;
    const msg = input.value.trim();
    if (!msg) return;

    addUserMessage(msg);
    input.value = '';

    if (!varshaSessionId) {
        varshaSessionId = 'session_' + Math.random().toString(36).substring(2, 15);
        safeStorage.setItem('varsha_session_id', varshaSessionId);
    }

    // Log User Message to Supabase (Async background)
    if (authUser) {
        supabase.from('chat_messages').insert([{
            session_id: varshaSessionId,
            user_id: authUser.id,
            role: 'user',
            message: msg
        }]).then(({ error }) => { if (error) console.error("Chat message log error:", error); });
    }

    showTypingIndicator();

    try {
        const res = await fetch(`${API}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: msg, 
                session_id: varshaSessionId, 
                language: currentLang 
                })
        });
        const data = await res.json();

        removeTypingIndicator();
        addBotMessage(data.reply);

        // Log Bot Reply to Supabase (Async background)
        if (authUser) {
            supabase.from('chat_messages').insert([{
                session_id: varshaSessionId,
                user_id: authUser.id,
                role: 'bot',
                message: data.reply
            }]).then(({ error }) => { if (error) console.error("Chat reply log error:", error); });
        }

    } catch (err) {
        removeTypingIndicator();
        addBotMessage("Sorry, I'm having trouble connecting right now. Please try again later. 🛑");
    }
}

function addUserMessage(text) {
    const container = document.getElementById('varsha-messages');
    if (!container) return;
    const msgDiv = document.createElement('div');
    msgDiv.className = 'varsha-msg user';
    msgDiv.innerHTML = `<div class="varsha-bubble">${text}</div>`;
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

function addBotMessage(text) {
    const container = document.getElementById('varsha-messages');
    if (!container) return;
    const msgDiv = document.createElement('div');
    msgDiv.className = 'varsha-msg bot';
    const formatted = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
    msgDiv.innerHTML = `<div class="varsha-bubble">${formatted}</div>`;
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
    const container = document.getElementById('varsha-messages');
    if (!container) return;
    const typingDiv = document.createElement('div');
    typingDiv.id = 'varsha-typing-indicator';
    typingDiv.className = 'varsha-typing';
    typingDiv.innerHTML = `
        <div class="varsha-typing-dot"></div>
        <div class="varsha-typing-dot"></div>
        <div class="varsha-typing-dot"></div>
    `;
    container.appendChild(typingDiv);
    container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator() {
    const indicator = document.getElementById('varsha-typing-indicator');
    if (indicator) indicator.remove();
}

async function loadChatHistory() {
    try {
        let messages = [];
        
        // Try fetching chat history from Supabase if logged in
        if (authUser) {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('session_id', varshaSessionId)
                .order('created_at', { ascending: true });
                
            if (!error && data) {
                messages = data;
            }
        }

        // If no records found or guest user, fallback to Python API endpoint
        if (messages.length === 0) {
            const res = await fetch(`${API}/chat/history?session_id=${varshaSessionId}`);
            messages = await res.json();
        }
        
        const container = document.getElementById('varsha-messages');
        if (!container) return;
        container.innerHTML = '';
        
        if (messages.length === 0) {
            const welcome = currentLang === 'hi' ? 
                "नमस्ते! मैं वर्षा हूँ। मैं आपकी कैसे मदद कर सकती हूँ? 🌿" : 
                "Namaste! I'm Varsha. How can I help you today? 🌿";
            addBotMessage(welcome);
            return;
        }

        messages.forEach(m => {
            if (m.role === 'user') addUserMessage(m.message);
            else addBotMessage(m.message);
        });
    } catch (err) {
        console.error("Failed to load chat history", err);
        addBotMessage("Namaste! I'm Varsha. How can I help you today? 🌿");
    }
}

async function promptFeedback() {
    const rating = prompt("Please rate Varsha (1-5):", "5");
    if (!rating) return;
    
    const comment = prompt("Any comments or suggestions?");
    
    // Save Feedback to Supabase
    try {
        const { error: dbErr } = await supabase
            .from('feedbacks')
            .insert([{
                user_id: authUser ? authUser.id : null,
                rating: parseInt(rating),
                comment: comment,
                category: 'chatbot'
            }]);
            
        if (dbErr) throw dbErr;
        alert(currentLang === 'hi' ? "प्रतिक्रिया देने के लिए धन्यवाद! 🌿" : "Feedback submitted successfully! Thank you. 🌿");
    } catch (err) {
        // Fallback to local server API if Supabase call fails
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
            
            const res = await fetch(`${API}/feedback`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    rating: parseInt(rating),
                    comment: comment,
                    category: 'chatbot'
                })
            });
            const data = await res.json();
            alert(data.message);
        } catch (localErr) {
            alert("Failed to submit feedback. Please try again later.");
        }
    }
}
window.promptFeedback = promptFeedback;

// ── HISTORY LOADER ────────────────────────────────────────────
async function loadHistory() {
    const historySection = document.getElementById('history-section');
    const historyList = document.getElementById('history-list');
    if (!authUser || !historySection || !historyList) return;

    try {
        // Fetch from Supabase directly
        const { data, error } = await supabase
            .from('predictions')
            .select('*')
            .eq('user_id', authUser.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;
        
        historySection.style.display = 'block';
        historyList.innerHTML = '';

        if (data.length === 0) {
            historyList.innerHTML = `<p class="no-history" data-i18n="no_history">${i18n[currentLang].no_history}</p>`;
            return;
        }

        const t = i18n[currentLang];
        let html = `
            <table class="history-table">
                <thead>
                    <tr>
                        <th data-i18n="history_date">${t.history_date}</th>
                        <th data-i18n="history_inputs">${t.history_inputs}</th>
                        <th data-i18n="history_crop">${t.history_crop}</th>
                    </tr>
                </thead>
                <tbody>
        `;

        data.forEach(item => {
            const date = new Date(item.created_at || item.timestamp).toLocaleDateString();
            const n = item.n !== undefined ? item.n : item.N;
            const p = item.p !== undefined ? item.p : item.P;
            const k = item.k !== undefined ? item.k : item.K;
            const ph = item.ph;
            
            html += `
                <tr>
                    <td>${date}</td>
                    <td>${n}, ${p}, ${k}, ${ph}</td>
                    <td class="history-crop-name">${item.top_crop}</td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        historyList.innerHTML = html;

    } catch (err) {
        console.error("Failed to load history from Supabase, attempting API fallback", err);
        // Fallback to local server SQLite history (if available)
        try {
            const res = await fetch(`${API}/history`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (!res.ok) return;
            const fallbackData = await res.json();
            
            historySection.style.display = 'block';
            historyList.innerHTML = '';

            if (fallbackData.length === 0) {
                historyList.innerHTML = `<p class="no-history" data-i18n="no_history">${i18n[currentLang].no_history}</p>`;
                return;
            }

            const t = i18n[currentLang];
            let html = `
                <table class="history-table">
                    <thead>
                        <tr>
                            <th data-i18n="history_date">${t.history_date}</th>
                            <th data-i18n="history_inputs">${t.history_inputs}</th>
                            <th data-i18n="history_crop">${t.history_crop}</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            fallbackData.forEach(item => {
                const date = new Date(item.timestamp).toLocaleDateString();
                html += `
                    <tr>
                        <td>${date}</td>
                        <td>${item.N}, ${item.P}, ${item.K}, ${item.ph}</td>
                        <td class="history-crop-name">${item.top_crop}</td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            historyList.innerHTML = html;
        } catch (localErr) {
            console.error("History fallback also failed", localErr);
        }
    }
}

// ── STARTUP INITIALIZATION & DOM EVENT BINDING ────────────────
function initApp() {
    // 1. Initial State UI Configuration
    applyAuthUI();
    setWeatherMode('api');

    // 2. Esc key listener for modal closing
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

    // 3. Register Language toggles
    const btnEn = document.getElementById('btn-en');
    const btnHi = document.getElementById('btn-hi');
    if (btnEn) btnEn.addEventListener('click', () => setLanguage('en'));
    if (btnHi) btnHi.addEventListener('click', () => setLanguage('hi'));

    // 4. Password strength listener for register modal
    const modalRegPw = document.getElementById('m-reg-password');
    if (modalRegPw) {
        modalRegPw.addEventListener('input', function () {
            const wrap  = document.getElementById('pw-strength-wrap');
            const fill  = document.getElementById('pw-sfill');
            const label = document.getElementById('pw-slbl');
            const val   = this.value;
            if (!wrap) return;
            if (!val) { wrap.style.display = 'none'; return; }
            wrap.style.display = 'flex';

            let score = 0;
            if (val.length >= 8)           score++;
            if (/[A-Z]/.test(val))         score++;
            if (/[0-9]/.test(val))         score++;
            if (/[^A-Za-z0-9]/.test(val)) score++;

            const levels = [
                { pct: '25%', color: '#ef4444', text: 'Weak'   },
                { pct: '50%', color: '#f97316', text: 'Fair'   },
                { pct: '75%', color: '#eab308', text: 'Good'   },
                { pct: '100%',color: '#22c55e', text: 'Strong' },
            ];
            const lv = levels[score - 1] || levels[0];
            if (fill) {
                fill.style.width      = lv.pct;
                fill.style.background = lv.color;
            }
            if (label) {
                label.textContent     = lv.text;
                label.style.color     = lv.color;
            }
        });
    }

    // 5. Modal Forms Submit
    const loginForm = document.getElementById('modal-form-login');
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            hideBanner();

            const email = document.getElementById('m-username').value.trim();
            const password = document.getElementById('m-password').value;
            if (!email || !password) { showBanner('Please fill in all fields.'); return; }

            const btn     = document.getElementById('login-submit-btn');
            const btnText = document.getElementById('login-submit-text');
            const spinner = document.getElementById('login-modal-spinner');
            if (btn) btn.disabled = true;
            if (btnText) btnText.textContent = 'Logging in…';
            if (spinner) spinner.style.display = 'block';

            try {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });

                if (error) {
                    showBanner(error.message || 'Incorrect email or password.');
                    return;
                }

                const displayName = data.user.user_metadata?.full_name || data.user.user_metadata?.username || data.user.email;
                showBanner(`Welcome back, ${displayName}! 🎉`, 'success');
                saveAuth(data.session, data.user);
                setTimeout(closeModal, 1200);

            } catch (err) {
                showBanner('Cannot connect to Auth service.');
            } finally {
                if (btn) btn.disabled = false;
                if (btnText) btnText.textContent = 'Login';
                if (spinner) spinner.style.display = 'none';
            }
        });
    }

    const signupForm = document.getElementById('modal-form-signup');
    if (signupForm) {
        signupForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            hideBanner();

            const fullName = document.getElementById('m-fullname').value.trim();
            const username = document.getElementById('m-reg-username').value.trim();
            const email    = document.getElementById('m-email').value.trim();
            const password = document.getElementById('m-reg-password').value;
            const confirm  = document.getElementById('m-confirm').value;

            if (!username || !email || !password || !confirm) { showBanner('Please fill in all required fields.'); return; }
            if (password !== confirm)  { showBanner('Passwords do not match.'); return; }
            if (password.length < 8)   { showBanner('Password must be at least 8 characters.'); return; }

            const btn     = document.getElementById('signup-submit-btn');
            const btnText = document.getElementById('signup-submit-text');
            const spinner = document.getElementById('signup-modal-spinner');
            if (btn) btn.disabled = true;
            if (btnText) btnText.textContent = 'Creating account…';
            if (spinner) spinner.style.display = 'block';

            try {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
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
                    const displayName = data.user.user_metadata?.full_name || data.user.user_metadata?.username || data.user.email;
                    showBanner(`Account created! Welcome, ${displayName}! 🌿`, 'success');
                    saveAuth(data.session, data.user);
                    setTimeout(closeModal, 1200);
                } else {
                    showBanner('Account created! Please check your email to confirm registration.', 'success');
                    setTimeout(() => switchModalTab('login'), 3000);
                }

            } catch (err) {
                showBanner('Cannot connect to Auth service.');
            } finally {
                if (btn) btn.disabled = false;
                if (btnText) btnText.textContent = 'Create Account';
                if (spinner) spinner.style.display = 'none';
            }
        });
    }

    // 6. Bind Fetch weather button click
    const fetchWeatherBtn = document.getElementById('fetch-weather-btn');
    if (fetchWeatherBtn) fetchWeatherBtn.addEventListener('click', fetchWeatherFromAPI);

    // 7. Bind Geolocation button click
    const getLocBtn = document.getElementById('get-location-btn');
    if (getLocBtn) {
        getLocBtn.addEventListener('click', () => {
            const t = i18n[currentLang];
            const locationInput = document.getElementById('location');
            if (!navigator.geolocation) { alert(t.geo_error); return; }
            getLocBtn.textContent = '⏳';
            getLocBtn.disabled = true;
            navigator.geolocation.getCurrentPosition(async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    const res  = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
                    const data = await res.json();
                    const city = data.city || data.locality || data.principalSubdivision;
                    if (city) {
                        if (locationInput) locationInput.value = city;
                        if (weatherMode === 'api') {
                            await fetchWeatherFromAPI();
                        }
                    } else {
                        alert(t.city_error);
                    }
                } catch { 
                    alert(t.fetch_error); 
                } finally { 
                    getLocBtn.textContent = '📍'; 
                    getLocBtn.disabled = false; 
                }
            }, () => { 
                alert(t.loc_unable); 
                getLocBtn.textContent = '📍'; 
                getLocBtn.disabled = false; 
            });
        });
    }

    // 8. Bind Prediction form submit
    const predictionForm = document.getElementById('prediction-form');
    if (predictionForm) {
        predictionForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const t          = i18n[currentLang];
            const submitBtn  = document.getElementById('submit-btn');
            const btnText    = document.getElementById('btn-text');
            const spinner    = document.getElementById('spinner');
            const formCard   = document.querySelector('.form-card');
            const resultCard = document.getElementById('result-card');
            const weatherInfoEl = document.getElementById('weather-info');

            const N        = parseFloat(document.getElementById('N').value);
            const P        = parseFloat(document.getElementById('P').value);
            const K        = parseFloat(document.getElementById('K').value);
            const ph       = parseFloat(document.getElementById('ph').value);
            
            let location = document.getElementById('location').value.trim();
            if (!location && weatherMode === 'manual') {
                location = 'Manual Entry';
            }

            // Read weather inputs
            const tempInput = document.getElementById('temperature').value;
            const humInput = document.getElementById('humidity').value;
            const rainInput = document.getElementById('rainfall').value;

            // Validate we have weather info
            if (weatherMode === 'api' && (!tempInput || !humInput || !rainInput)) {
                if (submitBtn) submitBtn.disabled = true;
                if (btnText) btnText.textContent = currentLang === 'hi' ? "मौसम डेटा ला रहा है..." : "Fetching weather details...";
                if (spinner) spinner.style.display = 'block';
                await fetchWeatherFromAPI();
            }

            const finalTemp = document.getElementById('temperature').value;
            const finalHum = document.getElementById('humidity').value;
            const finalRain = document.getElementById('rainfall').value;

            if (!finalTemp || !finalHum || !finalRain) {
                alert(currentLang === 'hi' ? "कृपया पहले मौसम की जानकारी भरें।" : "Please provide weather information first.");
                if (submitBtn) submitBtn.disabled = false;
                if (btnText) btnText.textContent = t.submit_btn;
                if (spinner) spinner.style.display = 'none';
                return;
            }

            if (submitBtn) submitBtn.disabled = true;
            if (btnText) btnText.textContent = t.analyzing;
            if (spinner) spinner.style.display = 'block';

            const tempFloat = parseFloat(finalTemp);
            const humFloat = parseFloat(finalHum);
            const rainFloat = parseFloat(finalRain);

            try {
                // Post to python ML service
                const response = await fetch(`${API}/predict`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        N, P, K, ph, 
                        location,
                        temperature: tempFloat,
                        humidity: humFloat,
                        rainfall: rainFloat
                    }),
                });

                if (!response.ok) throw new Error(`Error: ${response.statusText}`);

                const data = await response.json();
                
                lastWeatherParams = {
                    location,
                    temp: tempFloat,
                    hum:  humFloat,
                    rain: rainFloat,
                    N, P, K, ph,
                    crop: data.top_crops[0].crop,
                };

                // Render recommendation items
                const topCropsContainer = document.getElementById('top-crops');
                if (topCropsContainer) {
                    topCropsContainer.innerHTML = '';
                    data.top_crops.forEach(item => {
                        const el = document.createElement('div');
                        el.className = 'crop-item';
                        el.innerHTML = `
                            <div class="crop-name">${item.crop}</div>
                            <div class="confidence-wrapper">
                                <div class="confidence-bar-bg">
                                    <div class="confidence-bar-fill" style="width: 0%"></div>
                                </div>
                            </div>
                            <div class="confidence-text">${item.confidence}%</div>
                        `;
                        topCropsContainer.appendChild(el);
                        setTimeout(() => {
                            const barFill = el.querySelector('.confidence-bar-fill');
                            if (barFill) barFill.style.width = item.confidence + '%';
                        }, 50);
                    });
                }

                const alertEl = document.getElementById('suitability-alert');
                if (alertEl) {
                    if (!data.is_suitable) {
                        alertEl.textContent = data.alert_message;
                        alertEl.style.display = 'block';
                    } else {
                        alertEl.style.display = 'none';
                    }
                }

                updateExplanationText(t);
                if (weatherInfoEl) {
                    weatherInfoEl.innerHTML = t.weather_info
                        .replace('{loc}', location)
                        .replace('{temp}', tempFloat)
                        .replace('{hum}', humFloat);
                    weatherInfoEl.style.display = 'inline-block';
                }
                    
                const resTemp = document.getElementById('res-temp');
                if (resTemp) resTemp.textContent = tempFloat + '°C';
                const resHum = document.getElementById('res-hum');
                if (resHum) resHum.textContent = humFloat + '%';
                const resRain = document.getElementById('res-rain');
                if (resRain) resRain.textContent = rainFloat + ' mm';

                if (formCard) formCard.style.display  = 'none';
                if (resultCard) resultCard.style.display = 'block';

                // Save prediction directly to Supabase
                if (authUser) {
                    try {
                        const { error: dbErr } = await supabase
                            .from('predictions')
                            .insert([{
                                user_id: authUser.id,
                                n: N,
                                p: P,
                                k: K,
                                ph: ph,
                                location: location,
                                temperature: tempFloat,
                                humidity: humFloat,
                                rainfall: rainFloat,
                                top_crop: data.top_crops[0].crop,
                                confidence: data.top_crops[0].confidence,
                                is_suitable: data.is_suitable,
                                alert_message: data.alert_message || null
                            }]);
                        
                        if (dbErr) {
                            console.error("Supabase insert error:", dbErr);
                        } else {
                            loadHistory(); // Reload history section
                        }
                    } catch (err) {
                        console.error("Supabase logging failed:", err);
                    }
                }

            } catch (error) {
                alert(t.fetch_fail + error.message);
            } finally {
                if (submitBtn) submitBtn.disabled = false;
                if (btnText) btnText.textContent = t.submit_btn;
                if (spinner) spinner.style.display = 'none';
            }
        });
    }

    // 9. Attach Event Listeners for Varsha Chatbot
    const varshaLauncher = document.getElementById('varsha-launcher');
    if (varshaLauncher) varshaLauncher.addEventListener('click', toggleVarsha);

    const varshaClose = document.getElementById('varsha-close');
    if (varshaClose) varshaClose.addEventListener('click', toggleVarsha);

    const varshaForm = document.getElementById('varsha-form');
    if (varshaForm) {
        varshaForm.addEventListener('submit', function(e) {
            e.preventDefault();
            sendVarshaMessage();
        });
    }

    // 10. Listen to Supabase Auth state changes (syncs tabs and pages)
    try {
        supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
                saveAuth(session, session.user);
            } else {
                authToken = null;
                authUser  = null;
                safeStorage.removeItem('kc_token');
                safeStorage.removeItem('kc_user');
                applyAuthUI();
            }
        });
    } catch (authErr) {
        console.error("Failed to register Supabase auth listener, switching to mock supabase:", authErr);
        supabase = getMockSupabase();
        try {
            supabase.auth.onAuthStateChange((event, session) => {
                authToken = null;
                authUser  = null;
                safeStorage.removeItem('kc_token');
                safeStorage.removeItem('kc_user');
                applyAuthUI();
            });
        } catch (mockAuthErr) {
            console.error("Failed to register mock auth listener:", mockAuthErr);
        }
    }
}

// Safely execute initApp regardless of whether DOMContentLoaded has already fired
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
