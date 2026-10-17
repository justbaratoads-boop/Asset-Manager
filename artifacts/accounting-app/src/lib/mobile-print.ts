import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";

/**
 * Generate a PDF blob from an HTML element
 */
export async function generatePdfBlob(element: HTMLElement, filename = "document.pdf"): Promise<Blob> {
  const html2pdf = (await import("html2pdf.js")).default;
  const opt = {
    margin: [4, 4, 4, 4],
    filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  };

  return await html2pdf().set(opt).from(element).output("blob");
}

/**
 * Share a PDF file via native Android share sheet (Capacitor) or Web Share API.
 * Uses native Filesystem to write to disk and get a file:// or content:// URI so WhatsApp and Printer apps receive a genuine file!
 */
export async function sharePdfFile({
  blob,
  filename,
  title,
}: {
  blob: Blob;
  filename: string;
  title: string;
}) {
  // 1. If running natively in Capacitor (Android)
  if (Capacitor.isNativePlatform()) {
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          // Extract purely base64 data without prefix
          const base64 = res.includes(",") ? res.split(",")[1] : res;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const base64Data = await base64Promise;

      // Save file to Cache directory
      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });

      // Share using native files array so WhatsApp / Printer apps receive the PDF attachment
      await Share.share({
        title,
        text: title,
        files: [savedFile.uri],
        dialogTitle: title,
      });
      return true;
    } catch (err: any) {
      console.warn("Native Filesystem + Share failed, falling back:", err);
    }
  }

  // 2. Web Share API with files support
  const file = new File([blob], filename, { type: "application/pdf" });
  if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title,
        text: title,
      });
      return true;
    } catch (err: any) {
      if (err.name === "AbortError") return true;
    }
  }

  // 3. Fallback: Download file
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);
  return false;
}

/**
 * Trigger print on mobile or browser.
 * On native mobile, triggers the native share sheet with the generated PDF so the user can send to printer or printer apps!
 */
export async function printOrShareDocument({
  element,
  html,
  filename = "invoice.pdf",
  title = "Invoice",
}: {
  element?: HTMLElement | null;
  html?: string;
  filename?: string;
  title?: string;
}) {
  // If native platform, generate PDF and share via Android system share sheet
  if (Capacitor.isNativePlatform()) {
    let targetEl = element;
    let cleanup = false;

    if (!targetEl && html) {
      targetEl = document.createElement("div");
      targetEl.innerHTML = html;
      targetEl.style.position = "fixed";
      targetEl.style.left = "-9999px";
      targetEl.style.top = "0";
      targetEl.style.width = "750px";
      targetEl.style.background = "#ffffff";
      document.body.appendChild(targetEl);
      cleanup = true;
    }

    if (targetEl) {
      try {
        const blob = await generatePdfBlob(targetEl, filename);
        if (cleanup && targetEl.parentNode) {
          targetEl.parentNode.removeChild(targetEl);
        }
        await sharePdfFile({ blob, filename, title });
        return;
      } catch (err) {
        console.error("PDF generation for print failed:", err);
        if (cleanup && targetEl.parentNode) {
          targetEl.parentNode.removeChild(targetEl);
        }
      }
    }
  }

  // Desktop or web browser: print via hidden iframe
  if (html) {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      iframe.contentWindow?.focus();
      setTimeout(() => {
        try {
          iframe.contentWindow?.print();
        } catch {}
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch {}
        }, 1500);
      }, 350);
      return;
    }
  }

  window.print();
}
