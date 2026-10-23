import { PNG } from "pngjs";
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../public/assets/", import.meta.url);
const source = PNG.sync.read(
  readFileSync(new URL("source/tero-bomba-imagegen-v1.png", root)),
);
// Register the generated bird bodies at the same anchor, independently of
// wing extent. Sampling preserves the original alpha; no background removal.
const frames = [
  {
    name: "wings-up",
    x: 370,
    y: 480,
    scale: 0.125,
    left: 0,
    top: 0,
    right: 650,
    bottom: 650,
  },
  {
    name: "wings-down",
    x: 970,
    y: 480,
    scale: 0.125,
    left: 650,
    top: 0,
    right: 1280,
    bottom: 750,
  },
  {
    name: "glide",
    x: 400,
    y: 1050,
    scale: 0.125,
    left: 0,
    top: 760,
    right: 840,
    bottom: 1280,
  },
  {
    name: "bomb",
    x: 975,
    y: 990,
    scale: 0.25,
    left: 840,
    top: 760,
    right: 1280,
    bottom: 1280,
  },
];
const atlas = new PNG({ width: 512, height: 128 });
const metadata: Record<
  string,
  { frame: { x: number; y: number; w: number; h: number } }
> = {};
for (const [i, frame] of frames.entries()) {
  const image = new PNG({ width: 128, height: 128 });
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      const sx = Math.floor(
        ((frame.x + (x - 64) / frame.scale) * source.width) / 1280,
      );
      const sy = Math.floor(
        ((frame.y + (y - (i === 3 ? 64 : 80)) / frame.scale) * source.height) /
          1280,
      );
      if (
        sx < (frame.left * source.width) / 1280 ||
        sx >= (frame.right * source.width) / 1280 ||
        sy < (frame.top * source.height) / 1280 ||
        sy >= (frame.bottom * source.height) / 1280
      )
        continue;
      const offset = (sy * source.width + sx) * 4;
      image.data.set(
        source.data.subarray(offset, offset + 4),
        (y * 128 + x) * 4,
      );
    }
  PNG.bitblt(image, atlas, 0, 0, 128, 128, i * 128, 0);
  metadata[frame.name] = { frame: { x: i * 128, y: 0, w: 128, h: 128 } };
  if (i === 2)
    writeFileSync(new URL("tero-icon-v1.png", root), PNG.sync.write(image));
}
writeFileSync(new URL("tero-atlas-v1.png", root), PNG.sync.write(atlas));
writeFileSync(
  new URL("tero-atlas-v1.json", root),
  JSON.stringify(
    {
      frames: metadata,
      meta: {
        image: "tero-atlas-v1.png",
        size: { w: 512, h: 128 },
        scale: "1",
      },
    },
    null,
    2,
  ),
);
console.log(
  "Tero-Bomba: 3 flight frames, bomb and icon prepared with source alpha.",
);
