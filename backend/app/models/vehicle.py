from typing import Optional
from pydantic import BaseModel
from datetime import datetime

class Vehicle(BaseModel):
    vehicle_id: str
    name: str
    make: str
    model: str
    year: int
    fuel_type: str
    owner_id: str
    plate: Optional[str] = None
    soat_expiration: Optional[datetime] = None
    citv_expiration: Optional[datetime] = None
    gnv_expiration: Optional[datetime] = None
    docs_last_checked: Optional[datetime] = None
    guardian_mode_active: bool = False
    guardian_speed_limit: int = 60
    created_at: datetime = datetime.utcnow()

class VehicleCreate(BaseModel):
    name: str
    make: str
    model: str
    year: int
    fuel_type: str = "gasoline"
