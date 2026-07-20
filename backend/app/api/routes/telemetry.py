from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.models.telemetry import TelemetryData
from app.services.telemetry_service import save_telemetry, get_latest, get_range, get_stats
from app.services.alert_service import check_alerts
from app.ml.anomaly_detector import detector

router = APIRouter(prefix="/telemetry", tags=["Telemetry"])

# Active WebSocket connections per vehicle
connections: dict[str, list[WebSocket]] = {}

from app.db.database import get_db

@router.post("/ingest")
async def ingest(data: TelemetryData):
    db = get_db()
    vehicle = await db["vehicles"].find_one({"vehicle_id": data.vehicle_id})
    
    doc_id  = await save_telemetry(data)
    alerts  = check_alerts(data)
    
    if vehicle and vehicle.get("guardian_mode_active"):
        limit = vehicle.get("guardian_speed_limit", 60)
        if data.speed and data.speed > limit:
            alerts.append(f"GUARDIÁN: Límite de velocidad excedido ({data.speed} > {limit} km/h)")
            
    anomaly = detector.predict(data.model_dump())

    payload = {
        "id":      doc_id,
        "data":    data.model_dump(),
        "alerts":  alerts,
        "anomaly": anomaly
    }

    # Broadcast to WebSocket clients watching this vehicle
    for ws in connections.get(data.vehicle_id, []):
        try:
            await ws.send_json(payload)
        except Exception:
            pass

    return payload

@router.get("/{vehicle_id}/latest")
async def latest(vehicle_id: str, limit: int = 50):
    return await get_latest(vehicle_id, limit)

@router.get("/{vehicle_id}/range")
async def range_data(vehicle_id: str, hours: int = 24):
    return await get_range(vehicle_id, hours)

@router.get("/{vehicle_id}/stats")
async def stats(vehicle_id: str):
    return await get_stats(vehicle_id)

@router.websocket("/ws/{vehicle_id}")
async def websocket_endpoint(websocket: WebSocket, vehicle_id: str):
    await websocket.accept()
    if vehicle_id not in connections:
        connections[vehicle_id] = []
    connections[vehicle_id].append(websocket)
    try:
        while True:
            await websocket.receive_text()   # keep-alive
    except WebSocketDisconnect:
        connections[vehicle_id].remove(websocket)

@router.post("/{vehicle_id}/train-model")
async def train_model(vehicle_id: str):
    records = await get_range(vehicle_id, hours=168)   # last 7 days
    if len(records) < 50:
        return {"error": "Not enough data. Need at least 50 records."}
    detector.train(records)
    return {"message": f"✅ Model trained with {len(records)} records"}
