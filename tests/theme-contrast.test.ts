import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const css = readFileSync("src/style.css", "utf8");

function palette(selector: string) {
  const block = css.split(`${selector} {`)[1].split("}")[0];
  return Object.fromEntries(
    Array.from(
      block.matchAll(/--([\w-]+): (#[\da-f]{6});/gi),
      ([, name, color]) => [name, color],
    ),
  );
}

function luminance(hex: string) {
  return [0.2126, 0.7152, 0.0722].reduce((sum, weight, index) => {
    const start = index * 2 + 1;
    const sRgb = parseInt(hex.slice(start, start + 2), 16) / 255;
    const linear =
      sRgb <= 0.04045 ? sRgb / 12.92 : ((sRgb + 0.055) / 1.055) ** 2.4;
    return sum + weight * linear;
  }, 0);
}

const textPairs = [
  ["ink", "page"],
  ["ink", "paper"],
  ["muted", "page"],
  ["muted", "paper"],
  ["muted", "surface-soft"],
  ["control-text", "moss"],
  ["control-text", "moss-dark"],
  ["control-text", "control-pressed"],
  ["selected-text", "selected-surface"],
  ["link", "paper"],
  ["alert", "paper"],
  ["alert", "danger-surface"],
  ["danger-text", "danger-button"],
  ["danger-text", "danger-hover"],
  ["day-heading", "surface-soft"],
  ["success-text", "success-surface"],
  ["warning-text", "warning-surface"],
];
const boundaryPairs = [
  ["field-border", "field"],
  ["field-border", "paper"],
  ["selected-line", "selected-surface"],
  ["selected-line", "paper"],
  ["focus", "paper"],
  ["focus", "page"],
  ["focus", "selected-surface"],
];

const light = palette(":root");
it.each([
  ["light", light],
  ["dark", { ...light, ...palette(':root[data-theme="dark"]') }],
] as const)("%s semantic pairs meet WCAG AA contrast", (_theme, colors) => {
  for (const [pairs, minimum] of [
    [textPairs, 4.5],
    [boundaryPairs, 3],
  ] as const) {
    for (const [foreground, background] of pairs) {
      const fg = luminance(colors[foreground]);
      const bg = luminance(colors[background]);
      const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
      expect(ratio, `${foreground} on ${background}`).toBeGreaterThanOrEqual(
        minimum,
      );
    }
  }
});
