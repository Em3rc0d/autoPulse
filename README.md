# AutoPulse 🚗⚡
### Plataforma Inteligente de Monitoreo Vehicular
> Renault Logan 2014 · ELM327 Bluetooth · React Native · FastAPI · MongoDB

---

## Arquitectura

```
ELM327 (Bluetooth)
    ↓
React Native App
    ↓  (HTTP POST cada 2s + WebSocket)
FastAPI Backend
    ↓
MongoDB
    ↓
ML / Alertas / WebSocket broadcast
```

---

## Backend (FastAPI + Python)

### Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Editar .env con tu MONGO_URI y SECRET_KEY

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/v1/auth/register | Registro |
| POST | /api/v1/auth/login | Login |
| GET  | /api/v1/vehicles/ | Mis vehículos |
| POST | /api/v1/vehicles/ | Crear vehículo |
| POST | /api/v1/telemetry/ingest | Enviar datos OBD |
| GET  | /api/v1/telemetry/{id}/latest | Últimos registros |
| GET  | /api/v1/telemetry/{id}/stats | Estadísticas |
| WS   | /api/v1/telemetry/ws/{id} | WebSocket tiempo real |
| POST | /api/v1/telemetry/{id}/train-model | Entrenar IA |

Swagger UI: http://localhost:8000/docs

---

## Mobile App (React Native + Expo)

### Setup

```bash
cd mobile-app
npm install
npx expo start
```

### Configurar IP del servidor

En `src/services/api.ts` y `src/hooks/useWebSocket.ts`:
```ts
const BASE_URL = 'http://TU_IP_LOCAL:8000/api/v1';
```

### Librería Bluetooth

```bash
npx expo install react-native-bluetooth-classic
# Requiere build nativo (no Expo Go):
npx expo run:android
```

---

## Estructura del Proyecto

```
autoPulse/
├── backend/
│   ├── app/
│   │   ├── main.py               ← FastAPI app entry
│   │   ├── core/
│   │   │   ├── config.py         ← Settings (env vars)
│   │   │   └── security.py       ← JWT / bcrypt
│   │   ├── db/
│   │   │   └── database.py       ← MongoDB (Motor async)
│   │   ├── models/
│   │   │   ├── telemetry.py      ← Pydantic models
│   │   │   ├── vehicle.py
│   │   │   └── user.py
│   │   ├── services/
│   │   │   ├── telemetry_service.py  ← CRUD MongoDB
│   │   │   └── alert_service.py      ← Reglas de alertas
│   │   ├── ml/
│   │   │   └── anomaly_detector.py   ← Isolation Forest
│   │   └── api/routes/
│   │       ├── auth.py
│   │       ├── vehicles.py
│   │       └── telemetry.py      ← WebSocket + ingest
│   └── requirements.txt
│
└── mobile-app/
    └── src/
        ├── services/
        │   ├── api.ts             ← HTTP client
        │   └── bluetoothOBD.ts   ← ELM327 Bluetooth + parsers
        ├── hooks/
        │   ├── useOBDPolling.ts   ← Lee OBD y envía al backend
        │   └── useWebSocket.ts    ← Recibe datos en tiempo real
        └── screens/
            ├── DashboardScreen.tsx  ← Pantalla principal
            └── BluetoothScreen.tsx  ← Conexión ELM327
```

---

## PIDs OBD2 implementados

| PID | Sensor | Fórmula |
|-----|--------|---------|
| 010C | RPM | (A×256+B)/4 |
| 010D | Velocidad | A km/h |
| 0105 | Temp motor | A-40 °C |
| 0104 | Carga motor | A×100/255 % |
| 0111 | Acelerador | A×100/255 % |
| 0106 | Fuel trim corto | (A-128)×100/128 % |
| 0107 | Fuel trim largo | (A-128)×100/128 % |
| 0110 | MAF | (A×256+B)/100 g/s |
| 03 | Códigos DTC | Parser incluido |

---

## Alertas automáticas

| Sensor | Warning | Critical |
|--------|---------|----------|
| Temperatura motor | 95°C | 105°C |
| RPM | 5500 | 6500 |
| Voltaje batería | 11.8V | 11.0V |
| Carga motor | 85% | 95% |
| DTC | Cualquier código | — |

---

## ML — Anomaly Detection

El backend incluye **Isolation Forest** de scikit-learn.

### Cómo entrenar

```bash
# Después de tener 50+ registros (una semana de uso mínimo):
POST /api/v1/telemetry/{vehicle_id}/train-model
```

Cada `/ingest` responde con:
```json
{
  "anomaly": false,
  "score": -0.42,
  "message": "✅ Normal"
}
```

---

## Roadmap

- [x] Fase 1: Backend FastAPI + MongoDB + WebSocket
- [x] Fase 1: React Native + Bluetooth OBD + Dashboard
- [x] Fase 1: Alertas automáticas + ML base
- [ ] Fase 2: Login/Auth completo en app móvil
- [ ] Fase 2: Gráficos históricos (react-native-chart-kit)
- [ ] Fase 3: ESP32 como gateway WiFi alternativo
- [ ] Fase 4: LSTM para predicción de fallas
- [ ] Fase 5: Kafka + Spark Streaming
