"""Tkinter release publisher for OyamaCRM.

Auto-advances version, optionally runs validation commands,
and creates an upload zip that excludes all .env files.
"""

from __future__ import annotations

import datetime as dt
import json
import queue
import re
import subprocess
import threading
import tkinter as tk
import zipfile
from pathlib import Path
from tkinter import filedialog, messagebox, ttk
from tkinter.scrolledtext import ScrolledText

INCLUDE_DIRS = [
    "app",
    "server",
    "prisma",
    "public",
    "scripts",
    "tests",
    "docs",
]

INCLUDE_FILES = [
    "package.json",
    "pnpm-lock.yaml",
    "next.config.ts",
    "next-env.d.ts",
    "postcss.config.mjs",
    "eslint.config.mjs",
    "ecosystem.config.cjs",
    "tsconfig.json",
    "vitest.config.mts",
    "AGENTS.md",
    "CLAUDE.md",
    "README.md",
]

EXCLUDE_DIR_NAMES = {
    ".git",
    ".next",
    "node_modules",
    "coverage",
    "dist",
    "release",
    "__pycache__",
}

EXCLUDE_FILE_SUFFIXES = {
    ".log",
    ".sqlite",
    ".sqlite3",
    ".db",
    ".pyc",
}

ENV_FILE_PATTERN = re.compile(r"^\.env(\..+)?$", re.IGNORECASE)
VERSION_PATTERN = re.compile(r"^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$")


