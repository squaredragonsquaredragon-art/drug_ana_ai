import motor.motor_asyncio
import asyncio
import uuid
from datetime import datetime, timezone
import os

# Import the alert generator from server.py (mocking or direct)
# Since I'm in a standalone script, I'll just do it manually with DB calls
# and call the ai_service

async def populate_test_data():
    client = motor.motor_asyncio.AsyncIOMotorClient('mongodb://localhost:27017')
    db = client.meditrack
    
    # Get first user
    user = await db.users.find_one({})
    if not user:
        print("No user found.")
        return
    
    user_id = user['id']
    print(f"Adding medicines for user: {user_id}")
    
    # Clean up existing medicines to start fresh for this test
    await db.medicines.delete_many({"user_id": user_id})
    await db.interaction_alerts.delete_many({"user_id": user_id})
    
    meds = [
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "medicine_name": "Warfarin",
            "dosage": "5 mg",
            "start_date": datetime.now(timezone.utc).date().isoformat(),
            "frequency": "Once daily",
            "reminder_times": ["08:00"],
            "notes": "Anti-coagulant",
            "source": "manual",
            "barcode": "",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "medicine_name": "Aspirin",
            "dosage": "75 mg",
            "start_date": datetime.now(timezone.utc).date().isoformat(),
            "frequency": "Once daily",
            "reminder_times": ["08:00"],
            "notes": "Anti-platelet",
            "source": "manual",
            "barcode": "",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.medicines.insert_many(meds)
    print("Meds inserted. Interaction check will happen on next dashboard load or manually now.")

if __name__ == "__main__":
    asyncio.run(populate_test_data())
