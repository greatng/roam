import { supabase } from "../../../shared/supabase/client";

const RECEIPT_BUCKET = "expense-receipts";

export type ExpenseReceipt = {
  id: string;
  trip_id: string;
  expense_id: string;
  uploaded_by: string;
  object_path: string;
  byte_size: number;
  status: "pending" | "ready";
  created_at: string;
};

export async function loadExpenseReceipt(expenseId: string, tripId: string) {
  const { data, error } = await supabase
    .from("expense_receipts")
    .select(
      "id,trip_id,expense_id,uploaded_by,object_path,byte_size,status,created_at",
    )
    .eq("expense_id", expenseId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (error) throw error;
  return data as ExpenseReceipt | null;
}

export async function uploadExpenseReceipt({
  expenseId,
  tripId,
  uid,
  receiptId,
  photo,
}: {
  expenseId: string;
  tripId: string;
  uid: string;
  receiptId: string;
  photo: Blob;
}): Promise<{ id: string }> {
  let row = await loadExpenseReceipt(expenseId, tripId);
  if (!row) {
    const { data, error } = await supabase
      .from("expense_receipts")
      .insert({
        id: receiptId,
        trip_id: tripId,
        expense_id: expenseId,
        uploaded_by: uid,
        byte_size: photo.size,
      })
      .select(
        "id,trip_id,expense_id,uploaded_by,object_path,byte_size,status,created_at",
      )
      .single();
    if (error) {
      // A concurrent invocation may have created the unique expense row.
      row = await loadExpenseReceipt(expenseId, tripId);
      if (!row) throw error;
    } else row = data as ExpenseReceipt;
  }
  if (row.uploaded_by !== uid)
    throw new Error("This receipt belongs to another uploader.");
  if (row.status === "ready") return { id: row.id };
  if (row.byte_size !== photo.size)
    throw new Error("This pending receipt belongs to a different photo size.");

  const { error: uploadError } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .upload(row.object_path, photo, {
      contentType: "image/jpeg",
      upsert: false,
      cacheControl: "0",
    });
  if (uploadError && !isStorageConflict(uploadError)) throw uploadError;

  const { error: readyError } = await supabase
    .from("expense_receipts")
    .update({ status: "ready" })
    .eq("id", row.id);
  if (readyError) throw readyError;
  return { id: row.id };
}

function isStorageConflict(error: { statusCode?: string; message?: string }) {
  return (
    error.statusCode === "409" ||
    /already exists|duplicate|409/i.test(error.message ?? "")
  );
}

/** Remove an expense receipt's private object before deleting its metadata. */
export async function removeExpenseReceiptFiles(
  tripId: string,
  expenseId: string,
) {
  const receipt = await loadExpenseReceipt(expenseId, tripId);
  if (!receipt) return;
  const { error: storageError } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .remove([receipt.object_path]);
  if (storageError) throw storageError;
  const { error } = await supabase
    .from("expense_receipts")
    .delete()
    .eq("id", receipt.id);
  if (error) throw error;
}

export async function listExpenseReceiptCleanups(tripId: string): Promise<
  Array<{
    id: string;
    expense_id: string;
    object_path: string;
    description: string;
  }>
> {
  const { data, error } = await supabase
    .from("expense_receipts")
    .select("id,expense_id,object_path,expenses!inner(description,deleted_at)")
    .eq("trip_id", tripId)
    .not("expenses.deleted_at", "is", null);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const expense = row.expenses as unknown as { description: string };
    return {
      id: row.id as string,
      expense_id: row.expense_id as string,
      object_path: row.object_path as string,
      description: expense.description,
    };
  });
}

export async function removeTripReceiptFiles(tripId: string) {
  const storage = supabase.storage.from("expense-receipts");
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("expense_receipts")
      .select("object_path")
      .eq("trip_id", tripId)
      .order("id")
      .range(from, from + 499);
    if (error) throw error;
    const paths = (data ?? []).map((row) => row.object_path as string);
    for (let index = 0; index < paths.length; index += 100) {
      const { error: removeError } = await storage.remove(
        paths.slice(index, index + 100),
      );
      if (removeError) throw removeError;
    }
    if (paths.length < 500) break;
    from += 500;
  }
}
