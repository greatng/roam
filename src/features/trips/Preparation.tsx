import { useQuery, useQueryClient } from "@tanstack/preact-query";
import { useRef, useState } from "preact/hooks";
import { ActionIcon } from "../../shared/ActionIcon";
import { IconButton } from "../../shared/ui/IconButton";
import { refetchInvalidatedOnMount } from "../../shared/query/refetchInvalidatedOnMount";
import { supabase } from "../../shared/supabase/client";

type Item = { id: string; title: string };
type PersonalItem = Item & { done: boolean };
type Progress = { checked: string[]; items: PersonalItem[] };
const emptyProgress = (): Progress => ({ checked: [], items: [] });

export function Preparation({
  tripId,
  uid,
  organizer,
  thai,
}: {
  tripId: string;
  uid: string;
  organizer: boolean;
  thai: boolean;
}) {
  const tr = (en: string, th: string) => (thai ? th : en);
  const key = `roam-preparation:${uid}:${tripId}`;
  const [storageError, setStorageError] = useState(false);
  const [progress, setProgress] = useState<Progress>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as Progress) : emptyProgress();
    } catch {
      return emptyProgress();
    }
  });
  function saveProgress(next: Progress) {
    setProgress(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }

  const client = useQueryClient();
  const queryKey = ["trip-preparation", uid, tripId];
  const shared = useQuery({
    queryKey,
    refetchOnMount: refetchInvalidatedOnMount,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_preparation_items")
        .select("id,title")
        .eq("trip_id", tripId)
        .order("created_at")
        .order("id");
      if (error) throw error;
      return data as Item[];
    },
  });
  async function saveShared(title: string, id?: string) {
    const table = supabase.from("trip_preparation_items");
    const { error } = id
      ? await table
          .update({ title })
          .eq("trip_id", tripId)
          .eq("id", id)
          .select("id")
          .single()
      : await table.insert({ trip_id: tripId, title });
    if (error) throw error;
    await client.invalidateQueries({ queryKey });
  }
  async function removeShared(id: string) {
    const { error } = await supabase
      .from("trip_preparation_items")
      .delete()
      .eq("trip_id", tripId)
      .eq("id", id)
      .select("id")
      .single();
    if (error) throw error;
    await client.invalidateQueries({ queryKey });
  }

  return (
    <div class="preparation">
      <Checklist
        title={tr("Trip checklist", "เช็กลิสต์ของทริป")}
        description={tr(
          "Everyone sees these items. Your checkmarks stay on this device.",
          "ทุกคนในทริปเห็นรายการนี้ ส่วนการติ๊กของคุณจะบันทึกไว้เฉพาะในอุปกรณ์นี้",
        )}
        items={
          shared.isError
            ? []
            : (shared.data ?? []).map((item) => ({
                ...item,
                done: progress.checked.includes(item.id),
              }))
        }
        status={
          shared.isError
            ? tr(
                "Could not load the trip checklist.",
                "โหลดเช็กลิสต์ของทริปไม่สำเร็จ",
              )
            : shared.isPending
              ? tr("Loading checklist…", "กำลังโหลดรายการ…")
              : undefined
        }
        toggle={(id, done) =>
          saveProgress({
            ...progress,
            checked: done
              ? [...progress.checked, id]
              : progress.checked.filter((value) => value !== id),
          })
        }
        save={organizer ? saveShared : undefined}
        remove={organizer ? removeShared : undefined}
        thai={thai}
      />
      <Checklist
        title={tr("My checklist", "เช็กลิสต์ของฉัน")}
        description={tr(
          "Your personal items are saved on this device.",
          "เช็กลิสต์ส่วนตัวจะบันทึกไว้ในอุปกรณ์นี้เท่านั้น",
        )}
        items={progress.items}
        toggle={(id, done) =>
          saveProgress({
            ...progress,
            items: progress.items.map((item) =>
              item.id === id ? { ...item, done } : item,
            ),
          })
        }
        save={(title, id) =>
          saveProgress({
            ...progress,
            items: id
              ? progress.items.map((item) =>
                  item.id === id ? { ...item, title } : item,
                )
              : [
                  ...progress.items,
                  { id: crypto.randomUUID(), title, done: false },
                ],
          })
        }
        remove={(id) =>
          saveProgress({
            ...progress,
            items: progress.items.filter((item) => item.id !== id),
          })
        }
        thai={thai}
      />
      {storageError && (
        <p role="alert">
          {tr(
            "This device could not save your changes.",
            "บันทึกการเปลี่ยนแปลงในอุปกรณ์นี้ไม่ได้",
          )}
        </p>
      )}
    </div>
  );
}

