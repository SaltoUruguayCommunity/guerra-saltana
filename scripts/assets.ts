import { PNG } from "pngjs";
import fs from "node:fs";
const dir = new URL("../public/assets/", import.meta.url);
fs.mkdirSync(dir, { recursive: true });
const png = new PNG({ width: 512, height: 256 });
const frames: Record<
  string,
  {
    frame: {
      x: number;
      y: number;
      w: number;
      h: number;
    };
  }
> = {};
const colors = {
  outline: "#17313b",
  fur: "#be814f",
  light: "#edb975",
  nose: "#543b37",
  eye: "#132b35",
  white: "#fff3cb",
  blue: "#38b8cb",
  red: "#f67555",
};
function rect(x: number, y: number, w: number, h: number, c: string) {
  const rgb = c.match(/[a-f\d]{2}/gi)!.map((v) => parseInt(v, 16));
  for (let yy = Math.max(0, y); yy < Math.min(256, y + h); yy++)
    for (let xx = Math.max(0, x); xx < Math.min(512, x + w); xx++) {
      const i = (yy * 512 + xx) * 4;
      png.data.set([...rgb, 255], i);
    }
}
for (let team = 0; team < 2; team++)
  for (let state = 0; state < 6; state++)
    for (let f = 0; f < 4; f++) {
      const x = ((state * 4 + f) % 16) * 32,
        y = (team * 2 + Math.floor((state * 4 + f) / 16)) * 32;
      const bob = state === 0 ? f % 2 : state === 1 ? (f % 2) * 2 : 0;
      const oy = y + bob;
      rect(x + 7, oy + 10, 19, 16, colors.outline);
      rect(x + 8, oy + 10, 17, 14, colors.fur);
      rect(x + 11, oy + 7, 5, 6, colors.outline);
      rect(x + 12, oy + 8, 3, 5, colors.light);
      rect(x + 20, oy + 7, 5, 6, colors.outline);
      rect(x + 21, oy + 8, 3, 4, colors.fur);
      rect(x + 18, oy + 14, 11, 9, colors.fur);
      rect(x + 21, oy + 15, 2, 3, colors.eye);
      rect(x + 27, oy + 18, 3, 3, colors.nose);
      rect(x + 10, oy + 11, 8, 3, colors.light);
      rect(x + 6, oy + 22, 18, 3, team ? colors.red : colors.blue);
      rect(x + 9 + (state === 1 ? (f % 2) * 2 : 0), oy + 25, 5, 3, colors.nose);
      rect(
        x + 21 - (state === 1 ? (f % 2) * 2 : 0),
        oy + 25,
        5,
        3,
        colors.nose,
      );
      if (state === 3) rect(x + 23, oy + 21, 9, 3, colors.outline);
      if (state === 4) rect(x + 8, oy + 15, 3, 2, colors.white);
      if (state === 5) {
        for (let yy = y; yy < y + 32; yy++)
          for (let xx = x; xx < x + 32; xx++) {
            const i = (yy * 512 + xx) * 4;
            png.data[i + 3] = 0;
          }
        rect(x + 7, y + 24, 22, 5, colors.fur);
        rect(x + 10, y + 23, 3, 2, colors.eye);
      }
      frames[
        `capy-${team}-${["idle", "walk", "jump", "shoot", "hurt", "dead"][state]}-${f}`
      ] = { frame: { x, y, w: 32, h: 32 } };
    }
for (let i = 0; i < 12; i++) {
  const x = i * 32,
    y = 144;
  rect(x + 8, y + 8, 16, 16, colors.outline);
  rect(
    x + 9,
    y + 8,
    14,
    14,
    ["#ffb638", "#765344", "#e9e4ba", "#fa8054"][i % 4],
  );
  rect(x + 12, y + 10, 4, 3, colors.white);
  frames[
    [
      "orange",
      "mate",
      "bullet",
      "blast",
      "spark",
      "leaf",
      "grass",
      "soil",
      "stone",
      "heart",
      "wind",
      "crosshair",
    ][i]
  ] = { frame: { x, y, w: 32, h: 32 } };
}
// Terrain tiles: deliberately authored at native resolution.
for (let i = 0; i < 3; i++) {
  const x = i * 32,
    y = 192;
  rect(x, y, 32, 32, ["#6fc96b", "#925d49", "#56746a"][i]);
  for (let j = 0; j < 25; j++)
    rect(
      x + ((j * 13) % 30),
      y + ((j * 7) % 30),
      2,
      2,
      ["#b7e879", "#b87b58", "#779b86"][i],
    );
  frames[["tile-grass", "tile-soil", "tile-stone"][i]] = {
    frame: { x, y, w: 32, h: 32 },
  };
}
fs.writeFileSync(new URL("saltana.png", dir), PNG.sync.write(png));
fs.writeFileSync(
  new URL("saltana.json", dir),
  JSON.stringify(
    {
      frames,
      meta: { image: "saltana.png", size: { w: 512, h: 256 }, scale: "1" },
    },
    null,
    2,
  ),
);
for (let layer = 0; layer < 3; layer++) {
  const bg = new PNG({ width: 640, height: 180 });
  for (let x = 0; x < 640; x++) {
    const top = Math.round(
      100 + Math.sin(x * 0.01 + layer) * 20 + Math.sin(x * 0.04) * 5,
    );
    for (let y = top; y < 180; y++) {
      const i = (y * 640 + x) * 4;
      bg.data.set(
        [
          ...[
            [85, 151, 147],
            [54, 127, 121],
            [37, 98, 94],
          ][layer],
          255,
        ],
        i,
      );
    }
  }
  fs.writeFileSync(new URL(`parallax-${layer}.png`, dir), PNG.sync.write(bg));
}
console.log("Atlas original: 111 frames + 3 capas de paisaje.");
