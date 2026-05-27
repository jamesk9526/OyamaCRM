/**
 * Dev launcher: runs API + web in parallel while enabling permissive CORS for local testing.
 * Spawns each pnpm sub-script directly (no concurrently wrapper) to avoid Windows shell quoting issues.
 */
import { spawn } from "node:child_process";

const IS_WIN = process.platform === "win32";
const pnpm   = IS_WIN ? "pnpm.cmd" : "pnpm";
const cmdExe = process.env.ComSpec || "cmd.exe";

const env = { ...process.env, DEV_CORS_ALLOW_ALL: "1" };

// ANSI colour helpers
const C = { cyan: "\x1b[36m", green: "\x1b[32m", yellow: "\x1b[33m", reset: "\x1b[0m" };

/** Prefix each non-empty line with a coloured [label] tag. */
function prefixLines(label, color, data) {
  return String(data)
    .split(/\r?\n/)
    .map((l) => (l.trim() ? `${color}[${label}]${C.reset} ${l}` : ""))
    .filter(Boolean)
    .join("\n");
}

function startProc(label, color, scriptName) {
  // On Windows, run via cmd.exe /c to avoid EINVAL with .cmd child processes.
  const proc = IS_WIN
    ? spawn(cmdExe, ["/d", "/s", "/c", `pnpm run ${scriptName}`], { env, shell: false })
    : spawn(pnpm, ["run", scriptName], { env, shell: false });

  proc.stdout.on("data", (d) => { const s = prefixLines(label, color, d); if (s) console.log(s); });
  proc.stderr.on("data", (d) => { const s = prefixLines(label, color, d); if (s) console.error(s); });

  proc.on("error", (err) => {
    console.error(`${color}[${label}]${C.reset} Failed to start: ${err.message}`);
  });

  proc.on("exit", (code, signal) => {
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    console.log(`${color}[${label}]${C.reset} exited with ${reason}`);
    // Kill sibling processes when one exits
    procs.forEach((p) => { try { p.kill(); } catch { /* already gone */ } });
    process.exit(code ?? 1);
  });

  return proc;
}

const procs = [
  startProc("api",     C.cyan,   "dev:api"),
  startProc("web",     C.green,  "dev:web"),
  startProc("letters", C.yellow, "dev:letters"),
];

// Forward SIGINT/SIGTERM so Ctrl-C cleanly kills children
["SIGINT", "SIGTERM"].forEach((sig) => {
  process.on(sig, () => {
    procs.forEach((p) => { try { p.kill(sig); } catch { /* already gone */ } });
    process.exit(0);
  });
});
