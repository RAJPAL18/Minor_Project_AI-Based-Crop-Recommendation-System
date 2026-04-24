import pandas as pd
import numpy as np
import os

def generate_data(num_samples=2000):
    np.random.seed(42)
    crops = ['rice', 'maize', 'chickpea', 'kidneybeans', 'pigeonpeas',
             'mothbeans', 'mungbean', 'blackgram', 'lentil', 'pomegranate',
             'banana', 'mango', 'grapes', 'watermelon', 'muskmelon', 'apple',
             'orange', 'papaya', 'coconut', 'cotton', 'jute', 'coffee']
    
    data = []
    for crop in crops:
        # Generate some clustered data for each crop so the model learns something
        base_N = np.random.randint(20, 100)
        base_P = np.random.randint(20, 100)
        base_K = np.random.randint(20, 100)
        base_temp = np.random.uniform(20.0, 30.0)
        base_hum = np.random.uniform(50.0, 80.0)
        base_ph = np.random.uniform(5.5, 7.5)
        base_rain = np.random.uniform(50.0, 150.0)
        
        for _ in range(num_samples // len(crops)):
            N = max(0, base_N + np.random.normal(0, 10))
            P = max(0, base_P + np.random.normal(0, 10))
            K = max(0, base_K + np.random.normal(0, 10))
            temperature = base_temp + np.random.normal(0, 2)
            humidity = min(100, max(0, base_hum + np.random.normal(0, 5)))
            ph = base_ph + np.random.normal(0, 0.5)
            rainfall = max(0, base_rain + np.random.normal(0, 20))
            
            data.append([N, P, K, temperature, humidity, ph, rainfall, crop])
            
    df = pd.DataFrame(data, columns=['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall', 'label'])
    
    os.makedirs('../data', exist_ok=True)
    df.to_csv('../data/crop_recommendation.csv', index=False)
    print("Synthetic dataset generated at ../data/crop_recommendation.csv")

if __name__ == "__main__":
    generate_data()
