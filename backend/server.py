"""
MediTrack Backend — Production-grade FastAPI server.

Features:
  - Modern lifespan management (replaces deprecated on_event)
  - Structured JSON logging
  - Startup env validation
  - MongoDB indexes for performance
  - Request-ID middleware for traceability
  - Security headers middleware
  - Proper CORS configuration
  - Health check endpoints for AWS ALB / ECS
"""

import base64
import json
import os
import tempfile
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from importlib import resources as package_resources
from pathlib import Path
from typing import List

import logging
from fastapi import APIRouter, Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.cors import CORSMiddleware

from ai_service import analyze_interactions_dynamic, extract_medicines_from_text, extract_medicines_from_image, generate_chat_reply, transcribe_voice_note
from auth_utils import create_access_token, decode_access_token, hash_password, verify_password
from schemas import (
    AuthResponse,
    ChatMessage,
    ChatRequest,
    InteractionAlert,
    InteractionRule,
    MedicalRecord,
    MedicalRecordCreate,
    MedicineCreate,
    MedicineRecord,
    ReportCreate,
    ResetConfirm,
    ResetRequest,
    ShareReport,
    UserCreate,
    UserLogin,
    UserProfile,
)


# ─── Configuration ─────────────────────────────────

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
ENVIRONMENT = os.environ.get("ENVIRONMENT", "development")

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("meditrack")

# ─── Required env validation ───────────────────────

REQUIRED_ENV = ["MONGO_URL", "DB_NAME", "JWT_SECRET", "CORS_ORIGINS"]
_missing = [key for key in REQUIRED_ENV if not os.environ.get(key)]
if _missing:
    raise RuntimeError(f"Missing required environment variables: {', '.join(_missing)}")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
CORS_ORIGINS = [origin.strip() for origin in os.environ["CORS_ORIGINS"].split(",") if origin.strip()]

logger.info(f"🔧 Environment: {ENVIRONMENT}")
logger.info(f"🔌 MongoDB URL: {MONGO_URL}")
logger.info(f"📦 Database: {DB_NAME}")
logger.info(f"🌐 CORS origins: {CORS_ORIGINS}")


# ─── Database ──────────────────────────────────────

client = AsyncIOMotorClient(
    MONGO_URL,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=5000,
    maxPoolSize=50,
    minPoolSize=5,
)
db = client[DB_NAME]


# ─── MongoDB Index Setup ──────────────────────────

async def ensure_indexes():
    """Create MongoDB indexes for production query performance."""
    try:
        await db.users.create_index("id", unique=True)
        await db.users.create_index("email", unique=True)
        await db.users.create_index("phone")
        await db.medicines.create_index([("user_id", 1), ("created_at", -1)])
        await db.medicines.create_index("id", unique=True)
        await db.records.create_index([("user_id", 1), ("created_at", -1)])
        await db.records.create_index("id", unique=True)
        await db.interaction_alerts.create_index([("user_id", 1), ("timestamp", -1)])
        await db.share_reports.create_index("share_token", unique=True)
        await db.share_reports.create_index([("user_id", 1), ("created_at", -1)])
        await db.chat_messages.create_index([("user_id", 1), ("created_at", 1)])
        logger.info("✅ MongoDB indexes ensured")
    except Exception as exc:
        logger.error(f"❌ Failed to create indexes: {exc}")


# ─── Seed Defaults ─────────────────────────────────

