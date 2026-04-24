const i18n = {
    en: {
        title: "KisanConnect",
        subtitle: "Smart, AI-Powered Crop Recommendations for Your Farm",
        form_title: "Enter Soil & Location Details",
        n_label: "Nitrogen (N)",
        p_label: "Phosphorus (P)",
        k_label: "Potassium (K)",
        ph_label: "Soil pH",
        loc_label: "City/Town (for Weather Data)",
        loc_placeholder: "e.g., Pune, India",
        submit_btn: "Get Recommendation",
        result_title: "Recommended Crops",
        reset_btn: "Check Another",
        analyzing: "Analyzing...",
        weather_info: "Condition used for <b>{loc}</b>: Temp: {temp}°C, Humidity: {hum}%",
        geo_error: "Geolocation is not supported by your browser",
        city_error: "Could not determine city from location",
        fetch_error: "Error fetching location data",
        loc_unable: "Unable to retrieve your location",
        fetch_fail: "Failed to get recommendation. Please check if the backend is running and try again.\n",
        why_suitable_title: "Why is this suitable?",
        explain_base: "<b>{crop}</b> is highly recommended because your soil has {reasons}. Furthermore, the local {weather_reason} climate perfectly supports its growth cycle.",
        reason_high_n: "high nitrogen",
        reason_low_n: "low nitrogen",
        reason_high_p: "rich phosphorus",
        reason_high_k: "high potassium",
        reason_acidic: "slightly acidic pH",
        reason_alkaline: "alkaline pH",
        reason_neutral: "optimal neutral pH",
        weather_warm: "warm",
        weather_cool: "cool",
        weather_rainy: "rainy",
        weather_dry: "dry",
        and: "and"
    },
    hi: {
        title: "किसान कनेक्ट",
        subtitle: "आपके खेत के लिए स्मार्ट, एआई-संचालित फसल की सिफारिशें",
        form_title: "मिट्टी और स्थान का विवरण दर्ज करें",
        n_label: "नाइट्रोजन (N)",
        p_label: "फॉस्फोरस (P)",
        k_label: "पोटेशियम (K)",
        ph_label: "मिट्टी का पीएच (pH)",
        loc_label: "शहर/कस्बा (मौसम डेटा के लिए)",
        loc_placeholder: "जैसे, पुणे, भारत",
        submit_btn: "सिफारिश प्राप्त करें",
        result_title: "अनुशंसित फसलें",
        reset_btn: "दूसरी जांच करें",
        analyzing: "विश्लेषण कर रहा है...",
        weather_info: "<b>{loc}</b> के लिए उपयोग की गई स्थिति: तापमान: {temp}°C, नमी: {hum}%",
        geo_error: "आपका ब्राउज़र जियोलोकेशन का समर्थन नहीं करता है",
        city_error: "स्थान से शहर का निर्धारण नहीं किया जा सका",
        fetch_error: "स्थान डेटा लाने में त्रुटि",
        loc_unable: "आपका स्थान प्राप्त करने में असमर्थ",
        fetch_fail: "सिफारिश प्राप्त करने में विफल। कृपया जांचें कि क्या सर्वर चल रहा है।\n",
        why_suitable_title: "यह उपयुक्त क्यों है?",
        explain_base: "<b>{crop}</b> की अत्यधिक सिफारिश की जाती है क्योंकि आपकी मिट्टी में {reasons} है। इसके अलावा, स्थानीय {weather_reason} जलवायु इसके विकास चक्र का पूरी तरह से समर्थन करती है।",
        reason_high_n: "उच्च नाइट्रोजन",
        reason_low_n: "कम नाइट्रोजन",
        reason_high_p: "समृद्ध फॉस्फोरस",
        reason_high_k: "उच्च पोटेशियम",
        reason_acidic: "थोड़ा अम्लीय पीएच",
        reason_alkaline: "क्षारीय पीएच",
        reason_neutral: "इष्टतम तटस्थ पीएच",
        weather_warm: "गर्म",
        weather_cool: "ठंडी",
        weather_rainy: "बरसाती",
        weather_dry: "शुष्क",
        and: "और"
    }
};

let currentLang = 'en';
let lastWeatherParams = null; // Store to update dynamically when language changes

function updateExplanationText(t) {
    if (!lastWeatherParams) return;
    
    const reasons = [];
    if (lastWeatherParams.N > 80) reasons.push(t.reason_high_n);
    else if (lastWeatherParams.N < 40) reasons.push(t.reason_low_n);
    
    if (lastWeatherParams.P > 60) reasons.push(t.reason_high_p);
    if (lastWeatherParams.K > 60) reasons.push(t.reason_high_k);
    
    if (lastWeatherParams.ph < 6.0) reasons.push(t.reason_acidic);
    else if (lastWeatherParams.ph > 7.5) reasons.push(t.reason_alkaline);
    else reasons.push(t.reason_neutral);
    
    let weatherReason = "";
    if (lastWeatherParams.temp > 28) weatherReason = t.weather_warm;
    else weatherReason = t.weather_cool;
    
    if (lastWeatherParams.rain > 150) weatherReason += " " + t.and + " " + t.weather_rainy;
    else if (lastWeatherParams.rain < 50) weatherReason += " " + t.and + " " + t.weather_dry;

    const explanationText = document.getElementById('explanation-text');
    explanationText.innerHTML = t.explain_base
        .replace('{crop}', lastWeatherParams.crop)
        .replace('{reasons}', reasons.join(', '))
        .replace('{weather_reason}', weatherReason);
}

