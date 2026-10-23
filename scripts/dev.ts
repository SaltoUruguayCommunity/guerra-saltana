import { spawn } from "node:child_process";
const children = [
  spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    stdio: "inherit",
  }),
  spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--host", "0.0.0.0"],
    { stdio: "inherit" },
  ),
];
for (const c of children)
  c.on("exit", (code) => {
    for (const other of children) other.kill();
    process.exit(code || 0);
  });
process.on("SIGINT", () => {
  for (const c of children) c.kill();
  process.exit();
});
