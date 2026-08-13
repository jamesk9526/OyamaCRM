"""OyamaCRM Desktop — a focused Windows companion for search and reporting."""
from __future__ import annotations

import csv
import json
import queue
import threading
from datetime import datetime
from pathlib import Path
from tkinter import Tk, StringVar, BooleanVar, filedialog, messagebox
from tkinter import ttk
from typing import Any, Callable

import requests


APP_NAME = "OyamaCRM Desktop"
DEFAULT_API_URL = "http://localhost:4000"
NAVY = "#102a43"
BLUE = "#0f6cbd"
INK = "#102a43"
MUTED = "#627d98"
SURFACE = "#f5f8fb"
WHITE = "#ffffff"
SUCCESS = "#16794a"


class ApiError(Exception):
    """A readable error returned by the OyamaCRM API."""


class OyamaApi:
    def __init__(self) -> None:
        self.base_url = DEFAULT_API_URL
        self.token: str | None = None
        self.session = requests.Session()

    def configure(self, base_url: str) -> None:
        self.base_url = base_url.strip().rstrip("/").removesuffix("/api")

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        headers = kwargs.pop("headers", {})
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        headers.setdefault("Accept", "application/json")
        try:
            response = self.session.request(method, f"{self.base_url}{path}", headers=headers, timeout=20, **kwargs)
        except requests.RequestException as error:
            raise ApiError(f"Could not reach OyamaCRM at {self.base_url}. Check the API URL and server status.") from error
        try:
            payload = response.json()
        except ValueError:
            payload = {}
        if not response.ok:
            message = payload.get("error", {}).get("message") if isinstance(payload, dict) else None
            raise ApiError(message or f"Request failed ({response.status_code}).")
        return payload.get("data", payload) if isinstance(payload, dict) else payload

    def login(self, email: str, password: str) -> dict[str, Any]:
        return self._request("POST", "/api/auth/login", json={"email": email, "password": password})

    def verify_mfa(self, ticket: str, code: str) -> dict[str, Any]:
        return self._request("POST", "/api/auth/mfa/verify", json={"ticket": ticket, "code": code})

    def search(self, query: str) -> dict[str, Any]:
        return self._request("GET", "/api/search", params={"module": "donor", "q": query, "limit": 40})

    def report_summary(self, all_years: bool) -> dict[str, Any]:
        params = {"scope": "ALL_YEARS"} if all_years else {}
        return self._request("GET", "/api/reports/summary", params=params)

    def donation_stats(self, all_years: bool) -> dict[str, Any]:
        params = {"scope": "ALL_YEARS"} if all_years else {}
        return self._request("GET", "/api/donations/stats", params=params)


