import { useEffect, useState } from "preact/hooks";
import { useQuery, useQueryClient } from "@tanstack/preact-query";
import { supabase } from "../../../shared/supabase/client";
import { Button } from "../../../shared/ui/Button";
import {
  compressReceipt,
  RECEIPT_MAX_BYTES,
  type CompressedReceipt,
} from "./compress";
import { loadExpenseReceipt, type ExpenseReceipt } from "./api";

export type ReceiptAttachmentProps = {
  expenseId: string;
  tripId: string;
  uid: string;
  organizer: boolean;
  thai: boolean;
  active?: boolean;
};
const bucket = "expense-receipts";
const tr = (thai: boolean, en: string, th: string) => (thai ? th : en);
function uuid() {
  return crypto.randomUUID();
}
function isConflict(error: { statusCode?: string; message?: string }) {
  return (
    error.statusCode === "409" ||
    /already exists|duplicate|409/i.test(error.message ?? "")
  );
}

export function ReceiptAttachment({
  expenseId,
  tripId,
  uid,
  organizer,
  thai,
  active = true,
}: ReceiptAttachmentProps) {
  const queryClient = useQueryClient();
  const queryKey = ["expense-receipt", tripId, expenseId, uid];
  const receiptQuery = useQuery({
    queryKey,
    queryFn: () => loadExpenseReceipt(expenseId, tripId),
  });
  const receipt = receiptQuery.data as ExpenseReceipt | null | undefined;
  const [photo, setPhoto] = useState<CompressedReceipt | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [viewAttempt, setViewAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [offline, setOffline] = useState(!navigator.onLine);
  const canRemove = !!receipt && (receipt.uploaded_by === uid || organizer);
  const canRetry = receipt?.status === "pending" && receipt.uploaded_by === uid;

  useEffect(() => {
    if (!photo || !expanded) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo, expanded]);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (
      !receipt ||
      receipt.status !== "ready" ||
      expanded === false ||
      viewAttempt === 0
    )
      return;
    let active = true;
    let url: string | null = null;
    setSavedUrl(null);
    void supabase.storage
      .from(bucket)
      .download(receipt.object_path)
      .then(({ data, error: downloadError }) => {
        if (downloadError) throw downloadError;
        if (!data) throw new Error("Receipt photo could not be loaded.");
        url = URL.createObjectURL(data);
        if (active) setSavedUrl(url);
        else URL.revokeObjectURL(url);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Receipt photo could not be loaded.",
          );
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [
    receipt?.id,
    receipt?.status,
    receipt?.object_path,
    expanded,
    viewAttempt,
  ]);

  async function chooseFile(event: Event) {
    if (!active) return;
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    setBusy(true);
    setPhoto(null);
    setError("");
    setNotice("");
    setProgress(tr(thai, "Compressing photo…", "กำลังบีบอัดรูปภาพ…"));
    try {
      setPhoto(await compressReceipt(file));
    } catch (cause) {
      const reason =
        cause instanceof Error
          ? cause.message
          : "That image could not be opened.";
      const translations: Record<string, string> = {
        "Choose a JPEG, PNG, or WebP photo.": "เลือกรูปภาพ JPEG, PNG หรือ WebP",
        "Choose a photo smaller than 20 MiB.":
          "เลือกรูปที่มีขนาดเล็กกว่า 20 MiB",
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
      setError(
        thai
          ? (translations[reason] ?? "บีบอัดรูปภาพไม่ได้ โปรดลองเลือกรูปอื่น")
          : reason,
      );
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  async function save() {
    if (!active) return;
    if (!navigator.onLine) {
      setError(
        tr(
          thai,
          "Connect to the internet to save a receipt. Your compressed preview is still here.",
          "เชื่อมต่ออินเทอร์เน็ตเพื่อบันทึกใบเสร็จ รูปตัวอย่างที่บีบอัดแล้วยังคงอยู่",
        ),
      );
      return;
    }
    if (receipt?.status === "pending" && !canRetry) {
      setError(
        tr(
          thai,
          "Only the person who started this upload can retry it. Ask them to retry or remove it.",
          "เฉพาะผู้ที่เริ่มอัปโหลดเท่านั้นที่ลองอีกครั้งได้ โปรดให้ผู้เริ่มอัปโหลดลองอีกครั้งหรือลบออก",
        ),
      );
      return;
    }
    if (!photo && receipt?.status !== "pending") return;
    if (!photo && receipt?.status === "pending") {
      setBusy(true);
      setError("");
      setProgress(
        tr(thai, "Recovering saved photo…", "กำลังกู้คืนรูปที่บันทึกไว้…"),
      );
      try {
        const { error: readyError } = await supabase
          .from("expense_receipts")
          .update({ status: "ready" })
          .eq("id", receipt.id);
        if (readyError) throw readyError;
        await queryClient.invalidateQueries({ queryKey });
        setExpanded(true);
        setViewAttempt((n) => n + 1);
      } catch (cause) {
        setError(
          tr(
            thai,
            "No uploaded photo was found. Choose the original photo to retry, or remove this pending receipt.",
            "ไม่พบรูปที่อัปโหลดแล้ว โปรดเลือกรูปต้นฉบับเพื่อลองอีกครั้ง หรือลบใบเสร็จที่ค้างอยู่นี้",
          ) + (cause instanceof Error ? ` (${cause.message})` : ""),
        );
      } finally {
        setBusy(false);
        setProgress("");
      }
      return;
    }
    if (!photo) return;
    if (
      receipt?.status === "pending" &&
      receipt.byte_size !== photo.blob.size
    ) {
      setError(
        tr(
          thai,
          "This pending receipt belongs to a different photo size. Remove it before saving this photo.",
          "ใบเสร็จที่ค้างอยู่นี้มีขนาดรูปอื่น โปรดลบก่อนบันทึกรูปนี้",
        ),
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      let row = receipt;
      if (!row) {
        const id = uuid();
        const { data, error: insertError } = await supabase
          .from("expense_receipts")
          .insert({
            id,
            trip_id: tripId,
            expense_id: expenseId,
            uploaded_by: uid,
            byte_size: photo.blob.size,
          })
          .select(
            "id,trip_id,expense_id,uploaded_by,object_path,byte_size,status,created_at",
          )
          .single();
        if (insertError) throw insertError;
        row = data as ExpenseReceipt;
      }
      if (row.status === "ready") {
        await queryClient.invalidateQueries({ queryKey });
        setPhoto(null);
        return;
      }
      setProgress(tr(thai, "Saving receipt…", "กำลังบันทึกใบเสร็จ…"));
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(row.object_path, photo.blob, {
          contentType: "image/jpeg",
          upsert: false,
          cacheControl: "0",
        });
      if (uploadError && !isConflict(uploadError)) throw uploadError;
      if (uploadError) {
        setProgress(
          tr(thai, "Recovering saved photo…", "กำลังกู้คืนรูปที่บันทึกไว้…"),
        );
        setNotice(
          tr(
            thai,
            "An earlier upload was recovered. The stored receipt is shown below.",
            "กู้คืนรูปที่อัปโหลดไว้ก่อนหน้าแล้ว โดยแสดงใบเสร็จที่จัดเก็บไว้ด้านล่าง",
          ),
        );
      } else setNotice("");
      const { error: readyError } = await supabase
        .from("expense_receipts")
        .update({ status: "ready" })
        .eq("id", row.id);
      if (readyError) throw readyError;
      await queryClient.invalidateQueries({ queryKey });
      setPhoto(null);
      setExpanded(true);
      if (uploadError) setViewAttempt((n) => n + 1);
    } catch (cause) {
      if (!navigator.onLine)
        setError(
          tr(
            thai,
            "Connect to the internet to save a receipt. Your compressed preview is still here.",
            "เชื่อมต่ออินเทอร์เน็ตเพื่อบันทึกใบเสร็จ รูปตัวอย่างที่บีบอัดแล้วยังคงอยู่",
          ),
        );
      else
        setError(
          cause instanceof Error
            ? cause.message
            : tr(
                thai,
                "Receipt could not be saved. Try again.",
                "บันทึกใบเสร็จไม่สำเร็จ โปรดลองอีกครั้ง",
              ),
        );
      await queryClient.invalidateQueries({ queryKey });
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  async function remove() {
    if (!receipt || !canRemove) return;
    setBusy(true);
    setError("");
    try {
      const { error: removeError } = await supabase.storage
        .from(bucket)
        .remove([receipt.object_path]);
      if (removeError) throw removeError;
      const { error: deleteError } = await supabase
        .from("expense_receipts")
        .delete()
        .eq("id", receipt.id);
      if (deleteError) throw deleteError;
      setExpanded(false);
      setViewAttempt(0);
      setSavedUrl(null);
      setPhoto(null);
      await queryClient.invalidateQueries({ queryKey });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : tr(thai, "Receipt could not be removed.", "ลบใบเสร็จไม่สำเร็จ"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <details
      class="receipt-attachment"
      onToggle={(event) =>
        setExpanded((event.currentTarget as HTMLDetailsElement).open)
      }
    >
      <summary>
        {receipt?.status === "ready"
          ? tr(thai, "Receipt photo", "รูปใบเสร็จ")
          : tr(thai, "Attach receipt", "แนบใบเสร็จ")}
      </summary>
      <div class="receipt-attachment__body">
        {receiptQuery.isLoading && (
          <p role="status">
            {tr(thai, "Loading receipt…", "กำลังโหลดใบเสร็จ…")}
          </p>
        )}
        {receiptQuery.error && (
          <p role="alert">
            {tr(
              thai,
              "Receipt status could not be loaded. Refresh to try again.",
              "โหลดสถานะใบเสร็จไม่ได้ โปรดรีเฟรชแล้วลองอีกครั้ง",
            )}
          </p>
        )}
        {offline && (
          <p role="status">
            {tr(
              thai,
              "Connect to the internet to save a receipt.",
              "เชื่อมต่ออินเทอร์เน็ตเพื่อบันทึกใบเสร็จ",
            )}
            {!active && receipt?.status !== "ready" && (
              <p role="status">
                {tr(
                  thai,
                  "Archived trips are read-only. Receipt uploads are unavailable.",
                  "ทริปที่เก็บถาวรเป็นแบบอ่านอย่างเดียว ไม่สามารถอัปโหลดใบเสร็จได้",
                )}
              </p>
            )}
          </p>
        )}
        {receipt?.status === "pending" && (
          <p role="status">
            {canRetry
              ? tr(
                  thai,
                  "Receipt upload is pending. Retry saving or remove it.",
                  "การอัปโหลดใบเสร็จยังค้างอยู่ ลองบันทึกอีกครั้งหรือลบออก",
                )
              : tr(
                  thai,
                  "Receipt upload is pending. The uploader can retry it.",
                  "การอัปโหลดใบเสร็จยังค้างอยู่ ผู้ที่อัปโหลดสามารถลองอีกครั้งได้",
                )}
          </p>
        )}
        {active && receipt?.status === "pending" && canRetry && !photo && (
          <label>
            {tr(thai, "Choose a receipt photo", "เลือกรูปใบเสร็จ")}
            <input
              aria-label={tr(thai, "Choose a receipt photo", "เลือกรูปใบเสร็จ")}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={chooseFile}
              disabled={busy}
            />
          </label>
        )}
        {receipt?.status === "ready" && (
          <Button
            type="button"
            size="small"
            appearance="secondary"
            disabled={busy}
            onClick={() => {
              setError("");
              setExpanded(true);
              setViewAttempt((n) => n + 1);
            }}
          >
            {tr(thai, "View receipt", "ดูใบเสร็จ")}
          </Button>
        )}
        {notice && <p role="status">{notice}</p>}
        {savedUrl && receipt?.status === "ready" && (
          <img
            class="receipt-attachment__photo"
            src={savedUrl}
            alt={tr(thai, "Saved receipt photo", "รูปใบเสร็จที่บันทึกแล้ว")}
          />
        )}
        {active && !receipt && (
          <label>
            {tr(thai, "Choose a receipt photo", "เลือกรูปใบเสร็จ")}
            <input
              aria-label={tr(thai, "Choose a receipt photo", "เลือกรูปใบเสร็จ")}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={chooseFile}
              disabled={busy}
            />
          </label>
        )}
        {active && photo && (
          <>
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
              {Math.ceil(photo.blob.size / 1024)} KiB /{" "}
              {RECEIPT_MAX_BYTES / 1024} KiB
            </p>
            <Button
              type="button"
              size="small"
              disabled={busy}
              loading={busy}
              onClick={save}
            >
              {tr(thai, "Save receipt", "บันทึกใบเสร็จ")}
            </Button>
          </>
        )}
        {active && canRetry && (
          <Button
            type="button"
            size="small"
            appearance="secondary"
            disabled={busy}
            loading={busy}
            onClick={save}
          >
            {tr(thai, "Retry save", "ลองบันทึกอีกครั้ง")}
          </Button>
        )}
        {canRemove && (
          <Button
            type="button"
            size="small"
            appearance="tertiary"
            disabled={busy}
            onClick={remove}
          >
            {tr(thai, "Remove receipt", "ลบใบเสร็จ")}
          </Button>
        )}
        {progress && (
          <p role="status" aria-live="polite">
            {progress}
          </p>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </details>
  );
}
