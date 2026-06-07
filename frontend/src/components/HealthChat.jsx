import { useRef, useState } from "react";
import { AlertTriangle, Bot, Image, MessageSquare, Mic, Send, Square, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest, extractErrorMessage } from "@/lib/api";

// ── Non-medical topic detector ────────────────────────────────────────────────
const NON_MEDICAL_KEYWORDS = [
  // Tech / random
  "javascript", "python", "code", "programming", "software", "computer", "laptop", "phone",
  "movie", "film", "song", "music", "cricket", "football", "game", "sport",
  "weather", "news", "politics", "election", "stock", "crypto", "bitcoin",
  "recipe", "cook", "food", "restaurant", "travel", "hotel", "flight",
  "joke", "funny", "meme", "story", "poem", "essay", "homework", "math",
  "physics", "chemistry", "history", "geography", "economics",
];

const MEDICAL_KEYWORDS = [
  "medicine", "drug", "tablet", "capsule", "dose", "dosage", "symptom", "disease",
  "pain", "fever", "headache", "infection", "antibiotic", "prescription", "doctor",
  "hospital", "health", "medical", "treatment", "therapy", "side effect", "allergy",
  "blood", "heart", "diabetes", "pressure", "sugar", "cholesterol", "vitamin",
  "supplement", "pharmacy", "pharmacist", "injection", "vaccination", "vaccine",
  "cancer", "surgery", "diagnosis", "chronic", "acute", "wound", "fracture",
  "nausea", "vomiting", "diarrhea", "constipation", "asthma", "inhaler", "anxiety",
  "depression", "mental health", "sleep", "insomnia", "fatigue", "weight", "nutrition",
];

const isLikelyNonMedical = (text) => {
  const lower = text.toLowerCase();
  const hasNonMedical = NON_MEDICAL_KEYWORDS.some((kw) => lower.includes(kw));
  const hasMedical = MEDICAL_KEYWORDS.some((kw) => lower.includes(kw));
  return hasNonMedical && !hasMedical;
};

// ── Medical image checker ────────────────────────────────────────────────────
const MEDICAL_IMAGE_HINTS = ["prescription", "medicine", "tablet", "pill", "label", "report", "scan", "xray", "mri"];

const starterMessage = {
  role: "assistant",
  message:
    "Hi — I'm your medical guidance assistant. I can help explain dosage timing, side effects, medicine interactions, and health-related questions. I can only answer medical topics. For image uploads, please share prescription or medicine label images only.",
};

