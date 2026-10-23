import Phaser from "phaser";
import {
  createGame,
  command,
  step,
  active,
  WEAPONS,
  W,
  H,
  DT,
} from "../shared/game.ts";
import type {
  Action,
  Explosion,
  Peer,
  ServerMessage,
} from "../shared/types.ts";
import { Platform } from "./platform";
import { LoadingScreen } from "./loading-screen";
const loading = new LoadingScreen();
import { Deployment } from "./deployment";
const deployment = new Deployment();
import { TurnAnnouncement } from "./turn-announcement";
import { Victory } from "./victory";
const victory = new Victory();
const turnAnnouncement = new TurnAnnouncement();
let syncTurnBaseline = false;
type InputId = "name" | "code" | "public" | "power";
type ButtonId =
  | "login"
  | "local"
  | "restart"
  | "sound"
  | "create"
  | "join"
  | "fire"
  | "fullscreen"
  | "controls"
  | "close-help";
function $<K extends string>(
  id: K,
): K extends InputId
  ? HTMLInputElement
  : K extends ButtonId
    ? HTMLButtonElement
    : HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Falta el elemento #${id}`);
  return element as K extends InputId
    ? HTMLInputElement
    : K extends ButtonId
      ? HTMLButtonElement
      : HTMLElement;
}
const platform = new Platform();
const help = document.getElementById("help") as HTMLDialogElement;
$("controls").onclick = () => help.showModal();
$("close-help").onclick = () => help.close();
$("fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    notice("Este navegador no permite pantalla completa.");
  }
};
let state = createGame();
let mode: "menu" | "local" | "online" = "menu";
let team = 0,
  weapon = 0,
  angle = -0.7,
  power = 0.65,
  joined = false,
  started = false,
  lastEvent = 0,
  terrainEvent = -1,
  mute = true;
