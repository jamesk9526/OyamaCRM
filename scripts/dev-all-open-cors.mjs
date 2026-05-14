// Dev launcher: runs API + web concurrently while enabling permissive API CORS for local testing.
import { spawn } from "node:child_process";

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const args = [
  "concurrently",
  "-k",
  "-n",
  "api,web",
  "-c",
  "cyan,green",
  "pnpm dev:api",
  "pnpm dev:web",
];

const child = spawn(command, args, {
  stdio: "inherit",
  env: {
    ...process.env,
    DEV_CORS_ALLOW_ALL: "1",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error("Failed to start dev:all with open CORS:", error);
  process.exit(1);
});
