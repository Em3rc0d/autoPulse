from datetime import datetime, timedelta
from app.db.database import get_db
from app.models.telemetry import TelemetryData

COLLECTION = "telemetry"

async def save_telemetry(data: TelemetryData) -> str:
    db = get_db()
    doc = data.model_dump()
    result = await db[COLLECTION].insert_one(doc)
    return str(result.inserted_id)

async def get_latest(vehicle_id: str, limit: int = 50) -> list:
    db = get_db()
    cursor = db[COLLECTION].find(
        {"vehicle_id": vehicle_id},
        sort=[("timestamp", -1)],
        limit=limit
    )
    docs = await cursor.to_list(length=limit)
    for doc in docs:
        doc["id"] = str(doc.pop("_id"))
    return docs

async def get_range(vehicle_id: str, hours: int = 24) -> list:
    db = get_db()
    since = datetime.utcnow() - timedelta(hours=hours)
    cursor = db[COLLECTION].find(
        {"vehicle_id": vehicle_id, "timestamp": {"$gte": since}},
        sort=[("timestamp", 1)]
    )
    docs = await cursor.to_list(length=10000)
    for doc in docs:
        doc["id"] = str(doc.pop("_id"))
    return docs

async def get_stats(vehicle_id: str) -> dict:
    db = get_db()
    pipeline = [
        {"$match": {"vehicle_id": vehicle_id}},
        {"$group": {
            "_id": None,
            "avg_rpm":   {"$avg": "$rpm"},
            "max_speed": {"$max": "$speed"},
            "avg_temp":  {"$avg": "$coolant_temp"},
            "avg_load":  {"$avg": "$engine_load"},
            "total_records": {"$sum": 1}
        }}
    ]
    result = await db[COLLECTION].aggregate(pipeline).to_list(1)
    return result[0] if result else {}
