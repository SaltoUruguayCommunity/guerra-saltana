import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
const root = new URL("../public/assets/", import.meta.url);
const source = PNG.sync.read(
  readFileSync(new URL("source/saltouruguayserver-pixel-imagegen.png", root)),
);
let left = source.width,
  top = source.height,
  right = -1,
  bottom = -1;
for (let y = 0; y < source.height; y++)
  for (let x = 0; x < source.width; x++) {
    if (source.data[(y * source.width + x) * 4 + 3] < 32) continue;
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  }
if (right < left) throw Error("Logo vacío");
const width = right - left + 1,
  height = bottom - top + 1;
const scale = Math.min(44 / width, 60 / height);
const w = Math.max(1, Math.round(width * scale)),
  h = Math.max(1, Math.round(height * scale));
const output = new PNG({ width: 48, height: 64 });
const ox = Math.floor((48 - w) / 2),
  oy = Math.floor((64 - h) / 2);
for (let y = 0; y < h; y++)
  for (let x = 0; x < w; x++) {
    const sx = Math.min(right, left + Math.floor(((x + 0.5) * width) / w));
    const sy = Math.min(bottom, top + Math.floor(((y + 0.5) * height) / h));
    const i = (sy * source.width + sx) * 4;
    output.data.set(
      source.data.subarray(i, i + 4),
      ((y + oy) * 48 + x + ox) * 4,
    );
  }
writeFileSync(
  new URL("saltouruguayserver-pixel.png", root),
  PNG.sync.write(output),
);
console.log("Logo de SaltoUruguayServer: PNG transparente 48×64.");
