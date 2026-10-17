import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";

/**
 * Generate a PDF blob from an HTML element
 */
export async function generatePdfBlob(element: HTMLElement, filename = "document.pdf"): Promise<Blob> {
  const html2pdf = (await import("html2pdf.js")).default;
  const opt = {
    margin: [6, 6, 6, 6],
    filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  };

  return await html2pdf().set(opt).from(element).output("blob");
}

/**
 * Share a PDF file via native Android share sheet (Capacitor) or Web Share API
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
  const file = new File([blob], filename, { type: "application/pdf" });

  // 1. Try Web Share API with files support
  if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title,
        text: title,
      });
      return true;
    } catch (err: any) {
      if (err.name === "AbortError") return true; // user cancelled
    }
  }

  // 2. Try native Capacitor Share if running in native app
  if (Capacitor.isNativePlatform()) {
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const base64Data = await base64Promise;

      await Share.share({
        title,
        text: title,
        url: base64Data,
        dialogTitle: title,
      });
      return true;
    } catch (err: any) {
      console.warn("Capacitor Share failed:", err);
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
  if (Capacitor.isNativePlatform()) {
    // Inside Android/Capacitor app: convert to PDF and open Android system share sheet
    let targetEl = element;
    let cleanup = false;
    if (!targetEl && html) {
      targetEl = document.createElement("div");
      targetEl.innerHTML = html;
      targetEl.style.position = "fixed";
      targetEl.style.left = "-9999px";
      targetEl.style.top = "0";
      targetEl.style.width = "750px";
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

  // Desktop or browser print
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