class ReleasePublishGui(tk.Tk):
    """GUI workflow for release packaging and version bumping."""

    def __init__(self) -> None:
        super().__init__()
        self.title("OyamaCRM Release Publisher")
        self.geometry("1060x820")
        self.minsize(980, 760)

        self.root_dir = Path(__file__).resolve().parents[1]
        self.package_json = self.root_dir / "package.json"
        self.output_default = self.root_dir / "release_packages"
        self.log_queue: queue.Queue[str] = queue.Queue()

        self.current_version = self._read_current_version()

        self.status_var = tk.StringVar(value="Ready")
        self.bump_type_var = tk.StringVar(value="patch")
        self.prerelease_label_var = tk.StringVar(value="beta")
        self.current_version_var = tk.StringVar(value=self.current_version)
        self.next_version_var = tk.StringVar(value=self.compute_next_version())
        self.output_dir_var = tk.StringVar(value=str(self.output_default))
        self.run_checks_var = tk.BooleanVar(value=True)
        self.create_git_tag_var = tk.BooleanVar(value=False)
        self.create_git_commit_var = tk.BooleanVar(value=False)

        self._build_ui()
        self.after(120, self._drain_log_queue)

    def _build_ui(self) -> None:
        frame = ttk.Frame(self, padding=14)
        frame.pack(fill=tk.BOTH, expand=True)

        ttk.Label(frame, text="OyamaCRM Release Publisher", font=("Segoe UI", 16, "bold")).pack(anchor=tk.W)
        ttk.Label(
            frame,
            text="Auto-bump version and create an env-safe upload zip. .env files are always excluded.",
        ).pack(anchor=tk.W, pady=(2, 12))

        top = ttk.LabelFrame(frame, text="Release Settings", padding=10)
        top.pack(fill=tk.X)

        ttk.Label(top, text="Current version").grid(row=0, column=0, sticky="w", padx=(0, 8), pady=3)
        ttk.Entry(top, textvariable=self.current_version_var, width=18, state="readonly").grid(row=0, column=1, sticky="w", pady=3)

        ttk.Label(top, text="Bump type").grid(row=1, column=0, sticky="w", padx=(0, 8), pady=3)
        bump_combo = ttk.Combobox(
            top,
            textvariable=self.bump_type_var,
            width=16,
            state="readonly",
            values=["patch", "minor", "major", "prerelease"],
        )
        bump_combo.grid(row=1, column=1, sticky="w", pady=3)
        bump_combo.bind("<<ComboboxSelected>>", lambda _e: self._refresh_next_version())

        ttk.Label(top, text="Prerelease label").grid(row=2, column=0, sticky="w", padx=(0, 8), pady=3)
        prerelease_entry = ttk.Entry(top, textvariable=self.prerelease_label_var, width=18)
        prerelease_entry.grid(row=2, column=1, sticky="w", pady=3)
        prerelease_entry.bind("<KeyRelease>", lambda _e: self._refresh_next_version())

        ttk.Label(top, text="Next version").grid(row=3, column=0, sticky="w", padx=(0, 8), pady=3)
        ttk.Entry(top, textvariable=self.next_version_var, width=18, state="readonly").grid(row=3, column=1, sticky="w", pady=3)

        ttk.Label(top, text="Output folder").grid(row=4, column=0, sticky="w", padx=(0, 8), pady=3)
        ttk.Entry(top, textvariable=self.output_dir_var, width=64).grid(row=4, column=1, sticky="we", pady=3)
        ttk.Button(top, text="Browse", command=self._browse_output).grid(row=4, column=2, padx=(8, 0), pady=3)

        ttk.Checkbutton(top, text="Run typecheck + build before packaging", variable=self.run_checks_var).grid(
            row=5, column=0, columnspan=3, sticky="w", pady=(8, 2)
        )
        ttk.Checkbutton(top, text="Create git commit for version bump", variable=self.create_git_commit_var).grid(
            row=6, column=0, columnspan=3, sticky="w", pady=2
        )
        ttk.Checkbutton(top, text="Create git tag vX.Y.Z", variable=self.create_git_tag_var).grid(
            row=7, column=0, columnspan=3, sticky="w", pady=2
        )

        top.columnconfigure(1, weight=1)

        actions = ttk.Frame(frame)
        actions.pack(fill=tk.X, pady=(10, 8))

        ttk.Button(actions, text="Recompute Next Version", command=self._refresh_next_version).pack(side=tk.LEFT)
        ttk.Button(actions, text="Run Publish Workflow", command=self._run_publish).pack(side=tk.LEFT, padx=(8, 0))
        ttk.Label(actions, textvariable=self.status_var, foreground="#0f766e").pack(side=tk.LEFT, padx=(14, 0))

        notes = ttk.LabelFrame(frame, text="Safety Notes", padding=10)
        notes.pack(fill=tk.X, pady=(0, 8))
        ttk.Label(
            notes,
            text=(
                "This tool never includes .env or .env.* files in the zip.\n"
                "Use deployment sync commands that preserve server-side env files and secrets."
            ),
            justify="left",
        ).pack(anchor="w")

        self.log = ScrolledText(frame, wrap=tk.WORD, font=("Consolas", 10), height=24)
        self.log.pack(fill=tk.BOTH, expand=True)

    def _browse_output(self) -> None:
        selected = filedialog.askdirectory(initialdir=self.output_dir_var.get() or str(self.root_dir))
        if selected:
            self.output_dir_var.set(selected)

    def _read_current_version(self) -> str:
        payload = json.loads(self.package_json.read_text(encoding="utf-8"))
        version = str(payload.get("version", "0.1.0")).strip()
        if not VERSION_PATTERN.match(version):
            raise ValueError(f"Unsupported package.json version format: {version}")
        return version

    def compute_next_version(self) -> str:
        current = self.current_version_var.get().strip() or self.current_version
        match = VERSION_PATTERN.match(current)
        if not match:
            return current

        major = int(match.group(1))
        minor = int(match.group(2))
        patch = int(match.group(3))
        prerelease = match.group(4)
        bump_type = self.bump_type_var.get().strip() or "patch"
        label = re.sub(r"[^A-Za-z0-9.-]", "", self.prerelease_label_var.get().strip() or "beta")

        if bump_type == "major":
            return f"{major + 1}.0.0"
        if bump_type == "minor":
            return f"{major}.{minor + 1}.0"
        if bump_type == "prerelease":
            if prerelease and prerelease.startswith(f"{label}."):
                suffix = prerelease.split(".")[-1]
                if suffix.isdigit():
                    return f"{major}.{minor}.{patch}-{label}.{int(suffix) + 1}"
            return f"{major}.{minor}.{patch + 1}-{label}.1"

        return f"{major}.{minor}.{patch + 1}"

    def _refresh_next_version(self) -> None:
        self.next_version_var.set(self.compute_next_version())

    def _append_log(self, line: str) -> None:
        self.log_queue.put(line)

    def _drain_log_queue(self) -> None:
        while True:
            try:
                line = self.log_queue.get_nowait()
            except queue.Empty:
                break
            self.log.insert(tk.END, f"{line}\n")
            self.log.see(tk.END)
        self.after(120, self._drain_log_queue)

    def _run_cmd(self, cmd: list[str]) -> None:
        self._append_log(f"> {' '.join(cmd)}")
        process = subprocess.Popen(
            cmd,
            cwd=self.root_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            shell=False,
        )
        assert process.stdout is not None
        for line in process.stdout:
            text = line.strip()
            if text:
                self._append_log(text)
        process.wait()
        if process.returncode != 0:
            raise RuntimeError(f"Command failed ({process.returncode}): {' '.join(cmd)}")

    def _is_env_file(self, filename: str) -> bool:
        return bool(ENV_FILE_PATTERN.match(filename))

    def _should_skip_path(self, rel_path: Path) -> bool:
        parts = {p.lower() for p in rel_path.parts}
        if parts & {name.lower() for name in EXCLUDE_DIR_NAMES}:
            return True

        if self._is_env_file(rel_path.name):
            return True

        suffix = rel_path.suffix.lower()
        if suffix in EXCLUDE_FILE_SUFFIXES:
            return True

        if rel_path.as_posix().startswith("server/.data/"):
            return True

        return False

    def _iter_release_paths(self) -> list[Path]:
        paths: list[Path] = []

        for file_name in INCLUDE_FILES:
            abs_path = self.root_dir / file_name
            if abs_path.exists() and abs_path.is_file():
                rel = abs_path.relative_to(self.root_dir)
                if not self._should_skip_path(rel):
                    paths.append(rel)

        for dir_name in INCLUDE_DIRS:
            abs_dir = self.root_dir / dir_name
            if not abs_dir.exists() or not abs_dir.is_dir():
                continue

            for child in abs_dir.rglob("*"):
                if not child.is_file():
                    continue
                rel = child.relative_to(self.root_dir)
                if self._should_skip_path(rel):
                    continue
                paths.append(rel)

        unique_sorted = sorted(set(paths), key=lambda p: p.as_posix())
        return unique_sorted

    def _write_version(self, version: str) -> None:
        payload = json.loads(self.package_json.read_text(encoding="utf-8"))
        payload["version"] = version
        self.package_json.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    def _create_zip(self, version: str) -> Path:
        output_dir = Path(self.output_dir_var.get().strip() or str(self.output_default)).resolve()
        output_dir.mkdir(parents=True, exist_ok=True)

        timestamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
        zip_path = output_dir / f"oyamacrm-release-v{version}-{timestamp}.zip"
        manifest_path = output_dir / f"oyamacrm-release-v{version}-{timestamp}.manifest.json"

        release_paths = self._iter_release_paths()
        self._append_log(f"Packaging {len(release_paths)} files into {zip_path.name}")

        with zipfile.ZipFile(zip_path, mode="w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for rel in release_paths:
                archive.write(self.root_dir / rel, rel.as_posix())

        manifest = {
            "version": version,
            "createdAt": dt.datetime.now().isoformat(),
            "zipFile": str(zip_path),
            "fileCount": len(release_paths),
            "envExclusion": {
                "rules": [".env", ".env.*", "server/.data/*"],
                "guaranteed": True,
            },
            "includes": {
                "dirs": INCLUDE_DIRS,
                "files": INCLUDE_FILES,
            },
        }
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        self._append_log(f"Manifest created: {manifest_path.name}")

        return zip_path

    def _run_publish_worker(self) -> None:
        try:
            next_version = self.next_version_var.get().strip()
            if not VERSION_PATTERN.match(next_version):
                raise ValueError("Next version is invalid")

            self._append_log(f"Current version: {self.current_version_var.get()}")
            self._append_log(f"Next version: {next_version}")

            self._write_version(next_version)
            self._append_log("Updated package.json version.")

            if self.run_checks_var.get():
                self._run_cmd(["pnpm", "typecheck:web"])
                self._run_cmd(["pnpm", "typecheck:server"])
                self._run_cmd(["pnpm", "build"])
                self._run_cmd(["pnpm", "build:server"])

            if self.create_git_commit_var.get():
                self._run_cmd(["git", "add", "package.json"])
                self._run_cmd(["git", "commit", "-m", f"release: v{next_version}"])

            if self.create_git_tag_var.get():
                self._run_cmd(["git", "tag", f"v{next_version}"])

            zip_path = self._create_zip(next_version)
            self.current_version_var.set(next_version)
            self.current_version = next_version
            self.next_version_var.set(self.compute_next_version())
            self.status_var.set("Publish workflow completed")
            self._append_log(f"Release package ready: {zip_path}")
            self._append_log("Done.")
        except Exception as exc:  # noqa: BLE001
            self.status_var.set("Publish workflow failed")
            self._append_log(f"ERROR: {exc}")
            messagebox.showerror("Release Publisher", str(exc))

    def _run_publish(self) -> None:
        if not messagebox.askyesno(
            "Confirm Publish",
            (
                f"This will bump version to {self.next_version_var.get()} and create a new upload zip.\n\n"
                "All .env files are excluded automatically. Continue?"
            ),
        ):
            return

        self.status_var.set("Running publish workflow...")
        thread = threading.Thread(target=self._run_publish_worker, daemon=True)
        thread.start()


def main() -> None:
    app = ReleasePublishGui()
    app.mainloop()


if __name__ == "__main__":
    main()
