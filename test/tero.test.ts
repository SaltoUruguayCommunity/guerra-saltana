import test from "node:test";
import assert from "node:assert/strict";
import type { Projectile } from "../shared/types.ts";
import {
  command,
  createGame,
  nextTurn,
  step,
  teroCooldown,
  TERO_WEAPON,
  W,
} from "../shared/game.ts";

const attack = (targetX = 475) => ({
  type: "fire",
  weapon: TERO_WEAPON,
  angle: -1,
  power: 0.6,
  targetX,
});

test("tero flies to the target before dropping a bomb that damages and digs terrain", () => {
  const state = createGame(6); // No wind on the first turn.
  const terrain = state.terrain.reduce((sum, value) => sum + value, 0);
  assert.equal(command(state, 0, attack()), true);
  assert.equal(state.projectile, null);
  assert.equal(state.airstrike?.dropped, false);
  for (let i = 0; i < 200 && !state.projectile; i++) step(state);
  assert.equal(state.airstrike?.dropped, true);
  const bomb = state.projectile as Projectile | null;
  assert.equal(bomb?.weapon, TERO_WEAPON);
  assert.ok(bomb && Math.abs(bomb.x - 475) < 1);
  for (let i = 0; i < 250 && state.turn === 1; i++) step(state);
  assert.equal(state.turn, 2);
  assert.equal(state.explosions.length, 1);
  assert.ok(state.units.some((unit) => unit.team === 1 && unit.hp < 100));
  assert.ok(state.terrain.reduce((sum, value) => sum + value, 0) < terrain);
});

test("tero cooldown belongs to each team and becomes ready after three own turns", () => {
  const state = createGame();
  assert.equal(command(state, 0, attack()), true);
  nextTurn(state);
  assert.equal(teroCooldown(state), 0);
  assert.equal(command(state, 1, attack(65)), true);
  assert.equal(state.airstrike?.direction, -1);
  assert.ok(state.airstrike!.x > W);
  nextTurn(state);
  assert.equal(teroCooldown(state), 2);
  assert.equal(command(state, 0, attack()), false);
  nextTurn(state);
  assert.equal(teroCooldown(state), 2);
  nextTurn(state);
  assert.equal(teroCooldown(state), 1);
  assert.equal(command(state, 0, attack()), false);
  nextTurn(state);
  nextTurn(state);
  assert.equal(teroCooldown(state), 0);
  assert.equal(command(state, 0, attack()), true);
});

test("tero rejects invalid targets without consuming cooldown and clamps valid coordinates", () => {
  const state = createGame();
  for (const targetX of [NaN, Infinity, undefined, "475"]) {
    assert.equal(command(state, 0, { ...attack(), targetX }), false);
    assert.equal(teroCooldown(state), 0);
    assert.equal(state.phase, "aim");
  }
  assert.equal(command(state, 1, attack()), false);
  assert.equal(command(state, 0, attack(-999)), true);
  assert.equal(state.airstrike?.targetX, 20);
});

test("tero simulation is deterministic and a new match resets the cooldown", () => {
  const first = createGame(42),
    second = createGame(42);
  for (const state of [first, second]) {
    command(state, 0, attack(525));
    for (let i = 0; i < 260; i++) step(state);
  }
  assert.deepEqual(first, second);
  assert.deepEqual(createGame().teroReadyTurn, [0, 0]);
});
