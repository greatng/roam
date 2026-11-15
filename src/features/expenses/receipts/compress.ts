export const RECEIPT_MAX_BYTES = 512 * 1024;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const MAX_EDGE = 1600;
const HEADER_BYTES = 512 * 1024;

export type CompressedReceipt = { blob: Blob; width: number; height: number };

function loadImage(file: File): Promise<{
  image: CanvasImageSource;
  width: number;
  height: number;
  close?: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file).then((bitmap) => ({
      image: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    }));
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        image,
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That image could not be opened."));
    };
    image.src = url;
  });
}

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("This browser could not compress the photo.")),
      "image/jpeg",
      quality,
    ),
  );
}

function uint24(view: DataView, offset: number) {
  return (
    view.getUint8(offset) |
    (view.getUint8(offset + 1) << 8) |
    (view.getUint8(offset + 2) << 16)
  );
}

function readHeaderDimensions(
  bytes: ArrayBuffer,
): { width: number; height: number } | null {
  const view = new DataView(bytes);
  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...new Uint8Array(bytes, offset, length));
  if (
    bytes.byteLength >= 24 &&
    view.getUint32(0) === 0x89504e47 &&
    ascii(12, 4) === "IHDR"
  )
    return { width: view.getUint32(16), height: view.getUint32(20) };
  if (
    bytes.byteLength >= 30 &&
    ascii(0, 4) === "RIFF" &&
    ascii(8, 4) === "WEBP"
  ) {
    for (let offset = 12; offset + 8 <= bytes.byteLength;) {
      const chunk = ascii(offset, 4),
        size = view.getUint32(offset + 4, true),
        data = offset + 8;
      if (chunk === "VP8X" && size >= 10 && data + 10 <= bytes.byteLength)
        return {
          width: uint24(view, data + 4) + 1,
          height: uint24(view, data + 7) + 1,
        };
      if (
        chunk === "VP8 " &&
        size >= 10 &&
        data + 10 <= bytes.byteLength &&
        view.getUint8(data + 3) === 0x9d &&
        view.getUint8(data + 4) === 0x01 &&
        view.getUint8(data + 5) === 0x2a
      )
        return {
          width: view.getUint16(data + 6, true) & 0x3fff,
          height: view.getUint16(data + 8, true) & 0x3fff,
        };
      if (
        chunk === "VP8L" &&
        size >= 5 &&
        data + 5 <= bytes.byteLength &&
        view.getUint8(data) === 0x2f
      ) {
        const b1 = view.getUint8(data + 1),
          b2 = view.getUint8(data + 2),
          b3 = view.getUint8(data + 3),
          b4 = view.getUint8(data + 4);
        return {
          width: 1 + b1 + ((b2 & 0x3f) << 8),
          height: 1 + (b2 >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10),
        };
      }
      if (size < 0) break;
      offset = data + size + (size & 1);
    }
  }
  if (bytes.byteLength >= 4 && view.getUint16(0) === 0xffd8) {
    for (let offset = 2; offset + 4 <= bytes.byteLength;) {
      if (view.getUint8(offset) !== 0xff) {
        offset++;
        continue;
      }
      let markerOffset = offset + 1;
      while (
        markerOffset < bytes.byteLength &&
        view.getUint8(markerOffset) === 0xff
      )
        markerOffset++;
      if (markerOffset >= bytes.byteLength) break;
      const marker = view.getUint8(markerOffset);
      offset = markerOffset + 1;
      if (
        marker === 0xd8 ||
        marker === 0xd9 ||
        marker === 0x01 ||
        (marker >= 0xd0 && marker <= 0xd7)
      )
        continue;
      if (offset + 2 > bytes.byteLength) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.byteLength) break;
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker) &&
        length >= 7
      )
        return {
          height: view.getUint16(offset + 3),
          width: view.getUint16(offset + 5),
        };
      offset += length;
      if (marker === 0xda) break;
    }
  }
  return null;
}

async function readHeader(file: File): Promise<ArrayBuffer> {
  const slice = file.slice(0, HEADER_BYTES);
  if (typeof slice.arrayBuffer === "function") return slice.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      reader.result instanceof ArrayBuffer
        ? resolve(reader.result)
        : reject(new Error("That image could not be opened."));
    reader.onerror = () => reject(new Error("That image could not be opened."));
    reader.readAsArrayBuffer(slice);
  });
}

/** Re-encode a supported photo as metadata-free JPEG, shrinking until it fits the private bucket limit. */
export async function compressReceipt(file: File): Promise<CompressedReceipt> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPEG, PNG, or WebP photo.");
  if (file.size > MAX_SOURCE_BYTES)
    throw new Error("Choose a photo smaller than 20 MiB.");
  const header = await readHeader(file);
  const dimensions = readHeaderDimensions(header);
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0)
    throw new Error("That image could not be opened.");
  if (dimensions.width * dimensions.height > MAX_PIXELS)
    throw new Error("Choose an image no larger than 40 megapixels.");
  let source: Awaited<ReturnType<typeof loadImage>>;
  try {
    source = await loadImage(file);
  } catch {
    throw new Error("That image could not be opened.");
  }
  try {
    if (
      !source.width ||
      !source.height ||
      source.width * source.height > MAX_PIXELS
    )
      throw new Error("Choose an image no larger than 40 megapixels.");
    let width = source.width,
      height = source.height;
    const initialScale = Math.min(1, MAX_EDGE / Math.max(width, height));
    width = Math.max(1, Math.round(width * initialScale));
    height = Math.max(1, Math.round(height * initialScale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Photo compression is unavailable in this browser.");
    for (let attempt = 0; attempt < 12; attempt++) {
      canvas.width = width;
      canvas.height = height;
      context.fillStyle = "#fff";
      context.fillRect(0, 0, width, height);
      context.drawImage(source.image, 0, 0, width, height);
      const blob = await encode(canvas, Math.max(0.38, 0.86 - attempt * 0.045));
      if (blob.type !== "image/jpeg" || blob.size === 0)
        throw new Error("This browser could not encode the photo as JPEG.");
      if (blob.size <= RECEIPT_MAX_BYTES) return { blob, width, height };
      width = Math.max(1, Math.floor(width * 0.84));
      height = Math.max(1, Math.floor(height * 0.84));
    }
    throw new Error(
      "This photo cannot be reduced below 512 KiB. Choose a smaller image.",
    );
  } finally {
    source.close?.();
  }
}
