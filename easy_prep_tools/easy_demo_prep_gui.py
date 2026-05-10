"""Single-file Tkinter GUI for building a production demo bundle in dist/."""

from __future__ import annotations

import datetime as dt
import json
import shutil
import subprocess
import tkinter as tk
from pathlib import Path
from tkinter import messagebox
from tkinter import ttk
from tkinter.scrolledtext import ScrolledText


# Required directories and files to run/build the app in a demo environment.
REQUIRED_DIRS = [
    "app",
    "server",
    "prisma",
    "public",
    "docs",
    "scripts",
    "easy_prep_tools",
]

REQUIRED_FILES = [
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


class DemoPrepGui(tk.Tk):
    """GUI application that packages OyamaCRM into a demo-ready zip."""

    def __init__(self) -> None:
        super().__init__()
        self.title("OyamaCRM Easy Production Demo Prep")
        self.geometry("980x760")
        self.minsize(920, 700)

        self.root_dir = Path(__file__).resolve().parents[1]
        self.dist_dir = self.root_dir / "dist"
        self.version = self._read_version()
        self.git_commit = self._read_git_commit()
        self.today = dt.date.today().isoformat()

        self._build_ui()

    def _read_version(self) -> str:
        """Read app version from package.json with a safe fallback."""
        package_json = self.root_dir / "package.json"
        try:
            data = json.loads(package_json.read_text(encoding="utf-8"))
            return str(data.get("version", "0.0.0"))
        except Exception:
            return "0.0.0"

    def _read_git_commit(self) -> str:
        """Read short git commit hash, or return a local fallback."""
        try:
            result = subprocess.run(
                ["git", "-C", str(self.root_dir), "rev-parse", "--short", "HEAD"],
                check=True,
                capture_output=True,
                text=True,
            )
            value = result.stdout.strip()
            return value or "local-demo"
        except Exception:
            return "local-demo"

    def _build_ui(self) -> None:
        """Build all GUI controls and bind actions."""
        main = ttk.Frame(self, padding=14)
        main.pack(fill=tk.BOTH, expand=True)

        title = ttk.Label(
            main,
            text="OyamaCRM Production Demo Prep Tool",
            font=("Segoe UI", 15, "bold"),
        )
        title.pack(anchor=tk.W)

        subtitle = ttk.Label(
            main,
            text="Generate .env.production and create a staged zip bundle in dist/",
        )
        subtitle.pack(anchor=tk.W, pady=(2, 12))

        grid = ttk.Frame(main)
        grid.pack(fill=tk.X)

        self.vars: dict[str, tk.StringVar] = {
            "bundle_prefix": tk.StringVar(value="oyamacrm-demo"),
            "api_port": tk.StringVar(value="4000"),
            "frontend_origin": tk.StringVar(value="http://localhost:3001"),
            "next_public_api_url": tk.StringVar(value="http://localhost:4000"),
            "database_url": tk.StringVar(value="mysql://user:password@localhost:3306/oyamacrm"),
            "watchdog_database_url": tk.StringVar(
                value="mysql://user:password@localhost:3306/oyama_watchdog"
            ),
            "jwt_secret": tk.StringVar(value="replace-with-a-long-random-secret"),
            "jwt_refresh_secret": tk.StringVar(
                value="replace-with-a-second-long-random-secret"
            ),
            "app_name": tk.StringVar(value="OyamaCRM"),
            "app_version": tk.StringVar(value=self.version),
            "release_channel": tk.StringVar(value="production-demo"),
            "build_date": tk.StringVar(value=self.today),
            "git_commit": tk.StringVar(value=self.git_commit),
        }

        row = 0
        for label, key in [
            ("Bundle prefix", "bundle_prefix"),
            ("API port", "api_port"),
            ("Frontend origin", "frontend_origin"),
            ("NEXT_PUBLIC_API_URL", "next_public_api_url"),
            ("DATABASE_URL", "database_url"),
            ("WATCHDOG_DATABASE_URL", "watchdog_database_url"),
            ("JWT_SECRET", "jwt_secret"),
            ("JWT_REFRESH_SECRET", "jwt_refresh_secret"),
            ("APP_NAME", "app_name"),
            ("APP_VERSION", "app_version"),
            ("RELEASE_CHANNEL", "release_channel"),
            ("BUILD_DATE", "build_date"),
            ("GIT_COMMIT", "git_commit"),
        ]:
            ttk.Label(grid, text=label).grid(row=row, column=0, sticky="w", pady=3)
            ttk.Entry(grid, textvariable=self.vars[key], width=92).grid(
                row=row, column=1, sticky="ew", pady=3, padx=(8, 0)
            )
            row += 1

        grid.columnconfigure(1, weight=1)

        self.write_root_env = tk.BooleanVar(value=True)
        ttk.Checkbutton(
            main,
            text="Also write repo root .env.production",
            variable=self.write_root_env,
        ).pack(anchor=tk.W, pady=(8, 0))

        btns = ttk.Frame(main)
        btns.pack(fill=tk.X, pady=(10, 8))

        ttk.Button(btns, text="Generate .env.production Only", command=self.generate_env_only).pack(
            side=tk.LEFT
        )
        ttk.Button(btns, text="Package + Zip Demo", command=self.package_demo).pack(
            side=tk.LEFT, padx=(8, 0)
        )

        self.status = tk.StringVar(value="Ready")
        ttk.Label(main, textvariable=self.status, foreground="#065f46").pack(
            anchor=tk.W, pady=(2, 6)
        )

        self.log = ScrolledText(main, height=16, wrap=tk.WORD)
        self.log.pack(fill=tk.BOTH, expand=True)
        self._log("Tool ready. Set values and click 'Package + Zip Demo'.")

    def _log(self, message: str) -> None:
        """Append a timestamped log line to the output panel."""
        stamp = dt.datetime.now().strftime("%H:%M:%S")
        self.log.insert(tk.END, f"[{stamp}] {message}\n")
        self.log.see(tk.END)
        self.update_idletasks()

    def _build_env_text(self) -> str:
        """Build .env.production content from UI values."""
        v = self.vars
        build_date = v["build_date"].get().strip()
        return "\n".join(
            [
                "# Production demo environment generated by easy_demo_prep_gui.py",
                "NODE_ENV=production",
                f"API_PORT={v['api_port'].get().strip()}",
                f"NEXT_PUBLIC_API_URL={v['next_public_api_url'].get().strip()}",
                f"FRONTEND_ORIGIN={v['frontend_origin'].get().strip()}",
                f"DATABASE_URL={v['database_url'].get().strip()}",
                f"WATCHDOG_DATABASE_URL={v['watchdog_database_url'].get().strip()}",
                f"JWT_SECRET={v['jwt_secret'].get().strip()}",
                f"JWT_REFRESH_SECRET={v['jwt_refresh_secret'].get().strip()}",
                f"APP_NAME={v['app_name'].get().strip()}",
                f"APP_VERSION={v['app_version'].get().strip()}",
                f"BUILD_DATE={build_date}",
                f"GIT_COMMIT={v['git_commit'].get().strip()}",
                f"RELEASE_CHANNEL={v['release_channel'].get().strip()}",
                f"LAST_AUDIT_DATE={build_date}",
                f"NEXT_PUBLIC_APP_NAME={v['app_name'].get().strip()}",
                f"NEXT_PUBLIC_APP_VERSION={v['app_version'].get().strip()}",
                f"NEXT_PUBLIC_BUILD_DATE={build_date}",
                f"NEXT_PUBLIC_GIT_COMMIT={v['git_commit'].get().strip()}",
                f"NEXT_PUBLIC_RELEASE_CHANNEL={v['release_channel'].get().strip()}",
                "NEXT_PUBLIC_APP_ENV=production",
                f"NEXT_PUBLIC_LAST_AUDIT_DATE={build_date}",
                "",
            ]
        )

    def generate_env_only(self) -> None:
        """Generate or update root .env.production without packaging files."""
        env_text = self._build_env_text()
        root_env = self.root_dir / ".env.production"
        root_env.write_text(env_text, encoding="utf-8")
        self.status.set("Wrote .env.production in repository root")
        self._log(f"Wrote {root_env}")
        messagebox.showinfo("Done", f"Created {root_env}")

    def _copy_required_content(self, stage_dir: Path) -> None:
        """Copy whitelisted directories and files into stage folder."""
        for name in REQUIRED_DIRS:
            src = self.root_dir / name
            dst = stage_dir / name
            if not src.exists():
                self._log(f"WARN: Skipping missing directory: {name}")
                continue
            self._log(f"Copy dir: {name}")
            shutil.copytree(
                src,
                dst,
                dirs_exist_ok=True,
                ignore=shutil.ignore_patterns("node_modules", ".next", "coverage", "dist", "*.log"),
            )

        for name in REQUIRED_FILES:
            src = self.root_dir / name
            dst = stage_dir / name
            if not src.exists():
                self._log(f"WARN: Skipping missing file: {name}")
                continue
            self._log(f"Copy file: {name}")
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)

    def _write_start_script(self, stage_dir: Path) -> None:
        """Write a helper script to build and launch the packaged demo."""
        start_bat = stage_dir / "start-demo.bat"
        start_bat.write_text(
            "\n".join(
                [
                    "@echo off",
                    "REM Builds and starts the demo locally from this packaged folder.",
                    "setlocal",
                    "if not exist .env copy /Y .env.production .env >nul",
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

    def package_demo(self) -> None:
        """Stage required files, generate env, and zip into dist/."""
        try:
            self.dist_dir.mkdir(parents=True, exist_ok=True)
            timestamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
            bundle_name = f"{self.vars['bundle_prefix'].get().strip()}-{timestamp}"
            stage_dir = self.dist_dir / bundle_name
            zip_base = self.dist_dir / bundle_name
            zip_path = self.dist_dir / f"{bundle_name}.zip"

            if stage_dir.exists():
                shutil.rmtree(stage_dir)
            stage_dir.mkdir(parents=True, exist_ok=True)

            self.status.set("Copying files into staged bundle...")
            self._copy_required_content(stage_dir)

            env_text = self._build_env_text()
            (stage_dir / ".env.production").write_text(env_text, encoding="utf-8")
            self._log(f"Wrote {stage_dir / '.env.production'}")

            if self.write_root_env.get():
                root_env = self.root_dir / ".env.production"
                root_env.write_text(env_text, encoding="utf-8")
                self._log(f"Wrote {root_env}")

            self._write_start_script(stage_dir)
            self._log(f"Wrote {stage_dir / 'start-demo.bat'}")

            if zip_path.exists():
                zip_path.unlink()
            self.status.set("Creating zip archive...")
            shutil.make_archive(str(zip_base), "zip", root_dir=stage_dir)

            self.status.set("Done: production demo bundle created")
            self._log(f"Bundle folder: {stage_dir}")
            self._log(f"Bundle zip: {zip_path}")
            messagebox.showinfo(
                "Success",
                "Production demo bundle created.\n\n"
                f"Folder:\n{stage_dir}\n\n"
                f"Zip:\n{zip_path}",
            )
        except Exception as exc:
            self.status.set("Failed")
            self._log(f"ERROR: {exc}")
            messagebox.showerror("Error", str(exc))


def main() -> None:
    """Run the Tkinter app."""
    app = DemoPrepGui()
    app.mainloop()


if __name__ == "__main__":
    main()
