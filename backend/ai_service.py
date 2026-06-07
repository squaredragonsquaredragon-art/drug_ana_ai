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
You are a clinical parser and medical image recognizer. Your task is to analyze the prescription, medicine strip, or bottle image (or raw text) and extract the medicine data and a transcription/description.

Return strict JSON with this shape only:
{
  "transcription": "full transcribed text of the prescription or a clear description of what is seen on the medicine packaging",
  "medicines": [
    {
      "medicine_name": "...",
      "dosage": "...",
      "frequency": "...",
      "notes": "..."
    }
  ]
}

CRITICAL RULES:
1. Extract ONLY actual pharmaceutical drugs, medicines, active ingredients, vitamins, or supplements.
2. If the input (text or image) does not contain any valid medicine or drug names (for example, if it is a photo of a hand, objects, food, scenery, or random text), you MUST return: {"transcription": "", "medicines": []}.
3. Do not make up medicine names. If no clear medicine names are present, return an empty list of medicines.
4. Do not include markdown or extra explanation.
""".strip()

INTERACTION_PROMPT = """
You are a clinical pharmacist and drug safety engine for a patient medicine tracker app.
Your job is to detect ALL drug-drug interactions — severe, moderate, AND mild — between the provided medicines.

CRITICAL RULES:
1. Resolve ALL brand names, trade names, abbreviations, and common misspellings to their generic active ingredients.
   Examples: 'Tylenol' or 'PARACETHAMAL' or 'Paracetamol' or 'acetaminophen' → all mean the same drug.
   'Advil', 'Brufen', 'Ibuprofen' → all the same. Resolve before checking.
2. Analyze EVERY pair of medicines in the list, not just obvious ones.
3. Include interactions of ALL severity levels:
   - "severe": dangerous combinations that must be avoided (e.g., warfarin + aspirin)
   - "moderate": combinations requiring care or monitoring (e.g., paracetamol + ibuprofen, aspirin + ibuprofen)
   - "mild": low-risk but worth noting (e.g., ibuprofen + amoxicillin)
4. Paracetamol (acetaminophen) + Ibuprofen (NSAID) = MODERATE interaction. ALWAYS report this.
5. Aspirin + Ibuprofen = MODERATE interaction. ALWAYS report this.
6. If the same drug appears multiple times (duplicates), treat it as one instance.
7. ONLY return {"alerts": []} if the medicines genuinely have NO known interactions at ANY severity level.

For each interaction, provide:
- "medicine_combination": [use the original names as provided]
- "severity_level": one of: "severe", "moderate", "mild"
- "explanation": clinical explanation of the interaction mechanism
- "safety_recommendation": clear, actionable advice

RETURN ONLY this JSON format, no markdown, no extra text:
{
  "alerts": [
    {
      "medicine_combination": ["Drug A", "Drug B"],
      "severity_level": "moderate",
      "explanation": "...",
      "safety_recommendation": "..."
    }
  ]
}
""".strip()

CHAT_SYSTEM_PROMPT = """
You are Medi Track's medical guidance assistant. Your ONLY role is to answer questions about:
- Medicines: dosage, timing, side effects, interactions, storage
- Health conditions: symptoms, treatments, medical procedures
- Prescriptions, pharmacy questions, drug safety
- Nutrition and health-related supplements

STRICT RULES:
1. If the user asks about ANY non-medical topic (technology, sports, entertainment, politics, weather, general knowledge, etc.), you MUST respond ONLY with:
   "I can only answer medical and health-related questions. Please ask about medicines, dosage, side effects, or health conditions."
2. Never diagnose illness — only explain information and recommend seeing a doctor for diagnosis.
3. For risky or emergency situations, always recommend calling emergency services or consulting a doctor immediately.
4. Keep responses clear, accurate, and professional.
5. Never break character or discuss your own nature as an AI beyond what's needed for medical guidance.
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
    return found