async def seed_defaults():
    """Seed drug interaction rules (upsert by id) and admin user on first boot."""
    rules_path = ROOT_DIR / "drug_interactions.json"
    if rules_path.exists():
        rules = json.loads(rules_path.read_text())
    else:
        try:
            packaged_rules_path = package_resources.files("meditrack_backend").joinpath("drug_interactions.json")
            rules = json.loads(packaged_rules_path.read_text())
        except Exception:
            rules = []

    # Upsert each rule by its id — runs every startup so new rules are always picked up
    if rules:
        for rule in rules:
            await db.interaction_rules.update_one(
                {"id": rule["id"]},
                {"$set": rule},
                upsert=True,
            )
        logger.info(f"✅ Upserted {len(rules)} drug interaction rules")

    admin_email = "admin@meditrack.app"
    admin_exists = await db.users.find_one({"email": admin_email}, {"_id": 0})
    if not admin_exists:
        admin_user = UserProfile(
            name="Medi Track Admin",
            age=34,
            blood_group="O+",
            email=admin_email,
            phone="9999999999",
            profile_photo="https://images.pexels.com/photos/5452201/pexels-photo-5452201.jpeg?auto=compress&cs=tinysrgb&w=600",
            role="admin",
        ).model_dump()
        admin_user.update({"password_hash": hash_password("Admin123!"), "created_at": admin_user["created_at"].isoformat()})
        await db.users.insert_one(admin_user)
        logger.info("✅ Seeded admin user (admin@meditrack.app)")


# ─── Lifespan ──────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Modern lifespan handler replacing deprecated on_event."""
    logger.info("🚀 MediTrack Backend starting up...")

    # Verify DB connection
    try:
        result = await client.admin.command("ping")
        logger.info(f"✅ MongoDB connected — ping: {result}")
    except Exception as exc:
        logger.error(f"❌ MongoDB connection FAILED: {exc}")

    await ensure_indexes()
    await seed_defaults()

    logger.info(f"🟢 MediTrack Backend is LIVE ({ENVIRONMENT})")

    yield  # App runs here

    # Shutdown
    logger.info("🔴 MediTrack Backend shutting down...")
    client.close()
    logger.info("✅ MongoDB connection closed")


# ─── FastAPI App ───────────────────────────────────

app = FastAPI(
    title="MediTrack API",
    version="2.0.0",
    description="AI-powered medicine tracking and safety platform",
    docs_url="/docs" if ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if ENVIRONMENT != "production" else None,
    lifespan=lifespan,
)

api_router = APIRouter(prefix="/api")
security = HTTPBearer()


# ─── Middleware ────────────────────────────────────

@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    """Add request ID, log requests, and add security headers."""
    request_id = str(uuid.uuid4())[:8]
    start_time = time.time()

    response = await call_next(request)

    duration_ms = round((time.time() - start_time) * 1000, 2)
    logger.info(
        f"[{request_id}] {request.method} {request.url.path} → {response.status_code} ({duration_ms}ms)"
    )

    # Security headers
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    return response


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Global Exception Handler ──────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please try again later."},
    )


# ─── Health Checks ─────────────────────────────────