class OyamaDesktop(Tk):
    def __init__(self) -> None:
        super().__init__()
        self.api = OyamaApi()
        self.work_queue: queue.Queue[tuple[Callable[..., Any], tuple[Any, ...], Callable[[Any], None] | None]] = queue.Queue()
        self.user: dict[str, Any] | None = None
        self.mfa_ticket: str | None = None
        self.search_rows: list[dict[str, str]] = []
        self.report_rows: list[tuple[str, str]] = []

        self.title(APP_NAME)
        self.geometry("1080x700")
        self.minsize(820, 560)
        self.configure(bg=SURFACE)
        self._style()
        self._build_login()
        self.after(100, self._process_queue)

    def _style(self) -> None:
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("TFrame", background=SURFACE)
        style.configure("Card.TFrame", background=WHITE)
        style.configure("Top.TFrame", background=NAVY)
        style.configure("TLabel", background=SURFACE, foreground=INK, font=("Segoe UI", 10))
        style.configure("Card.TLabel", background=WHITE, foreground=INK, font=("Segoe UI", 10))
        style.configure("Title.TLabel", background=NAVY, foreground=WHITE, font=("Segoe UI Semibold", 20))
        style.configure("SubTitle.TLabel", background=NAVY, foreground="#d9e2ec", font=("Segoe UI", 10))
        style.configure("Heading.TLabel", background=WHITE, foreground=INK, font=("Segoe UI Semibold", 15))
        style.configure("Muted.TLabel", background=WHITE, foreground=MUTED, font=("Segoe UI", 9))
        style.configure("TEntry", padding=8, fieldbackground=WHITE, bordercolor="#bcccdc")
        style.configure("TButton", padding=(12, 8), font=("Segoe UI Semibold", 9), background="#e9eff5", foreground=INK)
        style.map("TButton", background=[("active", "#d9e2ec")])
        style.configure("Accent.TButton", background=BLUE, foreground=WHITE)
        style.map("Accent.TButton", background=[("active", "#075a9e"), ("disabled", "#9fb3c8")])
        style.configure("Treeview", rowheight=32, font=("Segoe UI", 9), background=WHITE, fieldbackground=WHITE, foreground=INK)
        style.configure("Treeview.Heading", font=("Segoe UI Semibold", 9), background="#e9eff5", foreground=INK, relief="flat")
        style.map("Treeview", background=[("selected", "#d9edff")], foreground=[("selected", INK)])

    def _card(self, parent: ttk.Frame, padding: int = 24) -> ttk.Frame:
        frame = ttk.Frame(parent, style="Card.TFrame", padding=padding)
        return frame

    def _build_login(self) -> None:
        self.login_view = ttk.Frame(self)
        self.login_view.pack(fill="both", expand=True)
        hero = ttk.Frame(self.login_view, style="Top.TFrame", padding=(48, 44))
        hero.pack(fill="x")
        ttk.Label(hero, text="OyamaCRM", style="Title.TLabel").pack(anchor="w")
        ttk.Label(hero, text="Desktop search and reporting companion", style="SubTitle.TLabel").pack(anchor="w", pady=(6, 0))

        body = ttk.Frame(self.login_view, padding=32)
        body.pack(fill="both", expand=True)
        body.columnconfigure(0, weight=1)
        body.rowconfigure(0, weight=1)
        card = self._card(body, 30)
        card.grid(row=0, column=0)
        card.columnconfigure(0, weight=1)
        ttk.Label(card, text="Sign in", style="Heading.TLabel").grid(row=0, column=0, sticky="w")
        ttk.Label(card, text="Connect with your existing OyamaCRM account.", style="Muted.TLabel").grid(row=1, column=0, sticky="w", pady=(4, 20))
        self.api_url = StringVar(value=DEFAULT_API_URL)
        self.email = StringVar()
        self.password = StringVar()
        self._login_field(card, "OyamaCRM API URL", self.api_url, 2)
        self._login_field(card, "Email address", self.email, 4)
        self._login_field(card, "Password", self.password, 6, show="•")
        self.login_status = StringVar(value="Use the same URL you use to access the CRM API.")
        ttk.Label(card, textvariable=self.login_status, style="Muted.TLabel", wraplength=420).grid(row=8, column=0, sticky="w", pady=(0, 14))
        self.sign_in_button = ttk.Button(card, text="Sign in", style="Accent.TButton", command=self._sign_in)
        self.sign_in_button.grid(row=9, column=0, sticky="ew")
        self.bind("<Return>", lambda _event: self._sign_in() if self.login_view.winfo_ismapped() else None)

    def _login_field(self, parent: ttk.Frame, label: str, variable: StringVar, row: int, show: str | None = None) -> None:
        ttk.Label(parent, text=label, style="Card.TLabel").grid(row=row, column=0, sticky="w", pady=(0, 5))
        ttk.Entry(parent, textvariable=variable, width=48, show=show).grid(row=row + 1, column=0, sticky="ew", pady=(0, 14))

    def _sign_in(self) -> None:
        if not self.email.get().strip() or not self.password.get():
            self.login_status.set("Enter your email address and password.")
            return
        self.api.configure(self.api_url.get())
        self.sign_in_button.configure(state="disabled")
        self.login_status.set("Signing in securely…")
        self._run(self.api.login, (self.email.get().strip(), self.password.get()), self._handle_login)

    def _handle_login(self, data: dict[str, Any]) -> None:
        self.sign_in_button.configure(state="normal")
        if data.get("mfaRequired"):
            self.mfa_ticket = data["mfaTicket"]
            self._show_mfa(data.get("destinationHint", "your email"))
            return
        self.api.token = data["accessToken"]
        self.user = data.get("user", {})
        self._build_workspace()

    def _show_mfa(self, destination: str) -> None:
        dialog = ttk.Frame(self.login_view, style="Card.TFrame", padding=24)
        dialog.place(relx=.5, rely=.5, anchor="center")
        ttk.Label(dialog, text="Verify your sign-in", style="Heading.TLabel").pack(anchor="w")
        ttk.Label(dialog, text=f"Enter the code sent to {destination}.", style="Muted.TLabel").pack(anchor="w", pady=(4, 14))
        code = StringVar()
        entry = ttk.Entry(dialog, textvariable=code, width=30)
        entry.pack(fill="x", pady=(0, 12)); entry.focus_set()
        status = StringVar()
        ttk.Label(dialog, textvariable=status, style="Muted.TLabel").pack(anchor="w")
        def verify() -> None:
            if not code.get().strip(): status.set("Enter the verification code."); return
            button.configure(state="disabled"); status.set("Verifying…")
            self._run(self.api.verify_mfa, (self.mfa_ticket, code.get().strip()), lambda data: self._complete_mfa(data, dialog, status))
        button = ttk.Button(dialog, text="Verify and continue", style="Accent.TButton", command=verify)
        button.pack(fill="x", pady=(12, 0))
        entry.bind("<Return>", lambda _event: verify())

    def _complete_mfa(self, data: dict[str, Any], dialog: ttk.Frame, status: StringVar) -> None:
        self.api.token = data["accessToken"]
        self.user = data.get("user", {})
        dialog.destroy()
        self._build_workspace()

    def _build_workspace(self) -> None:
        self.login_view.destroy()
        root = ttk.Frame(self); root.pack(fill="both", expand=True)
        header = ttk.Frame(root, style="Top.TFrame", padding=(24, 14)); header.pack(fill="x")
        ttk.Label(header, text="OyamaCRM Desktop", style="Title.TLabel").pack(side="left")
        name = " ".join(filter(None, [self.user.get("firstName", ""), self.user.get("lastName", "")])) or self.user.get("email", "Signed in")
        ttk.Label(header, text=f"Signed in as {name}", style="SubTitle.TLabel").pack(side="right")
        notebook = ttk.Notebook(root); notebook.pack(fill="both", expand=True, padx=20, pady=20)
        self.search_tab = ttk.Frame(notebook, padding=20); self.reports_tab = ttk.Frame(notebook, padding=20)
        notebook.add(self.search_tab, text="  Search records  "); notebook.add(self.reports_tab, text="  Reports  ")
        self._build_search_tab(); self._build_reports_tab()

    def _build_search_tab(self) -> None:
        self.search_tab.columnconfigure(0, weight=1); self.search_tab.rowconfigure(2, weight=1)
        ttk.Label(self.search_tab, text="Find donor records and CRM tools", style="Heading.TLabel").grid(row=0, column=0, sticky="w")
        bar = ttk.Frame(self.search_tab); bar.grid(row=1, column=0, sticky="ew", pady=(14, 16)); bar.columnconfigure(0, weight=1)
        self.search_query = StringVar()
        field = ttk.Entry(bar, textvariable=self.search_query); field.grid(row=0, column=0, sticky="ew", padx=(0, 10)); field.bind("<Return>", lambda _event: self._search())
        ttk.Button(bar, text="Search", style="Accent.TButton", command=self._search).grid(row=0, column=1)
        columns = ("type", "name", "details")
        self.results = ttk.Treeview(self.search_tab, columns=columns, show="headings")
        for key, title, width in (("type", "Type", 120), ("name", "Name", 300), ("details", "Details", 460)):
            self.results.heading(key, text=title); self.results.column(key, width=width, anchor="w")
        self.results.grid(row=2, column=0, sticky="nsew")
        ttk.Scrollbar(self.search_tab, orient="vertical", command=self.results.yview).grid(row=2, column=1, sticky="ns")
        self.results.configure(yscrollcommand=lambda first, last: None)
        self.search_status = StringVar(value="Search by name, email, campaign, gift receipt, or a CRM tool.")
        ttk.Label(self.search_tab, textvariable=self.search_status, style="Muted.TLabel").grid(row=3, column=0, sticky="w", pady=(12, 0))

    def _search(self) -> None:
        query = self.search_query.get().strip()
        if not query: self.search_status.set("Enter a name, email, campaign, or tool to search."); return
        self.search_status.set("Searching…")
        self._run(self.api.search, (query,), self._show_search_results)

    def _show_search_results(self, data: dict[str, Any]) -> None:
        self.results.delete(*self.results.get_children()); self.search_rows = list(data.get("results", []))
        for result in self.search_rows:
            self.results.insert("", "end", values=(result.get("type", "Record").replace("_", " ").title(), result.get("label", ""), result.get("sublabel", "")))
        self.search_status.set(f"{len(self.search_rows)} result(s) found.")

    def _build_reports_tab(self) -> None:
        self.reports_tab.columnconfigure(0, weight=1); self.reports_tab.rowconfigure(3, weight=1)
        ttk.Label(self.reports_tab, text="Fundraising snapshot", style="Heading.TLabel").grid(row=0, column=0, sticky="w")
        controls = ttk.Frame(self.reports_tab); controls.grid(row=1, column=0, sticky="ew", pady=(12, 16))
        self.all_years = BooleanVar(value=False)
        ttk.Checkbutton(controls, text="All years", variable=self.all_years).pack(side="left")
        self.run_report_button = ttk.Button(controls, text="Run report", style="Accent.TButton", command=self._run_report); self.run_report_button.pack(side="left", padx=12)
        ttk.Button(controls, text="Export CSV", command=self._export_report).pack(side="left")
        self.report_tree = ttk.Treeview(self.reports_tab, columns=("metric", "value"), show="headings")
        self.report_tree.heading("metric", text="Metric"); self.report_tree.heading("value", text="Value")
        self.report_tree.column("metric", width=400); self.report_tree.column("value", width=240, anchor="e")
        self.report_tree.grid(row=3, column=0, sticky="nsew")
        self.report_status = StringVar(value="Run a live summary using your CRM permissions.")
        ttk.Label(self.reports_tab, textvariable=self.report_status, style="Muted.TLabel").grid(row=4, column=0, sticky="w", pady=(12, 0))

    def _run_report(self) -> None:
        self.run_report_button.configure(state="disabled"); self.report_status.set("Loading current figures…")
        self._run(self.api.report_summary, (self.all_years.get(),), self._show_report)

    def _show_report(self, data: dict[str, Any]) -> None:
        self.run_report_button.configure(state="normal"); self.report_tree.delete(*self.report_tree.get_children())
        money = lambda value: f"${float(value or 0):,.2f}"
        self.report_rows = [
            ("Constituents", f"{data.get('totalConstituents', 0):,}"), ("Active donors", f"{data.get('activeDonors', 0):,}"),
            ("Giving total", money(data.get("ytdAmount"))), ("Gift count", f"{data.get('ytdCount', 0):,}"),
            ("Month-to-date giving", money(data.get("monthAmount") or data.get("mtdAmount"))), ("This week", money(data.get("weekAmount"))),
            ("Active campaigns", f"{data.get('activeCampaigns', 0):,}"), ("Campaign revenue", money(data.get("activeCampaignRaisedAmount"))),
            ("Pending tasks", f"{data.get('pendingTasks', 0):,}"), ("Overdue tasks", f"{data.get('overdueTasks', 0):,}"),
        ]
        for row in self.report_rows: self.report_tree.insert("", "end", values=row)
        self.report_status.set(f"Updated {datetime.now().strftime('%b %d, %Y at %I:%M %p')}")

    def _export_report(self) -> None:
        if not self.report_rows: messagebox.showinfo(APP_NAME, "Run a report before exporting."); return
        target = filedialog.asksaveasfilename(title="Export report", defaultextension=".csv", filetypes=[("CSV files", "*.csv")], initialfile="oyama-report.csv")
        if not target: return
        try:
            with Path(target).open("w", newline="", encoding="utf-8-sig") as file:
                writer = csv.writer(file); writer.writerow(["Metric", "Value"]); writer.writerows(self.report_rows)
            self.report_status.set(f"Exported to {target}")
        except OSError as error: messagebox.showerror(APP_NAME, f"Could not save the report.\n\n{error}")

    def _run(self, callback: Callable[..., Any], args: tuple[Any, ...], done: Callable[[Any], None] | None) -> None:
        def worker() -> None:
            try: result: Any = callback(*args)
            except Exception as error: result = error
            self.work_queue.put((lambda: result, (), done))
        threading.Thread(target=worker, daemon=True).start()

    def _process_queue(self) -> None:
        try:
            while True:
                get_result, _args, done = self.work_queue.get_nowait(); result = get_result()
                if isinstance(result, Exception):
                    self.sign_in_button.configure(state="normal") if hasattr(self, "sign_in_button") else None
                    self.run_report_button.configure(state="normal") if hasattr(self, "run_report_button") else None
                    messagebox.showerror(APP_NAME, str(result)); self.login_status.set(str(result)) if hasattr(self, "login_status") else None
                elif done: done(result)
        except queue.Empty: pass
        self.after(100, self._process_queue)


if __name__ == "__main__":
    OyamaDesktop().mainloop()