export const HealthChat = ({ token }) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([starterMessage]);
  const [isRecording, setIsRecording] = useState(false);
  const [nonMedicalWarning, setNonMedicalWarning] = useState(false);
  const [imageWarning, setImageWarning] = useState(false);
  const [pendingText, setPendingText] = useState("");
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileInputRef = useRef(null);

  const addAssistantMessage = (msg) =>
    setMessages((curr) => [...curr, { role: "assistant", message: msg }]);

  const sendMessage = async (textOverride) => {
    const text = textOverride || input;
    if (!text.trim() || loading) return;

    // Medical-only guard
    if (isLikelyNonMedical(text)) {
      setPendingText(text);
      setNonMedicalWarning(true);
      return;
    }

    const nextUserMessage = { role: "user", message: text.trim() };
    setMessages((curr) => [...curr, nextUserMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await apiRequest({
        method: "post",
        url: "/chat",
        data: { message: nextUserMessage.message },
        token,
      });
      addAssistantMessage(response.reply);
    } catch (error) {
      toast.error(extractErrorMessage(error, "Unable to send your message right now."));
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("file", audioBlob, "voice_message.webm");
        setLoading(true);
        try {
          const response = await apiRequest({ method: "post", url: "/voice/transcribe", data: formData, token });
          if (response.transcript) sendMessage(response.transcript);
        } catch (error) {
          toast.error(extractErrorMessage(error, "Transcription failed."));
        } finally {
          setLoading(false);
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      toast.error("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = "";

    // Validate it's an image
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (JPG, PNG, etc.).");
      return;
    }

    // Check filename for medical context clue (simple heuristic)
    const nameLower = file.name.toLowerCase();
    const looksNonMedical =
      !MEDICAL_IMAGE_HINTS.some((hint) => nameLower.includes(hint)) &&
      (nameLower.includes("selfie") ||
        nameLower.includes("photo") ||
        nameLower.includes("screenshot") ||
        nameLower.includes("img_") ||
        nameLower.includes("dsc"));

    if (looksNonMedical) {
      setImageWarning(true);
      return;
    }

    // Send image to OCR / medicine import endpoint
    const formData = new FormData();
    formData.append("file", file);
    setLoading(true);
    try {
      const response = await apiRequest({ method: "post", url: "/voice/transcribe", data: formData, token });
      if (response.transcript) {
        sendMessage(`[Image content]: ${response.transcript}`);
      } else {
        toast.info("Could not extract text from the image. Please ensure it's a clear prescription or medicine label.");
      }
    } catch (error) {
      toast.error(extractErrorMessage(error, "Image processing failed."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Non-medical warning modal */}
      {nonMedicalWarning && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="rounded-full bg-amber-100 p-3">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </span>
              <h2 className="text-lg font-semibold text-slate-900">Medical Queries Only</h2>
            </div>
            <p className="text-sm text-slate-600 leading-6 mb-5">
              I can only answer <strong>medical and health-related questions</strong> — such as dosage, side effects,
              drug interactions, and symptoms. Your question appears to be about a non-medical topic.
              Please ask something related to medicines or health.
            </p>
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-sky-600 hover:bg-sky-700"
                onClick={() => {
                  setNonMedicalWarning(false);
                  setPendingText("");
                  setInput("");
                }}
              >
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Non-medical image warning modal */}
      {imageWarning && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="rounded-full bg-red-100 p-3">
                <Image className="h-5 w-5 text-red-600" />
              </span>
              <h2 className="text-lg font-semibold text-slate-900">Medical Images Only</h2>
            </div>
            <p className="text-sm text-slate-600 leading-6 mb-5">
              Please upload only <strong>medical images</strong> such as:
              <ul className="mt-2 ml-4 list-disc space-y-1">
                <li>Prescription documents</li>
                <li>Medicine labels or packaging</li>
                <li>Lab reports or medical scans</li>
              </ul>
              <br />
              Personal photos, selfies, or non-medical images cannot be processed here.
            </p>
            <Button
              className="w-full bg-sky-600 hover:bg-sky-700"
              onClick={() => setImageWarning(false)}
            >
              Understood
            </Button>
          </div>
        </div>
      )}

      <Button
        data-testid="floating-chat-toggle-button"
        className="fixed bottom-24 right-4 z-[90] h-14 rounded-full bg-sky-600 px-5 shadow-[0_18px_45px_rgba(14,116,244,0.35)] hover:bg-sky-700 md:bottom-8 md:right-28"
        onClick={() => setOpen((curr) => !curr)}
      >
        {open ? <X className="mr-2 h-4 w-4" /> : <MessageSquare className="mr-2 h-4 w-4" />}
        {open ? "Close chat" : "AI guide"}
      </Button>

      {open ? (
        <Card
          data-testid="floating-chat-panel"
          className="fixed bottom-40 right-4 z-[90] flex h-[36rem] w-[min(92vw,24rem)] flex-col border-sky-100 bg-white/95 shadow-2xl backdrop-blur-xl md:bottom-24 md:right-28"
        >
          <CardHeader className="border-b border-sky-100 pb-4">
            <CardTitle className="flex items-center gap-3 text-lg text-slate-900">
              <span className="rounded-full bg-sky-100 p-2 text-sky-700">
                <Bot className="h-4 w-4" />
              </span>
              Medical guidance assistant
              <span className="ml-auto rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 font-medium">
                Medical only
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-4">
            <div data-testid="chat-message-list" className="flex-1 space-y-3 overflow-y-auto pr-1">
              {messages.map((entry, index) => (
                <div
                  key={`${entry.role}-${index}`}
                  data-testid={`chat-message-${index}`}
                  className={`rounded-2xl px-4 py-3 text-sm leading-6 ${entry.role === "assistant"
                      ? "mr-8 bg-slate-50 text-slate-700"
                      : "ml-8 bg-sky-600 text-white"
                    }`}
                >
                  {entry.message}
                </div>
              ))}
              {loading && (
                <div className="mr-8 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-400 animate-pulse">
                  Thinking…
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {/* Hidden file input for image upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              <Button
                data-testid="chat-image-button"
                variant="outline"
                title="Upload prescription or medicine label image"
                className="border-sky-200 shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                <Image className="h-4 w-4" />
              </Button>
              <Input
                data-testid="chat-message-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask a medical question…"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <Button
                data-testid="chat-voice-button"
                variant="outline"
                className={`border-sky-200 shrink-0 ${isRecording ? "animate-pulse border-red-500 bg-red-50 text-red-600" : ""}`}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={loading}
              >
                {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button
                data-testid="chat-send-button"
                className="bg-sky-600 hover:bg-sky-700 shrink-0"
                onClick={() => sendMessage()}
                disabled={loading || isRecording}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
};