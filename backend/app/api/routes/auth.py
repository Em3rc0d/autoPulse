from fastapi import APIRouter, HTTPException
from app.models.user import UserCreate, UserLogin
from app.core.security import hash_password, verify_password, create_access_token
from app.db.database import get_db

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/register")
async def register(user: UserCreate):
    db = get_db()
    existing = await db["users"].find_one({"email": user.email})
    if existing:
        raise HTTPException(400, "Email already registered")
    doc = {
        "username":        user.username,
        "email":           user.email,
        "hashed_password": hash_password(user.password),
        "is_active":       True
    }
    result = await db["users"].insert_one(doc)
    token = create_access_token({"sub": str(result.inserted_id), "email": user.email})
    return {"token": token, "username": user.username}

@router.post("/login")
async def login(data: UserLogin):
    db = get_db()
    user = await db["users"].find_one({"email": data.email})
    if not user or not verify_password(data.password, user["hashed_password"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_access_token({"sub": str(user["_id"]), "email": user["email"]})
    return {"token": token, "username": user["username"]}
