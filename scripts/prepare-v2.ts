import { PNG } from "pngjs";
import { readFileSync, writeFileSync } from "node:fs";
const root = new URL("../public/assets/", import.meta.url);
const read = (name: string) => PNG.sync.read(readFileSync(new URL(name, root)));
const save = (name: string, image: PNG) =>
  writeFileSync(new URL(name, root), PNG.sync.write(image));
/** Nearest-neighbour sampling for engine-ready frames. Alpha is copied unchanged. */
function sample(
  source: PNG,
  x: number,
  y: number,
  w: number,
  h: number,
  width: number,
  height: number,
): PNG {
  const result = new PNG({ width, height });
  for (let dy = 0; dy < height; dy++)
    for (let dx = 0; dx < width; dx++) {
      const sx = Math.min(
        source.width - 1,
        Math.floor(x + ((dx + 0.5) * w) / width),
      );
      const sy = Math.min(
        source.height - 1,
        Math.floor(y + ((dy + 0.5) * h) / height),
      );
      const offset = (sy * source.width + sx) * 4;
      result.data.set(
        source.data.subarray(offset, offset + 4),
        (dy * width + dx) * 4,
      );
    }
  return result;
}
const sheet = read("source/capy-soldiers-imagegen-v2.png");
const frames: Record<
  string,
  { frame: { x: number; y: number; w: number; h: number } }
> = {};
const atlas = new PNG({ width: 384, height: 128 });
for (let row = 0; row < 2; row++)
  for (let col = 0; col < 6; col++) {
    const cell = sample(
      sheet,
      (col * sheet.width) / 6,
      (row * sheet.height) / 2,
      sheet.width / 6,
      sheet.height / 2,
      64,
      64,
    );
    PNG.bitblt(cell, atlas, 0, 0, 64, 64, col * 64, row * 64);
    frames[`soldier-${row}-${col}`] = {
      frame: { x: col * 64, y: row * 64, w: 64, h: 64 },
    };
    if (row === 0 && col === 0) save("capy-portrait-v2.png", cell);
    if (row === 1 && col === 0) save("capy-orange-v3.png", cell);
  }
save("capy-atlas-v2.png", atlas);
writeFileSync(
  new URL("capy-atlas-v2.json", root),
  JSON.stringify(
    {
      frames,
      meta: {
        image: "capy-atlas-v2.png",
        size: { w: 384, h: 128 },
        scale: "1",
      },
    },
    null,
    2,
  ),
);
const scene = read("source/costanera-imagegen-v2.png");
const logo = read("source/logo-imagegen-v2.png");
save("logo-v2.png", sample(logo, 0, 0, logo.width, logo.height, 480, 360));
save(
  "costanera-v2.png",
  sample(scene, 0, 0, scene.width, scene.height, 1280, 720),
);
save(
  "river-v2.png",
  sample(scene, 0, 0, scene.width, scene.height * 0.72, 1280, 720),
);
save(
  "soil-v2.png",
  sample(
    scene,
    0,
    scene.height * 0.78,
    scene.width,
    scene.height * 0.22,
    640,
    144,
  ),
);
console.log(
  "Assets v2 listos: atlas 12 frames 64×64, retrato, fondo 1280×720 y textura de terreno.",
);
