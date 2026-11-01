# Steward v2: assistant, memory, and bridge operations

Steward is the CRM assistant, presented as a single floating chathead. The supplied HTML mockup informed the rounded launcher, gradient header, tabs, message bubbles, and quick-action cards. The CRM canvas retains its existing light-blue design.

## Interface and compatibility

- Chat streams real responses through the authenticated Steward API.
- Quick actions exposes reviewed playbooks and user-controlled saved memory.
- Insights offers questions that retrieve current evidence; it does not display invented totals or demo opportunities.
- Existing contextual events open the same chathead. Saved full-page Steward and Signals links are compatibility entries; they open the chathead rather than a second assistant UI.
- Removed the unused Copilot workspace, proactive nudge, metrics strip, save-template modal, old thinking display, and unreferenced Signals/draft-studio UI. Shared artifact rendering, permissioned tool execution, donor record signals, and Steward Paths remain available.
- Escape closes the panel and returns focus. Tabs support arrow keys. Stop cancels the browser request; a cancelled partial answer is labeled incomplete. Backend computation may continue after a browser disconnect.

## Reviewed answers and operations

Sixteen reviewed workflows plus an identity answer can bypass Ollama. Both chat and streaming endpoints share the same resolver and response shape. Supported requests include `Explain fiscal year`, `How do I record a donation?`, and `Open tasks`. These paths work when model generation is disabled. The authenticated catalog is `/api/steward-ai/playbooks`.

Matching is conservative: compound requests, donor-specific requests, explicit tools, and drafting/analysis requests stay in the existing guarded pipeline. Workspace links open existing forms. They do not silently execute writes. Existing deterministic top-donor/report paths and permissioned tool execution remain in use.

## Steward's voice and evidence

The shared personality defines Steward as warm, practical, calm, and candid. Steward introduces itself by name and prioritizes an accurate answer over a plausible answer. Missing records, denied access, failed retrieval, and confirmed zero are distinct states. It must not invent amounts, identities, dates, completed operations, product controls, or error causes.

Steward retrieves relevant data within organization/user permissions; it does not load or inspect the entire CRM for every question. Current scoped CRM evidence takes precedence over saved memory and conversation history. Security/event snapshots now enforce their source permissions. Model-free guidance grants no access to linked routes. No local model can be guaranteed hallucination-free; reviewed playbooks, evidence boundaries, tests, and feedback reduce and expose errors.

## Memory and compaction

Existing server-side memories remain scoped to the authenticated user and organization. The chathead lets staff enable/disable retrieval, deliberately save a preference, review entries, and forget an entry. Memories are labeled historical, carry update information, are deduplicated during retrieval, and have bounded excerpt lengths. They never replace live CRM values. Explicit memory commands retain the existing audited save path.

Conversation compaction is extractive, not a model-written summary. The newest messages stay in order, older excerpts are labeled unverified, client system roles are discarded, and omitted context is acknowledged. Recent history is bounded to 20,000 characters plus a small compacted excerpt block. General model evidence context is also capped. This preserves useful continuity without turning historical statements into verified facts. It is not unlimited recall or a vector database.

## Thinking

The chathead's **Think carefully** control is request-scoped. Qwen receives an explicit thinking flag. Private reasoning is not displayed or included in CRM chat logs. If the reasoning budget ends without a final answer, the client makes one final completion pass from the original evidence with thinking disabled; it never forwards private reasoning into the public response.

New configurations default to a single-pass standard response using Qwen3.5 9B for both model fields. Existing saved organization configuration is preserved until an administrator changes it. Thinking can add substantial latency; this is a deliberate user choice.

## RTX 5060 Ti model setup

The selected local candidate is `qwen3.5:9b`, downloaded and tested on the secondary 16 GB RTX 5060 Ti. Both local desktop model fields were updated to that tag, with GPU index 1 retained; a local config backup was created before changes. Existing organization settings may still name an older model and should be reviewed during deployment.

Official model information: https://ollama.com/library/qwen3.5:9b. The larger `qwen3.8:27b` remains an optional profile for larger hardware, not the default for this GPU.

The runtime now resolves physical NVIDIA indices to UUIDs before launch. Pinned managed CUDA mode disables Vulkan discovery, which otherwise selected the 3090 despite CUDA visibility settings. Request-level `main_gpu` is remapped to 0 within the isolated managed process. External runtimes cannot offer the same process-level isolation guarantee.

Synthetic checks cover identity, unavailable totals, unexecuted sends, and thinking/final completion. Evidence records CUDA discovery, model state, memory usage, and responses. These checks are not a comprehensive quality benchmark.

## Master improvements log

Open **Settings → AI → Master improvements log** (`/settings/ai/improvements`). Administrators see the latest 100 reports for their organization. Reports are durably stored in the existing audit table under `STEWARD_IMPROVEMENT_REPORT`, so no new database migration is required.

CRM responses support thumbs up/down, categorized reasons, optional notes, and an explicit opt-in to include a response excerpt. Failed saves remain visible and can be retried. Report IDs make delivery idempotent.

In the desktop app, feedback and sanitized runtime error summaries enter a durable local improvements log. Reports survive restarts and failed delivery. Error summaries are deduplicated per category/status per minute and omit prompts, generated content, credentials, and raw error messages. Optional response excerpts require a feedback checkbox.

To connect a desktop:

1. In the CRM improvements log, choose **Connect desktop feedback** as an administrator.
2. Copy the 30-day connection token.
3. In Oyama Bridge → Improvements log, enter the HTTPS CRM URL and token, then save.
4. Sync pending reports. New feedback attempts delivery automatically, and a one-minute retry loop processes pending reports while the app runs.

The capability can only append feedback for its tenant; it cannot authenticate as a CRM user. Its signing key is domain-separated from the user JWT key. HTTPS is required outside loopback development. Expired tokens require renewal. The log is organization-scoped; it is not an external telemetry service. No production feedback connection was created or deployed during this work.

Desktop storage is under `%APPDATA%/OyamaBridgeDesktopServer/improvements/`. The full local file retains up to 5,000 entries; the UI displays the latest 100. At capacity it reports an error instead of silently deleting reports. Archive the file with the app closed before resetting that local archive. Back up and restrict access to logs containing optional excerpts.

## Desktop build and verification

```powershell
node --test OyamaBridgeDesktopServer/tests/*.test.js
node tests/e2e/steward-v2.e2e.mjs
node tests/e2e/bridge-desktop.e2e.mjs
node scripts/qa/steward-local-model-check.cjs
cd OyamaBridgeDesktopServer
npm run installer:nsis:oneclick
```

The model check starts an isolated managed runtime on port 11435, uses synthetic prompts, and shuts it down afterward. It requires the installed model and NVIDIA tooling. `STEWARD_GPU_INDEX` overrides the default index 1.

The Windows installer is `OyamaBridgeDesktopServer/release/Oyama-Bridge-Setup-2.0.0.exe`. Build outputs are local artifacts, not committed source. Set `BRIDGE_QA_EXECUTABLE` to the packaged executable when running the Electron test. QA profiles use an isolated temporary directory and never overwrite the installed application's configuration.

The desktop has context isolation, sandboxing, a restricted preload, CSP, blocked window navigation, and validated feedback IPC. Signing credentials were not provided; the installer is unsigned. Production web/API deployment, a fresh-machine install, live communications, and a full tenant-wide operational audit remain separate validation steps.
