import { jsPDF } from "jspdf";

export type PdfLine = { text: string; style?: "day" | "stop" | "tag" };
export type PdfDay = { title: string; lines: PdfLine[] };

// Canvas uses the device's font fallback and shaping for mixed-script itineraries.
export function makeItineraryPdf(
  title: string,
  days: PdfDay[],
  locale: string,
) {
  const pdf = new jsPDF({ format: "a4", unit: "mm", compress: true });
  const canvas = document.createElement("canvas");
  canvas.width = 1190;
  canvas.height = 1684;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create the PDF canvas.");

  const margin = 100;
  const bottom = canvas.height - 110;
  const maxWidth = canvas.width - 2 * margin;
  const words = new Intl.Segmenter(locale, { granularity: "word" });
  const graphemes = new Intl.Segmenter(locale, { granularity: "grapheme" });
  let page = 1;
  let y = 0;

  function wrap(text: string) {
    const lines: string[] = [];
    for (const paragraph of text.split(/\r?\n/)) {
      let line = "";
      function append(piece: string) {
        if (line && ctx!.measureText(line + piece).width > maxWidth) {
          lines.push(line.trimEnd());
          line = "";
        }
        line += line ? piece : piece.trimStart();
      }
      for (const { segment } of words.segment(paragraph)) {
        if (ctx!.measureText(segment).width <= maxWidth) append(segment);
        else
          for (const part of graphemes.segment(segment)) append(part.segment);
      }
      lines.push(line.trimEnd());
    }
    return lines;
  }

  function startPage() {
    ctx!.fillStyle = "#fffdf8";
    ctx!.fillRect(0, 0, canvas.width, canvas.height);
    ctx!.fillStyle = "#41533d";
    ctx!.font = "700 25px sans-serif";
    ctx!.fillText("ROAM", margin, 78);
    y = 142;
  }

  function finishPage() {
    ctx!.fillStyle = "#41533d";
    ctx!.font = "24px sans-serif";
    ctx!.fillText(String(page), margin, canvas.height - 58);
    if (page > 1) pdf.addPage();
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, 210, 297);
  }

  function ensureSpace(height: number) {
    if (y + height <= bottom) return;
    finishPage();
    page++;
    startPage();
  }

  function write(
    text: string,
    font: string,
    lineHeight: number,
    color: string,
  ) {
    ctx!.font = font;
    const lines = wrap(text);
    for (const line of lines) {
      ensureSpace(lineHeight);
      ctx!.font = font;
      ctx!.fillStyle = color;
      ctx!.fillText(line, margin, y);
      y += lineHeight;
    }
  }

  startPage();
  write(title, "700 54px sans-serif", 72, "#17251c");
  for (const day of days) {
    ensureSpace(154);
    y += 26;
    write(day.title, "700 37px sans-serif", 56, "#41533d");
    for (const line of day.lines) {
      if (line.style === "stop") {
        ensureSpace(100);
        y += 12;
      }
      if (line.style === "tag") {
        write("[" + line.text + "]", "700 25px sans-serif", 39, "#41533d");
        continue;
      }
      write(
        line.text,
        line.style ? "700 30px sans-serif" : "30px sans-serif",
        43,
        "#17251c",
      );
    }
  }
  finishPage();

  const filename =
    title
      .replace(/[<>:"/\\|?*]/g, " ")
      .trim()
      .slice(0, 100) || "Roam";
  return new File([pdf.output("blob")], filename + ".pdf", {
    type: "application/pdf",
  });
}
