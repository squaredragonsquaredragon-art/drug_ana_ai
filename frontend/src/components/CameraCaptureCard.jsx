import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const CameraCaptureCard = ({ onCapture }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [capturedPreview, setCapturedPreview] = useState("");
  const [capturedSource, setCapturedSource] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraStatus, setCameraStatus] = useState("Open the camera or use your device photo capture.");

  const stopCamera = () => {
    streamRef.current?.getTracks()?.forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  };

  useEffect(() => stopCamera, []);

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("Live camera is unavailable here. Please use device photo capture below.");
      toast.error("Live camera is not supported in this browser.");
      return;
    }

    try {
      stopCamera();
      setCapturedPreview("");
      setCapturedSource(null);
      setCameraStatus("Requesting camera permission...");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
      setCameraStatus("Camera ready. Frame the prescription, then capture it.");
    } catch {
      setCameraStatus("Live camera could not start. Use device photo capture below instead.");
      toast.error("Unable to start the live camera. Use your device photo capture below.");
    }
  };

  const captureFrame = () => {
    const video = videoRef.current;
    if (!video || !cameraReady || video.readyState < 2) {
      toast.error("Open the camera and wait for the preview before capturing.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");
    setCapturedSource(dataUrl);
    setCapturedPreview(dataUrl);
    setCameraStatus("Photo captured. Review it, retake if needed, or use it for OCR.");
    stopCamera();
  };

  const handleCapturedFile = (file) => {
    if (!file) return;
    stopCamera();
    const nextPreview = URL.createObjectURL(file);
    setCapturedSource(file);
    setCapturedPreview(nextPreview);
    setCameraStatus("Device photo selected. Review it, then use it for OCR.");
  };

  const resetCapture = () => {
    setCapturedPreview("");
    setCapturedSource(null);
    setCameraStatus("Open the camera or use your device photo capture.");
  };

  return (
    <div className="rounded-3xl border border-sky-100 bg-slate-50/90 p-4">
      <div className="flex flex-wrap gap-3">
        <Button data-testid="camera-start-button" variant="outline" className="border-sky-200" onClick={startCamera}>
          <Camera className="mr-2 h-4 w-4" />
          Open camera
        </Button>
        <Button data-testid="camera-capture-button" className="bg-sky-600 hover:bg-sky-700" onClick={captureFrame}>
          Capture prescription
        </Button>
        <Button data-testid="camera-retake-button" variant="outline" className="border-sky-200" onClick={resetCapture}>
          Retake
        </Button>
        {capturedPreview ? (
          <Button data-testid="camera-use-image-button" variant="outline" className="border-sky-200" onClick={() => onCapture(capturedSource || capturedPreview)}>
            Use captured image
          </Button>
        ) : null}
      </div>
      <label data-testid="camera-device-capture-label" className="mt-4 flex cursor-pointer flex-col gap-2 rounded-3xl border border-dashed border-sky-200 bg-white px-4 py-4 text-sm text-slate-500">
        <span className="font-medium text-slate-900">Use device camera / gallery fallback</span>
        <span>Works when live camera access is blocked on mobile or desktop browsers.</span>
        <input
          data-testid="camera-device-capture-input"
          type="file"
          accept="image/*"
          capture="environment"
          className="mt-1 block w-full text-sm"
          onChange={(event) => handleCapturedFile(event.target.files?.[0])}
        />
      </label>
      <p data-testid="camera-status-text" className="mt-4 text-sm text-slate-500">{cameraStatus}</p>
      <div className="mt-4 overflow-hidden rounded-[1.6rem] bg-slate-950/90">
        {capturedPreview ? (
          <img data-testid="camera-preview-image" src={capturedPreview} alt="Captured prescription" className="h-72 w-full object-contain" />
        ) : (
          <video data-testid="camera-live-preview" ref={videoRef} autoPlay playsInline muted className="h-72 w-full object-cover" />
        )}
      </div>
    </div>
  );
};
