"""Professional Tkinter GUI for production build, env generation, and zip packaging."""

from __future__ import annotations

import datetime as dt
import json
import os
import queue
import re
import shutil
import subprocess
import threading
import tkinter as tk
from collections.abc import Callable
from pathlib import Path
from tkinter import filedialog, messagebox, ttk
from tkinter.scrolledtext import ScrolledText

# Default directories included in a production source bundle.
DEFAULT_INCLUDE_DIRS = [
    "app",
    "server",
    "prisma",
    "public",
    "docs",
    "scripts",
]

# Default files included in a production source bundle.
DEFAULT_INCLUDE_FILES = [
    ".env.example",
    "README.md",
    "AGENTS.md",
    "CLAUDE.md",
    "package.json",
    "pnpm-lock.yaml",
    "next.config.ts",
    "next-env.d.ts",
    "postcss.config.mjs",
    "eslint.config.mjs",
    "ecosystem.config.cjs",
    "tsconfig.json",
    "vitest.config.mts",
]

# Patterns ignored when copying folders into a stage directory.
COPY_IGNORE_PATTERNS = ["node_modules", ".next", "coverage", "dist", "*.log", "__pycache__", "*.pyc"]

# Standard env fields surfaced in the GUI. Additional values are supported as custom fields.
STANDARD_ENV_KEYS = [
    "NODE_ENV",
    "API_PORT",
    "FRONTEND_ORIGIN",
    "NEXT_PUBLIC_API_URL",
    "DATABASE_URL",
    "WATCHDOG_DATABASE_URL",
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
    "APP_NAME",
    "APP_VERSION",
    "BUILD_DATE",
    "GIT_COMMIT",
    "RELEASE_CHANNEL",
    "LAST_AUDIT_DATE",
    "NEXT_PUBLIC_APP_NAME",
    "NEXT_PUBLIC_APP_VERSION",
    "NEXT_PUBLIC_BUILD_DATE",
    "NEXT_PUBLIC_GIT_COMMIT",
    "NEXT_PUBLIC_RELEASE_CHANNEL",
    "NEXT_PUBLIC_APP_ENV",
    "NEXT_PUBLIC_LAST_AUDIT_DATE",
]


