from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.ai_service import ai_mechanic

router = APIRouter(prefix="/ai", tags=["AI Mechanic"])

class DiagnoseRequest(BaseModel):
    dtc_code: str
    make: str = "Desconocido"
    model: str = "Desconocido"

@router.post("/diagnose")
async def diagnose(request: DiagnoseRequest):
    if not request.dtc_code:
        raise HTTPException(status_code=400, detail="El código DTC es obligatorio")
        
    result = await ai_mechanic.diagnose_dtc(request.dtc_code, request.make, request.model)
    return result
