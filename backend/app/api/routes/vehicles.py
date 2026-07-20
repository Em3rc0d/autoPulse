from fastapi import APIRouter, HTTPException
from app.models.vehicle import VehicleCreate
from app.db.database import get_db
from datetime import datetime
import uuid

router = APIRouter(prefix="/vehicles", tags=["Vehicles"])

@router.post("/")
async def create_vehicle(data: VehicleCreate, owner_id: str = "default"):
    db = get_db()
    vehicle_id = f"{data.make.lower()}-{data.model.lower()}-{uuid.uuid4().hex[:6]}"
    doc = {
        "vehicle_id": vehicle_id,
        "name":       data.name,
        "make":       data.make,
        "model":      data.model,
        "year":       data.year,
        "fuel_type":  data.fuel_type,
        "owner_id":   owner_id,
        "created_at": datetime.utcnow()
    }
    await db["vehicles"].insert_one(doc)
    doc.pop("_id", None)
    return {"vehicle_id": vehicle_id, **doc}

@router.get("/")
async def list_vehicles(owner_id: str = "default"):
    db = get_db()
    cursor = db["vehicles"].find({"owner_id": owner_id})
    docs = await cursor.to_list(length=100)
    for d in docs:
        d["id"] = str(d.pop("_id"))
    return docs

@router.get("/{vehicle_id}")
async def get_vehicle(vehicle_id: str):
    db = get_db()
    doc = await db["vehicles"].find_one({"vehicle_id": vehicle_id})
    if not doc:
        raise HTTPException(404, "Vehicle not found")
    doc["id"] = str(doc.pop("_id"))
    return doc
