import { useEffect, useRef, useState } from "react";
import { ScanLine } from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { blankMedicine } from "@/constants";

export const BarcodeScannerCard = ({ token, onAutoAdd }) => {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const [active, setActive] = useState(false);
  const [lastCode, setLastCode] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanStatus, setScanStatus] = useState("Start the live scanner, upload a barcode image, or enter the code manually.");
  const [barcodeLoading, setBarcodeLoading] = useState(false);

  const handleDetectedCode = async (code) => {
    if (!code) {
      toast.error("Enter or scan a barcode first.");
      return;
    }
    setLastCode(code);
    setBarcodeInput(code);
    setActive(false);
    controlsRef.current?.stop();
    setBarcodeLoading(true);
    setScanStatus("Looking up that barcode...");
    try {
      const response = await apiRequest({ method: "get", url: `/medicines/barcode/${code}`, token });
      setScanStatus(`Barcode found: ${response.item.medicine_name}. Adding it to your medicine list...`);
      await onAutoAdd({
        ...blankMedicine,
        ...response.item,
        source: "barcode",
        barcode: code,
      });
      setScanStatus(`Barcode matched ${response.item.medicine_name}.`);
      toast.success(`Barcode matched ${response.item.medicine_name}`);
    } catch {
      setScanStatus("Barcode lookup failed. Try a clearer image or manual entry.");
      toast.error("Barcode lookup failed.");
    } finally {
      setBarcodeLoading(false);
    }
  };

  useEffect(() => {
    const startScan = async () => {
      if (!active || !videoRef.current) return;
      setScanStatus("Starting live barcode scanner...");
      try {
        const reader = new BrowserMultiFormatReader();
        controlsRef.current = await reader.decodeFromVideoDevice(undefined, videoRef.current, async (result) => {
          if (!result) return;
          await handleDetectedCode(result.getText());
        });
        setScanStatus("Scanner ready. Point the camera at the medicine barcode.");
      } catch {
        setActive(false);
        setScanStatus("Live scanning is unavailable here. Upload a barcode image or enter the code manually.");
        toast.error("Unable to start live barcode scanning.");
      }
    };
    startScan();
    return () => controlsRef.current?.stop();
  }, [active, token]);

  const decodeBarcodeImage = async (file) => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = async () => {
      try {
        const reader = new BrowserMultiFormatReader();
        const result = await reader.decodeFromImageElement(image);
        await handleDetectedCode(result.getText());
      } catch {
        setScanStatus("No barcode was detected in that image.");
        toast.error("No barcode found in the uploaded image.");
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setScanStatus("That barcode image could not be read.");
      toast.error("Unable to read the uploaded barcode image.");
    };
    image.src = objectUrl;
  };

  return (
    <div className="rounded-3xl border border-sky-100 bg-slate-50/90 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button data-testid="barcode-start-button" className="bg-sky-600 hover:bg-sky-700" onClick={() => setActive(true)}>
          <ScanLine className="mr-2 h-4 w-4" />
          Start barcode scan
        </Button>
        <Button data-testid="barcode-stop-button" variant="outline" className="border-sky-200" onClick={() => { setActive(false); controlsRef.current?.stop(); }}>
          Stop scan
        </Button>
        {lastCode ? <p data-testid="barcode-last-code" className="text-sm text-slate-500">Last code: {lastCode}</p> : null}
      </div>
      <p data-testid="barcode-status-text" className="mt-4 text-sm text-slate-500">{scanStatus}</p>
      <video data-testid="barcode-video-preview" ref={videoRef} autoPlay playsInline muted className="mt-4 h-72 w-full rounded-[1.6rem] bg-slate-950 object-cover" />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <label data-testid="barcode-image-upload-label" className="rounded-3xl border border-dashed border-sky-200 bg-white px-4 py-4 text-sm text-slate-500">
          <span className="font-medium text-slate-900">Upload a barcode image</span>
          <input
            data-testid="barcode-image-upload-input"
            type="file"
            accept="image/*"
            capture="environment"
            className="mt-2 block w-full text-sm"
            onChange={(event) => decodeBarcodeImage(event.target.files?.[0])}
          />
        </label>
        <div className="rounded-3xl border border-sky-100 bg-white p-4">
          <p className="text-sm font-medium text-slate-900">Manual barcode lookup</p>
          <Input data-testid="barcode-manual-input" className="mt-3" placeholder="Enter barcode digits" value={barcodeInput} onChange={(event) => setBarcodeInput(event.target.value)} />
          <Button data-testid="barcode-manual-lookup-button" className="mt-3 w-full bg-sky-600 hover:bg-sky-700" onClick={() => handleDetectedCode(barcodeInput.trim())} disabled={barcodeLoading}>
            {barcodeLoading ? "Looking up barcode..." : "Lookup barcode"}
          </Button>
        </div>
      </div>
    </div>
  );
};
