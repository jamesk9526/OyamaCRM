// OyamaPASSWORD dark-theme workspace for encrypted credential storage, sharing, and locked backup operations.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";
import { useAuth } from "@/app/components/auth/AuthProvider";

interface PasswordEntry {
  id: string;
  title: string;
  username: string | null;
  website: string | null;
  ownerUserId: string;
  canEdit: boolean;
  sharedByYou: boolean;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string | null;
  password?: string;
  notes?: string;
  hasMfa?: boolean;
  mfaMethod?: string;
  mfaConnectedTo?: string;
}

interface OrgUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface ShareItem {
  sharedWithUserId: string;
  canEdit: boolean;
  createdBy: string;
  createdAt: string;
}

interface BackupItem {
  id: string;
  label: string;
  fileName: string;
  checksumSha256: string;
  createdAt: string;
  restoredAt: string | null;
}

interface PinStatus {
  hasPin: boolean;
  lastVerifiedAt: string | null;
  lockedUntil?: string | null;
  remainingAttempts?: number;
}

interface PinSession {
  sessionToken: string;
  expiresAt: string;
}

interface VaultEditFormState {
  title: string;
  username: string;
  website: string;
  password: string;
  notes: string;
  hasMfa: boolean;
  mfaMethod: string;
  mfaConnectedTo: string;
}

const PIN_SESSION_STORAGE_KEY = "oyama.password.pin.session";

