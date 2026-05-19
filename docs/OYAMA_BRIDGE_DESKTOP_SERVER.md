# Oyama Bridge Desktop Server

Purpose: standalone local bridge app for Steward AI donor/report workflows with live request logging, generated-content viewing, tray-first Windows behavior, and startup automation controls.

## Location

- `OyamaBridgeDesktopServer/main.js`
- `OyamaBridgeDesktopServer/bridge-server.js`
- `OyamaBridgeDesktopServer/preload.js`
- `OyamaBridgeDesktopServer/renderer.js`
- `OyamaBridgeDesktopServer/index.html`
- `OyamaBridgeDesktopServer/styles.css`

## Runtime Model

- Electron shell hosts one dedicated bridge control surface.
- Local HTTP bridge proxies `/api/*` to configured upstream runtime and exposes `/health`.
- Bridge runtime sends live events (`runtime`, `request`, `error`) to renderer for request flow, generated content, and error table updates.
- The desktop shell uses a dark enterprise server-console layout with a collapsible left command sidebar, Dashboard, Requests, Generated, Pairing, Backup, Debug, and side-drawer Settings surfaces.
- Configuration actions live in Settings. The sidebar is intentionally limited to runtime controls, workspace navigation, and lightweight operational tools.
- Dashboard reports include latency sparkline, request status mix, GPU load/memory bars, and GPU monitor rows from `nvidia-smi`. If detailed telemetry is unavailable, the app falls back to `nvidia-smi -L` so GPU names/UUIDs still populate.

## Security and Guardrails

- Optional Bearer token gate: `bridgeApiKey`.
- CORS allowlist support: `bridgeAllowedOrigins`.
- Non-allowlisted origins are blocked with HTTP 403.
- Request body limit: 2 MB.
- Hop-by-hop upstream headers are stripped before relay.
- Donor/report scope guardrail is stored as `donorReportsOnly: true` in sanitized config output.
- Prompt/request bodies and API keys are not stored in request logs. Generated assistant previews from `/api/chat` and `/api/generate` are captured in memory for the Generated Content Log.
- For Ollama GPU isolation, the selected CUDA device must be applied to the Ollama/runtime process using `CUDA_VISIBLE_DEVICES=<gpu>`. The bridge still injects `main_gpu` for compatible runtimes, but `num_gpu` is not used as a device selector.

## Startup and Launch Behavior

- `startupLaunchEnabled`: start app when user logs into Windows.
- `startHidden`: launch to tray/hidden window behavior.
- `bridgeAutostart`: automatically start bridge server when app launches.
- Startup toggles are persisted in the bridge config file under Electron user data.
- Minimize and close can hide the dashboard to the Windows tray when `minimizeToTaskbarOnClose` is enabled.
- Tray menu actions can open the dashboard, request flow, generated log, start/stop the bridge, hide the dashboard, or quit the app.

## Bridge Config Surface

Primary values surfaced to CRM pairing:

- Endpoint URL
- API key
- Model
- Thinking model
- CUDA device
- Temperature
- Timeout

Network diagnostics include:

- local endpoint
- LAN endpoints
- detected public IP candidate
- discovered CUDA devices (when `nvidia-smi` is available)

## Verification

Run bridge server tests:

```bash
cd OyamaBridgeDesktopServer
npm test
```

Covered in `tests/bridge-server.test.js`:

- health route behavior
- auth rejection behavior
- CORS allowlist rejection behavior
- successful upstream forwarding
- request log/runtime counters
- CUDA option injection for `/api/chat`
- generated assistant preview extraction for `/api/chat` and `/api/generate`
- selected CUDA device request metadata and `main_gpu` injection for `/api/chat` and `/api/generate`
- dashboard GPU usage, temperature, memory, UUID, and power telemetry from `nvidia-smi`
