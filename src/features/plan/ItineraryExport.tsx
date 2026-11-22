import { useState } from "preact/hooks";
import { Button } from "../../shared/ui/Button";
import type { PdfDay } from "./itinerary-pdf";

export function ItineraryExport({
  title,
  thai,
  ready,
  buildDays,
}: {
  title: string;
  thai: boolean;
  ready: boolean;
  buildDays: () => PdfDay[];
}) {
  const t = (en: string, th: string) => (thai ? th : en);
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shareable =
    !!file && !!navigator.share && !!navigator.canShare?.({ files: [file] });

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const days = buildDays();
      const { makeItineraryPdf } = await import("./itinerary-pdf");
      await document.fonts.ready;
      setFile(makeItineraryPdf(title, days, thai ? "th-TH" : "en"));
    } catch {
      setError(
        t(
          "Could not create the PDF. Try again.",
          "สร้าง PDF ไม่สำเร็จ กรุณาลองใหม่",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  function download(pdf: File) {
    const url = URL.createObjectURL(pdf);
    const link = document.createElement("a");
    link.href = url;
    link.download = pdf.name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function share(pdf: File) {
    setError("");
    try {
      await navigator.share({ files: [pdf], title });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setError(
          t(
            "Could not share the file. Download it to attach to an email.",
            "แชร์ไฟล์ไม่สำเร็จ ดาวน์โหลดไฟล์เพื่อแนบในอีเมล",
          ),
        );
      }
    }
  }

  return (
    <details class="itinerary-export">
      <summary>
        {t("Export itinerary as PDF", "ส่งออกแผนการเดินทางเป็น PDF")}
      </summary>
      {!file ? (
        <Button
          type="button"
          disabled={!ready || busy}
          onClick={() => void generate()}
        >
          {busy
            ? t("Creating PDF…", "กำลังสร้าง PDF…")
            : t("Create PDF", "สร้าง PDF")}
        </Button>
      ) : (
        <>
          <Button type="button" onClick={() => download(file)}>
            {t("Download PDF", "ดาวน์โหลด PDF")}
          </Button>
          {shareable ? (
            <Button type="button" onClick={() => void share(file)}>
              {t("Share PDF", "แชร์ PDF")}
            </Button>
          ) : (
            <p>
              {t(
                "Download the PDF to attach it to an email.",
                "ดาวน์โหลด PDF เพื่อแนบในอีเมล",
              )}
            </p>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
