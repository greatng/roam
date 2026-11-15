/* eslint-disable @typescript-eslint/no-explicit-any -- fluent Supabase query mock */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { supabase, state } = vi.hoisted(() => {
  const state: { row: any; insertCalls: any[]; uploads: any[]; removals: any[]; calls: string[]; queryResult: any; uploadError: any; removeError: any } = {
    row: null, insertCalls: [], uploads: [], removals: [], calls: [], queryResult: { data: [], error: null }, uploadError: null, removeError: null,
  };
  const query = (table: string) => {
    let operation = "select";
    const q: any = {
      select: () => q,
      eq: () => q,
      not: () => q,
      insert: (value: any) => { operation = "insert"; state.insertCalls.push(value); return q; },
      update: (value: any) => { operation = "update"; state.calls.push(`update:${JSON.stringify(value)}`); return q; },
      delete: () => { operation = "delete"; return q; },
      maybeSingle: async () => ({ data: state.row, error: null }),
      single: async () => {
        state.row = { id: state.insertCalls.at(-1).id, trip_id: "trip", expense_id: "expense", uploaded_by: "user", object_path: "trip/expense/receipt.jpg", byte_size: state.insertCalls.at(-1).byte_size, status: "pending" };
        return { data: state.row, error: null };
      },
      then: (resolve: any, reject: any) => {
        if (operation === "delete") state.row = null;
        return Promise.resolve(table === "expense_receipts" && state.queryResult ? state.queryResult : { data: null, error: null }).then(resolve, reject);
      },
    };
    return q;
  };
  const supabase = {
    from: vi.fn((table: string) => query(table)),
    rpc: vi.fn(),
    storage: { from: vi.fn(() => ({
      upload: vi.fn(async (...args: any[]) => { state.uploads.push(args); return { error: state.uploadError }; }),
      remove: vi.fn(async (paths: string[]) => { state.removals.push(paths); return { error: state.removeError }; }),
    })) },
  };
  return { supabase, state };
});

vi.mock("../src/shared/supabase/client", () => ({ supabase }));
import { listExpenseReceiptCleanups, removeExpenseReceiptFiles, uploadExpenseReceipt } from "../src/features/expenses/receipts/api";

describe("expense receipt API", () => {
  beforeEach(() => {
    state.row = null;
    state.insertCalls.length = 0;
    state.uploads.length = 0;
    state.removals.length = 0;
    state.calls.length = 0;
    state.queryResult = { data: [], error: null };
    state.uploadError = null;
    state.removeError = null;
    vi.clearAllMocks();
  });

  it("uses the provided stable UUID and makes retry idempotent without financial RPCs", async () => {
    const photo = new Blob(["jpegbytes"], { type: "image/jpeg" });
    const args = { expenseId: "expense", tripId: "trip", uid: "user", receiptId: "stable-id", photo };
    expect(await uploadExpenseReceipt(args)).toEqual({ id: "stable-id" });
    expect(state.insertCalls).toEqual([{ id: "stable-id", trip_id: "trip", expense_id: "expense", uploaded_by: "user", byte_size: photo.size }]);
    expect(state.uploads[0][0]).toBe("trip/expense/receipt.jpg");
    expect(state.uploads[0][1]).toBe(photo);
    expect(state.uploads[0][2]).toEqual({ contentType: "image/jpeg", upsert: false, cacheControl: "0" });
    state.row.status = "ready";
    expect(await uploadExpenseReceipt(args)).toEqual({ id: "stable-id" });
    expect(state.insertCalls).toHaveLength(1);
    expect(state.uploads).toHaveLength(1);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("preserves a pending record and refuses different size photos before upload", async () => {
    state.row = { id: "stable-id", trip_id: "trip", expense_id: "expense", uploaded_by: "user", object_path: "trip/expense/a.jpg", byte_size: 5, status: "pending" };
    await expect(uploadExpenseReceipt({ expenseId: "expense", tripId: "trip", uid: "user", receiptId: "unused", photo: new Blob(["larger"]) })).rejects.toThrow(/different photo size/i);
    expect(state.row.byte_size).toBe(5);
    expect(state.uploads).toHaveLength(0);
  });

  it("retries an interrupted upload using the existing pending receipt UUID", async () => {
    const photo = new Blob(["jpeg"], { type: "image/jpeg" });
    state.uploadError = new Error("network interrupted");
    const args = { expenseId: "expense", tripId: "trip", uid: "user", receiptId: "stable-id", photo };
    await expect(uploadExpenseReceipt(args)).rejects.toThrow("network interrupted");
    state.uploadError = null;
    expect(await uploadExpenseReceipt(args)).toEqual({ id: "stable-id" });
    expect(state.insertCalls).toHaveLength(1);
    expect(state.uploads).toHaveLength(2);
  });

  it("removes storage before metadata and propagates cleanup failures", async () => {
    state.row = { id: "id", trip_id: "trip", expense_id: "expense", uploaded_by: "user", object_path: "trip/expense/a.jpg", byte_size: 2, status: "pending" };
    await removeExpenseReceiptFiles("trip", "expense");
    expect(state.removals).toEqual([["trip/expense/a.jpg"]]);
    expect(state.row).toBeNull();
    state.row = { id: "id", trip_id: "trip", expense_id: "expense", uploaded_by: "user", object_path: "trip/expense/a.jpg", byte_size: 2, status: "pending" };
    state.removeError = new Error("storage failed");
    await expect(removeExpenseReceiptFiles("trip", "expense")).rejects.toThrow("storage failed");
    expect(state.row).not.toBeNull();
    state.queryResult = { data: null, error: new Error("query failed") };
    await expect(listExpenseReceiptCleanups("trip")).rejects.toThrow("query failed");
    state.queryResult = { data: [], error: null };
    state.row = null;
    await expect(removeExpenseReceiptFiles("trip", "missing-expense")).resolves.toBeUndefined();
  });
});
