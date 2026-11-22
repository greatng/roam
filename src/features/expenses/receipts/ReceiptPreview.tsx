import { RECEIPT_MAX_BYTES } from "./compress";

export function ReceiptPreview({
  url,
  bytes,
  thai,
}: {
  url: string | null;
  bytes: number;
  thai: boolean;
}) {
  return (
    <>
      <img
        class="receipt-attachment__photo"
        src={url ?? undefined}
        alt={
          thai ? "ตัวอย่างใบเสร็จที่บีบอัดแล้ว" : "Compressed receipt preview"
        }
      />
      <p>
        {thai ? "ขนาดหลังบีบอัด" : "Compressed size"}: {Math.ceil(bytes / 1024)}{" "}
        KiB / {RECEIPT_MAX_BYTES / 1024} KiB
      </p>
    </>
  );
}
