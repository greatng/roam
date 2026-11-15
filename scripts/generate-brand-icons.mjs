import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import { ROAM_HASH_PATH, ROAM_R_PATH } from "../src/shared/brand.ts";

const artwork = `<g transform="translate(85 139) scale(2.25)"><path d="${ROAM_HASH_PATH}" fill="none" stroke="#b8c6a3" stroke-width="7" stroke-linecap="round"/><path d="${ROAM_R_PATH}" fill="#faf8f3" fill-rule="evenodd"/></g>`;
const icon = (rounded) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="#202821"/>${artwork}</svg>\n`;
await writeFile("public/icon.svg", icon(true));
for (const [filename, size, rounded] of [
  ["icon-192.png", 192, true],
  ["icon-512.png", 512, true],
  ["icon-maskable.png", 512, false],
  ["apple-touch-icon.png", 180, false],
]) {
  await sharp(Buffer.from(icon(rounded)))
    .resize(size, size)
    .png()
    .toFile(`public/${filename}`);
}