class ProductionBuildManagerGui(tk.Tk):
    """Desktop workflow tool for generating env files, running builds, and creating zip bundles."""

    def __init__(self) -> None:
        super().__init__()
        self.title("OyamaCRM Production Build Manager")
        self.geometry("1180x860")
        self.minsize(1060, 760)

        self.root_dir = Path(__file__).resolve().parents[1]
        self.profile_path = self.root_dir / "easy_prep_tools" / ".production_build_profile.json"
        self.log_queue: queue.Queue[str] = queue.Queue()
        self.is_busy = False

        self.version = self._read_package_version()
        self.git_commit = self._read_git_commit()
        self.today = dt.date.today().isoformat()

        self._build_state()
        self._build_ui()
        self._load_profile_if_exists()
        self.after(120, self._drain_log_queue)

    def _build_state(self) -> None:
        """Initialize Tk variables and env field state."""
        default_dist = self.root_dir / "dist"
        default_env = self.root_dir / ".env.production"

        self.vars: dict[str, tk.Variable] = {
            "bundle_prefix": tk.StringVar(value="oyamacrm-production"),
            "output_dir": tk.StringVar(value=str(default_dist)),
            "env_output_path": tk.StringVar(value=str(default_env)),
            "include_env_in_zip": tk.BooleanVar(value=False),
            "run_install": tk.BooleanVar(value=False),
            "run_db_generate": tk.BooleanVar(value=True),
            "run_web_build": tk.BooleanVar(value=True),
            "run_server_build": tk.BooleanVar(value=True),
            "open_output_folder": tk.BooleanVar(value=True),
        }

        self.env_vars: dict[str, tk.StringVar] = {
            "NODE_ENV": tk.StringVar(value="production"),
            "API_PORT": tk.StringVar(value="4000"),
            "FRONTEND_ORIGIN": tk.StringVar(value="http://localhost:3001"),
            "NEXT_PUBLIC_API_URL": tk.StringVar(value="http://localhost:4000"),
            "DATABASE_URL": tk.StringVar(value="mysql://user:password@localhost:3306/oyamacrm"),
            "WATCHDOG_DATABASE_URL": tk.StringVar(value="mysql://user:password@localhost:3306/oyama_watchdog"),
            "JWT_SECRET": tk.StringVar(value="replace-with-a-long-random-secret"),
            "JWT_REFRESH_SECRET": tk.StringVar(value="replace-with-a-second-long-random-secret"),
            "APP_NAME": tk.StringVar(value="OyamaCRM"),
            "APP_VERSION": tk.StringVar(value=self.version),
            "BUILD_DATE": tk.StringVar(value=self.today),
            "GIT_COMMIT": tk.StringVar(value=self.git_commit),
            "RELEASE_CHANNEL": tk.StringVar(value="production"),
            "LAST_AUDIT_DATE": tk.StringVar(value=self.today),
            "NEXT_PUBLIC_APP_NAME": tk.StringVar(value="OyamaCRM"),
            "NEXT_PUBLIC_APP_VERSION": tk.StringVar(value=self.version),
            "NEXT_PUBLIC_BUILD_DATE": tk.StringVar(value=self.today),
            "NEXT_PUBLIC_GIT_COMMIT": tk.StringVar(value=self.git_commit),
            "NEXT_PUBLIC_RELEASE_CHANNEL": tk.StringVar(value="production"),
            "NEXT_PUBLIC_APP_ENV": tk.StringVar(value="production"),
            "NEXT_PUBLIC_LAST_AUDIT_DATE": tk.StringVar(value=self.today),
        }

        self.custom_env_fields: list[dict[str, str]] = []
        self.include_dirs_text = tk.StringVar(value="\n".join(DEFAULT_INCLUDE_DIRS))
        self.include_files_text = tk.StringVar(value="\n".join(DEFAULT_INCLUDE_FILES))
        self.status_text = tk.StringVar(value="Ready")

    def _build_ui(self) -> None:
        """Construct the full user interface."""
        wrapper = ttk.Frame(self, padding=14)
        wrapper.pack(fill=tk.BOTH, expand=True)

        ttk.Label(
            wrapper,
            text="OyamaCRM Production Build Manager",
            font=("Segoe UI", 16, "bold"),
        ).pack(anchor=tk.W)

        ttk.Label(
            wrapper,
            text="Generate env files separately, run production builds, and create configurable zip bundles.",
        ).pack(anchor=tk.W, pady=(3, 10))

        self.step_titles = [
            "1) Paths",
            "2) Environment",
            "3) Bundle Content",
            "4) Run and Logs",
        ]
        self.active_step_index = 0

        wizard_header = ttk.LabelFrame(wrapper, text="Guided Wizard")
        wizard_header.pack(fill=tk.X, pady=(0, 10))

        self.step_indicator_var = tk.StringVar(value="")
        ttk.Label(wizard_header, textvariable=self.step_indicator_var, font=("Segoe UI", 10, "bold")).pack(anchor=tk.W, padx=10, pady=(8, 2))
        ttk.Label(
            wizard_header,
            text="Use Next and Back to walk through setup. You can still click tabs directly if preferred.",
        ).pack(anchor=tk.W, padx=10, pady=(0, 8))

        self.notebook = ttk.Notebook(wrapper)
        self.notebook.pack(fill=tk.BOTH, expand=True)

        build_tab = ttk.Frame(self.notebook, padding=10)
        env_tab = ttk.Frame(self.notebook, padding=10)
        include_tab = ttk.Frame(self.notebook, padding=10)
        log_tab = ttk.Frame(self.notebook, padding=10)

        self.notebook.add(build_tab, text="Step 1: Paths")
        self.notebook.add(env_tab, text="Step 2: Environment")
        self.notebook.add(include_tab, text="Step 3: Bundle Content")
        self.notebook.add(log_tab, text="Step 4: Run")

        self._build_build_tab(build_tab)
        self._build_env_tab(env_tab)
        self._build_include_tab(include_tab)
        self._build_log_tab(log_tab)
        self.notebook.bind("<<NotebookTabChanged>>", self._on_tab_changed)

        nav = ttk.Frame(wrapper)
        nav.pack(fill=tk.X, pady=(8, 4))
        self.back_button = ttk.Button(nav, text="Back", command=self._go_back_step)
        self.back_button.pack(side=tk.LEFT)
        self.next_button = ttk.Button(nav, text="Next", command=self._go_next_step)
        self.next_button.pack(side=tk.LEFT, padx=(8, 0))
        ttk.Button(nav, text="Jump To Run Step", command=lambda: self._go_to_step(3)).pack(side=tk.LEFT, padx=(8, 0))

        self._refresh_wizard_ui()

        footer = ttk.Frame(wrapper)
        footer.pack(fill=tk.X, pady=(10, 0))

        ttk.Button(footer, text="Save Profile", command=self._save_profile).pack(side=tk.LEFT)
        ttk.Button(footer, text="Load Profile", command=self._load_profile_interactive).pack(side=tk.LEFT, padx=(8, 0))
        ttk.Label(footer, textvariable=self.status_text, foreground="#0f766e").pack(side=tk.LEFT, padx=(18, 0))

    def _build_build_tab(self, parent: ttk.Frame) -> None:
        """Build controls for output paths, build steps, and packaging actions."""
        ttk.Label(
            parent,
            text="Step 1: Choose output locations and build behavior.",
            font=("Segoe UI", 10, "bold"),
        ).pack(anchor="w", pady=(0, 8))

        paths_card = ttk.LabelFrame(parent, text="Output")
        paths_card.pack(fill=tk.X, pady=(0, 10))

        self._labeled_entry(
            paths_card,
            row=0,
            label="Output zip folder",
            variable=self.vars["output_dir"],
            browse_handler=self._choose_output_dir,
            browse_label="Browse",
        )
        self._labeled_entry(
            paths_card,
            row=1,
            label="Env output file",
            variable=self.vars["env_output_path"],
            browse_handler=self._choose_env_output_file,
            browse_label="Browse",
        )
        self._labeled_entry(
            paths_card,
            row=2,
            label="Bundle name prefix",
            variable=self.vars["bundle_prefix"],
        )

        options_card = ttk.LabelFrame(parent, text="Build and Packaging Options")
        options_card.pack(fill=tk.X, pady=(0, 10))

        ttk.Checkbutton(options_card, text="Run pnpm install --frozen-lockfile", variable=self.vars["run_install"]).grid(
            row=0, column=0, sticky="w", pady=3
        )
        ttk.Checkbutton(options_card, text="Run pnpm db:generate", variable=self.vars["run_db_generate"]).grid(
            row=1, column=0, sticky="w", pady=3
        )
        ttk.Checkbutton(options_card, text="Run pnpm build (Next.js)", variable=self.vars["run_web_build"]).grid(
            row=2, column=0, sticky="w", pady=3
        )
        ttk.Checkbutton(options_card, text="Run pnpm build:server (API)", variable=self.vars["run_server_build"]).grid(
            row=3, column=0, sticky="w", pady=3
        )
        ttk.Checkbutton(options_card, text="Include .env.production inside zip bundle", variable=self.vars["include_env_in_zip"]).grid(
            row=4, column=0, sticky="w", pady=3
        )
        ttk.Checkbutton(options_card, text="Open output folder after success", variable=self.vars["open_output_folder"]).grid(
            row=5, column=0, sticky="w", pady=3
        )

    def _build_include_tab(self, parent: ttk.Frame) -> None:
        """Render bundle include lists as a dedicated wizard step."""
        ttk.Label(
            parent,
            text="Step 3: Select folders and files that should be staged into the zip bundle.",
            font=("Segoe UI", 10, "bold"),
        ).pack(anchor="w", pady=(0, 8))

        include_card = ttk.LabelFrame(parent, text="Bundle Content")
        include_card.pack(fill=tk.BOTH, expand=True)

        ttk.Label(
            include_card,
            text="Directories to include (one per line, relative to repo root)",
        ).grid(row=0, column=0, sticky="w", pady=(6, 4))
        self.include_dirs_box = tk.Text(include_card, height=12, width=56)
        self.include_dirs_box.grid(row=1, column=0, sticky="nsew", padx=(0, 10), pady=(0, 6))
        self.include_dirs_box.insert("1.0", self.include_dirs_text.get())

        ttk.Label(
            include_card,
            text="Files to include (one per line, relative to repo root)",
        ).grid(row=0, column=1, sticky="w", pady=(6, 4))
        self.include_files_box = tk.Text(include_card, height=12, width=56)
        self.include_files_box.grid(row=1, column=1, sticky="nsew", pady=(0, 6))
        self.include_files_box.insert("1.0", self.include_files_text.get())

        include_card.columnconfigure(0, weight=1)
        include_card.columnconfigure(1, weight=1)
        include_card.rowconfigure(1, weight=1)

    def _build_env_tab(self, parent: ttk.Frame) -> None:
        """Render standard and custom environment field controls."""
        ttk.Label(
            parent,
            text="Step 2: Fill required environment values and add custom fields.",
            font=("Segoe UI", 10, "bold"),
        ).pack(anchor="w", pady=(0, 8))

        standard_card = ttk.LabelFrame(parent, text="Standard Environment Fields")
        standard_card.pack(fill=tk.BOTH, expand=True, pady=(0, 10))

        canvas = tk.Canvas(standard_card, highlightthickness=0)
        scrollbar = ttk.Scrollbar(standard_card, orient="vertical", command=canvas.yview)
        fields_frame = ttk.Frame(canvas)

        fields_frame.bind("<Configure>", lambda _e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=fields_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        for idx, key in enumerate(STANDARD_ENV_KEYS):
            ttk.Label(fields_frame, text=key).grid(row=idx, column=0, sticky="w", pady=3)
            ttk.Entry(fields_frame, textvariable=self.env_vars[key], width=90).grid(row=idx, column=1, sticky="ew", pady=3, padx=(8, 0))

        fields_frame.columnconfigure(1, weight=1)

        custom_card = ttk.LabelFrame(parent, text="Custom Env Fields")
        custom_card.pack(fill=tk.BOTH, expand=True)

        self.custom_tree = ttk.Treeview(custom_card, columns=("key", "value"), show="headings", height=8)
        self.custom_tree.heading("key", text="Key")
        self.custom_tree.heading("value", text="Value")
        self.custom_tree.column("key", width=280, anchor="w")
        self.custom_tree.column("value", width=620, anchor="w")
        self.custom_tree.pack(fill=tk.BOTH, expand=True, padx=6, pady=(6, 4))

        entry_row = ttk.Frame(custom_card)
        entry_row.pack(fill=tk.X, padx=6, pady=(0, 6))
        self.custom_key_var = tk.StringVar()
        self.custom_value_var = tk.StringVar()

        ttk.Label(entry_row, text="Key").pack(side=tk.LEFT)
        ttk.Entry(entry_row, textvariable=self.custom_key_var, width=28).pack(side=tk.LEFT, padx=(6, 12))
        ttk.Label(entry_row, text="Value").pack(side=tk.LEFT)
        ttk.Entry(entry_row, textvariable=self.custom_value_var, width=70).pack(side=tk.LEFT, padx=(6, 12), fill=tk.X, expand=True)
        ttk.Button(entry_row, text="Add/Update", command=self._upsert_custom_field).pack(side=tk.LEFT)
        ttk.Button(entry_row, text="Remove Selected", command=self._remove_selected_custom_field).pack(side=tk.LEFT, padx=(8, 0))

    def _build_log_tab(self, parent: ttk.Frame) -> None:
        """Create the execution log panel."""
        ttk.Label(
            parent,
            text="Step 4: Generate env only or run full build + package.",
            font=("Segoe UI", 10, "bold"),
        ).pack(anchor="w", pady=(0, 8))

        actions = ttk.Frame(parent)
        actions.pack(fill=tk.X, pady=(0, 8))
        ttk.Button(actions, text="Generate Env Only", command=self._generate_env_only).pack(side=tk.LEFT)
        ttk.Button(actions, text="Run Build + Package Zip", command=self._run_build_and_package).pack(side=tk.LEFT, padx=(8, 0))

        self.log_output = ScrolledText(parent, wrap=tk.WORD, height=30)
        self.log_output.pack(fill=tk.BOTH, expand=True)
        self._log("Production Build Manager ready.")

    def _on_tab_changed(self, _event: tk.Event) -> None:
        """Keep wizard state in sync when users click tabs directly."""
        try:
            self.active_step_index = int(self.notebook.index(self.notebook.select()))
        except Exception:
            self.active_step_index = 0
        self._refresh_wizard_ui()

    def _refresh_wizard_ui(self) -> None:
        """Update wizard header and navigation button states."""
        total = len(self.step_titles)
        current = self.active_step_index + 1
        label = self.step_titles[self.active_step_index]
        self.step_indicator_var.set(f"Step {current} of {total}: {label}")

        self.back_button.configure(state=tk.NORMAL if self.active_step_index > 0 else tk.DISABLED)
        self.next_button.configure(state=tk.NORMAL if self.active_step_index < total - 1 else tk.DISABLED)

    def _go_to_step(self, step_index: int) -> None:
        """Select one wizard step by notebook tab index."""
        max_index = len(self.step_titles) - 1
        if step_index < 0 or step_index > max_index:
            return
        self.active_step_index = step_index
        self.notebook.select(step_index)
        self._refresh_wizard_ui()

    def _go_back_step(self) -> None:
        """Move one step backward in the wizard."""
        self._go_to_step(self.active_step_index - 1)

    def _go_next_step(self) -> None:
        """Move one step forward in the wizard after validation."""
        if not self._validate_current_step():
            return
        self._go_to_step(self.active_step_index + 1)

    def _validate_current_step(self) -> bool:
        """Validate required fields for the active wizard step."""
        if self.active_step_index == 0:
            output_dir = str(self.vars["output_dir"].get()).strip()
            env_path = str(self.vars["env_output_path"].get()).strip()
            if not output_dir or not env_path:
                messagebox.showwarning("Missing required fields", "Set output zip folder and env output file before continuing.")
                return False
        elif self.active_step_index == 1:
            database_url = str(self.env_vars["DATABASE_URL"].get()).strip()
            jwt_secret = str(self.env_vars["JWT_SECRET"].get()).strip()
            if not database_url or not jwt_secret:
                messagebox.showwarning("Missing required env values", "DATABASE_URL and JWT_SECRET are required before continuing.")
                return False
        elif self.active_step_index == 2:
            include_dirs = self._read_multiline_list(self.include_dirs_box)
            include_files = self._read_multiline_list(self.include_files_box)
            if not include_dirs and not include_files:
                messagebox.showwarning("Bundle is empty", "Add at least one directory or one file for packaging.")
                return False
        return True

    def _labeled_entry(
        self,
        parent: ttk.LabelFrame,
        row: int,
        label: str,
        variable: tk.Variable,
        browse_handler: Callable[[], None] | None = None,
        browse_label: str = "",
    ) -> None:
        """Render a reusable label + entry row with optional browse button."""
        ttk.Label(parent, text=label).grid(row=row, column=0, sticky="w", pady=5, padx=(6, 6))
        ttk.Entry(parent, textvariable=variable, width=92).grid(row=row, column=1, sticky="ew", pady=5)
        if browse_handler:
            ttk.Button(parent, text=browse_label, command=browse_handler).grid(row=row, column=2, sticky="w", padx=(6, 6))
        parent.columnconfigure(1, weight=1)

    def _choose_output_dir(self) -> None:
        """Prompt for output directory selection."""
        selected = filedialog.askdirectory(initialdir=self.vars["output_dir"].get() or str(self.root_dir))
        if selected:
            self.vars["output_dir"].set(selected)

    def _choose_env_output_file(self) -> None:
        """Prompt for env output file path selection."""
        selected = filedialog.asksaveasfilename(
            initialdir=str(self.root_dir),
            initialfile=".env.production",
            defaultextension="",
            filetypes=[("Env files", "*.env *.production *.local"), ("All files", "*.*")],
        )
        if selected:
            self.vars["env_output_path"].set(selected)

    def _read_package_version(self) -> str:
        """Read version from package.json with fallback safety."""
        package_json = self.root_dir / "package.json"
        try:
            payload = json.loads(package_json.read_text(encoding="utf-8"))
            return str(payload.get("version", "0.0.0"))
        except Exception:
            return "0.0.0"

    def _read_git_commit(self) -> str:
        """Read a short git commit hash for build metadata."""
        try:
            result = subprocess.run(
                ["git", "-C", str(self.root_dir), "rev-parse", "--short", "HEAD"],
                check=True,
                capture_output=True,
                text=True,
            )
            return result.stdout.strip() or "local-build"
        except Exception:
            return "local-build"

    def _upsert_custom_field(self) -> None:
        """Insert or update a custom env key/value pair in the table."""
        key = self.custom_key_var.get().strip()
        value = self.custom_value_var.get().strip()

        if not key:
            messagebox.showwarning("Missing key", "Enter a custom field key before adding.")
            return

        if not self._is_valid_env_key(key):
            messagebox.showwarning("Invalid key", "Use only letters, numbers, and underscores, and start with a letter or underscore.")
            return

        # Replace existing row for key if present so each key is unique.
        updated = False
        for idx, row in enumerate(self.custom_env_fields):
            if row["key"] == key:
                self.custom_env_fields[idx] = {"key": key, "value": value}
                updated = True
                break

        if not updated:
            self.custom_env_fields.append({"key": key, "value": value})

        self.custom_key_var.set("")
        self.custom_value_var.set("")
        self._refresh_custom_fields_tree()

    def _remove_selected_custom_field(self) -> None:
        """Delete selected custom env rows from the in-memory list and UI."""
        selected_ids = self.custom_tree.selection()
        if not selected_ids:
            return

        selected_keys = {self.custom_tree.item(item_id, "values")[0] for item_id in selected_ids}
        self.custom_env_fields = [row for row in self.custom_env_fields if row["key"] not in selected_keys]
        self._refresh_custom_fields_tree()

    def _refresh_custom_fields_tree(self) -> None:
        """Render custom env rows into the table."""
        for item in self.custom_tree.get_children():
            self.custom_tree.delete(item)
        for row in sorted(self.custom_env_fields, key=lambda x: x["key"]):
            self.custom_tree.insert("", tk.END, values=(row["key"], row["value"]))

    def _is_valid_env_key(self, key: str) -> bool:
        """Validate env key shape to avoid malformed files."""
        return bool(re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key))

    def _drain_log_queue(self) -> None:
        """Move queued worker logs to the text output in the main UI thread."""
        try:
            while True:
                line = self.log_queue.get_nowait()
                self._log(line)
        except queue.Empty:
            pass
        self.after(120, self._drain_log_queue)

    def _log(self, message: str) -> None:
        """Write a timestamped message into the log panel."""
        stamp = dt.datetime.now().strftime("%H:%M:%S")
        self.log_output.insert(tk.END, f"[{stamp}] {message}\n")
        self.log_output.see(tk.END)

    def _worker_log(self, message: str) -> None:
        """Queue a log message from worker threads."""
        self.log_queue.put(message)

    def _set_busy(self, busy: bool, status: str) -> None:
        """Update busy state and status text."""
        self.is_busy = busy
        self.status_text.set(status)

    def _save_profile(self) -> None:
        """Persist GUI configuration and custom fields to disk."""
        try:
            payload = {
                "bundle_prefix": str(self.vars["bundle_prefix"].get()),
                "output_dir": str(self.vars["output_dir"].get()),
                "env_output_path": str(self.vars["env_output_path"].get()),
                "include_env_in_zip": bool(self.vars["include_env_in_zip"].get()),
                "run_install": bool(self.vars["run_install"].get()),
                "run_db_generate": bool(self.vars["run_db_generate"].get()),
                "run_web_build": bool(self.vars["run_web_build"].get()),
                "run_server_build": bool(self.vars["run_server_build"].get()),
                "open_output_folder": bool(self.vars["open_output_folder"].get()),
                "include_dirs": self._read_multiline_list(self.include_dirs_box),
                "include_files": self._read_multiline_list(self.include_files_box),
                "env": {key: var.get() for key, var in self.env_vars.items()},
                "custom_env_fields": self.custom_env_fields,
            }
            self.profile_path.parent.mkdir(parents=True, exist_ok=True)
            self.profile_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
            self.status_text.set("Profile saved")
            self._log(f"Saved profile: {self.profile_path}")
        except Exception as exc:
            messagebox.showerror("Save failed", str(exc))

    def _load_profile_if_exists(self) -> None:
        """Load the default profile file silently when present."""
        if self.profile_path.exists():
            self._load_profile(self.profile_path, show_message=False)

    def _load_profile_interactive(self) -> None:
        """Prompt for a profile and load it into the GUI."""
        selected = filedialog.askopenfilename(
            initialdir=str(self.profile_path.parent),
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")],
        )
        if selected:
            self._load_profile(Path(selected), show_message=True)

    def _load_profile(self, profile_file: Path, show_message: bool) -> None:
        """Apply a profile payload onto all GUI fields."""
        try:
            payload = json.loads(profile_file.read_text(encoding="utf-8"))

            for key in [
                "bundle_prefix",
                "output_dir",
                "env_output_path",
                "include_env_in_zip",
                "run_install",
                "run_db_generate",
                "run_web_build",
                "run_server_build",
                "open_output_folder",
            ]:
                if key in payload:
                    self.vars[key].set(payload[key])

            include_dirs = payload.get("include_dirs")
            if isinstance(include_dirs, list):
                self._replace_text(self.include_dirs_box, "\n".join(str(item) for item in include_dirs))

            include_files = payload.get("include_files")
            if isinstance(include_files, list):
                self._replace_text(self.include_files_box, "\n".join(str(item) for item in include_files))

            env_payload = payload.get("env", {})
            if isinstance(env_payload, dict):
                for key, value in env_payload.items():
                    if key in self.env_vars:
                        self.env_vars[key].set(str(value))

            custom_fields = payload.get("custom_env_fields", [])
            if isinstance(custom_fields, list):
                sanitized: list[dict[str, str]] = []
                for row in custom_fields:
                    if not isinstance(row, dict):
                        continue
                    key = str(row.get("key", "")).strip()
                    value = str(row.get("value", "")).strip()
                    if key and self._is_valid_env_key(key):
                        sanitized.append({"key": key, "value": value})
                self.custom_env_fields = sanitized
                self._refresh_custom_fields_tree()

            self._log(f"Loaded profile: {profile_file}")
            self.status_text.set("Profile loaded")
            if show_message:
                messagebox.showinfo("Profile loaded", f"Loaded settings from:\n{profile_file}")
        except Exception as exc:
            messagebox.showerror("Load failed", str(exc))

    def _replace_text(self, widget: tk.Text, value: str) -> None:
        """Replace all text in a Tk text box with provided content."""
        widget.delete("1.0", tk.END)
        widget.insert("1.0", value)

    def _read_multiline_list(self, widget: tk.Text) -> list[str]:
        """Read newline-delimited list values from a text widget."""
        raw = widget.get("1.0", tk.END)
        return [line.strip() for line in raw.splitlines() if line.strip()]

    def _collect_env_snapshot(self) -> tuple[dict[str, str], list[dict[str, str]]]:
        """Read current env values from Tk state in the UI thread."""
        env_data = {key: var.get().strip() for key, var in self.env_vars.items()}
        custom_data = [dict(item) for item in self.custom_env_fields]
        return env_data, custom_data

    def _render_env_text(self, env_data: dict[str, str], custom_fields: list[dict[str, str]]) -> str:
        """Render env content from standard and custom fields."""
        merged = dict(env_data)

        # Keep derived mirror fields aligned with shared app metadata fields.
        merged["NEXT_PUBLIC_APP_NAME"] = merged.get("NEXT_PUBLIC_APP_NAME") or merged.get("APP_NAME", "")
        merged["NEXT_PUBLIC_APP_VERSION"] = merged.get("NEXT_PUBLIC_APP_VERSION") or merged.get("APP_VERSION", "")
        merged["NEXT_PUBLIC_BUILD_DATE"] = merged.get("NEXT_PUBLIC_BUILD_DATE") or merged.get("BUILD_DATE", "")
        merged["NEXT_PUBLIC_GIT_COMMIT"] = merged.get("NEXT_PUBLIC_GIT_COMMIT") or merged.get("GIT_COMMIT", "")
        merged["NEXT_PUBLIC_RELEASE_CHANNEL"] = merged.get("NEXT_PUBLIC_RELEASE_CHANNEL") or merged.get("RELEASE_CHANNEL", "")
        merged["NEXT_PUBLIC_LAST_AUDIT_DATE"] = merged.get("NEXT_PUBLIC_LAST_AUDIT_DATE") or merged.get("LAST_AUDIT_DATE", "")

        for row in custom_fields:
            if self._is_valid_env_key(row["key"]):
                merged[row["key"]] = row["value"]

        lines = [
            "# Production environment generated by production_build_manager_gui.py",
            "# Keep this file out of version control if it contains secrets.",
        ]
        for key in sorted(merged.keys()):
            lines.append(f"{key}={merged[key]}")
        lines.append("")
        return "\n".join(lines)

    def _generate_env_only(self) -> None:
        """Generate env output without running build or packaging steps."""
        if self.is_busy:
            return

        env_output_text = str(self.vars["env_output_path"].get()).strip()
        if not env_output_text:
            messagebox.showwarning("Missing env output", "Select an env output file path first.")
            return
        env_output = Path(env_output_text)

        try:
            env_data, custom_fields = self._collect_env_snapshot()
            env_text = self._render_env_text(env_data, custom_fields)
            env_output.parent.mkdir(parents=True, exist_ok=True)
            env_output.write_text(env_text, encoding="utf-8")
            self.status_text.set("Env generated")
            self._log(f"Generated env file: {env_output}")
            messagebox.showinfo("Env generated", f"Environment file created:\n{env_output}")
        except Exception as exc:
            messagebox.showerror("Env generation failed", str(exc))

    def _run_build_and_package(self) -> None:
        """Execute build pipeline and package output in a worker thread."""
        if self.is_busy:
            messagebox.showinfo("Busy", "Another operation is already in progress.")
            return

        env_data, custom_fields = self._collect_env_snapshot()
        settings = {
            "output_dir": str(self.vars["output_dir"].get()).strip(),
            "env_output_path": str(self.vars["env_output_path"].get()).strip(),
            "bundle_prefix": str(self.vars["bundle_prefix"].get()).strip(),
            "include_env_in_zip": bool(self.vars["include_env_in_zip"].get()),
            "run_install": bool(self.vars["run_install"].get()),
            "run_db_generate": bool(self.vars["run_db_generate"].get()),
            "run_web_build": bool(self.vars["run_web_build"].get()),
            "run_server_build": bool(self.vars["run_server_build"].get()),
            "open_output_folder": bool(self.vars["open_output_folder"].get()),
            "include_dirs": self._read_multiline_list(self.include_dirs_box),
            "include_files": self._read_multiline_list(self.include_files_box),
        }

        self._set_busy(True, "Running build and packaging...")
        worker = threading.Thread(
            target=self._build_and_package_worker,
            kwargs={
                "settings": settings,
                "env_data": env_data,
                "custom_fields": custom_fields,
            },
            daemon=True,
        )
        worker.start()

    def _build_and_package_worker(
        self,
        settings: dict[str, object],
        env_data: dict[str, str],
        custom_fields: list[dict[str, str]],
    ) -> None:
        """Worker execution pipeline for command execution, staging, and zipping."""
        try:
            output_dir_text = str(settings["output_dir"]).strip()
            env_output_text = str(settings["env_output_path"]).strip()
            prefix = str(settings["bundle_prefix"]).strip() or "oyamacrm-production"

            include_dirs_raw = settings.get("include_dirs", [])
            include_files_raw = settings.get("include_files", [])
            include_dirs = [str(item) for item in include_dirs_raw] if isinstance(include_dirs_raw, list) else []
            include_files = [str(item) for item in include_files_raw] if isinstance(include_files_raw, list) else []

            if not output_dir_text:
                raise ValueError("Output zip folder is required.")
            if not env_output_text:
                raise ValueError("Env output file path is required.")

            output_dir = Path(output_dir_text)
            env_output = Path(env_output_text)

            self._worker_log("Preparing env file...")
            env_text = self._render_env_text(env_data, custom_fields)
            env_output.parent.mkdir(parents=True, exist_ok=True)
            env_output.write_text(env_text, encoding="utf-8")
            self._worker_log(f"Env file written: {env_output}")

            commands: list[list[str]] = []
            if bool(settings["run_install"]):
                commands.append(["pnpm", "install", "--frozen-lockfile"])
            if bool(settings["run_db_generate"]):
                commands.append(["pnpm", "db:generate"])
            if bool(settings["run_web_build"]):
                commands.append(["pnpm", "build"])
            if bool(settings["run_server_build"]):
                commands.append(["pnpm", "build:server"])

            for cmd in commands:
                self._run_command(cmd)

            timestamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
            bundle_name = f"{prefix}-{timestamp}"
            stage_dir = output_dir / bundle_name
            zip_base = output_dir / bundle_name
            zip_path = output_dir / f"{bundle_name}.zip"

            output_dir.mkdir(parents=True, exist_ok=True)
            if stage_dir.exists():
                shutil.rmtree(stage_dir)
            stage_dir.mkdir(parents=True, exist_ok=True)

            self._worker_log("Staging selected content...")
            self._stage_content(stage_dir, include_dirs, include_files)

            if bool(settings["include_env_in_zip"]):
                stage_env = stage_dir / ".env.production"
                stage_env.write_text(env_text, encoding="utf-8")
                self._worker_log(f"Included env in bundle: {stage_env}")

            self._write_start_script(stage_dir)
            self._worker_log("Created start script in staged bundle.")

            if zip_path.exists():
                zip_path.unlink()

            self._worker_log("Creating zip archive...")
            shutil.make_archive(str(zip_base), "zip", root_dir=stage_dir)
            self._worker_log(f"Zip created: {zip_path}")
            self._worker_log(f"Bundle folder: {stage_dir}")

            if bool(settings["open_output_folder"]):
                self._open_folder(output_dir)

            self.after(
                0,
                lambda: [
                    self._set_busy(False, "Build and packaging completed"),
                    messagebox.showinfo(
                        "Success",
                        "Production build and package completed.\n\n"
                        f"Env file:\n{env_output}\n\n"
                        f"Bundle folder:\n{stage_dir}\n\n"
                        f"Zip:\n{zip_path}",
                    ),
                ],
            )
        except Exception as exc:
            self._worker_log(f"ERROR: {exc}")
            self.after(
                0,
                lambda: [
                    self._set_busy(False, "Failed"),
                    messagebox.showerror("Build failed", str(exc)),
                ],
            )

    def _run_command(self, command: list[str]) -> None:
        """Execute one shell command and stream output to the GUI log."""
        self._worker_log(f"Running: {' '.join(command)}")

        process = subprocess.Popen(
            command,
            cwd=str(self.root_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )

        if process.stdout:
            for line in process.stdout:
                self._worker_log(line.rstrip())

        code = process.wait()
        if code != 0:
            raise RuntimeError(f"Command failed ({code}): {' '.join(command)}")

        self._worker_log(f"Completed: {' '.join(command)}")

    def _stage_content(self, stage_dir: Path, include_dirs: list[str], include_files: list[str]) -> None:
        """Copy configured directories and files into stage folder."""
        ignore_fn = shutil.ignore_patterns(*COPY_IGNORE_PATTERNS)

        for rel in include_dirs:
            src = self.root_dir / rel
            dst = stage_dir / rel
            if not src.exists():
                self._worker_log(f"WARN: Missing directory skipped: {rel}")
                continue
            if not src.is_dir():
                self._worker_log(f"WARN: Not a directory, skipped: {rel}")
                continue
            self._worker_log(f"Copy dir: {rel}")
            shutil.copytree(src, dst, dirs_exist_ok=True, ignore=ignore_fn)

        for rel in include_files:
            src = self.root_dir / rel
            dst = stage_dir / rel
            if not src.exists():
                self._worker_log(f"WARN: Missing file skipped: {rel}")
                continue
            if not src.is_file():
                self._worker_log(f"WARN: Not a file, skipped: {rel}")
                continue
            self._worker_log(f"Copy file: {rel}")
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)

    def _write_start_script(self, stage_dir: Path) -> None:
        """Write a helper script for launching app services from the packaged source bundle."""
        script_path = stage_dir / "start-production.bat"
        script_path.write_text(
            "\n".join(
                [
                    "@echo off",
                    "REM Build and run OyamaCRM from this packaged folder.",
                    "setlocal",
                    "if not exist .env if exist .env.production copy /Y .env.production .env >nul",
                    "call pnpm install --frozen-lockfile",
                    "call pnpm db:generate",
                    "call pnpm build",
                    "call pnpm build:server",
                    "start \"OyamaCRM API\" cmd /c \"pnpm start:server\"",
                    "call pnpm start",
                    "",
                ]
            ),
            encoding="utf-8",
        )

    def _open_folder(self, folder: Path) -> None:
        """Open a folder in the host operating system explorer."""
        try:
            if os.name == "nt":
                os.startfile(str(folder))
        except Exception:
            self._worker_log(f"WARN: Could not open folder automatically: {folder}")


def main() -> None:
    """Launch the Production Build Manager GUI."""
    app = ProductionBuildManagerGui()
    app.mainloop()


if __name__ == "__main__":
    main()
