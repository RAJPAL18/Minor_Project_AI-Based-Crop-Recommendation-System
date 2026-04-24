from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import numpy as np
import requests
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="KisanConnect AI-Based Crop Recommendation System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
model_path = os.path.join(BASE_DIR, 'saved_models', 'crop_model.pkl')
try:
    model = joblib.load(model_path)
    print("Model loaded successfully.")
except Exception as e:
    print(f"Warning: Model not found at {model_path}. Please train the model first.")
    model = None

class CropPredictionRequest(BaseModel):
    N: float
    P: float
    K: float
    ph: float
    location: str

WEATHER_API_KEY = os.getenv('OPENWEATHERMAP_API_KEY', 'YOUR_DUMMY_KEY') # Replace with actual API key in .env

def fetch_weather_data(location: str):
    # Dummy logic to handle if API key is not present or dummy
    if WEATHER_API_KEY == 'YOUR_DUMMY_KEY':
        # Return simulated weather data if no API key is provided
        return {"temperature": 25.0, "humidity": 70.0, "rainfall": 100.0}
        
    url = f"http://api.openweathermap.org/data/2.5/weather?q={location}&appid={WEATHER_API_KEY}&units=metric"
    response = requests.get(url)
    if response.status_code != 200:
        # Fallback to simulated data for demo purposes if API call fails
        return {"temperature": 25.0, "humidity": 70.0, "rainfall": 100.0}
        
    data = response.json()
    temp = data['main']['temp']
    humidity = data['main']['humidity']
    
    # OpenWeatherMap often omits rain if it's not raining, we'll use a fallback
    rainfall = 100.0
    if 'rain' in data and '1h' in data['rain']:
        rainfall = data['rain']['1h'] * 24 * 30 # roughly monthly rainfall estimation
        
    return {"temperature": temp, "humidity": humidity, "rainfall": rainfall}

@app.get("/")
def read_root():
    return {"message": "Welcome to KisanConnect API"}

@app.post("/predict")
def predict_crop(request: CropPredictionRequest):
    if model is None:
        raise HTTPException(status_code=500, detail="ML Model not loaded.")
        
    weather = fetch_weather_data(request.location)
    
    # Features array: N, P, K, temperature, humidity, ph, rainfall
    features = np.array([[
        request.N,
        request.P,
        request.K,
        weather['temperature'],
        weather['humidity'],
        request.ph,
        weather['rainfall']
    ]])
    
    probabilities = model.predict_proba(features)[0]
    classes = model.classes_
    
    # Get top 3 predictions
    top_indices = np.argsort(probabilities)[::-1][:3]
    top_crops = [
        {"crop": str(classes[i]).capitalize(), "confidence": round(float(probabilities[i]) * 100, 2)}
        for i in top_indices
    ]
    
    # Suitability Check
    is_suitable = True
    alert_message = ""
    
    if request.ph < 4.0 or request.ph > 9.0:
        is_suitable = False
        alert_message = f"Warning: Extreme soil pH ({request.ph}). Most crops require a pH between 5.5 and 7.5. Consider soil amendment."
    elif top_crops[0]['confidence'] < 30.0:
        is_suitable = False
        alert_message = "Warning: Low suitability for known crops based on these exact conditions. The confidence is very low. You may need to alter your soil composition."
    
    return {
        "is_suitable": is_suitable,
        "alert_message": alert_message,
        "top_crops": top_crops,
        "weather_data_used": weather
    }