/** Renders OyamaPASSWORD encrypted vault management with PIN-gated unlock. */
export default function OyamaPasswordWorkspace() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [shares, setShares] = useState<ShareItem[]>([]);

  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [revealedPassword, setRevealedPassword] = useState("");
  const [revealedNotes, setRevealedNotes] = useState("");
  const [revealedMfa, setRevealedMfa] = useState<{ hasMfa: boolean; method: string; connectedTo: string }>({
    hasMfa: false,
    method: "",
    connectedTo: "",
  });

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newWebsite, setNewWebsite] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newHasMfa, setNewHasMfa] = useState(false);
  const [newMfaMethod, setNewMfaMethod] = useState("Authenticator app");
  const [newMfaConnectedTo, setNewMfaConnectedTo] = useState("");
  const [search, setSearch] = useState("");

  const [selectedShareUserIds, setSelectedShareUserIds] = useState<string[]>([]);
  const [shareCanEdit, setShareCanEdit] = useState(false);

  const [backupLabel, setBackupLabel] = useState("");
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");

  const [pinChecking, setPinChecking] = useState(true);
  const [pinStatus, setPinStatus] = useState<PinStatus | null>(null);
  const hasPin = Boolean(pinStatus?.hasPin);
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinSessionToken, setPinSessionToken] = useState("");
  const [resetPinMode, setResetPinMode] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [securityInfoOpen, setSecurityInfoOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletePinInput, setDeletePinInput] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<VaultEditFormState>({
    title: "",
    username: "",
    website: "",
    password: "",
    notes: "",
    hasMfa: false,
    mfaMethod: "Authenticator app",
    mfaConnectedTo: "",
  });

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) ?? null,
    [entries, selectedEntryId],
  );
  const availableShareUsers = useMemo(
    () => users.filter((item) => item.id !== selectedEntry?.ownerUserId),
    [selectedEntry?.ownerUserId, users],
  );
  const allShareUsersSelected = availableShareUsers.length > 0 && selectedShareUserIds.length === availableShareUsers.length;
  const recentCount = useMemo(
    () => entries.filter((entry) => entry.lastAccessedAt).length,
    [entries],
  );
  const sharedCount = useMemo(
    () => entries.filter((entry) => !entry.sharedByYou).length,
    [entries],
  );
  const secureCount = useMemo(
    () => entries.filter((entry) => entry.hasMfa).length,
    [entries],
  );
  const securityScore = useMemo(() => {
    if (entries.length === 0) return 100;
    const score = Math.round((secureCount / entries.length) * 100);
    return Math.max(35, Math.min(100, score));
  }, [entries, secureCount]);

  const showAdminBadge = String(user?.role ?? "").toLowerCase() === "admin" || String(user?.role ?? "").toLowerCase() === "super_admin";

  // Favorites stored in localStorage so they persist across sessions without a backend change.
  const FAVORITES_KEY = "oyama-vault-favorites";
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      return new Set(stored ? (JSON.parse(stored) as string[]) : []);
    } catch { return new Set(); }
  });

  function toggleFavorite(id: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      if (typeof window !== "undefined") {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      }
      return next;
    });
  }

  // Per-entry tags stored in localStorage.
  const TAGS_KEY = "oyama-vault-tags";
  const [entryTags, setEntryTags] = useState<Record<string, string[]>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem(TAGS_KEY);
      return stored ? (JSON.parse(stored) as Record<string, string[]>) : {};
    } catch { return {}; }
  });

  // Nav filter state: which sidebar item is active.
  type NavFilter = "all" | "favorites" | "recent" | "shared";
  const [navFilter, setNavFilter] = useState<NavFilter>("all");
  const [newTagInput, setNewTagInput] = useState("");

  // Copy feedback
  const [copiedField, setCopiedField] = useState<string | null>(null);
  function copyToClipboard(text: string, fieldKey: string) {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 1800);
    });
  }

  // Password strength helper
  function passwordStrength(pw: string): { label: string; color: string; score: number } {
    if (!pw) return { label: "Unknown", color: "text-slate-400", score: 0 };
    let score = 0;
    if (pw.length >= 12) score++;
    if (pw.length >= 16) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { label: "Weak", color: "text-rose-400", score };
    if (score === 2) return { label: "Fair", color: "text-amber-400", score };
    if (score === 3) return { label: "Good", color: "text-yellow-300", score };
    return { label: "Strong", color: "text-emerald-400", score };
  }

  // Favicon helper — uses Google S2 service, falls back gracefully.
  function faviconUrl(website: string | null): string | null {
    if (!website) return null;
    try {
      const host = new URL(website.startsWith("http") ? website : `https://${website}`).hostname;
      return `https://www.google.com/s2/favicons?sz=64&domain=${host}`;
    } catch { return null; }
  }

  // Filtered list based on nav selection + search.
  const displayedEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    let rows = entries;
    if (navFilter === "favorites") rows = rows.filter((e) => favorites.has(e.id));
    else if (navFilter === "recent") rows = rows.filter((e) => e.lastAccessedAt);
    else if (navFilter === "shared") rows = rows.filter((e) => !e.sharedByYou);
    if (query) rows = rows.filter((e) =>
      e.title.toLowerCase().includes(query) ||
      (e.username ?? "").toLowerCase().includes(query) ||
      (e.website ?? "").toLowerCase().includes(query)
    );
    return [...rows].sort((a, b) => a.title.localeCompare(b.title));
  }, [entries, search, navFilter, favorites]);

  const vaultFetch = useCallback(
    async <T,>(url: string, init?: RequestInit): Promise<T> => {
      const headers = new Headers(init?.headers ?? {});
      if (pinSessionToken) {
        headers.set("x-oyama-password-pin-session", pinSessionToken);
      }
      return apiFetch<T>(url, { ...init, headers });
    },
    [pinSessionToken],
  );

  const loadWorkspace = useCallback(async () => {
    if (!pinSessionToken) return;
    setLoading(true);
    setError(null);

    try {
      const [entriesPayload, usersPayload] = await Promise.all([
        vaultFetch<{ items: PasswordEntry[] }>("/api/oyama-password/entries"),
        vaultFetch<{ items: OrgUser[] }>("/api/oyama-password/users"),
      ]);

      const nextEntries = entriesPayload.items ?? [];
      setEntries(nextEntries);
      setUsers(usersPayload.items ?? []);

      if (!selectedEntryId && nextEntries.length) {
        setSelectedEntryId(nextEntries[0].id);
      }

      try {
        await vaultFetch<{ items: BackupItem[] }>("/api/oyama-password/backups");
      } catch {
        // Backup access is checked opportunistically so the settings drawer can stay lightweight.
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load password vault workspace.");
      if (requestError instanceof Error && requestError.message.toLowerCase().includes("pin")) {
        setPinSessionToken("");
        sessionStorage.removeItem(PIN_SESSION_STORAGE_KEY);
      }
    } finally {
      setLoading(false);
    }
  }, [pinSessionToken, selectedEntryId, vaultFetch]);

  const loadShares = useCallback(async (entryId: string) => {
    if (!pinSessionToken) return;
    try {
      const payload = await vaultFetch<{ items: ShareItem[] }>(`/api/oyama-password/entries/${entryId}/shares`);
      setShares(payload.items ?? []);
    } catch {
      setShares([]);
    }
  }, [pinSessionToken, vaultFetch]);

  useEffect(() => {
    let cancelled = false;

    async function checkPin() {
      setPinChecking(true);
      setError(null);
      try {
        const status = await apiFetch<PinStatus>("/api/oyama-password/pin/status");
        if (cancelled) return;
        setPinStatus(status);

        const stored = sessionStorage.getItem(PIN_SESSION_STORAGE_KEY) ?? "";
        if (stored) {
          setPinSessionToken(stored);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Failed to verify vault PIN status.");
        }
      } finally {
        if (!cancelled) setPinChecking(false);
      }
    }

    void checkPin();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pinSessionToken) return;
    void loadWorkspace();
  }, [pinSessionToken, loadWorkspace]);

  useEffect(() => {
    if (!selectedEntryId || !pinSessionToken) {
      setShares([]);
      return;
    }
    setSelectedShareUserIds([]);
    setShareCanEdit(false);
    void loadShares(selectedEntryId);
  }, [selectedEntryId, pinSessionToken, loadShares]);

  async function handlePinSetup() {
    setBusy(true);
    setError(null);
    try {
      if (!/^\d{6,10}$/.test(pinInput)) {
        throw new Error("PIN must be 6-10 digits.");
      }
      if (pinInput !== pinConfirm) {
        throw new Error("PIN confirmation does not match.");
      }

      const session = await apiFetch<PinSession>("/api/oyama-password/pin/setup", {
        method: "POST",
        body: JSON.stringify({ pin: pinInput }),
      });

      sessionStorage.setItem(PIN_SESSION_STORAGE_KEY, session.sessionToken);
      setPinSessionToken(session.sessionToken);
      setPinStatus((current) => ({
        hasPin: true,
        lastVerifiedAt: new Date().toISOString(),
        lockedUntil: null,
        remainingAttempts: current?.remainingAttempts ?? 5,
      }));
      setPinInput("");
      setPinConfirm("");
      setMessage("PIN configured. Vault unlocked.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to set PIN.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePinVerify() {
    setBusy(true);
    setError(null);
    try {
      if (!/^\d{4,10}$/.test(pinInput)) {
        throw new Error("Enter your 4-10 digit PIN.");
      }

      const session = await apiFetch<PinSession>("/api/oyama-password/pin/verify", {
        method: "POST",
        body: JSON.stringify({ pin: pinInput }),
      });

      sessionStorage.setItem(PIN_SESSION_STORAGE_KEY, session.sessionToken);
      setPinSessionToken(session.sessionToken);
      setPinStatus((current) => current ? {
        ...current,
        lastVerifiedAt: new Date().toISOString(),
        lockedUntil: null,
        remainingAttempts: 5,
      } : {
        hasPin: true,
        lastVerifiedAt: new Date().toISOString(),
        lockedUntil: null,
        remainingAttempts: 5,
      });
      setPinInput("");
      setMessage("Vault unlocked.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Invalid PIN.");
      try {
        const status = await apiFetch<PinStatus>("/api/oyama-password/pin/status");
        setPinStatus(status);
      } catch {
        // Ignore follow-up status refresh failures; preserve the original verify error.
      }
    } finally {
      setBusy(false);
    }
  }

  async function handlePinReset() {
    setBusy(true);
    setError(null);
    try {
      if (!/^\d{6,10}$/.test(pinInput)) {
        throw new Error("PIN must be 6-10 digits.");
      }
      if (pinInput !== pinConfirm) {
        throw new Error("PIN confirmation does not match.");
      }

      const session = await apiFetch<PinSession>("/api/oyama-password/pin/setup", {
        method: "POST",
        body: JSON.stringify({ pin: pinInput }),
      });

      sessionStorage.setItem(PIN_SESSION_STORAGE_KEY, session.sessionToken);
      setPinSessionToken(session.sessionToken);
      setPinStatus({
        hasPin: true,
        lastVerifiedAt: new Date().toISOString(),
        lockedUntil: null,
        remainingAttempts: 5,
      });
      setResetPinMode(false);
      setPinInput("");
      setPinConfirm("");
      setMessage("PIN reset. Vault unlocked.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to reset PIN.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateEntry() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (!newTitle.trim() || !newPassword.trim()) {
        throw new Error("Title and password are required.");
      }

      await vaultFetch("/api/oyama-password/entries", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle,
          username: newUsername,
          website: newWebsite,
          password: newPassword,
          notes: newNotes,
          hasMfa: newHasMfa,
          mfaMethod: newHasMfa ? newMfaMethod : "",
          mfaConnectedTo: newHasMfa ? newMfaConnectedTo : "",
        }),
      });

      setNewTitle("");
      setNewUsername("");
      setNewWebsite("");
      setNewPassword("");
      setNewNotes("");
      setNewHasMfa(false);
      setNewMfaMethod("Authenticator app");
      setNewMfaConnectedTo("");
      setCreateOpen(false);
      setMessage("Credential saved in encrypted vault.");
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create password entry.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevealSecret() {
    if (!selectedEntryId) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await vaultFetch<{ item: PasswordEntry }>(`/api/oyama-password/entries/${selectedEntryId}/reveal`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      setRevealedPassword(payload.item.password ?? "");
      setRevealedNotes(payload.item.notes ?? "");
      setRevealedMfa({
        hasMfa: Boolean(payload.item.hasMfa),
        method: payload.item.mfaMethod ?? "",
        connectedTo: payload.item.mfaConnectedTo ?? "",
      });
      setMessage("Password revealed. Handle with care.");
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to reveal password.");
    } finally {
      setBusy(false);
    }
  }

  function toggleShareUser(userId: string) {
    setSelectedShareUserIds((current) => (
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    ));
  }

  function toggleAllShareUsers() {
    setSelectedShareUserIds(allShareUsersSelected ? [] : availableShareUsers.map((item) => item.id));
  }

  function resetEditForm() {
    setEditForm({
      title: "",
      username: "",
      website: "",
      password: "",
      notes: "",
      hasMfa: false,
      mfaMethod: "Authenticator app",
      mfaConnectedTo: "",
    });
  }

  async function openEditModal() {
    if (!selectedEntryId || !selectedEntry?.canEdit) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await vaultFetch<{ item: PasswordEntry }>(`/api/oyama-password/entries/${selectedEntryId}/reveal`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      const item = payload.item;
      setRevealedPassword(item.password ?? "");
      setRevealedNotes(item.notes ?? "");
      setRevealedMfa({
        hasMfa: Boolean(item.hasMfa),
        method: item.mfaMethod ?? "",
        connectedTo: item.mfaConnectedTo ?? "",
      });
      setEditForm({
        title: item.title ?? "",
        username: item.username ?? "",
        website: item.website ?? "",
        password: item.password ?? "",
        notes: item.notes ?? "",
        hasMfa: Boolean(item.hasMfa),
        mfaMethod: item.mfaMethod ?? "Authenticator app",
        mfaConnectedTo: item.mfaConnectedTo ?? "",
      });
      setEditOpen(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load vault entry for editing.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEntryEdits() {
    if (!selectedEntryId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (!editForm.title.trim() || !editForm.password.trim()) {
        throw new Error("Title and password are required.");
      }

      const payload = await vaultFetch<{ item: PasswordEntry }>(`/api/oyama-password/entries/${selectedEntryId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editForm.title,
          username: editForm.username || null,
          website: editForm.website || null,
          password: editForm.password,
          notes: editForm.notes,
          hasMfa: editForm.hasMfa,
          mfaMethod: editForm.hasMfa ? editForm.mfaMethod : "",
          mfaConnectedTo: editForm.hasMfa ? editForm.mfaConnectedTo : "",
        }),
      });

      setRevealedPassword(payload.item.password ?? editForm.password);
      setRevealedNotes(payload.item.notes ?? editForm.notes);
      setRevealedMfa({
        hasMfa: Boolean(payload.item.hasMfa ?? editForm.hasMfa),
        method: payload.item.mfaMethod ?? editForm.mfaMethod,
        connectedTo: payload.item.mfaConnectedTo ?? editForm.mfaConnectedTo,
      });
      setEditOpen(false);
      resetEditForm();
      setMessage("Entry updated.");
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save entry changes.");
    } finally {
      setBusy(false);
    }
  }

  async function handleShareEntry() {
    if (!selectedEntryId || selectedShareUserIds.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await Promise.all(selectedShareUserIds.map((sharedWithUserId) => (
        vaultFetch(`/api/oyama-password/entries/${selectedEntryId}/shares`, {
          method: "POST",
          body: JSON.stringify({
            sharedWithUserId,
            canEdit: shareCanEdit,
          }),
        })
      )));
      setSelectedShareUserIds([]);
      setShareCanEdit(false);
      setMessage(`Access assignment updated for ${selectedShareUserIds.length} user${selectedShareUserIds.length === 1 ? "" : "s"}.`);
      await loadShares(selectedEntryId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to assign access.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteEntryWithPinConfirm() {
    if (!selectedEntryId) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      if (!/^\d{4,10}$/.test(deletePinInput)) {
        throw new Error("Enter your 4-10 digit PIN to confirm deletion.");
      }

      const session = await apiFetch<PinSession>("/api/oyama-password/pin/verify", {
        method: "POST",
        body: JSON.stringify({ pin: deletePinInput }),
      });

      sessionStorage.setItem(PIN_SESSION_STORAGE_KEY, session.sessionToken);
      setPinSessionToken(session.sessionToken);

      await apiFetch(`/api/oyama-password/entries/${selectedEntryId}`, {
        method: "DELETE",
        headers: {
          "x-oyama-password-pin-session": session.sessionToken,
        },
      });

      setSelectedEntryId(null);
      setRevealedPassword("");
      setRevealedNotes("");
      setRevealedMfa({ hasMfa: false, method: "", connectedTo: "" });
      setShares([]);
      setDeleteConfirmOpen(false);
      setDeletePinInput("");
      setMessage("Entry deleted.");
      await loadWorkspace();
    } catch (requestError) {
      setDeleteError(requestError instanceof Error ? requestError.message : "Failed to delete entry.");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleCreateLockedBackup() {
    setBackupBusy(true);
    setError(null);
    try {
      const response = await vaultFetch<{ item: BackupItem; lockedFileContents: string }>("/api/oyama-password/backups", {
        method: "POST",
        body: JSON.stringify({ label: backupLabel || undefined }),
      });

      const blob = new Blob([response.lockedFileContents], { type: "application/json" });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = response.item.fileName || `oyama-password-backup-${response.item.id}.opvaultl`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);

      setBackupLabel("");
      setMessage("Locked backup created and downloaded.");
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create locked backup.");
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleRestoreFromFile(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;

    setBackupBusy(true);
    setError(null);
    try {
      const contents = await selected.text();
      const response = await vaultFetch<{ success: boolean; restoredEntries: number; restoredShares: number }>(
        "/api/oyama-password/backups/restore",
        {
          method: "POST",
          body: JSON.stringify({
            lockedFileContents: contents,
            mode: restoreMode,
          }),
        },
      );
      setMessage(`Restore complete: ${response.restoredEntries} entries and ${response.restoredShares} shares.`);
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to restore locked backup.");
    } finally {
      event.target.value = "";
      setBackupBusy(false);
    }
  }

  if (pinChecking) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 p-6 text-slate-200">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-5 shadow-2xl">
          <p className="text-sm text-slate-300">Checking secure vault access...</p>
        </div>
      </div>
    );
  }

  if (!pinSessionToken) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 p-4 text-slate-100 sm:p-6">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur">
          <Link href="/" className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.08]">
            <span aria-hidden="true">←</span>
            Back to CRM
          </Link>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">OyamaPASSWORD</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">{hasPin ? "Unlock Vault" : "Set Your Vault PIN"}</h1>
          <p className="mt-2 text-sm text-slate-400">
            {hasPin && !resetPinMode
              ? "Enter your PIN to unlock encrypted credentials for this session."
              : hasPin && resetPinMode
                ? "Reset your vault PIN for this account and unlock immediately."
                : "Before first use, each user must create a personal vault PIN."}
          </p>

          {error ? <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div> : null}

          <div className="mt-5 space-y-3">
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pinInput}
              onChange={(event) => setPinInput(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder={hasPin && resetPinMode ? "Enter new PIN" : "Enter PIN"}
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/70"
            />
            {!hasPin || resetPinMode ? (
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pinConfirm}
                onChange={(event) => setPinConfirm(event.target.value.replace(/[^0-9]/g, ""))}
                placeholder="Confirm PIN"
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/70"
              />
            ) : null}
            <button
              type="button"
              onClick={() => void (hasPin ? (resetPinMode ? handlePinReset() : handlePinVerify()) : handlePinSetup())}
              disabled={busy}
              className="w-full rounded-xl bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
            >
              {busy ? "Working..." : hasPin ? (resetPinMode ? "Reset PIN & Unlock" : "Unlock Vault") : "Set PIN & Unlock"}
            </button>
            {pinStatus?.lockedUntil && new Date(pinStatus.lockedUntil).getTime() > Date.now() ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                PIN unlock is temporarily locked. Try again after {new Date(pinStatus.lockedUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.
              </div>
            ) : null}
            {hasPin ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
                {resetPinMode
                  ? "Use a 6-10 digit PIN. Avoid repeated digits and year-style PINs."
                  : `Vault sessions now expire after 30 minutes. ${typeof pinStatus?.remainingAttempts === "number" ? `${pinStatus.remainingAttempts} unlock attempts remain before a temporary lock.` : ""}`}
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
                Choose a 6-10 digit PIN. Avoid repeated digits and year-style PINs.
              </div>
            )}
            {hasPin ? (
              <button
                type="button"
                onClick={() => {
                  setResetPinMode((current) => !current);
                  setPinInput("");
                  setPinConfirm("");
                  setError(null);
                }}
                disabled={busy}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.08] disabled:opacity-60"
              >
                {resetPinMode ? "Use Existing PIN Instead" : "Reset PIN Instead"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const navItems: Array<{ key: NavFilter; label: string; count: number }> = [
    { key: "all", label: "All Items", count: entries.length },
    { key: "favorites", label: "Favorites", count: favorites.size },
    { key: "recent", label: "Recent", count: recentCount },
    { key: "shared", label: "Shared", count: sharedCount },
  ];

  const NAV_ICONS: Record<NavFilter, string> = {
    all: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z",
    favorites: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
    recent: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    shared: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z",
  };

  const categories: Array<{ label: string; iconPath: string; count: number }> = [
    { label: "Logins", iconPath: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z", count: entries.length },
    { label: "Secure Notes", iconPath: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", count: entries.filter((e) => Boolean(e.notes)).length },
    { label: "Shared Access", iconPath: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z", count: sharedCount },
  ];

  const scoreLabel = securityScore >= 90 ? "Excellent" : securityScore >= 70 ? "Good" : securityScore >= 50 ? "Fair" : "Weak";
  const scoreColor = securityScore >= 90 ? "text-emerald-400" : securityScore >= 70 ? "text-yellow-300" : securityScore >= 50 ? "text-amber-400" : "text-rose-400";

  const selectedFavicon = selectedEntry ? faviconUrl(selectedEntry.website) : null;
  const pwStrength = revealedPassword ? passwordStrength(revealedPassword) : null;
  const selectedTags = selectedEntry ? (entryTags[selectedEntry.id] ?? []) : [];

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_20%_0%,#0a1e4f_0%,#070d21_45%,#060914_100%)] p-3 text-slate-100">
      <div className="flex h-[calc(100vh-1.5rem)] w-full overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#0d0f1a] shadow-[0_24px_80px_rgba(2,6,23,0.65)]">
      {/* ── LEFT SIDEBAR ────────────────────────────────────────────────── */}
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-white/[0.07] bg-[#0c132f] lg:flex">
          {/* Logo */}
          <div className="flex items-center gap-3 px-5 py-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 via-violet-600 to-indigo-600 text-lg font-black text-white shadow-[0_0_24px_rgba(139,92,246,0.55)]">O</div>
            <div>
              <p className="text-[15px] font-black tracking-widest text-white">OYAMA</p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-500">Password Vault</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="mt-1 px-3">
            {navItems.map(({ key, label, count }) => (
              <button
                key={key}
                type="button"
                onClick={() => setNavFilter(key)}
                className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
                  navFilter === key
                    ? "bg-gradient-to-r from-violet-600/90 to-indigo-500/80 text-white shadow-[0_4px_14px_rgba(99,102,241,0.3)]"
                    : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
                }`}
              >
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={NAV_ICONS[key]} />
                </svg>
                <span className="flex-1 text-left">{label}</span>
                <span className={`rounded px-1.5 py-0.5 text-[11px] ${navFilter === key ? "bg-white/20 text-white" : "bg-white/10 text-slate-500"}`}>{count}</span>
              </button>
            ))}
          </nav>

          {/* Categories */}
          <div className="mt-5 border-t border-white/[0.07] px-3 pt-4">
            <div className="mb-1.5 px-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Working Views</p>
            </div>
            {categories.map(({ label, iconPath, count }) => {
              return (
                <div key={label} className="mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] text-slate-400 hover:bg-white/[0.04] hover:text-slate-200">
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
                  </svg>
                  <span className="flex-1">{label}</span>
                  <span className="text-[11px] text-slate-600">{count}</span>
                </div>
              );
            })}
          </div>

          {/* Security Score */}
          <div className="mx-3 mt-5 rounded-xl border border-white/[0.1] bg-[#1a1040] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                <svg className="h-5 w-5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-400">Security Score</p>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-2xl font-black ${scoreColor}`}>{securityScore}</span>
                  <span className={`text-xs font-semibold ${scoreColor}`}>{scoreLabel}</span>
                </div>
              </div>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-black/40">
              <div
                className={`h-full rounded-full transition-all ${securityScore >= 70 ? "bg-emerald-400" : securityScore >= 50 ? "bg-amber-400" : "bg-rose-400"}`}
                style={{ width: `${securityScore}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] text-slate-500">Last scan: {new Date().toLocaleString()}</p>
            <button
              type="button"
              onClick={() => setSecurityInfoOpen(true)}
              className="mt-1.5 text-[11px] font-semibold text-violet-300 hover:text-violet-200 hover:underline"
            >
              View Report
            </button>
          </div>

          {/* User profile */}
          <div className="mt-auto border-t border-white/[0.07] px-4 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white">
                {user ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() : "O"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-slate-200">{user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : "Vault User"}</p>
                <Link href="/" className="block truncate text-[11px] text-slate-500 hover:text-violet-300">Back to CRM</Link>
              </div>
              <svg className="h-4 w-4 shrink-0 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" /></svg>
            </div>
          </div>
        </aside>

        {/* ── RIGHT AREA (top bar + content) ──────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* TOP BAR */}
          <header className="flex h-[58px] shrink-0 items-center gap-3 border-b border-white/[0.07] bg-[#0d0f1a] px-5">
            {/* Search */}
            <div className="relative flex-1">
              <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search vault..."
                className="h-9 w-full rounded-lg border border-white/[0.09] bg-[#16192b] pl-10 pr-20 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-violet-500/50"
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-white/[0.12] bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-500">
                Ctrl+K
              </kbd>
            </div>

            {/* Add New */}
            <div className="flex shrink-0 overflow-hidden rounded-xl">
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-500 px-3.5 text-sm font-semibold text-white hover:from-violet-500 hover:to-indigo-400"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                <span>Add Entry</span>
              </button>
            </div>

            {/* Settings */}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
              aria-label="Vault settings"
            >
              <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </button>
          </header>

          {/* STATUS MESSAGES */}
          {(message || error) && (
            <div className="shrink-0 px-4 pt-2">
              {message ? <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{message}</div> : null}
              {error ? <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</div> : null}
            </div>
          )}

          {/* MAIN CONTENT: list column + detail pane */}
          <div className="flex min-h-0 flex-1 gap-3 overflow-hidden px-3 pb-3 pt-2">
            {/* ── MIDDLE LIST ──────────────────────────────────────────── */}
            <div className="flex w-[330px] shrink-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0f1220]/95">
              {/* List header */}
              <div className="flex shrink-0 items-center justify-between px-4 py-3.5">
                <div>
                  <p className="text-[15px] font-bold text-white">
                    {navFilter === "all" ? "All Items"
                      : navFilter === "favorites" ? "Favorites"
                      : navFilter === "recent" ? "Recent"
                      : "Shared"}
                  </p>
                  <p className="text-[11px] text-slate-500">{displayedEntries.length} Items</p>
                </div>
              </div>

              {/* Scrollable list */}
              <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
                  </div>
                ) : displayedEntries.length === 0 ? (
                  <div className="py-16 text-center text-xs text-slate-500">
                    {search ? "No matching entries." : "No entries yet. Click + Add New."}
                  </div>
                ) : displayedEntries.map((entry) => {
                  const favicon = faviconUrl(entry.website);
                  const isFav = favorites.has(entry.id);
                  const isSelected = selectedEntryId === entry.id;
                  return (
                    <div
                      key={entry.id}
                      className={`group mb-0.5 flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2.5 transition-colors ${
                        isSelected
                          ? "bg-[#1e1545] ring-1 ring-violet-500/40"
                          : "hover:bg-white/[0.04]"
                      }`}
                      onClick={() => {
                        setSelectedEntryId(entry.id);
                        setRevealedPassword("");
                        setRevealedNotes("");
                        setRevealedMfa({ hasMfa: false, method: "", connectedTo: "" });
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setSelectedEntryId(entry.id); setRevealedPassword(""); setRevealedNotes(""); setRevealedMfa({ hasMfa: false, method: "", connectedTo: "" }); } }}
                    >
                      {/* Icon */}
                      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#1c1f32]">
                        {favicon ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={favicon} alt="" className="h-6 w-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <span className="text-base font-bold text-white">{entry.title.slice(0, 1).toUpperCase()}</span>
                        )}
                      </div>

                      {/* Text */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-white">{entry.title}</p>
                        <p className="truncate text-[11px] text-slate-500">{entry.username || entry.website || "No account label"}</p>
                      </div>

                      {/* Actions */}
                      <button
                        type="button"
                        aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(entry.id); }}
                        className="shrink-0"
                      >
                        <svg
                          className={`h-4 w-4 transition-colors ${isFav ? "fill-amber-400 text-amber-400" : "fill-transparent text-slate-600 group-hover:text-slate-400"}`}
                          stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Footer count */}
              <div className="shrink-0 border-t border-white/[0.06] px-4 py-2.5 text-[11px] text-slate-500">
                {displayedEntries.length} items
              </div>
            </div>

            {/* ── DETAIL PANE ──────────────────────────────────────────── */}
            <div className="flex min-w-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0d0f1c] px-6 py-5">
              {!selectedEntry ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 text-slate-500">
                  <p className="text-center text-sm">Select an item from the list to view details.</p>
                </div>
              ) : (
                <>
                  {/* Entry header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {/* Large icon */}
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/[0.1] bg-[#1c1f32]">
                        {selectedFavicon ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={selectedFavicon} alt="" className="h-10 w-10 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <span className="text-2xl font-black text-white">{selectedEntry.title.slice(0, 1).toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white">{selectedEntry.title}</h2>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-violet-300">
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>
                            Login
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleFavorite(selectedEntry.id)}
                            className="text-slate-500 hover:text-amber-400"
                            aria-label={favorites.has(selectedEntry.id) ? "Remove from favorites" : "Add to favorites"}
                          >
                            <svg className={`h-4.5 w-4.5 ${favorites.has(selectedEntry.id) ? "fill-amber-400 text-amber-400" : "fill-transparent"}`} stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          </button>
                        </div>
                        <p className="mt-1.5 text-[11px] text-slate-500">
                          Last modified: {new Date(selectedEntry.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}&nbsp;|&nbsp;
                          Created: {new Date(selectedEntry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void openEditModal()}
                        disabled={busy || !selectedEntry.canEdit}
                        className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/15 disabled:opacity-40"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeletePinInput("");
                          setDeleteError(null);
                          setDeleteConfirmOpen(true);
                        }}
                        disabled={busy || (!selectedEntry.sharedByYou && !showAdminBadge)}
                        className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Credential fields */}
                  <div className="mt-5 space-y-3">
                    {/* Username */}
                    <div className="rounded-xl border border-white/[0.09] bg-[#131628] px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Username</p>
                      <div className="mt-1.5 flex items-center justify-between gap-3">
                        <p className="truncate text-sm text-slate-100">{selectedEntry.username || <span className="text-slate-500">Not set</span>}</p>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(selectedEntry.username ?? "", "username")}
                          className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-slate-400 hover:bg-white/[0.07] hover:text-slate-200"
                          aria-label="Copy username"
                        >
                          {copiedField === "username" ? (
                            <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                          ) : (
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" /></svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Password */}
                    <div className="rounded-xl border border-white/[0.09] bg-[#131628] px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Password</p>
                      <div className="mt-1.5 flex items-center justify-between gap-3">
                        <p className="flex-1 truncate font-mono text-sm tracking-widest text-slate-100">
                          {revealedPassword || "••••••••••••••••"}
                        </p>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleRevealSecret()}
                            disabled={busy}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-white/[0.07] hover:text-slate-200 disabled:opacity-50"
                            aria-label={revealedPassword ? "Hide password" : "Reveal password"}
                          >
                            {revealedPassword ? (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                            ) : (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(revealedPassword, "password")}
                            disabled={!revealedPassword}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-white/[0.07] hover:text-slate-200 disabled:opacity-40"
                            aria-label="Copy password"
                          >
                            {copiedField === "password" ? (
                              <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                            ) : (
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" /></svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Website */}
                    <div className="rounded-xl border border-white/[0.09] bg-[#131628] px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Website</p>
                      <div className="mt-1.5 flex items-center justify-between gap-3">
                        <p className="truncate text-sm text-violet-300">{selectedEntry.website || <span className="text-slate-500">No website</span>}</p>
                        {selectedEntry.website ? (
                          <a
                            href={selectedEntry.website.startsWith("http") ? selectedEntry.website : `https://${selectedEntry.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-slate-400 hover:bg-white/[0.07] hover:text-slate-200"
                            aria-label="Open website"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Strong Password card */}
                  {revealedPassword && pwStrength && pwStrength.score >= 4 && (
                    <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-[#0d2019] px-4 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                        <svg className="h-5 w-5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-emerald-400">Strong Password</p>
                        <p className="text-[11px] text-slate-400">This password is strong and unique.</p>
                      </div>
                      <button type="button" className="text-[11px] font-semibold text-violet-300 hover:text-violet-200 hover:underline" onClick={() => setSecurityInfoOpen(true)}>
                        View Details
                      </button>
                    </div>
                  )}
                  {revealedPassword && pwStrength && pwStrength.score < 4 && (
                    <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-500/20 bg-[#1e1508] px-4 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                        <svg className="h-5 w-5 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-bold ${pwStrength.color}`}>{pwStrength.label} Password</p>
                        <p className="text-[11px] text-slate-400">Consider using a stronger password.</p>
                      </div>
                    </div>
                  )}

                  {/* MFA banner */}
                  {revealedMfa.hasMfa && (
                    <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 shrink-0 text-cyan-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>
                        <p className="text-sm font-semibold text-cyan-200">MFA Enabled</p>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{revealedMfa.method || "Authenticator app"}{revealedMfa.connectedTo ? ` · ${revealedMfa.connectedTo}` : ""}</p>
                    </div>
                  )}

                  {/* Notes */}
                  <div className="mt-4 rounded-xl border border-white/[0.09] bg-[#131628] px-4 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Notes</p>
                      {(revealedNotes || selectedEntry.notes) && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(revealedNotes || selectedEntry.notes || "", "notes")}
                          className="text-slate-500 hover:text-slate-300"
                          aria-label="Copy notes"
                        >
                          {copiedField === "notes" ? (
                            <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                          ) : (
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" /></svg>
                          )}
                        </button>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {revealedNotes || selectedEntry.notes || <span className="text-slate-500 italic">No notes. Reveal to see encrypted notes.</span>}
                    </p>
                  </div>

                  {/* Tags */}
                  <div className="mt-4">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Tags</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-[12px] font-medium text-violet-200"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => {
                              const next = { ...entryTags, [selectedEntry.id]: selectedTags.filter((t) => t !== tag) };
                              setEntryTags(next);
                              if (typeof window !== "undefined") localStorage.setItem(TAGS_KEY, JSON.stringify(next));
                            }}
                            className="ml-0.5 text-violet-400/70 hover:text-violet-200"
                            aria-label={`Remove tag ${tag}`}
                          >×</button>
                        </span>
                      ))}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const trimmed = newTagInput.trim();
                          if (!trimmed || selectedTags.includes(trimmed)) { setNewTagInput(""); return; }
                          const next = { ...entryTags, [selectedEntry.id]: [...selectedTags, trimmed] };
                          setEntryTags(next);
                          if (typeof window !== "undefined") localStorage.setItem(TAGS_KEY, JSON.stringify(next));
                          setNewTagInput("");
                        }}
                        className="inline-flex"
                      >
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-white/20 px-3 py-1 text-[12px] text-slate-500 hover:border-violet-400/50 hover:text-violet-300"
                        >
                          {newTagInput ? `Add "${newTagInput}"` : (
                            <>
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                              Add Tag
                            </>
                          )}
                        </button>
                        <input
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          placeholder=""
                          className="ml-1 w-20 border-0 bg-transparent text-[12px] text-slate-300 outline-none"
                          aria-label="New tag name"
                        />
                      </form>
                    </div>
                  </div>

                  {/* Assign Access */}
                  <div className="mt-5 rounded-xl border border-white/[0.09] bg-[#131628] px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Assign Access</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">Grant view or edit access to other vault users.</p>
                      </div>
                      <button
                        type="button"
                        onClick={toggleAllShareUsers}
                        disabled={!selectedEntry.canEdit || availableShareUsers.length === 0}
                        className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-black/50 disabled:opacity-40"
                      >
                        {allShareUsersSelected ? "Clear all" : "Select all"}
                      </button>
                    </div>
                    <div className="mt-3 max-h-40 space-y-1 overflow-auto rounded-xl border border-white/[0.06] bg-[#0d0f1a] p-2">
                      {availableShareUsers.length === 0 ? (
                        <p className="px-2 py-3 text-xs text-slate-500">No other users available.</p>
                      ) : availableShareUsers.map((item) => {
                        const checked = selectedShareUserIds.includes(item.id);
                        return (
                          <label key={item.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-2.5 py-2 transition-colors ${checked ? "border-violet-400/30 bg-violet-400/10" : "border-transparent hover:bg-white/[0.04]"}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleShareUser(item.id)}
                              disabled={!selectedEntry.canEdit}
                              className="rounded border-slate-600 bg-slate-900 text-violet-400"
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-slate-200">{item.firstName} {item.lastName}</span>
                              <span className="block truncate text-[11px] text-slate-500">{item.email}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                        <input type="checkbox" checked={shareCanEdit} onChange={(e) => setShareCanEdit(e.target.checked)} className="rounded border-slate-600 text-violet-400" />
                        Allow edit access
                      </label>
                      <button
                        type="button"
                        onClick={() => void handleShareEntry()}
                        disabled={busy || selectedShareUserIds.length === 0 || !selectedEntry.canEdit}
                        className="ml-auto rounded-lg border border-violet-400/30 bg-violet-400/10 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-400/15 disabled:opacity-50"
                      >
                        Save {selectedShareUserIds.length > 0 ? `${selectedShareUserIds.length} ` : ""}Assignment{selectedShareUserIds.length === 1 ? "" : "s"}
                      </button>
                    </div>
                    {shares.length > 0 && (
                      <ul className="mt-3 space-y-1 border-t border-white/[0.06] pt-2">
                        {shares.map((share) => {
                          const u = users.find((item) => item.id === share.sharedWithUserId);
                          return (
                            <li key={`${share.sharedWithUserId}-${share.createdAt}`} className="flex items-center gap-2 rounded-lg bg-black/20 px-2.5 py-1.5 text-[11px] text-slate-400">
                              {u ? `${u.firstName} ${u.lastName}` : share.sharedWithUserId}
                              <span className="ml-auto rounded bg-white/10 px-1.5 py-0.5 text-[10px]">{share.canEdit ? "edit" : "view"}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {/* Timestamps */}
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                    <p>Created: {new Date(selectedEntry.createdAt).toLocaleString()}</p>
                    <p>Updated: {new Date(selectedEntry.updatedAt).toLocaleString()}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── CREATE MODAL ────────────────────────────────────────────────── */}
        {createOpen ? (
          <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Create vault record">
            <button type="button" className="absolute inset-0" aria-label="Close create dialog" onClick={() => setCreateOpen(false)} />
            <div className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-[#081327] p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-300">New Record</p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">Add Vault Entry</h2>
                </div>
                <button type="button" onClick={() => setCreateOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]" aria-label="Close">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Title (required)" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400/70" />
                <input value={newUsername} onChange={(event) => setNewUsername(event.target.value)} placeholder="Username / email" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400/70" />
                <input value={newWebsite} onChange={(event) => setNewWebsite(event.target.value)} placeholder="Website" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400/70" />
                <input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Password (required)" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400/70" />
              </div>

              <textarea value={newNotes} onChange={(event) => setNewNotes(event.target.value)} placeholder="Notes" className="mt-3 h-24 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400/70" />

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                  <input type="checkbox" checked={newHasMfa} onChange={(event) => setNewHasMfa(event.target.checked)} className="rounded border-slate-600 bg-slate-900 text-cyan-400" />
                  MFA enabled
                </label>
                <input value={newMfaMethod} onChange={(event) => setNewMfaMethod(event.target.value)} placeholder="MFA method" disabled={!newHasMfa} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400/70 disabled:opacity-50" />
              </div>
              <input value={newMfaConnectedTo} onChange={(event) => setNewMfaConnectedTo(event.target.value)} placeholder="MFA connected to" disabled={!newHasMfa} className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400/70 disabled:opacity-50" />

              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setCreateOpen(false)} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/[0.08]">Cancel</button>
                <button type="button" onClick={() => void handleCreateEntry()} disabled={busy} className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:from-violet-500 hover:to-indigo-400 disabled:opacity-60">{busy ? "Saving..." : "Save Entry"}</button>
              </div>
            </div>
          </div>
        ) : null}

        {editOpen && selectedEntry ? (
          <div className="fixed inset-0 z-[56] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Edit vault record">
            <button
              type="button"
              className="absolute inset-0"
              aria-label="Close edit dialog"
              onClick={() => {
                if (busy) return;
                setEditOpen(false);
                resetEditForm();
              }}
            />
            <div className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-[#081327] p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Edit Record</p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">Update {selectedEntry.title}</h2>
                  <p className="mt-1 text-sm text-slate-400">Edit the working vault fields directly instead of using placeholder actions.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (busy) return;
                    setEditOpen(false);
                    resetEditForm();
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                  aria-label="Close"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input value={editForm.title} onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))} placeholder="Title (required)" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400/70" />
                <input value={editForm.username} onChange={(event) => setEditForm((current) => ({ ...current, username: event.target.value }))} placeholder="Username / email" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400/70" />
                <input value={editForm.website} onChange={(event) => setEditForm((current) => ({ ...current, website: event.target.value }))} placeholder="Website" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400/70" />
                <input value={editForm.password} onChange={(event) => setEditForm((current) => ({ ...current, password: event.target.value }))} placeholder="Password (required)" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400/70" />
              </div>

              <textarea value={editForm.notes} onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes" className="mt-3 h-24 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400/70" />

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                  <input type="checkbox" checked={editForm.hasMfa} onChange={(event) => setEditForm((current) => ({ ...current, hasMfa: event.target.checked }))} className="rounded border-slate-600 bg-slate-900 text-cyan-400" />
                  MFA enabled
                </label>
                <input value={editForm.mfaMethod} onChange={(event) => setEditForm((current) => ({ ...current, mfaMethod: event.target.value }))} placeholder="MFA method" disabled={!editForm.hasMfa} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400/70 disabled:opacity-50" />
              </div>
              <input value={editForm.mfaConnectedTo} onChange={(event) => setEditForm((current) => ({ ...current, mfaConnectedTo: event.target.value }))} placeholder="MFA connected to" disabled={!editForm.hasMfa} className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400/70 disabled:opacity-50" />

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (busy) return;
                    setEditOpen(false);
                    resetEditForm();
                  }}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/[0.08]"
                >
                  Cancel
                </button>
                <button type="button" onClick={() => void handleSaveEntryEdits()} disabled={busy} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60">{busy ? "Saving..." : "Save Changes"}</button>
              </div>
            </div>
          </div>
        ) : null}

        {settingsOpen ? (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Vault settings">
            <button type="button" className="absolute inset-0" aria-label="Close settings" onClick={() => setSettingsOpen(false)} />
            <aside className="relative flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#080f1f] p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-300">Settings</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">Vault Security</h2>
                  <p className="mt-1 text-sm text-slate-400">Session, backup, restore, and encryption controls.</p>
                </div>
                <button type="button" onClick={() => setSettingsOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]" aria-label="Close settings">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={() => setSecurityInfoOpen(true)}
                  className="flex w-full items-center justify-between rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-left text-sm font-semibold text-cyan-100 hover:bg-cyan-400/15"
                >
                  <span>How vault security works</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-300/30">i</span>
                </button>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Backup</p>
                  <input
                    value={backupLabel}
                    onChange={(event) => setBackupLabel(event.target.value)}
                    placeholder="Optional backup label"
                    className="mt-3 w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400/70"
                  />
                  <button type="button" onClick={() => void handleCreateLockedBackup()} disabled={backupBusy} className="mt-3 w-full rounded-xl bg-violet-500 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-60">
                    {backupBusy ? "Creating..." : "Create Locked Backup"}
                  </button>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Restore</p>
                  <select value={restoreMode} onChange={(event) => setRestoreMode(event.target.value === "replace" ? "replace" : "merge")} className="mt-3 w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-slate-100">
                    <option value="merge">Restore Mode: Merge</option>
                    <option value="replace">Restore Mode: Replace All Data</option>
                  </select>
                  <label className="mt-3 flex cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/[0.08]">
                    Upload Locked File
                    <input type="file" accept=".opvaultl,application/json,.json" className="hidden" onChange={(event) => void handleRestoreFromFile(event)} />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPinSessionToken("");
                    sessionStorage.removeItem(PIN_SESSION_STORAGE_KEY);
                    setSettingsOpen(false);
                    setMessage("Vault locked for this browser session.");
                  }}
                  className="w-full rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-400/15"
                >
                  Lock Vault
                </button>
              </div>
            </aside>
          </div>
        ) : null}

        {deleteConfirmOpen && selectedEntry ? (
          <div className="fixed inset-0 z-[58] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Confirm entry deletion">
            <button
              type="button"
              className="absolute inset-0"
              aria-label="Close delete confirmation"
              onClick={() => {
                if (deleteBusy) return;
                setDeleteConfirmOpen(false);
                setDeletePinInput("");
                setDeleteError(null);
              }}
            />
            <div className="relative w-full max-w-md rounded-2xl border border-rose-500/25 bg-[#0b1220] p-5 shadow-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-300">Delete Entry</p>
              <h3 className="mt-1 text-lg font-semibold text-white">Confirm Permanent Delete</h3>
              <p className="mt-2 text-sm text-slate-400">
                This will permanently remove <span className="font-semibold text-slate-200">{selectedEntry.title}</span> from your vault. Enter your PIN to continue.
              </p>

              {deleteError ? (
                <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  {deleteError}
                </div>
              ) : null}

              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={deletePinInput}
                onChange={(event) => setDeletePinInput(event.target.value.replace(/[^0-9]/g, ""))}
                placeholder="Enter vault PIN"
                className="mt-4 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-rose-400/70"
              />

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (deleteBusy) return;
                    setDeleteConfirmOpen(false);
                    setDeletePinInput("");
                    setDeleteError(null);
                  }}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/[0.08] disabled:opacity-50"
                  disabled={deleteBusy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteEntryWithPinConfirm()}
                  disabled={deleteBusy}
                  className="rounded-xl border border-rose-500/30 bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/25 disabled:opacity-50"
                >
                  {deleteBusy ? "Deleting..." : "Delete Permanently"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {securityInfoOpen ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Vault security information">
            <button type="button" className="absolute inset-0" aria-label="Close security info" onClick={() => setSecurityInfoOpen(false)} />
            <div className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-[#091122] p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Security Info</p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">How OyamaPASSWORD Protects Records</h2>
                </div>
                <button type="button" onClick={() => setSecurityInfoOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]" aria-label="Close">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  ["PIN gate", "The vault requires a user PIN before records can be listed, revealed, shared, backed up, or restored."],
                  ["Encrypted secrets", "Passwords, notes, and MFA connection details are encrypted server-side before storage."],
                  ["Session token", "Unlocking creates a temporary vault session token stored in this browser session."],
                  ["Access assignment", "Owners and permitted users can view records; edit access is explicitly assigned."],
                  ["Audit events", "Create, reveal, update, delete, share, backup, and restore actions write audit records."],
                  ["Locked backups", "Backup files are exported as encrypted locked vault files and can be restored by merge or replace mode."],
                ].map(([title, text]) => (
                  <div key={title} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
