import { useEffect, useRef, useState } from "preact/hooks";
import { cacheTripData, readCachedTripData } from "../offline/db";
import type { CompressedReceipt } from "./receipts/compress";

type Draft = {
  fields: Record<string, string | boolean>;
  photo: CompressedReceipt | null;
};

// Serialize writes and deletion so an earlier edit cannot resurrect a saved draft.
export function useExpenseDraft(ownerId: string, tripId: string) {
  const form = useRef<HTMLFormElement>(null);
  const draft = useRef<Draft | null>(null);
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const generation = useRef(0);
  const [restored, setRestored] = useState(false);
  const [photo, setPhoto] = useState<CompressedReceipt | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const current = ++generation.current;
    draft.current = null;
    setPhoto(null);
    setReady(false);
    setRestored(false);
    void readCachedTripData<Draft>(ownerId, tripId, "expense_draft").then(
      (saved) => {
        if (current !== generation.current) return;
        if (saved) {
          draft.current = saved;
          setPhoto(saved.photo);
          setRestored(true);
        }
        setReady(true);
      },
      () => {
        if (current === generation.current) {
          setError(
            "Local draft storage is unavailable. Keep this page open until you save.",
          );
          setReady(true);
        }
      },
    );
    return () => {
      generation.current++;
    };
  }, [ownerId, tripId]);

  // The expense form is mounted only when its tab is selected.
  useEffect(() => {
    if (!form.current || !draft.current) return;
    for (const element of Array.from(form.current.elements)) {
      if (!(
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement
      ))
        continue;
      const value = draft.current.fields[element.name];
      if (value === undefined) continue;
      if (element instanceof HTMLInputElement && element.type === "checkbox")
        element.checked = value === true;
      else element.value = String(value);
    }
    const date = form.current.elements.namedItem(
      "expenseDate",
    ) as HTMLInputElement;
    const time = form.current.elements.namedItem(
      "expenseTime",
    ) as HTMLInputElement;
    time.disabled = !date.value;
  });

  function persist(nextPhoto = photo): Promise<unknown> {
    if (!ready || !form.current) return Promise.resolve();
    const fields: Draft["fields"] = {};
    for (const element of Array.from(form.current.elements)) {
      if (
        !(
          element instanceof HTMLInputElement ||
          element instanceof HTMLSelectElement
        ) ||
        !element.name ||
        element.type === "file"
      )
        continue;
      fields[element.name] =
        element instanceof HTMLInputElement && element.type === "checkbox"
          ? element.checked
          : element.value;
    }
    const value = { fields, photo: nextPhoto };
    draft.current = value;
    const current = generation.current;
    writes.current = writes.current
      .catch(() => {})
      .then(() => {
        if (current === generation.current)
          return cacheTripData(ownerId, tripId, "expense_draft", value);
      })
      .then(
        () => {
          setError("");
          return true;
        },
        () => {
          setError(
            "Could not preserve this draft. Keep this page open until you save.",
          );
          return false;
        },
      );
    return writes.current;
  }

  async function changePhoto(value: CompressedReceipt | null) {
    if (!ready) return;
    setPhoto(value);
    await persist(value);
  }

  async function flush() {
    generation.current++;
    await writes.current.catch(() => {});
  }

  function clear() {
    generation.current++;
    draft.current = null;
    setPhoto(null);
    setRestored(false);
  }

  return {
    form,
    photo,
    restored,
    ready,
    error,
    persist,
    changePhoto,
    clear,
    flush,
  };
}
