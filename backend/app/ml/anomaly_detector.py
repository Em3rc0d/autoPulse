import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import pickle
import os

MODEL_PATH  = "app/ml/model.pkl"
SCALER_PATH = "app/ml/scaler.pkl"

FEATURES = ["rpm", "coolant_temp", "engine_load", "throttle_pos", "speed"]

class AnomalyDetector:
    def __init__(self):
        self.model      = IsolationForest(contamination=0.05, random_state=42)
        self.scaler     = StandardScaler()
        self.is_trained = False

    def prepare_features(self, records: list[dict]) -> np.ndarray:
        matrix = []
        for r in records:
            row = [r.get(f) or 0 for f in FEATURES]
            matrix.append(row)
        return np.array(matrix)

    def train(self, records: list[dict]):
        X = self.prepare_features(records)
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled)
        self.is_trained = True
        with open(MODEL_PATH,  "wb") as f: pickle.dump(self.model,  f)
        with open(SCALER_PATH, "wb") as f: pickle.dump(self.scaler, f)

    def predict(self, record: dict) -> dict:
        battery_risk = 0.0
        coolant_risk = 0.0
        
        b_volt = record.get("battery_voltage") or 12.6
        if b_volt < 11.5 or b_volt > 15.0: battery_risk = 85.0
        elif b_volt < 12.0: battery_risk = 45.0
        else: battery_risk = 5.0
        
        c_temp = record.get("coolant_temp") or 90
        if c_temp > 105: coolant_risk = 90.0
        elif c_temp > 95: coolant_risk = 40.0
        else: coolant_risk = 10.0

        if not self.is_trained:
            return {
                "anomaly": False, 
                "score": 0.0, 
                "message": "Model not trained yet",
                "components": {"battery": battery_risk, "coolant": coolant_risk}
            }
        
        X        = self.prepare_features([record])
        X_scaled = self.scaler.transform(X)
        score      = self.model.score_samples(X_scaled)[0]
        is_anomaly = self.model.predict(X_scaled)[0] == -1
        
        return {
            "anomaly": bool(is_anomaly),
            "score":   float(score),
            "message": "⚠️ Comportamiento anómalo detectado" if is_anomaly else "✅ Normal",
            "components": {"battery": battery_risk, "coolant": coolant_risk}
        }

    def load(self):
        if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
            with open(MODEL_PATH,  "rb") as f: self.model  = pickle.load(f)
            with open(SCALER_PATH, "rb") as f: self.scaler = pickle.load(f)
            self.is_trained = True

detector = AnomalyDetector()
detector.load()
