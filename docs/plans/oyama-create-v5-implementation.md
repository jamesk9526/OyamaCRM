# Oyama Create v5 implementation and rollout

Date: 2026-11-06 America/Chicago. The owner-supplied v5 HTML and four previews establish the visual and interaction contract. The standalone demonstration is not embedded, its `execCommand` implementation is not used, and its local-storage document format is not imported as trusted CRM state.

## Architecture and retained ownership

- `CreateShell` retains authentication, permissions, navigation, import/recovery services and bootstrap. Its v5 theme applies across all Create destinations. `WorkspaceFrame` replaces the nested editor chrome with the v5 title/workbar, six ribbon tabs, independent navigator/canvas/inspector regions, dock splitters, command palette and status bar.
- `StudioWorkspace` continues owning guarded saves, recipient context, source comparison, channel adaptations, HTML sessions, brand adoption, proofs, history and recovery. Both the v5 shell and rollback shell use the same schema-aware Tiptap components. Channel sessions remain mounted to preserve their selection/history. SMS/social version-4 adaptations own their message copy; retained literal captions remain available when an adaptation is explicitly removed.
- Version-4 `StudioDesign` extends the existing JSON contract. Readers retain v2/v3 support. `mergeField` is a protected inline node with canonical field identity, authored token/alias and original filters. Validation requires the token to match its canonical field; server permissions and values still come from the existing resolver. Unknown tokens remain authored text with diagnostics. Copying or upgrading a document does not rewrite its original source.
- New drafts and imported edits save only in Create. The existing import bindings, snapshots, original names, headers/footers/signers and external-source comparison remain in their existing services. Approval, delivery, media ownership, sensitive merge access and public projection rules remain server-side.
- Physical media include Letter/A4/Legal/Half Letter and orientation. Vertical editing uses derived ProseMirror decorations, shared physical geometry and typography. Line groups protect paragraph starts/ends and keep-with-next. Table gaps preserve column counts and repeat headers. Oversize preserved/atomic content warns and requires production-proof review. Generated page layout is never persisted as content.
- Frozen print snapshots use version 2 for new designs and retain the existing version-1 reader. Requested print fonts are retained; unavailable fonts produce proof/readiness errors. Bundled Inter/Noto Serif work immediately. Proprietary/custom fonts require authorized `.woff2` files under `public/fonts/create`; they are not copied from this Windows machine or silently substituted. Existing historical artifacts are not regenerated.
- One `CreateContentNote` per content piece holds internal plain-text notes, its own revision and updater. Note writes require the same content ownership/edit grants, reject stale writes and do not increment document/campaign revisions or supersede approvals. Notes never enter render/release/ChatGPT design payloads.
- Local layout is keyed by authenticated organization/user and browser device. Widths, density, panel preferences, zoom and per-content viewport positions contain no donor text and never update CRM content. Storage failure retains an in-memory layout while documents continue saving to the server.

## Additive contracts

| Contract | Behavior |
|---|---|
| Bootstrap `shellEnabled`, `unifiedEditorEnabled` | Organization defaults; false until enabled |
| GET/PUT `/api/oyama-create/workspace/config` | Separate shell/editor controls; management permission and reviewed boolean payload; audited |
| POST `/api/oyama-create/workspace/start` | Permission-checked Letter, Email, Newsletter, Appeal, Acknowledgment or Event draft; pinned brand and initial content/revision; no audience/release/delivery |
| GET/PUT `/api/oyama-create/contents/:id/notes` | Authorized internal text and optimistic revision, independent of approved content |
| GET `/api/oyama-create/studio/fonts` | Available standard print-font resources |
| Existing Studio routes | Accept/read v2/v3/v4; conversion can request a unified draft; HTML export retains authored field tokens |

## Rollout and rollback

1. Back up staging, deploy additive migration `20261106030000_create_v5_workspace`, generate Prisma, then deploy the compatible API/web together. No production migration was performed by this task.
2. In Create → Settings, enable the v5 shell for a pilot organization. Enable the unified editor after comparing representative original output. These switches are independent of live delivery.
3. Verify staff roles, import inventory, real original names/branding and selected recipients. Complete the output and provider gates below before production default cutover.
4. Disabling the shell restores the compatibility chrome. Disabling unified defaults retains the version-4-capable Studio reader/editor for already-created drafts; originals remain in standalone Letters/Email. No lossy down-conversion or source overwrite occurs. Keep the compatible reader deployed after version-4 writes; an older server binary cannot safely replace it without a separate compatibility rehearsal.
5. Keep standalone routes and historical artifacts. Removing them is outside this implementation and requires demonstrated parity.

## Acceptance boundaries

The capability matrix enumerates all 184 supplied checklist items and the v5 additions. Synthetic browser/API tests and Chromium PDF fixtures are development evidence, not certification of real production letters or providers. In particular, the standalone old Letters PDF route uses jsPDF; the upgraded production pipeline uses Chromium. Their real letter-by-letter typography, header furniture and pagination still require golden comparisons and physical printer acceptance. A shared schema alone does not prove those outputs identical.

No deployment, production data migration, live send, publication, physical printing or original-template edit was performed. Unrelated native desktop work was preserved.

See [capability matrix](oyama-create-v5-capabilities.md) and [verification](../status/audit-artifacts/2026-11-06-create-v5/verification.md).
