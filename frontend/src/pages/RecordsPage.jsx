import { useEffect, useRef, useState } from "react";
import { Mic, Volume2, ClipboardPlus, FileText, Trash2 } from "lucide-react";
import Tesseract from "tesseract.js";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api";
import { blankRecord } from "@/constants";
import { CameraCaptureCard } from "@/components/CameraCaptureCard";
import { BarcodeScannerCard } from "@/components/BarcodeScannerCard";
import { EmptyState } from "@/components/EmptyState";

export const RecordsPage = ({ token, records, onAddMedicine, onAddRecord, onDeleteRecord }) => {
  const [recordForm, setRecordForm] = useState(blankRecord);
  const [ocrPreview, setOcrPreview] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("Use live speech, record a short voice note, or paste spoken medicine text manually.");
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceManualInput, setVoiceManualInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const voiceStreamRef = useRef(null);
  const voiceChunksRef = useRef([]);

  const importText = async (rawText, source) => {
    if (!rawText?.trim()) {
      toast.error("No text found for medicine extraction.");
      return;
    }
    try {
      const response = await apiRequest({ method: "post", url: "/medicines/import-from-text", token, data: { raw_text: rawText, source } });
      toast.success(`${response.items.length} medicine item(s) added`);
      setRecordForm((current) => ({ ...current, prescription_text: rawText }));
      await onAddMedicine(null, true);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Import failed");
    }
  };

  const runOcr = async (imageSource, source) => {
    setOcrLoading(true);
    setOcrPreview(typeof imageSource === "string" ? imageSource : URL.createObjectURL(imageSource));
    try {
      const formData = new FormData();
      if (typeof imageSource === "string") {
        const response = await fetch(imageSource);
        const blob = await response.blob();
        formData.append("file", blob, "camera-capture.jpg");
      } else {
        formData.append("file", imageSource, imageSource.name || "upload.jpg");
      }
      formData.append("source", source);

      const response = await apiRequest({
        method: "post",
        url: "/medicines/import-from-image",
        token,
        data: formData,
      });

      toast.success(`${response.items.length} medicine item(s) added`);
      setRecordForm((current) => ({
        ...current,
        prescription_image: typeof imageSource === "string" ? imageSource : "",
        prescription_text: response.transcription || "",
      }));
      await onAddMedicine(null, true);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Enter valid medicine details");
    } finally {
      setOcrLoading(false);
    }
  };

  const stopVoiceStream = () => {
    voiceStreamRef.current?.getTracks()?.forEach((track) => track.stop());
    voiceStreamRef.current = null;
  };

  const transcribeAudioBlob = async (audioBlob) => {
    const formData = new FormData();
    formData.append("file", audioBlob, audioBlob.type.includes("mp4") ? "voice-note.m4a" : "voice-note.webm");

    setVoiceLoading(true);
    setVoiceStatus("Uploading voice note for transcription...");
    try {
      const response = await apiRequest({ method: "post", url: "/voice/transcribe", token, data: formData });
      setVoiceTranscript(response.transcript);
      setVoiceManualInput(response.transcript);
      setVoiceStatus(`Transcribed with ${response.model}. Medicines are being extracted now.`);
      await importText(response.transcript, "voice");
    } catch (error) {
      setVoiceStatus("Voice note transcription failed. Try again or paste the spoken text manually.");
      toast.error(error.response?.data?.detail || "Unable to transcribe the voice note.");
    } finally {
      setVoiceLoading(false);
    }
  };

  const startVoiceRecognition = async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceStatus("Live speech recognition is unavailable in this browser. Use Record voice note instead.");
      toast.error("Live speech recognition is not supported here. Try Record voice note.");
      return;
    }

    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        tempStream.getTracks().forEach((track) => track.stop());
      } catch {
        setVoiceStatus("Microphone permission is blocked. Use Record voice note or paste the spoken text manually.");
        toast.error("Microphone permission is blocked.");
        return;
      }
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setVoiceStatus("Starting live speech input...");
    recognition.onstart = () => setVoiceStatus("Listening now. Speak the medicine names clearly.");
    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      setVoiceTranscript(transcript);
      setVoiceManualInput(transcript);
      setVoiceStatus("Speech captured. Importing medicines now.");
      await importText(transcript, "voice");
    };
    recognition.onerror = () => {
      setVoiceStatus("Live speech capture failed. Try Record voice note instead.");
      toast.error("Voice capture failed. Please try the record voice note option.");
    };
    recognition.onend = () => {
      setVoiceStatus((current) => current === "Listening now. Speak the medicine names clearly." ? "Voice capture ended." : current);
    };
    try {
      recognition.start();
    } catch {
      setVoiceStatus("Live speech input could not start. Use Record voice note instead.");
      toast.error("Unable to start live speech input.");
    }
  };

  const toggleVoiceRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      setVoiceStatus("Finishing voice note...");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceStatus("Audio recording is unavailable in this browser. Paste spoken text manually below.");
      toast.error("Audio recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      voiceChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/mp4";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          voiceChunksRef.current.push(event.data);
        }
      };
      recorder.onerror = () => {
        stopVoiceStream();
        setIsRecording(false);
        setVoiceStatus("Recording failed. Try again or placeholder pasted the spoken text manually.");
        toast.error("Voice recording failed.");
      };
      recorder.onstop = async () => {
        const voiceBlob = new Blob(voiceChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stopVoiceStream();
        if (voiceBlob.size > 0) {
          await transcribeAudioBlob(voiceBlob);
        } else {
          setVoiceStatus("No voice note was captured.");
          toast.error("No voice note was captured.");
        }
      };

      recorder.start();
      setIsRecording(true);
      setVoiceStatus("Recording voice note... Tap again to stop and transcribe.");
    } catch {
      stopVoiceStream();
      setIsRecording(false);
      setVoiceStatus("Microphone permission was blocked. Paste spoken text manually if needed.");
      toast.error("Unable to access the microphone.");
    }
  };

  useEffect(() => stopVoiceStream, []);

  return (
    <div className="space-y-6">
      <section className="glass-panel p-6 lg:p-8">
        <Badge data-testid="records-page-badge" className="bg-sky-100 text-sky-700 hover:bg-sky-100">Medical records and ingestion tools</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">Bring prescriptions into your record flow faster.</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">Capture a prescription with camera, upload a file, scan a barcode, speak medicine names, or read medicine strip text with OCR-assisted recognition.</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <Card className="border-sky-100 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>Prescription scanning suite</CardTitle>
            <CardDescription>Use whichever medicine adding method is most convenient on mobile or desktop.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="camera" className="space-y-5">
              <TabsList className="grid w-full grid-cols-5 rounded-3xl bg-sky-50 p-1">
                <TabsTrigger data-testid="records-tab-camera" value="camera">Camera</TabsTrigger>
                <TabsTrigger data-testid="records-tab-upload" value="upload">Upload</TabsTrigger>
                <TabsTrigger data-testid="records-tab-barcode" value="barcode">Barcode</TabsTrigger>
                <TabsTrigger data-testid="records-tab-voice" value="voice">Voice</TabsTrigger>
                <TabsTrigger data-testid="records-tab-image" value="image">Image AI</TabsTrigger>
              </TabsList>
              <TabsContent value="camera"><CameraCaptureCard onCapture={(image) => runOcr(image, "camera")} /></TabsContent>
              <TabsContent value="upload">
                <div className="rounded-3xl border border-sky-100 bg-slate-50/90 p-4">
                  <Input data-testid="file-upload-input" type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && runOcr(event.target.files[0], "upload")} />
                  <p className="mt-3 text-sm text-slate-500">Upload a prescription image and Medi Track will extract medicine names and dosage clues.</p>
                </div>
              </TabsContent>
              <TabsContent value="barcode"><BarcodeScannerCard token={token} onAutoAdd={onAddMedicine} /></TabsContent>
              <TabsContent value="voice">
                <div className="rounded-3xl border border-sky-100 bg-slate-50/90 p-4">
                  <div className="flex flex-wrap gap-3">
                    <Button data-testid="voice-start-button" className="bg-sky-600 hover:bg-sky-700" onClick={startVoiceRecognition} disabled={voiceLoading}>
                      <Mic className="mr-2 h-4 w-4" />
                      Live speech input
                    </Button>
                    <Button data-testid="voice-record-button" variant="outline" className="border-sky-200" onClick={toggleVoiceRecording} disabled={voiceLoading}>
                      <Volume2 className="mr-2 h-4 w-4" />
                      {isRecording ? "Stop recording" : "Record voice note"}
                    </Button>
                  </div>
                  <p data-testid="voice-status-text" className="mt-4 text-sm text-slate-500">{voiceLoading ? "Processing your voice note..." : voiceStatus}</p>
                  <Textarea
                    data-testid="voice-manual-input"
                    className="mt-4"
                    placeholder="Or paste the medicine names you spoke, then import them manually"
                    value={voiceManualInput}
                    onChange={(event) => setVoiceManualInput(event.target.value)}
                  />
                  <Button data-testid="voice-manual-import-button" className="mt-3 bg-sky-600 hover:bg-sky-700" onClick={() => importText(voiceManualInput, "voice")} disabled={voiceLoading}>
                    Import spoken text
                  </Button>
                  {voiceTranscript ? <p data-testid="voice-transcript" className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-600">{voiceTranscript}</p> : null}
                </div>
              </TabsContent>
              <TabsContent value="image">
                <div className="rounded-3xl border border-sky-100 bg-slate-50/90 p-4">
                  <Input data-testid="medicine-image-input" type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && runOcr(event.target.files[0], "image")} />
                  <p className="mt-3 text-sm text-slate-500">Upload a medicine strip or tablet packaging image to identify printed medicine details and add them automatically.</p>
                </div>
              </TabsContent>
            </Tabs>
            <div className="mt-5 rounded-3xl border border-sky-100 bg-sky-50/80 p-4">
              <p className="text-sm font-semibold text-slate-900">OCR processing</p>
              <p data-testid="ocr-processing-status" className="mt-2 text-sm text-slate-500">{ocrLoading ? "Extracting prescription text..." : "Ready for camera, upload, barcode, voice, or medicine strip processing."}</p>
              {ocrPreview ? <img data-testid="ocr-preview-image" src={ocrPreview} alt="OCR preview" className="mt-4 h-48 w-full rounded-[1.6rem] object-cover" /> : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-sky-100 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>Add medical record</CardTitle>
            <CardDescription>Store history, prescription text, and treatment details for future reference.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input data-testid="record-title-input" placeholder="Record title" value={recordForm.title} onChange={(event) => setRecordForm((current) => ({ ...current, title: event.target.value }))} />
            <Input data-testid="record-type-input" placeholder="Record type (prescription, lab, history)" value={recordForm.report_type} onChange={(event) => setRecordForm((current) => ({ ...current, report_type: event.target.value }))} />
            <Textarea data-testid="record-treatment-input" placeholder="Past treatments or main findings" value={recordForm.past_treatments} onChange={(event) => setRecordForm((current) => ({ ...current, past_treatments: event.target.value }))} />
            <Textarea data-testid="record-notes-input" placeholder="Additional notes" value={recordForm.notes} onChange={(event) => setRecordForm((current) => ({ ...current, notes: event.target.value }))} />
            <Textarea data-testid="record-prescription-text-input" placeholder="Detected prescription text" value={recordForm.prescription_text} onChange={(event) => setRecordForm((current) => ({ ...current, prescription_text: event.target.value }))} />
            <Button data-testid="record-submit-button" className="w-full bg-sky-600 hover:bg-sky-700" onClick={() => onAddRecord(recordForm, () => setRecordForm(blankRecord))}>
              <ClipboardPlus className="mr-2 h-4 w-4" />
              Save record
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-sky-100 bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle>Stored medical history</CardTitle>
          <CardDescription>Every prescription and treatment note stays grouped for future doctor consultations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {records.length ? (
            records.map((record) => (
              <div key={record.id} data-testid={`record-card-${record.id}`} className="rounded-3xl border border-sky-100 bg-slate-50/90 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{record.title}</p>
                    <p className="mt-2 text-sm leading-7 text-slate-500">{record.past_treatments}</p>
                  </div>
                  <Button data-testid={`record-delete-button-${record.id}`} variant="outline" className="border-red-200 text-red-600" onClick={() => onDeleteRecord(record.id)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
                {record.prescription_text ? <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-slate-500">OCR text: {record.prescription_text}</p> : null}
              </div>
            ))
          ) : (
            <EmptyState testId="records-empty-state" icon={FileText} title="No records saved yet" description="Scan a prescription or add a treatment summary to start building your medical history." />
          )}
        </CardContent>
      </Card>
    </div>
  );
};
