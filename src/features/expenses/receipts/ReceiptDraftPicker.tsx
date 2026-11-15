import { useEffect, useRef, useState } from "preact/hooks";
import { Button } from "../../../shared/ui/Button";
import {
  compressReceipt,
  RECEIPT_MAX_BYTES,
  type CompressedReceipt,
} from "./compress";
import { ReceiptSourcePicker } from "./ReceiptSourcePicker";

export type ReceiptDraftPickerProps = {
  photo: CompressedReceipt | null;
  onChange: (photo: CompressedReceipt | null) => void | Promise<unknown>;
  beforePick?: () => Promise<unknown>;
  onBusyChange: (busy: boolean) => void;
  thai: boolean;
  disabled?: boolean;
};

const tr = (thai: boolean, en: string, th: string) => (thai ? th : en);
const errorThai: Record<string, string> = {
  "Choose a JPEG, PNG, or WebP photo.": "เลือกรูปภาพ JPEG, PNG หรือ WebP",
  "Choose a photo smaller than 20 MiB.": "เลือกรูปที่มีขนาดเล็กกว่า 20 MiB",
  "That image could not be opened.": "เปิดรูปภาพนี้ไม่ได้",
  "Choose an image no larger than 40 megapixels.":
    "เลือกรูปภาพที่มีขนาดไม่เกิน 40 ล้านพิกเซล",
  "Photo compression is unavailable in this browser.":
    "เบราว์เซอร์นี้ไม่รองรับการบีบอัดรูปภาพ",
  "This photo cannot be reduced below 512 KiB. Choose a smaller image.":
    "ลดขนาดรูปนี้ให้ต่ำกว่า 512 KiB ไม่ได้ โปรดเลือกรูปที่เล็กลง",
  "This browser could not compress the photo.":
    "เบราว์เซอร์นี้บีบอัดรูปภาพไม่ได้",
};

export function ReceiptDraftPicker({
  photo,
  onChange,
  onBusyChange,
  beforePick,
  thai,
  disabled = false,
}: ReceiptDraftPickerProps) {
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!photo) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function chooseFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file || disabled) return;
    setBusy(true);
    onBusyChange(true);
    setError("");
    setProgress(tr(thai, "Compressing photo…", "กำลังบีบอัดรูปภาพ…"));
    try {
      const photo = await compressReceipt(file);
      if (active.current) await onChange(photo);
    } catch (cause) {
      const reason =
        cause instanceof Error
          ? cause.message
          : "That image could not be opened.";
      setError(
        thai
          ? (errorThai[reason] ?? "บีบอัดรูปภาพไม่ได้ โปรดลองเลือกรูปอื่น")
          : reason,
      );
    } finally {
      setBusy(false);
      onBusyChange(false);
      setProgress("");
    }
  }

  return (
    <section
      class="receipt-draft-picker"
      aria-label={tr(thai, "Receipt photo", "รูปใบเสร็จ")}
    >
      <ReceiptSourcePicker
        label={tr(thai, "Receipt photo (optional)", "รูปใบเสร็จ (ไม่บังคับ)")}
        thai={thai}
        disabled={disabled || busy}
        onChange={chooseFile}
        beforePick={beforePick}
      />
      {photo && (
        <div class="receipt-draft-picker__preview">
          <img
            class="receipt-attachment__photo"
            src={previewUrl ?? undefined}
            alt={tr(
              thai,
              "Compressed receipt preview",
              "ตัวอย่างใบเสร็จที่บีบอัดแล้ว",
            )}
          />
          <p>
            {tr(thai, "Compressed size", "ขนาดหลังบีบอัด")}:{" "}
            {Math.ceil(photo.blob.size / 1024)} KiB / {RECEIPT_MAX_BYTES / 1024}{" "}
            KiB
          </p>
          <Button
            type="button"
            size="small"
            appearance="secondary"
            disabled={disabled || busy}
            onClick={() => {
              onChange(null);
              setError("");
            }}
          >
            {tr(thai, "Remove selected receipt", "นำรูปใบเสร็จที่เลือกออก")}
          </Button>
        </div>
      )}
      {progress && (
        <p role="status" aria-live="polite">
          {progress}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
