import test from "node:test";
import assert from "node:assert/strict";
import { createGame, command, step, DT } from "../shared/game.ts";
test("rechaza acciones fuera de turno y valores no finitos", () => {
  const s = createGame();
  assert.equal(
    command(s, 1, { type: "fire", angle: -1, power: 1, weapon: 0 }),
    false,
  );
  assert.equal(
    command(s, 0, { type: "fire", angle: NaN, power: 1, weapon: 0 }),
    false,
  );
  assert.equal(s.projectile, null);
});
test("disparo destruye terreno, inflige daño y termina turno", () => {
  const s = createGame();
  const before = s.terrain.reduce((a, b) => a + b, 0);
  assert.ok(
    command(s, 0, { type: "fire", angle: -0.1, power: 0.2, weapon: 1 }),
  );
  for (let i = 0; i < 450 && s.turn === 1; i++) step(s, DT);
  assert.equal(s.turn, 2);
  assert.ok(s.event > 0);
  assert.ok(s.terrain.reduce((a, b) => a + b, 0) < before);
  assert.ok(s.units.some((u) => u.hp < 100));
});
test("simulación repetible con semilla y órdenes iguales", () => {
  const a = createGame(42),
    b = createGame(42);
  for (const s of [a, b]) {
    command(s, 0, { type: "fire", angle: -0.8, power: 0.8, weapon: 0 });
    for (let i = 0; i < 250; i++) step(s);
  }
  assert.deepEqual(a, b);
});
test("tiempo agota turno y eliminación produce victoria", () => {
  const s = createGame();
  s.time = 0.01;
  step(s);
  assert.equal(s.team, 1);
  s.units.filter((u) => u.team === 0).forEach((u) => (u.hp = 0));
  s.time = 0;
  step(s);
  assert.equal(s.phase, "over");
  assert.equal(s.winner, 1);
});
