import asyncio
import os
import json
from ai_service import analyze_interactions_dynamic

async def test_interaction():
    os.environ["OPENAI_API_KEY"] = "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"
    os.environ["OPENAI_MODEL"] = "gpt-4o-mini"
    
    medicines = ["Warfarin", "Aspirin"]
    print(f"Testing interaction for: {medicines}")
    
    alerts = await analyze_interactions_dynamic("test_user", medicines)
    print("\nAI RESPONSE:")
    print(json.dumps(alerts, indent=2))

if __name__ == "__main__":
    asyncio.run(test_interaction())
