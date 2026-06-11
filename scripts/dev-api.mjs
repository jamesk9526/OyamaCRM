import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const entry = resolve("dist", "server", "index.js");
const tscBin = resolve("node_modules", "typescript", "bin", "tsc");
const prismaBin = resolve("node_modules", "prisma", "build", "index.js");

let serverProcess = null;
let startedServer = false;
let readyToStart = false;

function spawnChild(command, args, options = {}) {
  return spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    env: process.env,
    ...options,
  });
}

function startServer() {
  if (startedServer || !readyToStart || !existsSync(entry)) return;
  startedServer = true;

  serverProcess = spawn(process.execPath, ["--preserve-symlinks", "--preserve-symlinks-main", "--watch", entry], {
    stdio: "inherit",
    shell: false,
    env: process.env,
  });

  serverProcess.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    if (code && code !== 0) {
      process.exit(code);
    }
  });
}

const prismaGenerateProcess = spawnChild(process.execPath, [prismaBin, "generate"]);
let tscProcess = null;

function startTypeScriptWatcher() {
  if (tscProcess) return;
  tscProcess = spawnChild(process.execPath, [tscBin, "-p", "server/tsconfig.json", "--watch", "--preserveWatchOutput"]);

  tscProcess.stdout.on("data", (chunk) => {
    const text = String(chunk);
    process.stdout.write(text);
    if (text.includes("Watching for file changes.")) {
      readyToStart = true;
      startServer();
    }
  });

  tscProcess.stderr.on("data", (chunk) => {
    process.stderr.write(String(chunk));
  });

  tscProcess.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    if (code && code !== 0) {
      process.exit(code);
    }
  });
}

prismaGenerateProcess.stdout.on("data", (chunk) => {
  process.stdout.write(String(chunk));
});

prismaGenerateProcess.stderr.on("data", (chunk) => {
  process.stderr.write(String(chunk));
});

prismaGenerateProcess.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  if (code && code !== 0) {
    process.exit(code);
    return;
  }
  startTypeScriptWatcher();
});

const poll = setInterval(() => {
  startServer();
  if (startedServer) clearInterval(poll);
}, 500);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    try {
      prismaGenerateProcess.kill(signal);
    } catch {}
    try {
      tscProcess?.kill(signal);
    } catch {}
    try {
      serverProcess?.kill(signal);
    } catch {}
    process.exit(0);
  });
}
