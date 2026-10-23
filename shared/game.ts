import type {
  GameState,
  GameSnapshot,
  Unit,
  Weapon,
  Projectile,
  Team,
} from "./types.ts";
export const W = 640,
  H = 360,
  DT = 1 / 30;
export const WEAPONS: readonly Weapon[] = [
  {
    name: "Naranjazo",
    damage: 42,
    radius: 27,
    speed: 210,
    gravity: 115,
    bounce: 0,
  },
  {
    name: "Mate bomba",
    damage: 62,
    radius: 37,
    speed: 165,
    gravity: 130,
    bounce: 0.55,
  },
  {
    name: "Chumbo",
    damage: 28,
    radius: 16,
    speed: 320,
    gravity: 65,
    bounce: 0,
  },
  {
    name: "Tero-Bomba",
    damage: 70,
    radius: 40,
    speed: 0,
    gravity: 150,
    bounce: 0,
    cooldown: 3,
  },
];
export const TERO_WEAPON = 3;
export function teroCooldown(s: GameState, team = s.team): number {
  return Math.max(0, Math.ceil((s.teroReadyTurn[team] - s.turn) / 2));
}
export function groundHeight(x: number) {
  return Math.round(
    241 +
      17 * Math.sin(x * 0.015) +
      11 * Math.sin(x * 0.039) +
      6 * Math.cos(x * 0.073),
  );
}
export function createGame(seed = 123): GameState {
  const terrain = new Uint8Array(W * H);
  for (let x = 0; x < W; x++)
    for (let y = groundHeight(x); y < H; y++) terrain[y * W + x] = 1;
  const units: Unit[] = [];
  for (let team = 0; team < 2; team++)
    for (let i = 0; i < 3; i++) {
      const x = team ? 475 + i * 48 : 65 + i * 48;
      units.push({
        id: team * 3 + i,
        team: team as Team,
        x,
        y: groundHeight(x) - 10,
        vx: 0,
        vy: 0,
        hp: 100,
        face: team ? -1 : 1,
        anim: "idle",
      });
    }
  return {
    terrain,
    units,
    active: 0,
    team: 0,
    turn: 1,
    time: 45,
    wind: ((seed % 13) - 6) * 2,
    seed,
    phase: "aim",
    projectile: null,
    airstrike: null,
    teroReadyTurn: [0, 0],
    explosions: [],
    event: 0,
    winner: null,
    travel: 0,
    tick: 0,
    settle: 0,
  };
}
export function solid(s: GameState, x: number, y: number) {
  x = Math.floor(x);
  y = Math.floor(y);
  return x >= 0 && x < W && y >= 0 && y < H && s.terrain[y * W + x] === 1;
}
export function active(s: GameState): Unit {
  return s.units[s.active];
}
export function command(s: GameState, team: number, input: unknown) {
  if (
    s.phase !== "aim" ||
    team !== s.team ||
    !input ||
    typeof input !== "object"
  )
    return false;
  const a = input as Record<string, unknown>;
  const u = active(s);
  if (a.type === "move") {
    if (typeof a.dir !== "number" || ![-1, 0, 1].includes(a.dir)) return false;
    u.vx = a.dir * 35;
    u.face = a.dir || u.face;
    return true;
  }
  if (a.type === "jump") {
    if (Math.abs(u.vy) < 0.1 && solid(s, u.x, u.y + 11)) u.vy = -69;
    return true;
  }
  if (a.type === "fire") {
    if (
      typeof a.angle !== "number" ||
      typeof a.power !== "number" ||
      typeof a.weapon !== "number" ||
      !Number.isFinite(a.angle) ||
      !Number.isFinite(a.power) ||
      !Number.isInteger(a.weapon) ||
      !WEAPONS[a.weapon]
    )
      return false;
    if (a.weapon === TERO_WEAPON) {
      if (teroCooldown(s) > 0 || typeof a.targetX !== "number" || !Number.isFinite(a.targetX)) return false;
      const direction = s.team === 0 ? 1 : -1;
      s.airstrike = {
        x: direction === 1 ? -48 : W + 48,
        y: 48,
        targetX: Math.max(20, Math.min(W - 20, a.targetX)),
        direction,
        age: 0,
        dropped: false,
      };
      s.teroReadyTurn[s.team] = s.turn + WEAPONS[TERO_WEAPON].cooldown! * 2;
      u.vx = 0;
      u.anim = "shoot";
      s.phase = "flight";
      return true;
    }
    const angle = Math.max(-Math.PI, Math.min(0, a.angle));
    const weapon = WEAPONS[a.weapon],
      speed = weapon.speed * Math.max(0.2, Math.min(1, a.power));
    u.vx = 0;
    u.anim = "shoot";
    s.projectile = {
      x: u.x + Math.cos(angle) * 14,
      y: u.y - 5 + Math.sin(angle) * 14,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      weapon: a.weapon,
      age: 0,
      bounces: 0,
    };
    s.phase = "flight";
    return true;
  }
  return false;
}
function explode(s: GameState, p: Projectile) {
  const w = WEAPONS[p.weapon];
  s.explosions.push({
    x: p.x,
    y: p.y,
    r: w.radius,
    id: ++s.event,
    tick: s.tick,
  });
  s.explosions = s.explosions.slice(-12);
  for (
    let y = Math.max(0, Math.floor(p.y - w.radius));
    y < Math.min(H, p.y + w.radius);
    y++
  )
    for (
      let x = Math.max(0, Math.floor(p.x - w.radius));
      x < Math.min(W, p.x + w.radius);
      x++
    )
      if ((x - p.x) ** 2 + (y - p.y) ** 2 < w.radius ** 2)
        s.terrain[y * W + x] = 0;
  for (const u of s.units) {
    if (u.hp <= 0) continue;
    const d = Math.hypot(u.x - p.x, u.y - p.y);
    if (d < w.radius + 19) {
      u.hp = Math.max(
        0,
        u.hp - Math.round(w.damage * (1 - d / (w.radius + 23))),
      );
      u.vy = -35;
      u.anim = "hurt";
    }
  }
  s.projectile = null;
  s.phase = "settle";
  s.settle = 1.6;
}
export function nextTurn(s: GameState) {
  const alive = [0, 1].filter((t) =>
    s.units.some((u) => u.team === t && u.hp > 0),
  );
  if (alive.length < 2) {
    s.phase = "over";
    s.winner = (alive[0] ?? -1) as Team | -1;
    return;
  }
  const old = s.active;
  s.team = s.team === 0 ? 1 : 0;
  let candidate = (old + 1) % 3;
  for (let i = 0; i < 3; i++) {
    const id = s.team * 3 + ((candidate + i) % 3);
    if (s.units[id].hp > 0) {
      s.active = id;
      break;
    }
  }
  s.turn++;
  s.time = 45;
  s.travel = 0;
  s.wind = (((s.seed + s.turn * 7) % 19) - 9) * 1.5;
  s.phase = "aim";
  s.airstrike = null;
  for (const u of s.units) u.vx = 0;
}
export function step(s: GameState, dt = DT) {
  if (s.phase === "over") return;
  s.tick++;
  if (s.airstrike) {
    const bird = s.airstrike;
    bird.age += dt;
    bird.x += bird.direction * 200 * dt;
    if (!bird.dropped && (bird.x - bird.targetX) * bird.direction >= 0) {
      bird.dropped = true;
      s.projectile = { x: bird.targetX, y: bird.y + 16, vx: 0, vy: 25, weapon: TERO_WEAPON, age: 0, bounces: 0 };
    }
    if (bird.x < -80 || bird.x > W + 80) s.airstrike = null;
  }
  for (const u of s.units) {
    if (u.hp <= 0) {
      u.anim = "dead";
      continue;
    }
    u.vy += 120 * dt;
    const dx = u.vx * dt;
    if (u.id === s.active && s.phase === "aim" && s.travel < 85 && dx) {
      const nx = Math.max(8, Math.min(W - 8, u.x + dx));
      let lift = 0;
      while (lift < 5 && solid(s, nx, u.y + 8 - lift)) lift++;
      if (lift < 5 && !solid(s, nx, u.y - 8 - lift)) {
        u.x = nx;
        u.y -= lift;
        s.travel += Math.abs(dx);
      }
    }
    u.y += u.vy * dt;
    if (u.vy >= 0 && solid(s, u.x, u.y + 10)) {
      let n = 0;
      while (solid(s, u.x, u.y + 9) && n++ < 30) u.y--;
      u.vy = 0;
    }
    if (u.y > H - 9) u.hp = 0;
    u.anim =
      u.hp <= 0
        ? "dead"
        : Math.abs(u.vy) > 1
          ? "jump"
          : u.vx && s.phase === "aim"
            ? "walk"
            : "idle";
  }
  if (s.phase === "aim") {
    s.time -= dt;
    if (active(s).hp <= 0 || s.time <= 0) nextTurn(s);
  }
  if (s.phase === "flight" && s.projectile) {
    const p = s.projectile,
      w = WEAPONS[p.weapon];
    for (let i = 0; i < 4 && s.projectile; i++) {
      const sub = dt / 4;
      p.age += sub;
      p.vx += s.wind * sub;
      p.vy += w.gravity * sub;
      p.x += p.vx * sub;
      p.y += p.vy * sub;
      if (solid(s, p.x, p.y)) {
        if (w.bounce && p.bounces < 3 && p.age < 2.6) {
          p.y -= 4;
          p.vy = -Math.abs(p.vy) * w.bounce;
          p.vx *= 0.7;
          p.bounces++;
        } else explode(s, p);
      } else if (
        p.age > 6 ||
        p.x < 0 ||
        p.x > W ||
        p.y > H ||
        s.units.some(
          (u) =>
            u.hp > 0 &&
            u.id !== s.active &&
            Math.hypot(u.x - p.x, u.y - p.y) < 10,
        )
      )
        explode(s, p);
    }
  }
  if (s.phase === "settle") {
    s.settle -= dt;
    if (s.settle <= 0) nextTurn(s);
  }
}
export function snapshot(s: GameState): GameSnapshot {
  return { ...s, terrain: undefined };
}
