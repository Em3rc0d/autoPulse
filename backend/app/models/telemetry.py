from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class TelemetryData(BaseModel):
    vehicle_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    rpm: Optional[float] = None
    speed: Optional[float] = None
    coolant_temp: Optional[float] = None
    engine_load: Optional[float] = None
    throttle_pos: Optional[float] = None
    fuel_trim_short: Optional[float] = None
    fuel_trim_long: Optional[float] = None
    intake_air_temp: Optional[float] = None
    maf: Optional[float] = None
    o2_voltage: Optional[float] = None
    battery_voltage: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    dtc_codes: list[str] = []

class TelemetryResponse(TelemetryData):
    id: str
