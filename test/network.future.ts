import type { ServerMessage } from "../shared/types.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { WebSocket } from "ws";
test("dos clientes: crear, unirse, validar turno y reconectar", async () => {
  const server = spawn(
    process.execPath,
    ["--import", "tsx", "server/index.ts"],
    {
      env: { ...process.env, PORT: "18787" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  type TestSocket = WebSocket & {
    inbox: ServerMessage[];
  };
  let a: TestSocket | undefined,
    b: TestSocket | undefined,
    c: TestSocket | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      server.stdout!.once("data", () => resolve());
      server.once("error", reject);
      server.once("exit", () => reject(Error("Servidor cerrado")));
    });
    const open = async () => {
      const w = new WebSocket("ws://localhost:18787") as TestSocket;
      w.inbox = [];
      w.on("message", (raw) =>
        w.inbox.push(JSON.parse(raw.toString()) as ServerMessage),
      );
      await new Promise((r, j) => {
        w.once("open", r);
        w.once("error", j);
      });
      return w;
    };
    const wait = async <T extends ServerMessage["type"]>(
      w: TestSocket,
      type: T,
      p: (
        m: Extract<
          ServerMessage,
          {
            type: T;
          }
        >,
      ) => boolean = () => true,
    ): Promise<
      Extract<
        ServerMessage,
        {
          type: T;
        }
      >
    > => {
      for (let n = 0; n < 300; n++) {
        const i = w.inbox.findIndex(
          (m) =>
            m.type === type &&
            p(
              m as Extract<
                ServerMessage,
                {
                  type: T;
                }
              >,
            ),
        );
        if (i >= 0)
          return w.inbox.splice(i, 1)[0] as Extract<
            ServerMessage,
            {
              type: T;
            }
          >;
        await new Promise((r) => setTimeout(r, 20));
      }
      throw Error("Tiempo agotado");
    };
    a = await open();
    a.send(JSON.stringify({ type: "create", name: "Uno", public: true }));
    const joined = await wait(a, "joined");
    b = await open();
    b.send(JSON.stringify({ type: "join", code: joined.code, name: "Dos" }));
    await wait(b, "joined");
    const deployment = await wait(
      a,
      "state",
      (m) => m.started && (m.deploymentMs ?? 0) > 0,
    );
    assert.equal(deployment.state.time, 45);
    a.send(
      JSON.stringify({
        type: "action",
        action: { type: "fire", angle: -1, power: 1, weapon: 0 },
      }),
    );
    assert.match((await wait(a, "error")).message, /despliegue/);
    await wait(a, "state", (m) => m.started && m.deploymentMs === 0);
    b.send(
      JSON.stringify({
        type: "action",
        action: { type: "fire", angle: -1, power: 1, weapon: 0 },
      }),
    );
    await wait(b, "error");
    a.send(
      JSON.stringify({
        type: "action",
        action: { type: "fire", angle: -0.7, power: 0.7, weapon: 0 },
      }),
    );
    const flight = await wait(b, "state", (m) => m.state.phase === "flight");
    assert.ok(flight.state.projectile);
    a.close();
    await new Promise((r) => a!.once("close", r));
    c = await open();
    c.send(
      JSON.stringify({
        type: "resume",
        code: joined.code,
        token: joined.token,
      }),
    );
    assert.equal((await wait(c, "joined")).team, 0);
    const full = await wait(c, "state", (m) => !!m.terrain);
    assert.equal(full.terrain!.length, 640 * 360);
  } finally {
    a?.close();
    b?.close();
    c?.close();
    server.kill();
  }
});
