from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.db.database import connect_db, close_db, get_db
from app.api.routes import telemetry, auth, vehicles, ai_mechanic
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.services.scraper_service import verifier
from datetime import datetime

scheduler = AsyncIOScheduler()

async def check_all_vehicles_documents():
    db = get_db()
    print("[CRON] Iniciando verificación de documentos de todos los vehículos...")
    cursor = db.vehicles.find({"plate": {"$exists": True, "$ne": None}})
    vehicles_list = await cursor.to_list(length=100)
    
    for v in vehicles_list:
        plate = v.get("plate")
        print(f"[CRON] Verificando placa {plate}")
        results = await verifier.verify_all(plate)
        
        await db.vehicles.update_one(
            {"_id": v["_id"]},
            {"$set": {
                "soat_expiration": results["soat_expiration"],
                "citv_expiration": results["citv_expiration"],
                "gnv_expiration": results["gnv_expiration"],
                "docs_last_checked": datetime.utcnow()
            }}
        )
    print("[CRON] Verificación completada.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    # Schedule to run every Sunday at 3 AM
    scheduler.add_job(check_all_vehicles_documents, 'cron', day_of_week='sun', hour=3, minute=0)
    scheduler.start()
    yield
    scheduler.shutdown()
    await close_db()

app = FastAPI(
    title="AutoPulse API",
    description="Plataforma inteligente de monitoreo vehicular",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,     prefix="/api/v1")
app.include_router(vehicles.router, prefix="/api/v1")
app.include_router(telemetry.router,prefix="/api/v1")
app.include_router(ai_mechanic.router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"app": "AutoPulse", "status": "running", "version": "1.0.0"}
