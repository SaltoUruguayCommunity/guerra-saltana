import { PNG } from "pngjs";
import { readFileSync, writeFileSync } from "node:fs";
const root = new URL("../public/assets/", import.meta.url);
const source = PNG.sync.read(
  readFileSync(new URL("source/ui-sprites-imagegen.png", root)),
);
const atlas = new PNG({ width: 128, height: 96 });
const frames: Record<
  string,
  { frame: { x: number; y: number; w: number; h: number } }
> = {};
for (let row = 0; row < 3; row++)
  for (let col = 0; col < 4; col++) {
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const sx = Math.min(
          source.width - 1,
          Math.floor(((col + (x + 0.5) / 32) * source.width) / 4),
        );
        const sy = Math.min(
          source.height - 1,
          Math.floor(((row + (y + 0.5) / 32) * source.height) / 3),
        );
        const index = (sy * source.width + sx) * 4;
        atlas.data.set(
          source.data.subarray(index, index + 4),
          ((row * 32 + y) * 128 + col * 32 + x) * 4,
        );
      }
    frames[`${["whistle", "wind", "speaker"][row]}-${col}`] = {
      frame: { x: col * 32, y: row * 32, w: 32, h: 32 },
    };
  }
writeFileSync(new URL("ui-atlas.png", root), PNG.sync.write(atlas));
writeFileSync(
  new URL("ui-atlas.json", root),
  JSON.stringify(
    {
      frames,
      meta: { image: "ui-atlas.png", size: { w: 128, h: 96 }, scale: "1" },
    },
    null,
    2,
  ),
);
console.log("Atlas UI: 12 frames de 32×32, transparente.");