NON_MEDICAL_WORDS = [
    "javascript", "python", "code", "programming", "software", "computer",
    "movie", "film", "song", "music", "cricket", "football", "game",
    "weather", "news", "politics", "election", "stock", "crypto", "bitcoin",
    "recipe", "cook", "restaurant", "travel", "hotel", "flight",
    "joke", "funny", "meme", "story", "poem", "essay", "homework",
]
MEDICAL_WORDS = [
    "medicine", "drug", "tablet", "capsule", "dose", "symptom", "disease",
    "pain", "fever", "headache", "infection", "antibiotic", "prescription",
    "doctor", "hospital", "health", "medical", "treatment", "side effect",
    "allergy", "blood", "heart", "diabetes", "pressure", "vitamin",
]

def _smart_chat_reply(user_message: str) -> str:
    msg = user_message.lower()
    has_non_medical = any(w in msg for w in NON_MEDICAL_WORDS)
    has_medical = any(w in msg for w in MEDICAL_WORDS)
    if has_non_medical and not has_medical:
        return "I can only answer medical and health-related questions. Please ask about medicines, dosage, side effects, or health conditions."
    if any(w in msg for w in ["headache", "pain", "fever"]):
        return "For mild pain/fever, Paracetamol (500mg) is commonly used. Always check for allergies and consult a doctor if symptoms persist or are severe."
    return "I can help with medicine dosage, side effects, drug interactions, and health questions. Please ask a specific medical question."


# ─── Public API ─────────────────────────────────────

async def extract_medicines_from_text(user_id: str, raw_text: str) -> List[dict]:
    client = _get_openai_client()
    if client:
        try:
            response = await client.chat.completions.create(
                model=_get_model(),
                messages=[{"role": "system", "content": MEDICINE_EXTRACTION_PROMPT}, {"role": "user", "content": raw_text}],
                temperature=0.3,
                response_format={"type": "json_object"}
            )
            return _json_or_default(response.choices[0].message.content, {}).get("medicines", [])
        except Exception as exc: 
            logger.error(f"GPT extraction failed: {exc}")
            
    return _smart_extract_medicines(raw_text)

async def extract_medicines_from_image(user_id: str, base64_image: str, mime_type: str) -> dict:
    client = _get_openai_client()
    if client:
        try:
            response = await client.chat.completions.create(
                model=_get_model(),
                messages=[
                    {"role": "system", "content": MEDICINE_EXTRACTION_PROMPT},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Analyze this prescription, medicine strip, or bottle image. Extract all medicine names, dosages, and full transcription following the required JSON schema."},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime_type};base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                temperature=0.2,
                response_format={"type": "json_object"}
            )
            content = response.choices[0].message.content
            logger.info(f"AI image extraction response: {content}")
            return _json_or_default(content, {})
        except Exception as exc: 
            logger.error(f"GPT image extraction failed: {exc}")
            
    return {"transcription": "", "medicines": []}

async def analyze_interactions_dynamic(user_id: str, medicine_names: List[str]) -> List[dict]:
    # Deduplicate by lowercased name to avoid duplicate entries like [Ibuprofen, Ibuprofen]
    seen_names: set = set()
    unique_medicines = []
    for name in medicine_names:
        key = name.strip().lower()
        if key not in seen_names:
            seen_names.add(key)
            unique_medicines.append(name.strip())

    if len(unique_medicines) < 2:
        return []

    logger.info(f"Triggering interaction check for: {unique_medicines}")
    client = _get_openai_client()
    if client:
        try:
            # Build explicit user prompt listing all medicine pairs
            import itertools
            pairs = list(itertools.combinations(unique_medicines, 2))
            pairs_text = ", ".join([f"{a} + {b}" for a, b in pairs])
            prompt = (
                f"Medicines in use: {', '.join(unique_medicines)}.\n"
                f"Pairs to analyze: {pairs_text}.\n"
                f"Report ALL interactions found at any severity level (severe, moderate, mild). "
                f"Include paracetamol+ibuprofen if both are present."
            )
            response = await client.chat.completions.create(
                model=_get_model(),
                messages=[
                    {"role": "system", "content": INTERACTION_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content
            logger.info(f"AI interaction response: {content}")
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