function Checklist({
  title,
  description,
  items,
  status,
  toggle,
  save,
  remove,
  thai,
}: {
  title: string;
  description: string;
  items: PersonalItem[];
  status?: string;
  toggle: (id: string, done: boolean) => void;
  save?: (title: string, id?: string) => void | Promise<void>;
  remove?: (id: string) => void | Promise<void>;
  thai: boolean;
}) {
  const tr = (en: string, th: string) => (thai ? th : en);
  const [editing, setEditing] = useState<string>();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function run(action: () => void | Promise<void>) {
    setBusy(true);
    setError(false);
    try {
      await action();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label={title}>
      <h2>{title}</h2>
      <p>{description}</p>
      {status ? (
        <p role="status">{status}</p>
      ) : items.length === 0 ? (
        <p>{tr("No items yet.", "ยังไม่มีรายการ")}</p>
      ) : (
        <ul class="preparation-items">
          {items.map((item) => (
            <li key={item.id}>
              <label>
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={(event) =>
                    toggle(item.id, event.currentTarget.checked)
                  }
                />
                <span>{item.title}</span>
              </label>
              {save && (
                <IconButton
                  appearance="tertiary"
                  disabled={busy}
                  aria-label={tr("Edit", "แก้ไข") + " " + item.title}
                  onClick={() => {
                    setEditing(item.id);
                    setDraft(item.title);
                    input.current?.focus();
                  }}
                >
                  <ActionIcon kind="edit" />
                </IconButton>
              )}
              {remove && (
                <IconButton
                  appearance="tertiary"
                  disabled={busy}
                  aria-label={tr("Remove", "ลบ") + " " + item.title}
                  onClick={() =>
                    void run(async () => {
                      await remove(item.id);
                      if (editing === item.id) {
                        setEditing(undefined);
                        setDraft("");
                      }
                    })
                  }
                >
                  <ActionIcon kind="remove" />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}
      {save && (
        <form
          class="preparation-form"
          onSubmit={(event) => {
            event.preventDefault();
            const value = draft.trim();
            if (!value) return;
            void run(async () => {
              await save(value, editing);
              setEditing(undefined);
              setDraft("");
              input.current?.focus();
            });
          }}
        >
          <label>
            {editing
              ? tr("Edit item", "แก้ไขรายการ")
              : tr("New item", "รายการใหม่")}
            <input
              ref={input}
              required
              maxLength={120}
              value={draft}
              disabled={busy}
              onInput={(event) => setDraft(event.currentTarget.value)}
            />
          </label>
          <IconButton
            type="submit"
            aria-label={
              editing
                ? tr("Save item", "บันทึกรายการ")
                : tr("Add item", "เพิ่มรายการ")
            }
            disabled={busy || !draft.trim()}
          >
            <ActionIcon kind={editing ? "save" : "add"} />
          </IconButton>
          {editing && (
            <IconButton
              appearance="tertiary"
              aria-label={tr("Cancel edit", "ยกเลิกการแก้ไข")}
              disabled={busy}
              onClick={() => {
                setEditing(undefined);
                setDraft("");
              }}
            >
              <ActionIcon kind="cancel" />
            </IconButton>
          )}
        </form>
      )}
      {error && (
        <p role="alert">
          {tr(
            "Could not update the checklist. Try again.",
            "อัปเดตรายการไม่สำเร็จ กรุณาลองอีกครั้ง",
          )}
        </p>
      )}
    </section>
  );
}
