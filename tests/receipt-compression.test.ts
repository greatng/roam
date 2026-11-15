import { afterEach, describe, expect, it, vi } from "vitest";
import {
  compressReceipt,
  RECEIPT_MAX_BYTES,
} from "../src/features/expenses/receipts/compress";

function pngHeader(width: number, height: number) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function webpHeader(width: number, height: number) {
  const bytes = new Uint8Array(30);
  const view = new DataView(bytes.buffer);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  bytes.set([0x56, 0x50, 0x38, 0x58], 12);
  view.setUint32(16, 10, true);
  const put24 = (offset: number, value: number) => {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >> 8) & 0xff;
    bytes[offset + 2] = (value >> 16) & 0xff;
  };
  put24(24, width - 1);
  put24(27, height - 1);
  return bytes;
}

function jpegWithExifOrientation6() {
  return new Uint8Array([
    0xff, 0xd8, 0xff, 0xe1, 0x00, 0x0a, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xf4, 0x01, 0x2c, 0x03,
    0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
  ]);
}

function hugeJpegHeader() {
  return new Uint8Array([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x17, 0x70, 0x1f, 0x40, 0x03,
    0x01, 0x11, 0x00,
  ]);
}

function hugeWebpHeader() {
  return webpHeader(8000, 6000);
}

function jpegWithLateSof() {
  const header = [0xff, 0xd8];
  for (let i = 0; i < 9; i++)
    header.push(0xff, 0xe2, 0xff, 0xff, ...new Array(65533).fill(0));
  header.push(...hugeJpegHeader().slice(2));
  return new Uint8Array(header);
}

describe("compressReceipt", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("re-encodes a PNG as a bounded JPEG and reduces its longest edge", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 3000, height: 2000, close: vi.fn() })),
    );
    const paintOrder: string[] = [];
    const context = {
      fillRect: vi.fn(() => paintOrder.push("white")),
      drawImage: vi.fn(() => paintOrder.push("photo")),
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      function (callback) {
        callback(new Blob(["jpeg"], { type: "image/jpeg" }));
      },
    );
    const result = await compressReceipt(
      new File([pngHeader(3000, 2000)], "receipt.png", { type: "image/png" }),
    );
    expect(result.blob.type).toBe("image/jpeg");
    expect(result.blob.size).toBeLessThanOrEqual(RECEIPT_MAX_BYTES);
    expect(result.width).toBe(1600);
    expect(result.height).toBe(1067);
    expect(paintOrder.slice(0, 2)).toEqual(["white", "photo"]);
  });

  it("shrinks repeatedly when the first JPEG encode exceeds the bucket limit", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 1600, height: 1200, close: vi.fn() })),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    let attempts = 0;
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      function (callback) {
        attempts++;
        const blob = new Blob(["x"], { type: "image/jpeg" });
        Object.defineProperty(blob, "size", {
          value: attempts === 1 ? RECEIPT_MAX_BYTES + 1 : 128,
        });
        callback(blob);
      },
    );
    const result = await compressReceipt(
      new File([webpHeader(1600, 1200)], "receipt.webp", {
        type: "image/webp",
      }),
    );
    expect(attempts).toBeGreaterThan(1);
    expect(result.width).toBeLessThan(1600);
    expect(result.blob.size).toBe(128);
  });

  it("rejects unsupported, oversized, and excessive-pixel images", async () => {
    await expect(
      compressReceipt(new File(["x"], "receipt.gif", { type: "image/gif" })),
    ).rejects.toThrow(/JPEG, PNG, or WebP/);
    const oversized = new File(
      [new Uint8Array(20 * 1024 * 1024 + 1)],
      "large.jpg",
      { type: "image/jpeg" },
    );
    await expect(compressReceipt(oversized)).rejects.toThrow(/20 MiB/);
    const decode = vi.fn(async () => ({
      width: 8000,
      height: 6000,
      close: vi.fn(),
    }));
    vi.stubGlobal("createImageBitmap", decode);
    const huge = new File([pngHeader(8000, 6000)], "huge.png", {
      type: "image/png",
    });
    await expect(compressReceipt(huge)).rejects.toThrow(/40 megapixels/);
    expect(decode).not.toHaveBeenCalled();
  });

  it("rejects an encoder fallback that did not produce a nonempty JPEG", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 100, height: 100, close: vi.fn() })),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      function (callback) {
        callback(new Blob(["png"], { type: "image/png" }));
      },
    );
    await expect(
      compressReceipt(
        new File([pngHeader(100, 100)], "receipt.png", { type: "image/png" }),
      ),
    ).rejects.toThrow(/encode the photo as JPEG/);
  });

  it("keeps JPEG EXIF orientation semantics without swapping header dimensions", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 300, height: 500, close: vi.fn() })),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      function (callback) {
        callback(new Blob(["jpeg"], { type: "image/jpeg" }));
      },
    );
    const result = await compressReceipt(
      new File([jpegWithExifOrientation6()], "oriented.jpg", {
        type: "image/jpeg",
      }),
    );
    expect(result.width).toBe(300);
    expect(result.height).toBe(500);
  });

  it("preflights oversized JPEG and WebP headers before invoking the decoder", async () => {
    const decode = vi.fn(async () => ({
      width: 8000,
      height: 6000,
      close: vi.fn(),
    }));
    vi.stubGlobal("createImageBitmap", decode);
    await expect(
      compressReceipt(
        new File([hugeJpegHeader()], "huge.jpg", { type: "image/jpeg" }),
      ),
    ).rejects.toThrow(/40 megapixels/);
    await expect(
      compressReceipt(
        new File([hugeWebpHeader()], "huge.webp", { type: "image/webp" }),
      ),
    ).rejects.toThrow(/40 megapixels/);
    expect(decode).not.toHaveBeenCalled();
  });

  it("rejects headers whose dimensions are missing from the bounded preflight", async () => {
    const decode = vi.fn(async () => ({
      width: 100,
      height: 100,
      close: vi.fn(),
    }));
    vi.stubGlobal("createImageBitmap", decode);
    const lateSof = new File([jpegWithLateSof()], "late.jpg", {
      type: "image/jpeg",
    });
    expect(lateSof.size).toBeGreaterThan(512 * 1024);
    await expect(compressReceipt(lateSof)).rejects.toThrow(
      /image could not be opened/,
    );
    expect(decode).not.toHaveBeenCalled();
  });
});