@app.get("/", tags=["Health"])
async def root_health():
    """Root endpoint — returns service status + DB connectivity."""
    try:
        await client.admin.command("ping")
        db_status = "connected"
    except Exception:
        db_status = "disconnected"
    return {
        "status": "running",
        "service": "MediTrack API",
        "version": "2.0.0",
        "environment": ENVIRONMENT,
        "database": db_status,
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check for AWS ALB / ECS target groups."""
    try:
        await client.admin.command("ping")
        return {"status": "healthy", "database": "connected"}
    except Exception:
        raise HTTPException(status_code=503, detail="Database connection failed")


# ─── Helpers ───────────────────────────────────────

barcode_reference = {
    "8901030863048": {"medicine_name": "Paracetamol", "dosage": "500 mg", "frequency": "After meals"},
    "8901063151201": {"medicine_name": "Ibuprofen", "dosage": "200 mg", "frequency": "After meals"},
    "8901725130054": {"medicine_name": "Amoxicillin", "dosage": "500 mg", "frequency": "Twice daily"},
}


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def document_without_mongo_id(document: dict) -> dict:
    if not document:
        return {}
    return {key: value for key, value in document.items() if key != "_id"}


# ─── Auth Dependencies ─────────────────────────────

async def get_user_from_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_admin_user(user=Depends(get_user_from_token)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ─── Interaction Alert Engine ──────────────────────

async def create_interaction_alerts(user_id: str) -> List[dict]:
    medicines = await db.medicines.find({"user_id": user_id}, {"_id": 0}).to_list(200)
    alerts = []
    seen_ai = set()

    # ── AI analysis — always runs independently for ALL combinations ──────
    # Check against AI analysis
    for ai_alert in await analyze_interactions_dynamic(user_id, [m["medicine_name"] for m in medicines]):
        key = tuple(sorted([name.lower() for name in ai_alert.get("medicine_combination", [])]))
        if len(key) < 2 or key in seen_ai:
            continue
        seen_ai.add(key)
        alert = InteractionAlert(
            user_id=user_id,
            medicine_combination=ai_alert.get("medicine_combination", []),
            severity_level=ai_alert.get("severity_level", "mild"),
            explanation=ai_alert.get("explanation", "Potential interaction detected."),
            safety_recommendation=ai_alert.get("safety_recommendation", "Confirm with a doctor or pharmacist."),
            source="ai",
        )
        alerts.append(alert.model_dump())


    await db.interaction_alerts.delete_many({"user_id": user_id})
    if alerts:
        docs = [{**alert, "timestamp": alert["timestamp"].isoformat()} for alert in alerts]
        await db.interaction_alerts.insert_many(docs)
    return alerts


async def build_report_payload(user_id: str) -> dict:
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0, "reset_code": 0})
    medicines = await db.medicines.find({"user_id": user_id}, {"_id": 0}).to_list(200)
    records = await db.records.find({"user_id": user_id}, {"_id": 0}).to_list(200)
    alerts = await db.interaction_alerts.find({"user_id": user_id}, {"_id": 0}).to_list(200)
    return {
        "user": user,
        "medicines": medicines,
        "records": records,
        "alerts": alerts,
        "generated_at": iso_now(),
    }


# ─── API Routes ────────────────────────────────────

@api_router.get("/", tags=["API"])
async def api_root():
    return {"message": "MediTrack API is running", "version": "2.0.0"}


# ── Auth ────────────────────────────────────────────

@api_router.post("/auth/signup", response_model=AuthResponse, tags=["Auth"])
async def signup(input: UserCreate):
    existing_user = await db.users.find_one({"email": input.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email is already registered")

    user = UserProfile(
        name=input.name,
        age=input.age,
        blood_group=input.blood_group,
        email=input.email,
        phone=input.phone,
        profile_photo=input.profile_photo or "https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=600",
        role="patient",
    )
    user_doc = user.model_dump()
    user_doc.update({
        "password_hash": hash_password(input.password),
        "created_at": user_doc["created_at"].isoformat(),
        "reset_code": "",
    })
    await db.users.insert_one(user_doc)
    token = create_access_token(user.id, user.role)
    logger.info(f"New user registered: {input.email}")
    return AuthResponse(token=token, user=user)


@api_router.post("/auth/login", response_model=AuthResponse, tags=["Auth"])
async def login(input: UserLogin):
    user = await db.users.find_one({"email": input.email}, {"_id": 0})
    if not user or not verify_password(input.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user_profile = UserProfile(**{k: v for k, v in user.items() if k not in {"password_hash", "reset_code"}})
    logger.info(f"User logged in: {input.email}")
    return AuthResponse(token=create_access_token(user_profile.id, user_profile.role), user=user_profile)


@api_router.post("/auth/request-reset", tags=["Auth"])
async def request_reset(input: ResetRequest):
    user = await db.users.find_one({"phone": input.phone}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="No account found for that phone number")
    code = str(uuid.uuid4().int)[-6:]
    await db.users.update_one({"id": user["id"]}, {"$set": {"reset_code": code}})
    return {"message": "Verification code generated", "demo_code": code}


@api_router.post("/auth/confirm-reset", tags=["Auth"])
async def confirm_reset(input: ResetConfirm):
    user = await db.users.find_one({"phone": input.phone}, {"_id": 0})
    if not user or user.get("reset_code") != input.code:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password_hash": hash_password(input.new_password), "reset_code": ""}},
    )
    return {"message": "Password updated successfully"}


@api_router.get("/auth/me", tags=["Auth"])
async def me(user=Depends(get_user_from_token)):
    return {"user": {k: v for k, v in user.items() if k not in {"password_hash", "reset_code"}}}


@api_router.delete("/auth/account", tags=["Auth"])
async def delete_account(user=Depends(get_user_from_token)):
    user_id = user["id"]
    await db.users.delete_one({"id": user_id})
    await db.medicines.delete_many({"user_id": user_id})
    await db.records.delete_many({"user_id": user_id})
    await db.interaction_alerts.delete_many({"user_id": user_id})
    await db.share_reports.delete_many({"user_id": user_id})
    await db.chat_messages.delete_many({"user_id": user_id})
    logger.info(f"Account deleted: {user_id}")
    return {"message": "Account deleted"}


# ── Dashboard ──────────────────────────────────────

@api_router.get("/dashboard", tags=["Dashboard"])
async def dashboard(user=Depends(get_user_from_token)):
    user_id = user["id"]
    medicines = await db.medicines.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
    alerts = await db.interaction_alerts.find({"user_id": user_id}, {"_id": 0}).sort("timestamp", -1).to_list(20)
    records = await db.records.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(10)
    reminders = [
        {
            "id": medicine["id"],
            "medicine_name": medicine["medicine_name"],
            "reminder_times": medicine.get("reminder_times", []),
            "taken_today": datetime.now(timezone.utc).date().isoformat() in medicine.get("taken_log", []),
        }
        for medicine in medicines
    ]
    return {
        "user": {k: v for k, v in user.items() if k not in {"password_hash", "reset_code"}},
        "summary": {
            "medicine_count": len(medicines),
            "alert_count": len(alerts),
            "record_count": len(records),
            "adherence_score": max(68, 100 - (len(alerts) * 7)),
        },
        "medicines": medicines,
        "alerts": alerts,
        "records": records,
        "reminders": reminders,
    }


# ── Medicines ──────────────────────────────────────

@api_router.get("/medicines", tags=["Medicines"])
async def get_medicines(user=Depends(get_user_from_token)):
    medicines = await db.medicines.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"items": medicines}


@api_router.post("/medicines", tags=["Medicines"])
async def add_medicine(input: MedicineCreate, user=Depends(get_user_from_token)):
    medicine = MedicineRecord(user_id=user["id"], **input.model_dump())
    medicine_doc = medicine.model_dump()
    medicine_doc["created_at"] = medicine_doc["created_at"].isoformat()
    await db.medicines.insert_one(medicine_doc)
    alerts = await create_interaction_alerts(user["id"])
    return {"medicine": medicine, "alerts": alerts}


@api_router.post("/medicines/import-from-text", tags=["Medicines"])
async def import_medicines(payload: dict, user=Depends(get_user_from_token)):
    raw_text = payload.get("raw_text", "").strip()
    source = payload.get("source", "upload")
    if not raw_text:
        raise HTTPException(status_code=400, detail="No text received for processing")

    extracted = await extract_medicines_from_text(user["id"], raw_text)
    saved_items = []
    if extracted:
        for item in extracted[:5]:
            if not item.get("medicine_name"):
                continue
            medicine = MedicineRecord(
                user_id=user["id"],
                medicine_name=item.get("medicine_name", "Unknown medicine"),
                dosage=item.get("dosage", "Refer prescription"),
                start_date=datetime.now(timezone.utc).date().isoformat(),
                frequency=item.get("frequency", "As prescribed"),
                reminder_times=[],
                notes=item.get("notes", "Imported from scan"),
                source=source,
                barcode="",
            )
            doc = medicine.model_dump()
            doc["created_at"] = doc["created_at"].isoformat()
            await db.medicines.insert_one(doc)
            saved_items.append(document_without_mongo_id(doc))

    if not saved_items:
        raise HTTPException(status_code=400, detail="Enter valid medicine details")

    alerts = await create_interaction_alerts(user["id"])
    return {"items": saved_items, "alerts": alerts}


@api_router.post("/medicines/import-from-image", tags=["Medicines"])
async def import_medicines_from_image(
    file: UploadFile = File(...),
    source: str = "upload",
    user=Depends(get_user_from_token)
):
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    base64_image = base64.b64encode(contents).decode("utf-8")
    mime_type = file.content_type or "image/jpeg"

    result = await extract_medicines_from_image(user["id"], base64_image, mime_type)
    extracted_meds = result.get("medicines", [])
    transcription = result.get("transcription", "")

    saved_items = []
    if extracted_meds:
        for item in extracted_meds[:5]:
            if not item.get("medicine_name"):
                continue
            medicine = MedicineRecord(
                user_id=user["id"],
                medicine_name=item.get("medicine_name", "Unknown medicine"),
                dosage=item.get("dosage", "Refer prescription"),
                start_date=datetime.now(timezone.utc).date().isoformat(),
                frequency=item.get("frequency", "As prescribed"),
                reminder_times=[],
                notes=item.get("notes", f"Imported from {source} image"),
                source=source,
                barcode="",
            )
            doc = medicine.model_dump()
            doc["created_at"] = doc["created_at"].isoformat()
            await db.medicines.insert_one(doc)
            saved_items.append(document_without_mongo_id(doc))

    if not saved_items:
        raise HTTPException(status_code=400, detail="Enter valid medicine details")

    alerts = await create_interaction_alerts(user["id"])
    return {
        "items": saved_items,
        "alerts": alerts,
        "transcription": transcription
    }


@api_router.get("/medicines/barcode/{barcode}", tags=["Medicines"])
async def lookup_barcode(barcode: str, user=Depends(get_user_from_token)):
    lookup = barcode_reference.get(barcode)
    if lookup:
        return {"item": lookup}
    return {
        "item": {
            "medicine_name": f"Barcode {barcode[-4:]} medicine",
            "dosage": "Check label",
            "frequency": "As directed",
        }
    }


@api_router.post("/medicines/{medicine_id}/mark-taken", tags=["Medicines"])
async def mark_medicine_taken(medicine_id: str, user=Depends(get_user_from_token)):
    medicine = await db.medicines.find_one({"id": medicine_id, "user_id": user["id"]}, {"_id": 0})
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found")
    taken_log = set(medicine.get("taken_log", []))
    taken_log.add(datetime.now(timezone.utc).date().isoformat())
    await db.medicines.update_one({"id": medicine_id}, {"$set": {"taken_log": sorted(list(taken_log))}})
    return {"message": "Marked as taken"}


@api_router.delete("/medicines/{medicine_id}", tags=["Medicines"])
async def delete_medicine(medicine_id: str, user=Depends(get_user_from_token)):
    await db.medicines.delete_one({"id": medicine_id, "user_id": user["id"]})
    alerts = await create_interaction_alerts(user["id"])
    return {"message": "Medicine removed", "alerts": alerts}


# ── Records ────────────────────────────────────────

@api_router.get("/records", tags=["Records"])
async def get_records(user=Depends(get_user_from_token)):
    records = await db.records.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"items": records}


@api_router.post("/records", tags=["Records"])
async def add_record(input: MedicalRecordCreate, user=Depends(get_user_from_token)):
    record = MedicalRecord(user_id=user["id"], **input.model_dump())
    record_doc = record.model_dump()
    record_doc["created_at"] = record_doc["created_at"].isoformat()
    await db.records.insert_one(record_doc)
    return {"record": record}


@api_router.delete("/records/{record_id}", tags=["Records"])
async def delete_record(record_id: str, user=Depends(get_user_from_token)):
    await db.records.delete_one({"id": record_id, "user_id": user["id"]})
    return {"message": "Record deleted"}


# ── Alerts ─────────────────────────────────────────

@api_router.get("/alerts", tags=["Alerts"])
async def get_alerts(user=Depends(get_user_from_token)):
    alerts = await db.interaction_alerts.find({"user_id": user["id"]}, {"_id": 0}).sort("timestamp", -1).to_list(200)
    return {"items": alerts}


@api_router.post("/alerts/refresh", tags=["Alerts"])
async def refresh_alerts(user=Depends(get_user_from_token)):
    """Force re-run the full interaction analysis (DB rules + AI) for the current user."""
    alerts = await create_interaction_alerts(user["id"])
    serialized = []
    for alert in alerts:
        doc = {**alert}
        if hasattr(doc.get("timestamp"), "isoformat"):
            doc["timestamp"] = doc["timestamp"].isoformat()
        serialized.append(doc)
    logger.info(f"Alert refresh triggered for user {user['id']}: {len(alerts)} alerts found")
    return {"items": serialized, "count": len(alerts)}


# ── Profile ────────────────────────────────────────

@api_router.get("/profile", tags=["Profile"])
async def get_profile(user=Depends(get_user_from_token)):
    return {"profile": {k: v for k, v in user.items() if k not in {"password_hash", "reset_code"}}}


@api_router.put("/profile", tags=["Profile"])
async def update_profile(payload: dict, user=Depends(get_user_from_token)):
    allowed_fields = {"name", "age", "blood_group", "profile_photo", "phone"}
    update_fields = {k: v for k, v in payload.items() if k in allowed_fields}
    if not update_fields:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    await db.users.update_one({"id": user["id"]}, {"$set": update_fields})
    updated_user = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0, "reset_code": 0})
    return {"profile": updated_user}


# ── Reports ────────────────────────────────────────

@api_router.get("/reports", tags=["Reports"])
async def get_reports(user=Depends(get_user_from_token)):
    reports = await db.share_reports.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"items": reports}


@api_router.post("/reports", tags=["Reports"])
async def create_report(input: ReportCreate, user=Depends(get_user_from_token)):
    report = ShareReport(user_id=user["id"], **input.model_dump())
    report_doc = report.model_dump()
    report_doc["created_at"] = report_doc["created_at"].isoformat()
    report_doc["payload"] = await build_report_payload(user["id"])
    await db.share_reports.insert_one(report_doc)
    return {"report": document_without_mongo_id(report_doc)}


@api_router.get("/public/reports/{share_token}", tags=["Reports"])
async def public_report(share_token: str):
    report = await db.share_reports.find_one({"share_token": share_token}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"report": report}


# ── Chat ──────────────────────────────────────────

NON_MEDICAL_PATTERNS = [
    "javascript", "python", "code", "programming", "software", "computer",
    "movie", "film", "song", "music", "cricket", "football", "game",
    "weather", "news", "politics", "election", "stock", "crypto", "bitcoin",
    "recipe", "cook", "restaurant", "travel", "hotel", "flight",
    "joke", "funny", "meme", "story", "poem", "essay", "homework",
]
MEDICAL_PATTERNS = [
    "medicine", "drug", "tablet", "capsule", "dose", "dosage", "symptom", "disease",
    "pain", "fever", "headache", "infection", "antibiotic", "prescription",
    "doctor", "hospital", "health", "medical", "treatment", "side effect",
    "allergy", "blood", "heart", "diabetes", "pressure", "vitamin",
    "supplement", "pharmacy", "pharmacist", "injection", "vaccination", "vaccine",
    "cancer", "surgery", "diagnosis", "chronic", "acute", "wound", "fracture",
    "nausea", "vomiting", "diarrhea", "constipation", "asthma", "inhaler",
    "anxiety", "depression", "mental health", "sleep", "insomnia", "fatigue",
]
MEDICAL_ONLY_REFUSAL = (
    "I can only answer medical and health-related questions. "
    "Please ask about medicines, dosage, side effects, or health conditions."
)


def _is_likely_non_medical(text: str) -> bool:
    lower = text.lower()
    has_non_medical = any(kw in lower for kw in NON_MEDICAL_PATTERNS)
    has_medical = any(kw in lower for kw in MEDICAL_PATTERNS)
    return has_non_medical and not has_medical


@api_router.post("/chat", tags=["Chat"])
async def chat(input: ChatRequest, user=Depends(get_user_from_token)):
    # Server-side medical topic guard
    if _is_likely_non_medical(input.message):
        return {"reply": MEDICAL_ONLY_REFUSAL, "messages": []}

    user_message = ChatMessage(user_id=user["id"], role="user", message=input.message)
    user_doc = user_message.model_dump()
    user_doc["created_at"] = user_doc["created_at"].isoformat()
    await db.chat_messages.insert_one({**user_doc})

    history = await db.chat_messages.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", 1).to_list(50)
    reply = await generate_chat_reply(user["id"], history, input.message)

    assistant_message = ChatMessage(user_id=user["id"], role="assistant", message=reply)
    assistant_doc = assistant_message.model_dump()
    assistant_doc["created_at"] = assistant_doc["created_at"].isoformat()
    await db.chat_messages.insert_one({**assistant_doc})
    return {"reply": reply, "messages": [user_doc, assistant_doc]}


# ── Voice ─────────────────────────────────────────

@api_router.post("/voice/transcribe", tags=["Voice"])
async def transcribe_voice(file: UploadFile = File(...), user=Depends(get_user_from_token)):
    filename = file.filename or "voice-note.webm"
    suffix = Path(filename).suffix or ".webm"
    payload = await file.read()

    if not payload:
        raise HTTPException(status_code=400, detail="Audio file is empty")
    if len(payload) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Audio file exceeds the 25 MB limit")

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(payload)
            temp_path = temp_file.name

        transcript = await transcribe_voice_note(temp_path)
        if not transcript:
            raise HTTPException(status_code=422, detail="Unable to transcribe this voice note")
        return {"transcript": transcript, "model": "whisper-1"}
    finally:
        await file.close()
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


# ── Admin ─────────────────────────────────────────

@api_router.get("/admin/overview", tags=["Admin"])
async def admin_overview(admin=Depends(get_admin_user)):
    users = await db.users.count_documents({})
    medicines = await db.medicines.count_documents({})
    alerts = await db.interaction_alerts.count_documents({})
    reports = await db.share_reports.count_documents({})
    recent_users = await db.users.find({}, {"_id": 0, "password_hash": 0, "reset_code": 0}).sort("created_at", -1).to_list(8)
    rules = await db.interaction_rules.find({}, {"_id": 0}).to_list(100)
    return {
        "summary": {
            "users": users,
            "medicines": medicines,
            "alerts": alerts,
            "reports": reports,
            "safety_index": max(72, 100 - alerts),
        },
        "users": recent_users,
        "rules": rules,
    }


@api_router.post("/admin/interaction-rules", tags=["Admin"])
async def add_interaction_rule(payload: InteractionRule, admin=Depends(get_admin_user)):
    rule_doc = payload.model_dump()
    await db.interaction_rules.insert_one({**rule_doc})
    return {"rule": rule_doc}


# ── Status ─────────────────────────────────────────

class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


@api_router.post("/status", response_model=StatusCheck, tags=["Status"])
async def create_status_check(input: StatusCheckCreate):
    status_obj = StatusCheck(**input.model_dump())
    doc = status_obj.model_dump()
    doc["timestamp"] = doc["timestamp"].isoformat()
    await db.status_checks.insert_one(doc)
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck], tags=["Status"])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for check in status_checks:
        if isinstance(check["timestamp"], str):
            check["timestamp"] = datetime.fromisoformat(check["timestamp"])
    return status_checks


# ─── Mount Router ──────────────────────────────────

app.include_router(api_router)