from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
import joblib
import numpy as np
import requests
import os
import re
import uuid
from dotenv import load_dotenv
from datetime import datetime
from typing import Optional

load_dotenv()

# ── DB & Auth imports ──────────────────────────────────────────────────────────
from .database import engine, get_db
from . import models, auth as auth_utils

# Create all tables on startup
models.Base.metadata.create_all(bind=engine)

# ── App setup ─────────────────────────────────────────────────────────────────
app = FastAPI(title="KisanConnect API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load ML model ─────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
model_path = os.path.join(BASE_DIR, 'saved_models', 'crop_model.pkl')
try:
    model = joblib.load(model_path)
    print("[OK] Model loaded successfully.")
except Exception as e:
    print(f"[WARNING] Model not found: {e}")
    model = None

# ── Pydantic Schemas ──────────────────────────────────────────────────────────
class UserRegister(BaseModel):
    username: str
    email: str
    password: str
    full_name: str = ""

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: str | None
    created_at: datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class CropPredictionRequest(BaseModel):
    N: float
    P: float
    K: float
    ph: float
    location: str
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    rainfall: Optional[float] = None

class PredictionHistoryItem(BaseModel):
    id: int
    N: float
    P: float
    K: float
    ph: float
    location: str
    top_crop: str
    confidence: float
    temperature: float | None
    humidity: float | None
    rainfall: float | None
    is_suitable: bool
    alert_message: str | None
    timestamp: datetime

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None   # client-generated UUID; created if absent
    language: Optional[str] = "en"


class ChatResponse(BaseModel):
    reply: str
    session_id: str


class FeedbackRequest(BaseModel):
    rating: int
    comment: Optional[str] = None
    category: Optional[str] = "general"

# ── Weather helper ────────────────────────────────────────────────────────────
WEATHER_API_KEY = os.getenv('OPENWEATHERMAP_API_KEY', 'YOUR_DUMMY_KEY')

def fetch_weather_data(location: str):
    if WEATHER_API_KEY in ('YOUR_DUMMY_KEY', 'your_actual_api_key_here', ''):
        return {"temperature": 25.0, "humidity": 70.0, "rainfall": 100.0}

    url = (
        f"http://api.openweathermap.org/data/2.5/weather"
        f"?q={location}&appid={WEATHER_API_KEY}&units=metric"
    )
    response = requests.get(url)
    if response.status_code != 200:
        return {"temperature": 25.0, "humidity": 70.0, "rainfall": 100.0}

    data = response.json()
    rainfall = 100.0
    if 'rain' in data and '1h' in data['rain']:
        rainfall = data['rain']['1h'] * 24 * 30
    return {
        "temperature": data['main']['temp'],
        "humidity": data['main']['humidity'],
        "rainfall": rainfall,
    }


# ══════════════════════════════════════════════════════════════════════════════
# VARSHA CHATBOT  –  Rule-based knowledge engine + optional Gemini fallback
# ══════════════════════════════════════════════════════════════════════════════
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')

VARSHA_KNOWLEDGE: list[tuple[list[str], str]] = [
    # ── Greetings ──
    (["hello", "hi", "hey", "namaste", "hii"],
     "Namaste! 👋 I’m **Varsha**, your KisanConnect crop assistant. Ask me anything about crops, soil, diseases, or farming tips!"),
    (["who are you", "what are you", "your name", "introduce"],
     "I’m **Varsha** 🌿, the AI assistant of KisanConnect. I help farmers with crop recommendations, disease identification, soil health, and more!"),
    # ── Crops: basics ──
    (["best crop", "which crop", "suggest crop", "crop recommendation", "konsi fasal"],
     "For the best crop recommendation, use the **Soil & Location form** above! I’ll need your Nitrogen (N), Phosphorus (P), Potassium (K), pH, and location. 🌱"),
    (["rice", "paddy", "chawal"],
     "🌾 **Rice (Paddy)**\n• Temperature: 22–32°C\n• Rainfall: 1000–2000 mm\n• Soil pH: 5.5–7.0\n• Needs: High N, medium P & K\n• Best planted: June–July (Kharif). Ensure good water retention in soil."),
    (["wheat", "gehu"],
     "🌾 **Wheat**\n• Temperature: 10–25°C\n• Rainfall: 400–900 mm\n• Soil pH: 6.0–7.5\n• Best planted: October–November (Rabi)\n• Needs: Moderate N, P, and K. Avoid waterlogging."),
    (["maize", "corn", "makka"],
     "🌽 **Maize (Corn)**\n• Temperature: 18–35°C\n• Rainfall: 500–1200 mm\n• Soil pH: 5.8–7.0\n• High nitrogen feeder. Well-drained loamy soil is ideal."),
    (["cotton", "kapas"],
     "🪥 **Cotton**\n• Temperature: 21–35°C\n• Rainfall: 600–1200 mm\n• Soil pH: 6.0–8.0\n• Deep black soils (Vertisols) are best. Needs long frost-free season."),
    (["sugarcane", "ganna"],
     "🍬 **Sugarcane**\n• Temperature: 20–40°C\n• Rainfall: 1500–2500 mm\n• Soil pH: 6.0–7.5\n• High water and nitrogen demand. Ratoon crops possible."),
    (["potato", "aloo"],
     "🥔 **Potato**\n• Temperature: 15–25°C\n• Rainfall: 600–1000 mm\n• Soil pH: 5.2–6.4\n• Loose, sandy-loam soil. High K and moderate N needed."),
    (["tomato", "tamatar"],
     "🍅 **Tomato**\n• Temperature: 20–30°C\n• Soil pH: 6.0–7.0\n• Well-drained fertile soil. Needs staking and regular irrigation."),
    (["soybean", "soya"],
     "🌱 **Soybean**\n• Temperature: 20–32°C\n• Rainfall: 500–1000 mm\n• Soil pH: 6.0–7.0\n• Fixes atmospheric nitrogen — great for soil health!"),
    (["lentil", "dal", "masoor", "moong", "chickpea", "gram", "chana"],
     "🌱 **Pulses (Lentils/Chickpea)**\n• Temperature: 18–30°C\n• Soil pH: 6.0–8.0\n• Drought-tolerant. Excellent for nitrogen fixation and crop rotation."),
    # ── Diseases ──
    (["disease", "blight", "rust", "rot", "fungus", "pest", "insect", "wilt", "virus"],
     "🪠 **Common Crop Diseases**\n• **Leaf Blight** – caused by fungi/bacteria; treat with copper-based fungicides.\n• **Rust** – fungal; apply Mancozeb or Propiconazole.\n• **Root Rot** – overwatering + poor drainage; improve soil aeration.\n• **Aphids/Whitefly** – spray Neem oil or systemic insecticides.\n\nTell me the **specific crop name** for targeted advice! 🌿"),
    (["rice disease", "paddy disease", "blast", "sheath blight"],
     "🪠 **Rice Diseases**\n• **Blast** – apply Tricyclazole; avoid excess N.\n• **Sheath Blight** – Hexaconazole + proper spacing.\n• **Brown Plant Hopper** – drain fields periodically."),
    (["wheat disease", "yellow rust", "loose smut"],
     "🪠 **Wheat Diseases**\n• **Yellow/Brown Rust** – Propiconazole spray.\n• **Loose Smut** – treat seeds with Carbendazim.\n• **Powdery Mildew** – Sulfur-based fungicides."),
    # ── Soil & pH ──
    (["ph", "soil ph", "acidity", "alkaline", "acidic"],
     "🧪 **Soil pH Guide**\n• < 5.5 – Very Acidic: add lime (CaCO₃)\n• 5.5–7.0 – Ideal for most crops\n• 7.0–8.0 – Slightly Alkaline: add gypsum or sulfur\n• > 8.0 – Strongly Alkaline: needs heavy amendment\n\nTest your soil every 2 seasons!"),
    (["nitrogen", " n ", "urea", "npk", "fertilizer", "khad"],
     "🌱 **Fertilizer Basics (NPK)**\n• **N (Nitrogen)** – promotes leaf/stem growth; apply as Urea or DAP.\n• **P (Phosphorus)** – root development; apply as SSP or DAP.\n• **K (Potassium)** – disease resistance, fruit quality; MOP or SOP.\n\nTypical ratio for cereals: 120:60:40 kg/ha (N:P:K)."),
    (["organic", "manure", "compost", "vermicompost"],
     "♻️ **Organic Farming Tips**\n• Use FYM (farm yard manure) 10–15 tonnes/ha before sowing.\n• Vermicompost improves soil structure.\n• Green manure crops (Dhaincha, Sunhemp) add 60–80 kg N/ha.\n• Compost tea boosts microbial activity."),
    # ── Irrigation ──
    (["irrigation", "water", "drip", "sprinkler", "sinchai"],
     "💧 **Irrigation Tips**\n• **Drip Irrigation** – saves 30–60% water; best for horticulture.\n• **Sprinkler** – good for wheat, groundnut.\n• **Flood** – used for rice; less efficient.\n\nIrrigate at critical stages: germination, flowering, grain filling."),
    # ── Weather & Season ──
    (["kharif", "rabi", "zaid", "season", "season crop"],
     "📅 **Crop Seasons in India**\n• **Kharif** (Jun–Oct): Rice, Cotton, Maize, Soybean\n• **Rabi** (Oct–Mar): Wheat, Barley, Mustard, Peas\n• **Zaid** (Mar–Jun): Cucumber, Melon, Muskmelon"),
    (["temperature", "weather", "climate", "humidity", "rainfall"],
     "🌡️ **Weather & Crops**\nWeather data (temperature, humidity, rainfall) is automatically fetched for your location when you use the recommendation form above. Each crop has specific climatic requirements — ask me about any specific crop!"),
    # ── Government schemes ──
    (["scheme", "yojana", "subsidy", "pm kisan", "government"],
     "🏦 **Key Government Schemes for Farmers**\n• **PM-KISAN** – ₹6000/year income support\n• **PM Fasal Bima Yojana** – crop insurance\n• **Soil Health Card** – free soil testing\n• **PM Krishi Sinchayee** – micro-irrigation subsidy\n\nVisit your nearest Krishi Vigyan Kendra (KVK) for details."),
    # ── General help ──
    (["help", "what can you do", "kya kar sakte"],
     "🌿 **Varsha can help you with:**\n1️⃣ Crop selection & growing conditions\n2️⃣ Crop disease identification & treatment\n3️⃣ Soil health & fertilizer guidance\n4️⃣ Irrigation methods\n5️⃣ Weather & seasons\n6️⃣ Government schemes for farmers\n\nJust ask your question in English or Hindi!"),
    (["thank", "thanks", "shukriya", "dhanyawad", "shukran"],
     "You’re welcome, farmer! 🌾 Happy growing! Feel free to ask me anything else about your crops or fields. 🌱"),

    # ── Hindi Translations / Specifics ──
    (["mousam", "mausam", "weather hi"],
     "मौसम की जानकारी के लिए ऊपर दिए गए फॉर्म में अपना शहर डालें। मैं आपको तापमान और बारिश के आधार पर सही सलाह दूँगी। 🌦️"),
    (["bimari", "rog", "disease hi"],
     "फसलों में बीमारी कई कारणों से हो सकती है। क्या आप किसी खास फसल (जैसे धान, गेहूँ) के बारे में पूछना चाहते हैं? 🌿"),
    (["kheti", "farming"],
     "खेती से जुड़ी किसी भी समस्या के लिए मैं यहाँ हूँ। आप खाद, सिंचाई, या फसलों के बारे में पूछ सकते हैं।"),
]


def _varsha_rule_response(user_msg: str) -> str | None:
    """Match user message against rule-base; return response or None."""
    msg = user_msg.lower()
    for keywords, response in VARSHA_KNOWLEDGE:
        # Use regex to match exact words, not substrings (e.g., 'hi' in 'which')
        if any(re.search(r'\b' + re.escape(kw) + r'\b', msg) for kw in keywords):
            return response
    return None


def _varsha_gemini_response(user_msg: str, language: str = "en") -> str:
    """Call Google Gemini API if key is configured."""
    try:
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
        )
        
        lang_instruction = "English"
        if language == "hi":
            lang_instruction = "Hindi (हिंदी)"
        elif language == "bn":
            lang_instruction = "Bengali (বাংলা)"
        elif language == "ta":
            lang_instruction = "Tamil (தமிழ்)"
        elif language == "te":
            lang_instruction = "Telugu (తెలుగు)"
        elif language == "mr":
            lang_instruction = "Marathi (मराठी)"
        elif language != "en":
            lang_instruction = f"the language with ISO code '{language}'"

        payload = {
            "contents": [{
                "parts": [{
                    "text": (
                        "You are Varsha, an expert agricultural assistant for "
                        "Indian farmers on the KisanConnect platform. Answer only "
                        "crop, soil, disease, irrigation, and farming related queries "
                        "in a friendly, concise way. Use emojis where helpful. "
                        f"IMPORTANT: You MUST answer the query in {lang_instruction}. "
                        "If the question is unrelated to agriculture, politely decline in that language.\n\n"
                        f"User: {user_msg}"
                    )
                }]
            }]
        }
        resp = requests.post(url, json=payload, timeout=10)
        if resp.status_code == 200:
            return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        else:
            print(f"Gemini API Error: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"Gemini Request Failed: {e}")
    
    fallback_msg = "🪠 I’m not sure about that specific question. Try asking about a particular crop, disease, or soil topic, and I’ll do my best to help! 🌿"
    if language == "hi":
        fallback_msg = "🪠 मुझे उस विशिष्ट प्रश्न के बारे में पूरी जानकारी नहीं है। किसी विशेष फसल, बीमारी या मिट्टी के विषय के बारे में पूछने का प्रयास करें, और मैं मदद करने की पूरी कोशिश करूँगी! 🌿"
    return fallback_msg


def _varsha_respond(user_msg: str, language: str = "en") -> str:
    # If Gemini API is configured, use it for ALL questions to get smart, context-aware answers
    if GEMINI_API_KEY:
        return _varsha_gemini_response(user_msg, language)
        
    # Fallback to simple rule-based engine if no API key is provided
    rule_reply = _varsha_rule_response(user_msg)
    if rule_reply and language == "en":
        return rule_reply
    
    if language == "hi":
        return "🌿 मुझे अभी उस विशिष्ट प्रश्न के बारे में पूरी जानकारी नहीं है। कृपया किसी विशिष्ट फसल (जैसे 'चावल'), बीमारी, मिट्टी के पीएच, उर्वरक, सिंचाई, या सरकारी योजनाओं के बारे में पूछने का प्रयास करें। मैं हमेशा सीख रही हूँ! 👩‍🌾"
        
    return (
        "🌿 I’m not sure about that specific query yet. Try asking about a particular "
        "crop (e.g. ‘rice’), a disease, soil pH, fertilizer, irrigation, or government "
        "schemes. I’m always learning! 👩‍🌾"
    )

# ═══════════════════════════════════════════════════════════════════════════════
# PUBLIC ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/")
def read_root():
    return {"message": "Welcome to KisanConnect API v2", "status": "running"}


# ── Auth: Register ────────────────────────────────────────────────────────────
@app.post("/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    # Check username
    if auth_utils.get_user_by_username(db, user_data.username):
        raise HTTPException(status_code=400, detail="Username already registered")
    # Check email
    if auth_utils.get_user_by_email(db, user_data.email):
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pw = auth_utils.get_password_hash(user_data.password)
    new_user = models.User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_pw,
        full_name=user_data.full_name,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = auth_utils.create_access_token(data={"sub": new_user.username})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": new_user,
    }


# ── Auth: Login ───────────────────────────────────────────────────────────────
@app.post("/auth/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = auth_utils.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = auth_utils.create_access_token(data={"sub": user.username})
    return {"access_token": token, "token_type": "bearer", "user": user}


# ── Auth: Me ──────────────────────────────────────────────────────────────────
@app.get("/auth/me", response_model=UserResponse)
def get_me(current_user: models.User = Depends(auth_utils.get_current_user)):
    return current_user


# ═══════════════════════════════════════════════════════════════════════════════
# PROTECTED ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/predict")
def predict_crop(
    request: CropPredictionRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_optional_user),
):
    if model is None:
        raise HTTPException(status_code=500, detail="ML Model not loaded.")

    # Use manual weather inputs if provided, otherwise fetch automatically
    if (request.temperature is not None and 
            request.humidity is not None and 
            request.rainfall is not None):
        weather = {
            "temperature": request.temperature,
            "humidity": request.humidity,
            "rainfall": request.rainfall
        }
    else:
        fetched = fetch_weather_data(request.location)
        weather = {
            "temperature": request.temperature if request.temperature is not None else fetched['temperature'],
            "humidity": request.humidity if request.humidity is not None else fetched['humidity'],
            "rainfall": request.rainfall if request.rainfall is not None else fetched['rainfall']
        }

    features = np.array([[
        request.N, request.P, request.K,
        weather['temperature'], weather['humidity'],
        request.ph, weather['rainfall']
    ]])

    probabilities = model.predict_proba(features)[0]
    classes = model.classes_
    top_indices = np.argsort(probabilities)[::-1][:3]
    top_crops = [
        {"crop": str(classes[i]).capitalize(), "confidence": round(float(probabilities[i]) * 100, 2)}
        for i in top_indices
    ]

    is_suitable = True
    alert_message = ""
    if request.ph < 4.0 or request.ph > 9.0:
        is_suitable = False
        alert_message = (
            f"Warning: Extreme soil pH ({request.ph}). "
            "Most crops require a pH between 5.5 and 7.5."
        )
    elif top_crops[0]['confidence'] < 30.0:
        is_suitable = False
        alert_message = (
            "Warning: Low suitability for known crops. "
            "Confidence is very low — consider altering your soil composition."
        )

    # ── Save prediction to DB (only when logged in) ───────────────────────────
    if current_user:
        prediction_record = models.Prediction(
            user_id=current_user.id,
            N=request.N, P=request.P, K=request.K, ph=request.ph,
            location=request.location,
            top_crop=top_crops[0]['crop'],
            confidence=top_crops[0]['confidence'],
            temperature=weather['temperature'],
            humidity=weather['humidity'],
            rainfall=weather['rainfall'],
            is_suitable=is_suitable,
            alert_message=alert_message if alert_message else None,
        )
        db.add(prediction_record)
        db.commit()

    return {
        "is_suitable": is_suitable,
        "alert_message": alert_message,
        "top_crops": top_crops,
        "weather_data_used": weather,
    }


# ── History: all user predictions ─────────────────────────────────────────────
@app.get("/history", response_model=list[PredictionHistoryItem])
def get_history(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    records = (
        db.query(models.Prediction)
        .filter(models.Prediction.user_id == current_user.id)
        .order_by(models.Prediction.timestamp.desc())
        .limit(limit)
        .all()
    )
    return records


# ── History: delete a single record ───────────────────────────────────────────
@app.delete("/history/{prediction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prediction(
    prediction_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    record = (
        db.query(models.Prediction)
        .filter(
            models.Prediction.id == prediction_id,
            models.Prediction.user_id == current_user.id,
        )
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    db.delete(record)
    db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# VARSHA CHATBOT ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/chat", response_model=ChatResponse)
def chat_with_varsha(
    req: ChatRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_optional_user),
):
    """Send a message to Varsha; she responds and the convo is saved to DB."""
    session_id = req.session_id or str(uuid.uuid4())
    user_msg = req.message.strip()
    if not user_msg:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    # ── Save user message ──────────────────────────────────────────────────────
    db.add(models.ChatMessage(
        session_id=session_id,
        user_id=current_user.id if current_user else None,
        role="user",
        message=user_msg,
    ))

    # ── Generate Varsha reply ──────────────────────────────────────────────────
    reply = _varsha_respond(user_msg, req.language)

    # ── Save bot reply ─────────────────────────────────────────────────────────
    db.add(models.ChatMessage(
        session_id=session_id,
        user_id=current_user.id if current_user else None,
        role="bot",
        message=reply,
    ))
    db.commit()

    return {"reply": reply, "session_id": session_id}


@app.get("/chat/history")
def get_chat_history(
    session_id: str,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """Retrieve chat history for a given session_id."""
    messages = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.session_id == session_id)
        .order_by(models.ChatMessage.timestamp.asc())
        .limit(limit)
        .all()
    )
    return [
        {
            "role": m.role,
            "message": m.message,
            "timestamp": m.timestamp.isoformat(),
        }
        for m in messages
    ]


@app.post("/feedback")
def submit_feedback(
    req: FeedbackRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_optional_user),
):
    """Save user feedback to DB."""
    new_feedback = models.Feedback(
        user_id=current_user.id if current_user else None,
        rating=req.rating,
        comment=req.comment,
        category=req.category,
    )
    db.add(new_feedback)
    db.commit()
    return {"message": "Feedback submitted successfully! Thank you. 🌿"}

class LogRequest(BaseModel):
    message: str
    source: Optional[str] = None
    lineno: Optional[int] = None
    colno: Optional[int] = None
    stack: Optional[str] = None

@app.post("/log")
def log_client_error(req: LogRequest):
    print(f"\n[CLIENT LOG] Message: {req.message} | Source: {req.source} | Line: {req.lineno}:{req.colno}")
    if req.stack:
        print(f"[CLIENT LOG STACK]\n{req.stack}\n")
    return {"status": "ok"}

# Trigger reload

# Trigger reload for Gemini Key
