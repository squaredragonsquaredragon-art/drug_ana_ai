"""
MediTrack AI Service — Production-grade AI logic.
"""

import json
import logging
import os
import re
from typing import List, Optional

logger = logging.getLogger(__name__)

# ─── Constants ─────────────────────────────────────

MEDICINE_EXTRACTION_PROMPT = """
You extract medicine data from prescriptions or package text.
Return strict JSON with this shape only:
{"medicines":[{"medicine_name":"","dosage":"","frequency":"","notes":""}]}
If a field is missing, use an empty string. Do not include markdown.
""".strip()

INTERACTION_PROMPT = """
You are a senior clinical pharmacist and pharmacological safety engine. 
Analyze the provided medicine names for clinically significant drug-drug interactions.

CRITICAL INSTRUCTIONS:
1. Resolve all BRAND NAMES to their generic ACTIVE INGREDIENTS first (e.g., 'Metapro XL' -> 'Metoprolol', 'Tylenol' -> 'Acetaminophen').
2. Identify interactions between the resolved generic ingredients.
3. For each interaction, provide:
   - "medicine_combination": [Original Brand/Generic names provided]
   - "severity_level": "severe" (red/danger), "moderate" (orange/warning), "mild" (yellow/caution)
   - "explanation": A detailed pharmacological explanation of WHY the interaction occurs. Use professional but accessible language.
   - "safety_recommendation": Actionable clinical advice for the user (e.g., "Space doses by 4 hours", "Avoid combined used", "Monitor blood pressure daily").

Return strict JSON:
{
  "alerts": [
    {
      "medicine_combination": ["Drug A", "Drug B"],
      "severity_level": "severe",
      "explanation": "...",
      "safety_recommendation": "..."
    }
  ]
}

Guidelines:
- If NO significant interactions are found, return {"alerts": []}.
- Focus on safety, efficacy reduction, and toxicity increase.
- RETURN ONLY RAW JSON. No markdown.
""".strip()

CHAT_SYSTEM_PROMPT = """
You are Medi Track's medicine guidance assistant.
Explain dosage, purpose, and side effects. No medical diagnosis.
End risky answers by recommending a professional review.
""".strip()


# ─── Lazy-loaded OpenAI client ──────────────────────
_openai_client = None

def _get_openai_client():
    global _openai_client
    if _openai_client is not None:
        return _openai_client
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key or api_key.startswith("sk-xxxx"):
        return None
    try:
        from openai import AsyncOpenAI
        _openai_client = AsyncOpenAI(api_key=api_key)
        logger.info("✅ OpenAI client initialized")
        return _openai_client
    except Exception as exc:
        logger.error(f"❌ OpenAI init failed: {exc}")
        return None

def _get_model() -> str:
    return os.environ.get("OPENAI_MODEL", "gpt-4o-mini")


# ─── Helpers ────────────────────────────────────────

def _json_or_default(raw_text: str, default_value: dict) -> dict:
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").replace("json", "", 1).strip()
    try:
        return json.loads(cleaned)
    except:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start != -1 and end != -1:
            try: return json.loads(cleaned[start:end+1])
            except: pass
    return default_value


# ─── Smart Mock Logic (Fallback) ────────────────────

def _smart_extract_medicines(text: str) -> List[dict]:
    known_meds = ["Paracetamol", "Ibuprofen", "Amoxicillin", "Metformin", "Aspirin", "Warfarin"]
    found = []
    for med in known_meds:
        if med.lower() in text.lower():
            found.append({"medicine_name": med, "dosage": "500 mg", "frequency": "Once daily", "notes": "Mock extract"})
    return found or [{"medicine_name": text.strip().split()[0].capitalize(), "dosage": "As prescribed", "frequency": "As directed", "notes": "Mock extract"}]

def _smart_chat_reply(user_message: str) -> str:
    msg = user_message.lower()
    if any(w in msg for w in ["headache", "pain", "fever"]):
        return "For mild pain/fever, Paracetamol is common. Check for allergies. If severe, see a doctor."
    return "I'm in basic mode. Please verify medications with your doctor."


# ─── Public API ─────────────────────────────────────

async def extract_medicines_from_text(user_id: str, raw_text: str) -> List[dict]:
    client = _get_openai_client()
    if client:
        try:
            response = await client.chat.completions.create(
                model=_get_model(),
                messages=[{"role": "system", "content": MEDICINE_EXTRACTION_PROMPT}, {"role": "user", "content": raw_text}],
                temperature=0.3
            )
            return _json_or_default(response.choices[0].message.content, {}).get("medicines", [])
        except Exception as exc: 
            logger.error(f"GPT extraction failed: {exc}")
            
    return _smart_extract_medicines(raw_text)

async def analyze_interactions_dynamic(user_id: str, medicine_names: List[str]) -> List[dict]:
    if len(medicine_names) < 2: return []
    logger.info(f"Triggering interaction check for: {medicine_names}")
    client = _get_openai_client()
    if client:
        try:
            prompt = f"Analyze these medicines: {', '.join(medicine_names)}"
            response = await client.chat.completions.create(
                model=_get_model(),
                messages=[{"role": "system", "content": INTERACTION_PROMPT}, {"role": "user", "content": prompt}],
                temperature=0.3
            )
            content = response.choices[0].message.content
            logger.info(f"AI raw response: {content}")
            return _json_or_default(content, {}).get("alerts", [])
        except Exception as exc: 
            logger.error(f"GPT interaction failed: {exc}")
            
    return []

async def generate_chat_reply(user_id: str, history: List[dict], user_message: str) -> str:
    client = _get_openai_client()
    if client:
        try:
            transcript = "\n".join([f"{e['role'].upper()}: {e['message']}" for e in history[-5:]])
            response = await client.chat.completions.create(
                model=_get_model(),
                messages=[{"role": "system", "content": CHAT_SYSTEM_PROMPT}, {"role": "user", "content": f"{transcript}\nUser: {user_message}"}],
                temperature=0.7
            )
            return response.choices[0].message.content
        except Exception as exc: 
            logger.error(f"GPT chat failed: {exc}")
            
    return _smart_chat_reply(user_message)

async def transcribe_voice_note(file_path: str) -> str:
    client = _get_openai_client()
    if client:
        try:
            with open(file_path, "rb") as f:
                return (await client.audio.transcriptions.create(model="whisper-1", file=f)).text
        except: pass
    return "Voice needs API key."