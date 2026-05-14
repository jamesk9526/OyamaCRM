# Oyama Bridge Desktop Server

Purpose: standalone local bridge app for Steward AI donor/report workflows with live request logging and startup automation controls.

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
- Bridge runtime sends live events (`runtime`, `request`) to renderer for request table updates.

## Security and Guardrails

- Optional Bearer token gate: `bridgeApiKey`.
- CORS allowlist support: `bridgeAllowedOrigins`.
- Non-allowlisted origins are blocked with HTTP 403.
- Request body limit: 2 MB.
- Hop-by-hop upstream headers are stripped before relay.
- Donor/report scope guardrail is stored as `donorReportsOnly: true` in sanitized config output.

## Startup and Launch Behavior

- `startupLaunchEnabled`: start app when user logs into Windows.
- `startHidden`: launch to tray/hidden window behavior.
- `bridgeAutostart`: automatically start bridge server when app launches.
- Startup toggles are persisted in the bridge config file under Electron user data.

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
