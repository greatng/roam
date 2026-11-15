import { beforeEach, describe, expect, it, vi } from "vitest";

const { supabaseMock, rows, removeMock } = vi.hoisted(() => {
  const rows: { object_path: string }[] = [];
  const removeMock = vi.fn(
    async (paths: string[]): Promise<{ error: Error | null }> => {
      void paths;
      return { error: null };
    },
  );
  const supabaseMock = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            range: vi.fn(async (start: number, end: number) => ({
              data: rows.slice(start, end + 1),
              error: null,
            })),
          })),
        })),
      })),
    })),
    storage: { from: vi.fn(() => ({ remove: removeMock })) },
  };
  return { supabaseMock, rows, removeMock };
});
vi.mock("../src/shared/supabase/client", () => ({ supabase: supabaseMock }));

import { removeTripReceiptFiles } from "../src/features/expenses/receipts/storage";

describe("removeTripReceiptFiles", () => {
  beforeEach(() => {
    rows.length = 0;
    removeMock.mockClear();
  });

  it("removes every trip receipt in storage-sized chunks and stable pages", async () => {
    rows.push(
      ...Array.from({ length: 501 }, (_, index) => ({
        object_path: `trip/expense/${index}.jpg`,
      })),
    );
    await removeTripReceiptFiles("trip");
    expect(supabaseMock.from).toHaveBeenCalledWith("expense_receipts");
    expect(removeMock).toHaveBeenCalledTimes(6);
    expect(removeMock.mock.calls.map(([paths]) => paths.length)).toEqual([
      100, 100, 100, 100, 100, 1,
    ]);
    expect(removeMock.mock.calls[5][0]).toEqual(["trip/expense/500.jpg"]);
  });

  it("stops cleanup and propagates a failed Storage removal", async () => {
    rows.push({ object_path: "trip/expense/receipt.jpg" });
    removeMock.mockResolvedValueOnce({
      error: new Error("Storage unavailable"),
    });
    await expect(removeTripReceiptFiles("trip")).rejects.toThrow(
      "Storage unavailable",
    );
    expect(removeMock).toHaveBeenCalledTimes(1);
  });
});