let ws: WebSocket | undefined, audio: AudioContext | undefined;
let peers: Peer[] = [];
const notice = (t: string) => ($("notice").textContent = t);
let authInitialization: Promise<void> | undefined;
function updateAccount(name?: string) {
  const connected = platform.session?.authenticated === true;
  $("login").textContent = "CONECTAR CUENTA ↗";
  $("login").hidden = connected;
  $("account").hidden = !connected;
  if (connected) {
    const displayName = platform.profile?.displayName || "Jugador";
    $("account-name").textContent = displayName;
    $("account").title = `${displayName} · SaltoUruguayServer`;
    $("account-initial").textContent = Array.from(displayName)[0]?.toUpperCase() || "J";
    const avatar = $("account-avatar") as HTMLImageElement;
    avatar.hidden = true;
    $("account-initial").hidden = false;
    avatar.onload = () => { avatar.hidden = false; $("account-initial").hidden = true; };
    avatar.onerror = () => { avatar.hidden = true; $("account-initial").hidden = false; };
    const avatarUrl = platform.profile?.avatar;
    if (avatarUrl && /^https?:\/\//i.test(avatarUrl)) {
      if (avatar.getAttribute("src") !== avatarUrl) avatar.src = avatarUrl;
      else if (avatar.complete && avatar.naturalWidth > 0) {
        avatar.hidden = false;
        $("account-initial").hidden = true;
      }
    } else avatar.removeAttribute("src");
  }
  $("login").title = connected
    ? "Cuenta conectada a SaltoUruguayServer"
    : "Conectar cuenta con SaltoUruguayServer";
  $("login").disabled = connected;
  if (name) $("name").value = name;
}
function initializeAccount(): Promise<void> {
  return (authInitialization ??= platform.init().then((name) => {
    updateAccount(name);
  }).catch((error) => {
    authInitialization = undefined;
    throw error;
  }));
}
$("login").onclick = async () => {
  $("login").disabled = true;
  $("login").textContent = "CONECTANDO…";
  try {
    if (!platform.sdk) await initializeAccount();
    if (!platform.session?.authenticated) updateAccount(await platform.login());
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const loginErrors: Record<string, string> = {
      popup_blocked: "El navegador bloqueó la ventana de login. Permití ventanas emergentes para este juego y reintentá.",
      popup_closed: "Cerraste la ventana de login. Podés volver a conectar tu cuenta.",
      popup_timeout: "La ventana de login expiró. Reintentá la conexión.",
      access_denied: "Cancelaste el acceso a tu cuenta.",
    };
    notice(loginErrors[message] || message || "No se pudo conectar la cuenta. Reintentá.");
  } finally {
    updateAccount();
  }
};
function effect(key: string, volume: number) {
  if (scene && !mute && !scene.sound.locked) scene.sound.play(key, { volume });
}
deployment.onTick = () => effect("countdown-tick", 0.55);
function tone(freq = 140, duration = 0.15) {
  if (mute) return;
  audio ??= new AudioContext();
  const o = audio.createOscillator(),
    g = audio.createGain();
  o.type = "square";
  o.frequency.setValueAtTime(freq, audio.currentTime);
  o.frequency.exponentialRampToValueAtTime(35, audio.currentTime + duration);
  g.gain.setValueAtTime(0.06, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
  o.connect(g).connect(audio.destination);
  o.start();
  o.stop(audio.currentTime + duration);
}
$("sound").onclick = () => {
  mute = !mute;
  if (scene) scene.sound.mute = mute;
  $("sound").classList.toggle("sound-on", !mute);
  $("sound").setAttribute("aria-pressed", String(!mute));
  $("sound").textContent = "SONIDO " + (mute ? "OFF" : "ON");
  tone();
};
function act(a: Action) {
  if (deployment.active) return;
  if (document.activeElement instanceof HTMLInputElement || help.open) return;
  if (mode === "local") command(state, state.team, a);
  else if (mode === "online" && started && ws?.readyState === 1)
    ws.send(JSON.stringify({ type: "action", action: a }));
}
function begin() {
  if (deployment.active) return;
  deployment.play(
    () => startLocalMatch(),
    () => scene?.input.keyboard?.resetKeys(),
  );
}
function startLocalMatch() {
  mode = "local";
  joined = false;
  started = true;
  state = createGame(Date.now() % 1000);
  lastTurn = state.turn;
  turnAnnouncement.clear();
  lastEvent = 0;
  terrainEvent = -1;
  $("overlay").classList.add("hidden");
  $("app").classList.remove("is-menu");
  $("connection").textContent = "LOCAL · DOS JUGADORES";
  scene?.resetCamera();
}
$("local").onclick = begin;
$("restart").onclick = () => {
  if (mode === "online") {
    turnAnnouncement.clear();
    sessionStorage.removeItem("saltana-room");
    ws?.close();
    joined = false;
    mode = "menu";
    $("overlay").classList.remove("hidden");
    $("app").classList.add("is-menu");
    scene?.resetCamera();
    notice("Creá una sala nueva para otra partida.");
  } else begin();
};
function connect(onOpen?: () => void) {
  if (!platform.session?.authenticated || !multiplayerAvailable()) {
    notice(
      "Multijugador próximamente. Requerirá una cuenta conectada a SaltoPlay.",
    );
    return;
  }
  if (ws?.readyState === 1) return onOpen?.();
  if (ws?.readyState === 0) return;
  const url =
    import.meta.env.VITE_WS_URL ||
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
  const socket = new WebSocket(url);
  ws = socket;
  socket.onopen = () => {
    const saved = sessionStorage.getItem("saltana-room");
    if (saved && joined)
      socket.send(JSON.stringify({ type: "resume", ...JSON.parse(saved) }));
    else onOpen?.();
    socket.send(JSON.stringify({ type: "list" }));
  };
  ws.onmessage = ({ data }) => {
    const m = JSON.parse(data) as ServerMessage;
    if (m.type === "joined") {
      syncTurnBaseline = true;
      turnAnnouncement.clear();
      joined = true;
      mode = "online";
      team = m.team;
      lastEvent = 0;
      terrainEvent = -1;
      sessionStorage.setItem(
        "saltana-room",
        JSON.stringify({ code: m.code, token: m.token }),
      );
      $("connection").textContent = `SALA ${m.code} · EQUIPO ${team + 1}`;
      notice(`Código ${m.code}. Compartilo con tu rival. Esperando conexión…`);
    }
    if (m.type === "state") {
      const wasStarted = started;
      const old = state.terrain;
      state = {
        ...m.state,
        terrain: m.terrain ? Uint8Array.from(m.terrain) : old,
      };
      if (syncTurnBaseline) {
        lastTurn = state.turn;
        syncTurnBaseline = false;
      }
      if (m.terrain) terrainEvent = -1;
      else
        for (const e of state.explosions) if (e.id > lastEvent) cutTerrain(e);
      started = m.started;
      peers = m.players;
      if (started) {
        const reveal = () => {
          $("overlay").classList.add("hidden");
          $("app").classList.remove("is-menu");
          scene?.resetCamera();
        };
        if (!wasStarted && (m.deploymentMs ?? 0) > 0)
          deployment.play(
            reveal,
            () => scene?.input.keyboard?.resetKeys(),
            m.deploymentMs,
          );
        else if (!deployment.active) {
          $("overlay").classList.add("hidden");
          $("app").classList.remove("is-menu");
        }
      }
      if (peers.some((p) => !p.connected))
        $("connection").textContent = "RIVAL DESCONECTADO · PARTIDA PAUSADA";
    }
    if (m.type === "error") {
      notice(m.message);
      if (!started) {
        joined = false;
        sessionStorage.removeItem("saltana-room");
      }
    }
    if (m.type === "rooms") {
      $("rooms").replaceChildren();
      for (const r of m.rooms) {
        const b = document.createElement("button");
        b.textContent = `${r.name} · ${r.code} →`;
        b.onclick = () => join(r.code);
        $("rooms").append(b);
      }
    }
  };
  ws.onclose = () => {
    if (joined) {
      $("connection").textContent = "RECONECTANDO · PARTIDA PAUSADA";
      setTimeout(() => connect(), 1500);
    }
  };
  ws.onerror = () =>
    notice(
      "Servidor no disponible. Ejecutá pnpm run dev o configurá VITE_WS_URL.",
    );
}
function cutTerrain(e: Explosion) {
  for (
    let y = Math.max(0, Math.floor(e.y - e.r));
    y < Math.min(H, e.y + e.r);
    y++
  )
    for (
      let x = Math.max(0, Math.floor(e.x - e.r));
      x < Math.min(W, e.x + e.r);
      x++
    )
      if ((x - e.x) ** 2 + (y - e.y) ** 2 < e.r ** 2)
        state.terrain[y * W + x] = 0;
}
function join(code: string) {
  connect(() =>
    ws?.send(JSON.stringify({ type: "join", code, name: $("name").value })),
  );
}
$("create").onclick = () =>
  connect(() =>
    ws?.send(
      JSON.stringify({
        type: "create",
        public: $("public").checked,
        name: $("name").value,
      }),
    ),
  );
$("join").onclick = () => join($("code").value.toUpperCase());
sessionStorage.removeItem("saltana-room");
function multiplayerAvailable(): boolean {
  return false;
}
document.querySelectorAll<HTMLButtonElement>("[data-weapon]").forEach(
  (b) =>
    (b.onclick = () => {
      weapon = Number(b.dataset.weapon);
      document
        .querySelectorAll<HTMLButtonElement>("[data-weapon]")
        .forEach((x) => x.classList.toggle("selected", x === b));
    }),
);
function setPower(value: number) {
  power = Phaser.Math.Clamp(value, 0.2, 1);
  const percent = Math.round(power * 100);
  $("power").value = String(percent);
  $("power-value").textContent = percent + "%";
}
$("power").oninput = () => setPower(Number($("power").value) / 100);
const powerKeys = new Set<string>();
function canAdjustPower() {
  const focused = document.activeElement;
  const editing =
    focused instanceof HTMLTextAreaElement ||
    focused instanceof HTMLSelectElement ||
    (focused instanceof HTMLElement && focused.isContentEditable) ||
    (focused instanceof HTMLInputElement &&
      !["range", "checkbox", "button"].includes(focused.type));
  return (
    !deployment.active &&
    mode !== "menu" &&
    state.phase === "aim" &&
    (mode === "local" ||
      (team === state.team && started && peers.every((p) => p.connected))) &&
    !help.open &&
    !editing
  );
}
window.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.altKey || event.metaKey || !canAdjustPower())
    return;
  const key = event.key.toLowerCase();
  if (key === "q" || key === "e") {
    event.preventDefault();
    powerKeys.add(event.code);
    if (!event.repeat) setPower(power + (key === "e" ? 0.01 : -0.01));
  } else if (["+", "=", "-", "_"].includes(key)) {
    event.preventDefault();
    setPower(
      power +
        (key === "+" || key === "=" ? 1 : -1) * (event.shiftKey ? 0.05 : 0.01),
    );
  }
});
window.addEventListener("keyup", (event) => powerKeys.delete(event.code));
window.addEventListener("blur", () => powerKeys.clear());
function fire() {
  if (mode === "menu") return;
  act({ type: "fire", angle, power, weapon });
  tone(260, 0.13);
}
$("fire").onclick = fire;
const touch: Record<string, boolean> = {};
document.querySelectorAll<HTMLButtonElement>("[data-key]").forEach((b) => {
  b.onpointerdown = (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    touch[b.dataset.key!] = true;
    if (b.dataset.key === "jump") act({ type: "jump" });
  };
  b.onpointerup = b.onpointercancel = () => (touch[b.dataset.key!] = false);
});
let scene: Battle | undefined;
let acc = 0,
  lastDir = 0,
  won = false,
  lastTurn = 1;
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: number;
}
class Battle extends Phaser.Scene {
  visuals = new Map<number, { hp: number; hurtUntil: number }>();
  shootingUntil = 0;
  previousPhase = state.phase;
  backdrop!: Phaser.GameObjects.Image;
  baseZoom = 1;
  soilPixels!: Uint8ClampedArray;
  land!: Phaser.Textures.CanvasTexture;
  people: Phaser.GameObjects.Sprite[] = [];
  labels: Phaser.GameObjects.Text[] = [];
  fx!: Phaser.GameObjects.Graphics;
  hud!: Phaser.GameObjects.Text;
  keys!: Record<
    "A" | "D" | "W" | "LEFT" | "RIGHT" | "UP" | "DOWN" | "SPACE",
    Phaser.Input.Keyboard.Key
  >;
  parts: Particle[] = [];
  preload() {
    loading.update(10, "Abriendo el arsenal…");
    this.load.on("progress", (progress: number) =>
      loading.update(10 + progress * 80),
    );
    this.load.on("loaderror", (file: Phaser.Loader.File) =>
      loading.fail(
        `No se pudo cargar ${file.key}. Revisá la conexión y reintentá.`,
      ),
    );
    this.load.once("complete", () => {
      loading.check("assets");
      loading.update(90, "Preparando el terreno…");
    });
    this.load.atlas(
      "soldiers",
      "assets/capy-atlas-v2.png",
      "assets/capy-atlas-v2.json",
    );
    this.load.image("coast", "assets/costanera-v2.png");
    this.load.image("river", "assets/river-v2.png");
    this.load.image("soil", "assets/soil-v2.png");
    this.load.atlas("ui", "assets/ui-atlas.png", "assets/ui-atlas.json");
    this.load.audio("turn-whistle", "audio/turn-change.mp3");
    this.load.audio("countdown-tick", "audio/countdown-tick.mp3");
    this.load.audio("explosion", "audio/explosion.mp3");
    this.load.audio("damage-hit", "audio/damage-hit.mp3");
    this.load.audio("victory", "audio/victory.mp3");
  }
  create() {
    loading.update(95, "Ubicando la brigada…");
    scene = this;
    this.sound.mute = mute;
    this.cameras.main.roundPixels = true;
    for (const key of ["soldiers", "coast", "river", "soil", "ui"])
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.paintBackground();
    for (let t = 0; t < 2; t++)
      for (const name of ["idle", "walk", "jump", "shoot", "hurt", "dead"])
        this.anims.create({
          key: `${t}-${name}`,
          frames: (name === "walk"
            ? [1, 0, 2, 0]
            : name === "jump"
              ? [3]
              : name === "shoot"
                ? [4]
                : name === "hurt" || name === "dead"
                  ? [5]
                  : [0]
          ).map((i) => ({ key: "soldiers", frame: `soldier-${t}-${i}` })),
          frameRate: name === "walk" ? 10 : 4,
          repeat: -1,
        });
    const land = this.textures.createCanvas("land", W, H);
    if (!land) throw Error("No se pudo crear el terreno");
    this.land = land;
    this.land.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.add.image(0, 0, "land").setName("terrain").setOrigin(0).setDepth(2);
    this.add
      .tileSprite(W / 2, H + 512, W, 1024, "soil")
      .setName("foundation")
      .setDepth(1);
    this.people = state.units.map((u) =>
      this.add
        .sprite(u.x, u.y + 12, "soldiers", `soldier-${u.team}-0`)
        .setOrigin(0.5, 1)
        .setDisplaySize(48, 48)
        .setDepth(4),
    );
    this.labels = state.units.map((u) =>
      this.add
        .text(0, 0, "", {
          fontFamily: '"Press Start 2P"',
          fontSize: "8px",
          align: "center",
          lineSpacing: 2,
          color: "#fff3d3",
          backgroundColor: "#17363dcc",
          padding: { x: 3, y: 2 },
        })
        .setOrigin(0.5)
        .setDepth(5),
    );
    this.fx = this.add.graphics().setDepth(6);
    this.hud = this.add
      .text(320, 28, "", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#fff1c7",
        backgroundColor: "#173b42cc",
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setDepth(9)
      .setScrollFactor(0);
    const keyboard = this.input.keyboard;
    if (!keyboard) throw Error("Teclado no disponible");
    this.keys = keyboard.addKeys(
      "A,D,W,LEFT,RIGHT,UP,DOWN,SPACE",
    ) as Battle["keys"];
    keyboard.addCapture(["SPACE", "UP", "DOWN", "LEFT", "RIGHT"]);
    keyboard.on("keydown-SPACE", (e: KeyboardEvent) => {
      if (!e.repeat) fire();
    });
    keyboard.on("keydown-W", (e: KeyboardEvent) => {
      if (!e.repeat) act({ type: "jump" });
    });
    keyboard.on("keydown", (e: KeyboardEvent) => {
      if (["1", "2", "3"].includes(e.key)) {
        const button = document.querySelector<HTMLButtonElement>(
          `[data-weapon="${Number(e.key) - 1}"]`,
        );
        button?.click();
      }
    });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.aim(p));
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (p.isDown || !p.wasTouch) this.aim(p);
    });
    this.parts = [];
    this.scale.on("resize", () => this.resizeViewport());
    this.resizeViewport();
    this.drawTerrain();
    this.game.events.once(Phaser.Core.Events.POST_RENDER, () =>
      loading.finish(),
    );
  }
  resetCamera() {
    victory.clear();
    this.sound.stopByKey("victory");
    this.cameras.main.setZoom(this.baseZoom);
    this.cameras.main.centerOn(320, 180);
    won = false;
  }
  aim(p: Phaser.Input.Pointer) {
    const world = this.cameras.main.getWorldPoint(p.x, p.y),
      u = active(state);
    angle = Phaser.Math.Clamp(
      Math.atan2(Math.min(-2, world.y - u.y), world.x - u.x),
      -Math.PI,
      -0.02,
    );
  }
  resizeViewport() {
    const camera = this.cameras.main;
    const fit = Math.min(this.scale.width / 640, this.scale.height / 400);
    this.baseZoom = fit >= 2 ? Math.floor(fit) : fit;
    camera.setZoom(this.baseZoom).centerOn(320, 180);
    const worldWidth = camera.width / this.baseZoom,
      worldHeight = camera.height / this.baseZoom;
    const cover = Math.max(worldWidth / 1280, worldHeight / 720);
    this.backdrop
      .setDisplaySize(1280 * cover, 720 * cover)
      .setPosition(320, 180);
    this.hud?.setPosition(
      camera.width / 2,
      Math.max(125, camera.height * 0.26),
    );
  }
  paintBackground() {
    this.backdrop = this.add.image(320, 180, "coast").setDepth(-10);
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 144;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Canvas no disponible");
    ctx.drawImage(
      this.textures.get("soil").getSourceImage() as HTMLImageElement,
      0,
      0,
    );
    this.soilPixels = ctx.getImageData(0, 0, 640, 144).data;
  }
  drawTerrain() {
    const ctx = this.land.context,
      img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!state.terrain[y * W + x]) continue;
        const top = !state.terrain[Math.max(0, y - 2) * W + x];
        const soil = ((y % 144) * 640 + x) * 4,
          index = (y * W + x) * 4;
        const light = (x * 19 + y * 7) % 11;
        if (top)
          img.data.set(
            [83 + light * 3, 110 + light * 3, 48 + light, 255],
            index,
          );
        else
          img.data.set(
            [
              this.soilPixels[soil],
              this.soilPixels[soil + 1],
              this.soilPixels[soil + 2],
              255,
            ],
            index,
          );
      }
    ctx.putImageData(img, 0, 0);
    this.land.refresh();
    terrainEvent = state.event;
  }
  update(_time: number, delta: number) {
    if (canAdjustPower()) {
      const direction =
        Number(powerKeys.has("KeyE")) - Number(powerKeys.has("KeyQ"));
      if (direction)
        setPower(power + direction * Math.min(delta, 100) * 0.0003);
    } else powerKeys.clear();
    const menu = mode === "menu";
    this.fx.setVisible(!menu);
    if (state.phase === "flight" && this.previousPhase !== "flight")
      this.shootingUntil = _time + 350;
    this.previousPhase = state.phase;
    this.backdrop.setTexture(menu ? "coast" : "river");
    this.people.forEach((p) => p.setVisible(!menu));
    this.labels.forEach((p) => p.setVisible(!menu && state.phase !== "over"));
    const terrain = this.children.getByName(
      "terrain",
    ) as Phaser.GameObjects.Image | null;
    terrain?.setVisible(!menu);
    const foundation = this.children.getByName(
      "foundation",
    ) as Phaser.GameObjects.TileSprite | null;
    foundation?.setVisible(!menu);
    if (this.input.keyboard)
      this.input.keyboard.enabled =
        !deployment.active &&
        !(document.activeElement instanceof HTMLInputElement) &&
        !help.open;
    for (const [id, t] of [
      ["blue", 0],
      ["orange", 1],
    ] as const) {
      const hp = state.units
        .filter((u) => u.team === t)
        .reduce((sum, u) => sum + u.hp, 0);
      $(id + "-health").textContent = hp + " PV";
      $(id + "-bar").style.width = hp / 3 + "%";
    }
    acc += Math.min(delta / 1000, 0.1);
    if (mode === "local" && !deployment.active)
      while (acc >= DT) {
        step(state);
        acc -= DT;
      }
    else acc = 0;
    if (state.event !== terrainEvent) this.drawTerrain();
    const u = active(state),
      mine = mode === "local" || team === state.team;
    const dir =
      mine && state.phase === "aim"
        ? (this.keys.D.isDown || this.keys.RIGHT.isDown || touch.right
            ? 1
            : 0) -
          (this.keys.A.isDown || this.keys.LEFT.isDown || touch.left ? 1 : 0)
        : 0;
    if (dir !== lastDir) {
      act({ type: "move", dir });
      lastDir = dir;
    }
    if (mine) {
      if (this.keys.UP.isDown || touch.up)
        angle = Math.max(-Math.PI, angle - delta * 0.001);
      if (this.keys.DOWN.isDown || touch.down)
        angle = Math.min(-0.01, angle + delta * 0.001);
    }
    if (state.turn !== lastTurn) {
      const forward = state.turn > lastTurn;
      angle = state.team ? -2.4 : -0.7;
      lastTurn = state.turn;
      if (
        forward &&
        mode !== "menu" &&
        !deployment.active &&
        state.phase !== "over"
      ) {
        turnAnnouncement.show(state.turn, state.team);
        if (!mute && !this.sound.locked)
          this.sound.play("turn-whistle", { volume: 0.7 });
      }
    }
    this.fx.clear();
    for (let i = 0; i < state.units.length; i++) {
      const c = state.units[i],
        sprite = this.people[i];
      let visual = this.visuals.get(c.id);
      if (!visual) {
        visual = { hp: c.hp, hurtUntil: 0 };
        this.visuals.set(c.id, visual);
      }
      if (c.hp < visual.hp) {
        visual.hurtUntil = _time + 450;
        if (
          mode !== "menu" &&
          !deployment.active &&
          !this.sound.getAll("damage-hit").some((sound) => sound.isPlaying)
        )
          effect("damage-hit", 0.45);
      }
      visual.hp = c.hp;
      const animation =
        c.hp <= 0
          ? "dead"
          : visual.hurtUntil > _time
            ? "hurt"
            : c.id === state.active && this.shootingUntil > _time
              ? "shoot"
              : c.anim;
      sprite
        .setPosition(
          Math.round(c.x),
          Math.round(c.y + 12) +
            (animation === "idle" ? Math.floor(_time / 450 + c.id) % 2 : 0),
        )
        .setFlipX(c.face < 0)
        .setAlpha(c.hp > 0 ? 1 : 0.45);
      sprite.play(`${c.team}-${animation}`, true);
      if (visual.hurtUntil > _time && Math.floor(_time / 70) % 2 === 0)
        sprite.setTintFill(0xffe2bc);
      else sprite.clearTint();
      sprite.setAngle(c.hp <= 0 ? -85 : 0);
      this.labels[i]
        .setPosition(c.x, c.y - 53)
        .setText(
          c.hp > 0
            ? `${["CEBO", "TERMO", "ÑATO", "CHINA", "TOTO", "BRASA"][i]}\n${c.hp}`
            : "✕",
        );
      if (c.hp > 0) {
        this.fx.fillStyle(0x17383c);
        this.fx.fillRect(c.x - 12, c.y - 38, 24, 3);
        this.fx.fillStyle(c.team ? 0xf68c64 : 0x6de0cb);
        this.fx.fillRect(c.x - 12, c.y - 38, (24 * c.hp) / 100, 2);
      }
    }
    if (state.phase === "aim" && mode !== "menu") {
      this.fx.lineStyle(1, 0xffefb0, 0.6);
      let px = u.x,
        py = u.y - 5,
        vx = Math.cos(angle) * WEAPONS[weapon].speed * power,
        vy = Math.sin(angle) * WEAPONS[weapon].speed * power;
      for (let i = 0; i < 24; i++) {
        vx += state.wind * 0.06;
        vy += WEAPONS[weapon].gravity * 0.06;
        px += vx * 0.06;
        py += vy * 0.06;
        if (i % 2 === 0)
          this.fx
            .fillStyle(0xffedb5, 0.7)
            .fillRect(Math.round(px), Math.round(py), 2, 2);
      }
      this.fx.fillStyle(0xffd36c);
      this.fx.fillTriangle(u.x - 4, u.y - 76, u.x + 4, u.y - 76, u.x, u.y - 70);
    }
    if (state.projectile) {
      const p = state.projectile;
      this.fx.fillStyle(0xfff0b9).fillCircle(p.x, p.y, 4);
      this.fx
        .fillStyle(weapon === 1 ? 0x775039 : 0xffa839)
        .fillCircle(p.x, p.y, 3);
    }
    for (const e of state.explosions)
      if (e.id > lastEvent) {
        if (mode !== "menu" && !deployment.active) effect("explosion", 0.22);
        this.cameras.main.shake(200, 0.006);
        for (let i = 0; i < 32; i++)
          this.parts.push({
            x: e.x,
            y: e.y,
            vx: Math.cos(i * 2.4) * (20 + i * 2),
            vy: Math.sin(i * 2.4) * (20 + i * 2) - 30,
            life: 0.6 + (i % 4) * 0.15,
            color: [0xffd272, 0xfff2b5, 0xf17c49, 0x8c6349][i % 4],
          });
      }
    lastEvent = state.event;
    for (const p of this.parts) {
      p.life -= delta / 1000;
      p.vy += (100 * delta) / 1000;
      p.x += (p.vx * delta) / 1000;
      p.y += (p.vy * delta) / 1000;
      this.fx
        .fillStyle(p.color, Math.min(1, p.life * 2))
        .fillRect(Math.round(p.x), Math.round(p.y), 3, 3);
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    const target = state.projectile;
    if (
      state.phase === "over" &&
      state.winner !== null &&
      state.winner !== -1
    ) {
      const survivors = state.units.filter(
        (unit) => unit.team === state.winner && unit.hp > 0,
      );
      if (survivors.length) {
        const left = Math.min(...survivors.map((unit) => unit.x)) - 50;
        const right = Math.max(...survivors.map((unit) => unit.x)) + 50;
        const top = Math.min(...survivors.map((unit) => unit.y)) - 85;
        const bottom = Math.max(...survivors.map((unit) => unit.y)) + 35;
        const zoom = Math.min(
          this.baseZoom * 1.65,
          (this.cameras.main.width * 0.8) / (right - left),
          (this.cameras.main.height * 0.45) / (bottom - top),
        );
        const ease = matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 1
          : 1 - Math.exp(-delta / 400);
        const halfWidth = this.cameras.main.width / zoom / 2;
        const centerX =
          halfWidth < W / 2
            ? Phaser.Math.Clamp((left + right) / 2, halfWidth, W - halfWidth)
            : W / 2;
        this.cameras.main.setZoom(
          Phaser.Math.Linear(this.cameras.main.zoom, zoom, ease),
        );
        this.cameras.main.centerOn(
          Phaser.Math.Linear(this.cameras.main.midPoint.x, centerX, ease),
          Phaser.Math.Linear(
            this.cameras.main.midPoint.y,
            (top + bottom) / 2 - 20,
            ease,
          ),
        );
      }
    } else if (target && target.x > 110 && target.x < 530) {
      this.cameras.main.setZoom(
        Phaser.Math.Linear(this.cameras.main.zoom, this.baseZoom * 1.08, 0.03),
      );
      this.cameras.main.centerOn(
        Phaser.Math.Linear(this.cameras.main.midPoint.x, target.x, 0.04),
        180,
      );
    } else {
      this.cameras.main.setZoom(
        Phaser.Math.Linear(this.cameras.main.zoom, this.baseZoom, 0.05),
      );
      this.cameras.main.centerOn(320, 180);
    }
    $("battle-message").hidden = !(
      !menu &&
      state.phase !== "over" &&
      (state.phase === "flight" ||
        state.phase === "settle" ||
        (mode === "online" && peers.some((p) => !p.connected)))
    );
    this.hud.setVisible(false);
    this.hud.setText(
      mode === "menu"
        ? "LA BATALLA DEL LITORAL"
        : state.phase === "over"
          ? state.winner === -1
            ? "EMPATE"
            : `VICTORIA ${state.winner ? "CÍTRICA" : "CELESTE"} · NUEVA PARTIDA ABAJO`
          : mode === "online" && peers.some((p) => !p.connected)
            ? "PAUSA · ESPERANDO RECONEXIÓN"
            : `TURNO ${state.turn}  ·  ${state.team ? "CÍTRICOS" : "CELESTES"}  ·  ${state.phase === "flight" ? "¡AHÍ VA!" : state.phase === "settle" ? "IMPACTO" : mine ? "TU TURNO" : "TURNO RIVAL"}`,
    );
    $("battle-message").textContent = this.hud.text;
    $("turn-label").textContent =
      `TURNO ${String(state.turn).padStart(2, "0")} / ${mode === "online" ? peers[state.team]?.name || "Esperando" : "PARTIDA LOCAL"}`;
    $("turn-name").textContent = state.team ? "Los Cítricos" : "Los Celestes";
    $("timer").textContent = Math.ceil(state.time) + " s";
    $("wind").textContent =
      `VIENTO ${state.wind < 0 ? "←" : "→"} ${Math.abs(state.wind).toFixed(0)} km/h`;
    $("wind").classList.toggle("wind-left", state.wind < 0);
    $("fire").disabled =
      deployment.active ||
      mode === "menu" ||
      !mine ||
      state.phase !== "aim" ||
      (mode === "online" && (!started || peers.some((p) => !p.connected)));
    if (state.phase === "over" && !won) {
      won = true;
      turnAnnouncement.clear();
      victory.show(state);
      if (state.winner !== -1 && state.winner !== null) effect("victory", 0.55);
      platform.save(state.winner).catch((e) => {
        this.hud.setText("No se pudo guardar el resultado local: " + e.message);
      });
    }
  }
}
async function startGame() {
  try {
    await document.fonts.load('8px "Press Start 2P"');
    loading.check("font");
  } catch {
    loading.fail("No se pudo cargar la fuente local. Reintentá la carga.");
    return;
  }
  try {
    new Phaser.Game({
      type: Phaser.AUTO,
      parent: "game",
      width: W,
      height: H,
      pixelArt: true,
      roundPixels: true,
      antialias: false,
      transparent: true,
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: Battle,
      render: { pixelArt: true, roundPixels: true, antialias: false },
      audio: { noAudio: false },
    });
  } catch {
    loading.fail(
      "No se pudo iniciar el juego. Comprobá que Canvas o WebGL estén disponibles.",
    );
  }
}
if (!window.SaltoPlay?.isOAuthCallback) {
  void startGame();
  void initializeAccount().catch((error) => {
    updateAccount();
    notice(error instanceof Error ? error.message : "No se pudo conectar la cuenta. Reintentá.");
  });
}
