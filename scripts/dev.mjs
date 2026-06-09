import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const mode = args[0];
const isWin = process.platform === "win32";
const pnpm = isWin ? "pnpm.cmd" : "pnpm";
const cmdExe = process.env.ComSpec || "cmd.exe";

const child = isWin
  ? spawn(cmdExe, ["/d", "/s", "/c", mode === "all" ? "pnpm run dev:all" : `pnpm run dev:web${args.length > 0 ? ` ${args.slice(1).join(" ")}` : ""}`], {
      stdio: "inherit",
      shell: false,
      env: process.env,
    })
  : spawn(pnpm, mode === "all" ? ["run", "dev:all"] : ["run", "dev:web", ...args.slice(1)], {
      stdio: "inherit",
      shell: false,
      env: process.env,
    });

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