function setLanguage(lang) {
    currentLang = lang;
    const t = i18n[lang];
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) {
            el.innerHTML = t[key];
        }
    });
    
    document.getElementById('location').placeholder = t.loc_placeholder;
    
    // If spinner is active or inactive, reset the submit button text correctly
    const btnText = document.getElementById('btn-text');
    if (document.getElementById('submit-btn').disabled) {
        btnText.textContent = t.analyzing;
    }
    
    // If result is shown, update the weather string and explanation
    if (lastWeatherParams) {
        const weatherInfoEl = document.getElementById('weather-info');
        weatherInfoEl.innerHTML = t.weather_info
            .replace('{loc}', lastWeatherParams.location)
            .replace('{temp}', lastWeatherParams.temp)
            .replace('{hum}', lastWeatherParams.hum);
            
        updateExplanationText(t);
    }
    
    // Update active button state
    document.getElementById('btn-en').classList.toggle('active', lang === 'en');
    document.getElementById('btn-hi').classList.toggle('active', lang === 'hi');
}

document.getElementById('btn-en').addEventListener('click', () => setLanguage('en'));
document.getElementById('btn-hi').addEventListener('click', () => setLanguage('hi'));

document.getElementById('prediction-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const t = i18n[currentLang];
    const submitBtn = document.getElementById('submit-btn');
    const btnText = document.getElementById('btn-text');
    const spinner = document.getElementById('spinner');
    const formCard = document.querySelector('.form-card');
    const resultCard = document.getElementById('result-card');
    const cropNameEl = document.getElementById('crop-name');
    const weatherInfoEl = document.getElementById('weather-info');

    const N = parseFloat(document.getElementById('N').value);
    const P = parseFloat(document.getElementById('P').value);
    const K = parseFloat(document.getElementById('K').value);
    const ph = parseFloat(document.getElementById('ph').value);
    const location = document.getElementById('location').value;

    const payload = { N, P, K, ph, location };

    submitBtn.disabled = true;
    btnText.textContent = t.analyzing;
    spinner.style.display = "block";

    try {
        const response = await fetch('http://localhost:8000/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`Error: ${response.statusText}`);

        const data = await response.json();
        
        lastWeatherParams = {
            location: location,
            temp: data.weather_data_used.temperature,
            hum: data.weather_data_used.humidity,
            rain: data.weather_data_used.rainfall,
            N: N, P: P, K: K, ph: ph,
            crop: data.top_crops[0].crop
        };

        const topCropsContainer = document.getElementById('top-crops');
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
            
            // Animate bar width
            setTimeout(() => {
                el.querySelector('.confidence-bar-fill').style.width = item.confidence + '%';
            }, 50);
        });

        const alertEl = document.getElementById('suitability-alert');
        if (!data.is_suitable) {
            alertEl.textContent = data.alert_message;
            alertEl.style.display = 'block';
        } else {
            alertEl.style.display = 'none';
        }

        updateExplanationText(t);

        weatherInfoEl.innerHTML = t.weather_info
            .replace('{loc}', lastWeatherParams.location)
            .replace('{temp}', lastWeatherParams.temp)
            .replace('{hum}', lastWeatherParams.hum);
        
        formCard.style.display = 'none';
        resultCard.style.display = 'block';

    } catch (error) {
        alert(t.fetch_fail + error.message);
    } finally {
        submitBtn.disabled = false;
        btnText.textContent = t.submit_btn;
        spinner.style.display = "none";
    }
});

function resetForm() {
    document.getElementById('prediction-form').reset();
    document.querySelector('.form-card').style.display = 'block';
    document.getElementById('result-card').style.display = 'none';
    lastWeatherParams = null;
}

document.getElementById('get-location-btn').addEventListener('click', () => {
    const t = i18n[currentLang];
    const locationInput = document.getElementById('location');
    const btn = document.getElementById('get-location-btn');
    if (!navigator.geolocation) {
        alert(t.geo_error);
        return;
    }
    btn.textContent = '⏳';
    btn.disabled = true;
    navigator.geolocation.getCurrentPosition(async (position) => {
        try {
            const { latitude, longitude } = position.coords;
            const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
            const data = await res.json();
            const city = data.city || data.locality || data.principalSubdivision;
            if (city) {
                locationInput.value = city;
            } else {
                alert(t.city_error);
            }
        } catch (err) {
            alert(t.fetch_error);
        } finally {
            btn.textContent = '📍';
            btn.disabled = false;
        }
    }, () => {
        alert(t.loc_unable);
        btn.textContent = '📍';
        btn.disabled = false;
    });
});
