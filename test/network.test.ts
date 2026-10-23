import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { WebSocket } from "ws";
import type { ServerMessage } from "../shared/types.ts";

test("multijugador cerrado mientras SaltoPlay no está operativo", async () => {
  const server = spawn(
    process.execPath,
    ["--import", "tsx", "server/index.ts"],
    {
      env: { ...process.env, PORT: "18787" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let socket: WebSocket | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      server.stdout!.once("data", () => resolve());
      server.once("error", reject);
      server.once("exit", () => reject(Error("Servidor cerrado")));
    });
    socket = new WebSocket("ws://localhost:18787");
    await new Promise<void>((resolve, reject) => {
      socket!.once("open", resolve);
      socket!.once("error", reject);
    });
    for (const type of ["create", "join", "resume", "list", "action"]) {
      const response = new Promise<ServerMessage>((resolve, reject) => {
        const timeout = setTimeout(() => reject(Error("Sin respuesta")), 2000);
        socket!.once("message", (raw) => {
          clearTimeout(timeout);
          resolve(JSON.parse(raw.toString()));
        });
      });
      socket.send(JSON.stringify({ type, name: "Invitado", code: "ABCDEF" }));
      const message = await response;
      assert.equal(message.type, "error");
      assert.match((message as { message: string }).message, /SaltoPlay/);
    }
  } finally {
    socket?.close();
    server.kill();
  }
});
