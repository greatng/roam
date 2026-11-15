import { supabase } from "../../../shared/supabase/client";

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
