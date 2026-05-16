import { jsPDF } from "jspdf";
import { toast } from "sonner";

export const isIosDevice = () => {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
};

export const downloadBlobFile = (blob, filename) => {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (isIosDevice()) {
    const popup = window.open(blobUrl, "_blank", "noopener,noreferrer");
    if (!popup) {
      window.location.href = blobUrl;
    }
  }

  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
};

export const savePdfToDevice = async (blob, filename) => {
  const pdfFile = new File([blob], filename, { type: "application/pdf" });

  if (window.showSaveFilePicker) {
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: "PDF document",
            accept: { "application/pdf": [".pdf"] },
          },
        ],
      });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      toast.success("PDF saved to your device.");
      return true;
    } catch {
      // silently fall back
    }
  }

  if (navigator.canShare) {
    try {
      if (navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: filename,
          text: "Save or share your Medi Track report PDF.",
        });
        toast.success("Use the share sheet to save the PDF to Files or Downloads.");
        return true;
      }
    } catch {
      // silently fall back
    }
  }

  downloadBlobFile(blob, filename);
  toast.success(isIosDevice() ? "PDF opened. Use the share button to Save to Files." : "PDF download started.");
  return true;
};

export const copyTextToClipboard = async (text) => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Share link copied.");
      return true;
    } catch {
      // fall back
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  try {
    const copied = document.execCommand("copy");
    if (copied) {
      toast.success("Share link copied.");
      return true;
    }
  } catch {
    // noop
  } finally {
    document.body.removeChild(textarea);
  }

  toast.error("Unable to copy automatically. Please long-press or select the link manually.");
  return false;
};

export const makePdf = async (report, filename = "medi-track-report.pdf") => {
  try {
    const doc = new jsPDF();
    const payload = report.payload || report;
    let y = 18;

    const writeLine = (text, offset = 8) => {
      const lines = doc.splitTextToSize(text, 175);
      doc.text(lines, 18, y);
      y += lines.length * 6 + offset;
      if (y > 270) {
        doc.addPage();
        y = 18;
      }
    };

    doc.setFontSize(18);
    doc.text("Medi Track Medical Report", 18, y);
    y += 10;
    doc.setFontSize(11);
    writeLine(`Generated: ${payload.generated_at || report.created_at || new Date().toISOString()}`, 6);

    if (payload.user) {
      writeLine(`Patient: ${payload.user.name} | Blood Group: ${payload.user.blood_group} | Email: ${payload.user.email}`);
    }
    writeLine(`Medicines (${payload.medicines?.length || 0})`, 4);
    (payload.medicines || []).forEach((medicine) => {
      writeLine(`• ${medicine.medicine_name} — ${medicine.dosage} — ${medicine.frequency}`);
    });
    writeLine(`Interaction Alerts (${payload.alerts?.length || 0})`, 4);
    (payload.alerts || []).forEach((alert) => {
      writeLine(`• ${alert.severity_level.toUpperCase()}: ${alert.medicine_combination.join(" + ")} — ${alert.explanation}`);
    });
    writeLine(`Medical Records (${payload.records?.length || 0})`, 4);
    (payload.records || []).forEach((record) => {
      writeLine(`• ${record.title}: ${record.past_treatments}`);
    });

    const pdfBlob = doc.output("blob");
    await savePdfToDevice(pdfBlob, filename);
  } catch {
    toast.error("Unable to prepare the PDF right now.");
  }
};
