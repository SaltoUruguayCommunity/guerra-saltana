import http from "node:http";
import { randomBytes } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { createGame, command, step, snapshot } from "../shared/game.ts";
import { DEPLOYMENT_MS } from "../shared/presentation.ts";
import type {
  ClientMessage,
  ServerMessage,
  GameState,
  Team,
} from "../shared/types.ts";
interface Player {
  token: string;
  name: string;
  team: Team;
  ws: WebSocket | null;
}
interface Room {
  code: string;
  public: boolean;
  players: Player[];
  game: GameState;
  started: boolean;
  touched: number;
  startAt: number;
}
const rooms = new Map<string, Room>(),
  clients = new Set<WebSocket>();
const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ service: "Guerra Saltana", rooms: rooms.size }));
});
const allowed = process.env.ALLOWED_ORIGINS?.split(",");
const wss = new WebSocketServer({
  server,
  maxPayload: 2048,
  verifyClient: ({ origin }, done) =>
    done(!allowed || allowed.includes(origin)),
});
const send = (ws: WebSocket | null, data: ServerMessage) => {
  if (ws?.readyState === 1 && ws.bufferedAmount < 1000000)
    ws.send(JSON.stringify(data));
};
const broadcast = (r: Room, data: ServerMessage) =>
  r.players.forEach((p) => send(p.ws, data));
const list = (ws: WebSocket) =>
  send(ws, {
    type: "rooms",
    rooms: [...rooms.values()]
      .filter((r) => r.public && r.players.length === 1 && !r.started)
      .map((r) => ({ code: r.code, name: r.players[0].name })),
  });
function state(r: Room, full = false) {
  broadcast(r, {
    type: "state",
    state: snapshot(r.game),
    ...(full ? { terrain: Array.from(r.game.terrain) } : {}),
    players: r.players.map((p) => ({
      name: p.name,
      connected: p.ws?.readyState === 1,
    })),
    started: r.started,
    deploymentMs: r.started ? Math.max(0, r.startAt - Date.now()) : 0,
  });
}
wss.on("connection", (ws) => {
  clients.add(ws);
  let room: Room | undefined, player: Player | undefined;
  let count = 0,
    windowStart = Date.now();
  ws.on("message", (raw) => {
    try {
      if (Date.now() - windowStart > 1000) {
        count = 0;
        windowStart = Date.now();
      }
      if (++count > 60) return;
      const a = JSON.parse(raw.toString()) as ClientMessage;
      if (!multiplayerAvailable())
        throw Error(
          "Multijugador próximamente: requiere integración de cuentas SaltoPlay verificadas.",
        );
      if (a.type === "list") return list(ws);
      if (a.type === "resume") {
        if (room) throw Error("La conexión ya tiene una sala.");
        const r = rooms.get(String(a.code));
        const p = r?.players.find((p) => p.token === a.token);
        if (!r || !p) throw Error("La sesión ya no está disponible.");
        if (p.ws?.readyState === 1 && p.ws !== ws) p.ws.close();
        room = r;
        player = p;
        p.ws = ws;
        r.touched = Date.now();
        send(ws, {
          type: "joined",
          code: r.code,
          token: p.token,
          team: p.team,
        });
        return state(r, true);
      }
      if (a.type === "create" || a.type === "join") {
        if (room) throw Error("Ya estás en una sala. Recargá para salir.");
        if (a.type === "create") {
          if (rooms.size >= 100) throw Error("Servidor lleno");
          const code = randomBytes(3).toString("hex").toUpperCase();
          room = {
            code,
            public: !!a.public,
            players: [],
            game: createGame(Date.now() % 10000),
            started: false,
            startAt: 0,
            touched: Date.now(),
          };
          rooms.set(code, room);
        } else room = rooms.get(String(a.code).toUpperCase());
        if (!room || room.players.length >= 2) {
          room = undefined;
          throw Error("Sala inexistente o completa.");
        }
        player = {
          token: randomBytes(24).toString("hex"),
          name: String(a.name || "Saltano").slice(0, 20),
          team: room.players.length as Team,
          ws,
        };
        room.players.push(player);
        if (room.players.length === 2) {
          room.started = true;
          room.startAt = Date.now() + DEPLOYMENT_MS;
        }
        send(ws, {
          type: "joined",
          code: room.code,
          token: player.token,
          team: player.team,
        });
        return state(room, true);
      }
      if (
        a.type === "action" &&
        player &&
        player.ws === ws &&
        room?.started &&
        room.players.every((p) => p.ws?.readyState === 1)
      ) {
        if (Date.now() < room.startAt) {
          send(ws, { type: "error", message: "El despliegue sigue en curso." });
          return;
        }
        if (!command(room.game, player.team, a.action))
          send(ws, {
            type: "error",
            message: "Acción inválida o fuera de turno.",
          });
      }
    } catch (e) {
      send(ws, {
        type: "error",
        message: e instanceof Error ? e.message : "Mensaje inválido",
      });
    }
  });
  ws.on("close", () => {
    clients.delete(ws);
    if (room && player?.ws === ws) {
      player.ws = null;
      room.touched = Date.now();
      state(room);
    }
  });
  ws.on("error", () => {});
});
let tick = 0;
setInterval(() => {
  tick++;
  for (const r of rooms.values()) {
    if (
      r.started &&
      Date.now() >= r.startAt &&
      r.players.every((p) => p.ws?.readyState === 1)
    )
      step(r.game);
    if (tick % 3 === 0) state(r, tick % 30 === 0);
    if (
      r.players.every((p) => p.ws?.readyState !== 1) &&
      Date.now() - r.touched > 600000
    )
      rooms.delete(r.code);
  }
}, 1000 / 30);
server.listen(Number(process.env.PORT) || 8787, "0.0.0.0", () =>
  console.log(
    "Guerra Saltana: servidor autoritativo en :" + (process.env.PORT || 8787),
  ),
);

// Keep the server closed until real server-side SaltoPlay identity validation exists.
function multiplayerAvailable(): boolean {
  return false;
}
