"""Call Analyzer GUI (clean English version).

Features:
  - Parses call logs (analyze_calls) showing audio metrics (audio_ok, delays, durations).
  - Filtering, sorting, auto-refresh.
  - Simple outbound call campaign helper (PhonerLite automation) with history.
"""

from __future__ import annotations

import os, json, traceback, threading, time
from pathlib import Path
from datetime import datetime, timezone
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import sys

try:
    from call_events_extractor import analyze_calls  # type: ignore
except Exception:  # fallback to local path
    import sys
    sys.path.append(os.path.dirname(__file__))
    from call_events_extractor import analyze_calls  # type: ignore

try:
    from call_dialer import DialerConfig, run_campaign, request_abort  # type: ignore
except Exception:
    DialerConfig = None  # type: ignore
    run_campaign = None  # type: ignore
    request_abort = None  # type: ignore

UI_TERMS = {
    'PANEL_TITLE': 'Call Manager',
    'OPEN_PANEL_BUTTON': 'Dialer',
    'START_BUTTON_START': 'Start',
    'START_BUTTON_ABORT': 'Abort',
    'STATUS_RUNNING': 'Running...',
    'STATUS_READY': 'Ready',
}

SOFTPHONE_EXE_NAMES = ('PhoneLite.exe', 'PhonerLite.exe')
SOFTPHONE_LABEL = 'PhonerLite'
SOFTPHONE_CHOICES = ('PhonerLite',)


class CallAnalyzerGUI(tk.Tk):
    def _apply_theme(self) -> None:
        """Keep native ttk look (user preference).

        We intentionally avoid applying external themes or global padding tweaks,
        because they can make buttons look "too big" or unfamiliar.
        """
        try:
            style = ttk.Style()
            # Prefer a native Windows theme when available.
            for candidate in ('vista', 'xpnative'):
                if candidate in style.theme_names():
                    style.theme_use(candidate)
                    break

            # Output "en negro": black text on a normal light background.
            # Some Windows themes can make Treeview text look too light; force it to black.
            style.configure('Treeview', foreground='#000', background='#fff', fieldbackground='#fff')
            style.configure('Treeview.Heading', foreground='#000')
            style.map(
                'Treeview',
                foreground=[('selected', '#fff')],
                background=[('selected', '#2b74c7')],
            )
        except Exception:
            pass

    def _clamp_geometry_to_screen(self) -> None:
        """Clamp current window geometry to a reasonable size and on-screen position."""
        try:
            import re
            self.update_idletasks()
            geom = self.winfo_geometry()  # e.g. 1250x700+10+10
            m = re.match(r'^(\d+)x(\d+)\+(-?\d+)\+(-?\d+)$', geom)
            if not m:
                return

            w, h, x, y = (int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4)))
            sw = int(self.winfo_screenwidth() or 1920)
            sh = int(self.winfo_screenheight() or 1080)

            # Keep it comfortably on-screen (but allow enough height for the Dialer panel).
            max_w = min(1350, int(sw * 0.90))
            max_h = min(900, max(550, sh - 60))
            w = max(950, min(w, max_w))
            h = max(580, min(h, max_h))

            # Keep top-left on screen; recenter if it ends up off-screen
            x = max(0, min(x, max(0, sw - w)))
            y = max(0, min(y, max(0, sh - h)))
            self.geometry(f"{w}x{h}+{x}+{y}")
        except Exception:
            pass

    def _resize_window_for_dropdown_panel(self, panel_widget: tk.Widget) -> None:
        """Expand window height to fit a newly-shown dropdown-like panel.

        Keeps the window on-screen and avoids oversizing.
        """
        try:
            self.update_idletasks()

            # Use current runtime position/size to avoid geometry-string races that
            # can cause the window to "jump".
            w = int(self.winfo_width() or 0)
            h = int(self.winfo_height() or 0)
            x = int(self.winfo_x() or 0)
            y = int(self.winfo_y() or 0)
            if w <= 0 or h <= 0:
                return

            # How much vertical space the panel wants.
            # On Windows/Tk, reqheight can be 0 until the widget is mapped and the
            # event loop has calculated sizes. Use the best available value.
            req = int(panel_widget.winfo_reqheight() or 0)
            actual = int(panel_widget.winfo_height() or 0)
            req = max(req, actual)
            if req <= 0:
                return

            # How much the panel is currently missing (if clipped).
            missing_panel = max(0, req - actual)

            sw = int(self.winfo_screenwidth() or 1920)
            sh = int(self.winfo_screenheight() or 1080)

            # Keep some room for taskbar / window chrome.
            safe_bottom_margin = 60
            # Allow the window to grow up to almost full screen height.
            max_h = max(550, sh - safe_bottom_margin)

            # Prefer fitting the *whole* window required height (after packing the panel)
            # rather than guessing based on panel height.
            try:
                needed_total = int(self.winfo_reqheight() or 0)
            except Exception:
                needed_total = 0

            desired_candidates = []
            if needed_total > 0:
                desired_candidates.append(needed_total)

            # Stronger signal: where the panel starts + what it requests.
            # This works well even when the panel is clipped by the toplevel.
            try:
                panel_top = int(panel_widget.winfo_y() or 0)
                panel_req = int(panel_widget.winfo_reqheight() or 0)
                if panel_req > 0:
                    desired_candidates.append(panel_top + panel_req + 80)
            except Exception:
                pass

            # If the panel is clipped, grow just enough (+ cushion) to reveal it.
            if missing_panel > 0:
                desired_candidates.append(h + missing_panel + 60)
            if not desired_candidates:
                return
            desired_h = max(desired_candidates)

            new_h = min(max(h, desired_h), max_h)
            if new_h <= h + 1:
                return

            # Clamp width too, just in case.
            max_w = min(1400, int(sw * 0.90))
            w = max(900, min(w, max_w))

            # If the window is too low on screen, grow might be clipped.
            # Move up minimally ONLY when needed to fit the new height.
            max_y = max(0, sh - int(new_h) - safe_bottom_margin)
            new_y = y if y <= max_y else max_y

            if new_y != y:
                self.geometry(f"{w}x{new_h}+{max(0, x)}+{max(0, new_y)}")
            else:
                # Size-only change keeps the window anchored.
                self.geometry(f"{w}x{new_h}")
        except Exception:
            pass

    def _set_default_geometry_if_missing(self) -> None:
        """Set a sensible default size/position only when no saved geometry exists."""
        try:
            saved = (self._settings.get('window', {}) or {}).get('geometry')
            if saved:
                return
            sw = int(self.winfo_screenwidth() or 1920)
            sh = int(self.winfo_screenheight() or 1080)
            w = min(1350, int(sw * 0.82))
            h = min(860, int(sh * 0.82))
            x = max(0, (sw - w) // 2)
            y = max(0, (sh - h) // 2)
            self.geometry(f"{w}x{h}+{x}+{y}")
        except Exception:
            pass
    def _settings_path(self) -> Path:
        return Path(__file__).resolve().parent / 'gui_call_analyzer_settings.json'

    def _load_settings(self) -> dict:
        try:
            p = self._settings_path()
            if not p.exists():
                return {}
            with open(p, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return data if isinstance(data, dict) else {}
        except Exception:
            return {}

    def _save_settings(self) -> None:
        try:
            p = self._settings_path()
            tmp = p.with_suffix(p.suffix + '.tmp')
            data = {
                'window': {
                    'geometry': self.geometry(),
                },
                'log': {
                    'path': (self.file_var.get().strip() if hasattr(self, 'file_var') else ''),
                },
                'auto_refresh': {
                    'enabled': int(self.auto_refresh_var.get()) if hasattr(self, 'auto_refresh_var') else 0,
                    'seconds': int(self.auto_refresh_secs.get()) if hasattr(self, 'auto_refresh_secs') else 15,
                },
                'filters': {
                    'search': (self.search_var.get() if hasattr(self, 'search_var') else ''),
                    'ok': int(self.filter_ok.get()) if hasattr(self, 'filter_ok') else 1,
                    'ko': int(self.filter_ko.get()) if hasattr(self, 'filter_ko') else 1,
                },
                'campaign': {
                    'duration_s': int(self.camp_dur.get()) if hasattr(self, 'camp_dur') else 20,
                    'pause_s': int(self.camp_gap.get()) if hasattr(self, 'camp_gap') else 20,
                    'repetitions': int(self.camp_repeat.get()) if hasattr(self, 'camp_repeat') else 1,
                    'reuse': int(self.camp_reuse_var.get()) if hasattr(self, 'camp_reuse_var') else 1,
                    'softphone': (self.softphone_pref_var.get() if hasattr(self, 'softphone_pref_var') else 'PhonerLite'),
                    'phonerlite_profile': (self.phonerlite_profile_var.get() if hasattr(self, 'phonerlite_profile_var') else ''),
                },
                'environment': {
                    'svk_hw': (self.svk_hw_var.get() if hasattr(self, 'svk_hw_var') else 'HW 1E'),
                    'svk_fw': (self.svk_fw_var.get() if hasattr(self, 'svk_fw_var') else '4.12.1'),
                    'cu_hw': (self.cu_hw_var.get() if hasattr(self, 'cu_hw_var') else 'CU 2'),
                    'cu_fw': (self.cu_fw_var.get() if hasattr(self, 'cu_fw_var') else '1.32.16'),
                },
            }
            with open(tmp, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            tmp.replace(p)
        except Exception:
            pass

    def _safe_cancel_after_jobs(self):
        # Cancela todos los after() conocidos y detiene progressbars
        if hasattr(self, 'auto_refresh_job') and self.auto_refresh_job:
            try:
                self.after_cancel(self.auto_refresh_job)
            except Exception:
                pass
            self.auto_refresh_job = None
        if hasattr(self, '_hide_job') and self._hide_job:
            try:
                self.after_cancel(self._hide_job)
            except Exception:
                pass
            self._hide_job = None
        # Detener todos los progressbar indeterminados
        try:
            if hasattr(self, 'progress') and self.progress:
                self.progress.stop()
        except Exception:
            pass
        try:
            if hasattr(self, 'camp_progress') and self.camp_progress:
                self.camp_progress.stop()
        except Exception:
            pass

    def _on_close(self):
        self._save_settings()
        self._safe_cancel_after_jobs()
        # Destruir todos los progressbar explícitamente
        try:
            if hasattr(self, 'progress') and self.progress:
                self.progress.destroy()
        except Exception:
            pass
        try:
            if hasattr(self, 'camp_progress') and self.camp_progress:
                self.camp_progress.destroy()
        except Exception:
            pass
        self.destroy()
    def __init__(self) -> None:
        super().__init__()
        self.protocol("WM_DELETE_WINDOW", self._on_close)
        self.title("Call Analyzer")
        self._settings = self._load_settings()
        self._apply_theme()
        self.geometry((self._settings.get('window', {}) or {}).get('geometry') or "1200x700")
        self._set_default_geometry_if_missing()
        self._clamp_geometry_to_screen()
        try:
            self.minsize(950, 580)
        except Exception:
            pass
        # Softphone is fixed to PhoneLite (installed) to keep UI simple.
        self._last_softphone_launch_mono = 0.0
        # --- Core state ---
        self.current_file = None  # type: str | None
        self.full_calls = []      # type: list[dict]
        self.auto_refresh_job = None  # after() id
        self.analyzing = False
        # --- Campaign state ---
        self.campaign_running = False
        self.campaign_targets = []
        self.campaign_thread = None
        # --- Softphone preference (PhonerLite-only UI) ---
        camp = (self._settings.get('campaign', {}) or {})
        pref = (camp.get('softphone') or 'PhonerLite')
        pref_s = str(pref)
        # Backwards-compat: older saved values included PhoneLite/Auto/Phoner.
        if pref_s.lower() in ('phonelite', 'phone lite', 'phonelite.exe', 'phonelite/phonerlite', 'auto', 'phoner'):
            pref_s = 'PhonerLite'
        # We now only support PhonerLite in the UI.
        self.softphone_pref_var = tk.StringVar(value='PhonerLite')
        # --- Environment metadata (defaults) ---
        env = (self._settings.get('environment', {}) or {})
        self.svk_hw_var = tk.StringVar(value=env.get('svk_hw', 'HW 1E'))
        self.svk_fw_var = tk.StringVar(value=env.get('svk_fw', '4.12.1'))
        self.cu_hw_var  = tk.StringVar(value=env.get('cu_hw',  'CU 2'))
        self.cu_fw_var  = tk.StringVar(value=env.get('cu_fw',  '1.32.16'))
        # --- Build UI ---
        self._build_widgets()
        # Async prep
        # (No auto-prepare/download: PhoneLite must be installed)
        self.after(150, self._bring_front)

    # ---- Window helpers ----
    def _bring_front(self):
        try:
            self.lift(); self.attributes('-topmost', True)
            self.after(400, lambda: self.attributes('-topmost', False))
        except Exception:
            pass

    # ---- Build UI ----
    def _build_widgets(self):
        top = ttk.Frame(self, padding=(10, 8, 10, 6))
        top.pack(fill=tk.X)

        self.file_var = tk.StringVar(value=((self._settings.get('log', {}) or {}).get('path') or ''))
        ar = (self._settings.get('auto_refresh', {}) or {})
        self.auto_refresh_var = tk.IntVar(value=int(ar.get('enabled', 0) or 0))
        self.auto_refresh_secs = tk.IntVar(value=int(ar.get('seconds', 15) or 15))
        self.status_var = tk.StringVar(value=UI_TERMS['STATUS_READY'])
        self.progress = ttk.Progressbar(top, mode='indeterminate', length=120)

        # Grid layout for better responsiveness
        top.columnconfigure(1, weight=1)
        top.columnconfigure(10, weight=1)

        ttk.Label(top, text="Log:").grid(row=0, column=0, sticky='w')
        file_entry = ttk.Entry(top, textvariable=self.file_var)
        file_entry.grid(row=0, column=1, sticky='ew', padx=(6, 8))
        ttk.Button(top, text="Browse", command=self.select_file).grid(row=0, column=2, sticky='w')
        ttk.Button(top, text="Analyze", command=self.start_analysis).grid(row=0, column=3, sticky='w', padx=(8, 0))
        ttk.Button(top, text="Refresh", command=self.refresh_analysis).grid(row=0, column=4, sticky='w', padx=(6, 0))
        ttk.Button(top, text=UI_TERMS['OPEN_PANEL_BUTTON'], command=self.toggle_campaign_panel).grid(row=0, column=5, sticky='w', padx=(10, 0))

        ttk.Checkbutton(top, text="Auto", variable=self.auto_refresh_var, command=self._toggle_auto_refresh).grid(row=0, column=6, sticky='w', padx=(14, 2))
        ttk.Spinbox(top, from_=5, to=3600, textvariable=self.auto_refresh_secs, width=6).grid(row=0, column=7, sticky='w')
        ttk.Label(top, text="s").grid(row=0, column=8, sticky='w', padx=(2, 10))

        # Right side status
        ttk.Label(top, textvariable=self.status_var, foreground='blue').grid(row=0, column=9, sticky='e', padx=(10, 8))
        self.progress.grid(row=0, column=10, sticky='e')
        self.progress.grid_remove()  # shown only while analyzing

        # Filter bar
        bar = ttk.Frame(self, padding=(10, 0, 10, 6)); bar.pack(fill=tk.X)
        ttk.Label(bar, text="Search:").pack(side=tk.LEFT)
        self.search_var = tk.StringVar(value=((self._settings.get('filters', {}) or {}).get('search') or ''))
        self.search_var.trace_add('write', lambda *_: self.apply_filters())
        self.search_entry = ttk.Entry(bar, textvariable=self.search_var, width=30)
        self.search_entry.pack(side=tk.LEFT, padx=4)
        ttk.Label(bar, text="Verdicts:").pack(side=tk.LEFT, padx=(12,2))
        flt = (self._settings.get('filters', {}) or {})
        self.filter_ok = tk.IntVar(value=int(flt.get('ok', 1) or 1))
        self.filter_ko = tk.IntVar(value=int(flt.get('ko', 1) or 1))
        for txt, var in (('OK', self.filter_ok), ('KO', self.filter_ko)):
            ttk.Checkbutton(bar, text=txt, variable=var, command=self.apply_filters).pack(side=tk.LEFT)
        ttk.Button(bar, text="Clear", command=self.clear_search).pack(side=tk.LEFT, padx=(10,0))
        ttk.Button(bar, text="Clear All", command=self.clear_all).pack(side=tk.LEFT, padx=(6,0))

        # Key bindings
        self.bind('<Control-o>', lambda _e: self.select_file())
        self.bind('<F5>', lambda _e: self.refresh_analysis())
        self.bind('<Control-f>', lambda _e: (self.search_entry.focus_set(), self.search_entry.select_range(0, tk.END)) if hasattr(self, 'search_entry') else None)

    # (Environment controls moved to bottom bar to save vertical space)

        # Legend
        legend = ttk.Frame(self, padding=(10, 0, 10, 6)); legend.pack(fill=tk.X)
        ttk.Label(legend, text='OK', foreground='#0a0').pack(side=tk.LEFT, padx=(0, 8))
        ttk.Label(legend, text='KO', foreground='#d00').pack(side=tk.LEFT)

        # Results table (full width)
        main = ttk.Frame(self)
        # Keep the output area compact (about 15 rows); use scrollbar to browse.
        main.pack(fill=tk.X, expand=False, padx=10, pady=(0, 8))

        tree_wrap = ttk.Frame(main)
        tree_wrap.pack(fill=tk.X, expand=False)
        self.columns = [
            'call_number','test_group','status','type','remote','duration_ms','time_to_join_ms',
            'state_path_ok','audio_ok','verdict','reason','has_cmdDectLock'
        ]
        headers = {
            'call_number':'Call #','test_group':'Group','status':'Status','type':'Type','remote':'Remote',
            'duration_ms':'Dur(ms)','time_to_join_ms':'Join(ms)','state_path_ok':'Path','audio_ok':'Audio',
            'verdict':'Result','reason':'Reason','has_cmdDectLock':'cmdDectLock'
        }
        # Keep output compact, but free more vertical space on small laptop screens.
        try:
            sh = int(self.winfo_screenheight() or 1080)
        except Exception:
            sh = 1080
        tree_h = 15
        if sh <= 800:
            tree_h = 10
        elif sh <= 900:
            tree_h = 12
        self.tree = ttk.Treeview(tree_wrap, columns=self.columns, show='headings', height=tree_h)
        for c in self.columns:
            self.tree.heading(c, text=headers.get(c,c), command=lambda cc=c: self.sort_by_column(cc, False))
            # Ajustar ancho para la nueva columna
            if c == 'remote':
                self.tree.column(c, width=180, anchor=tk.W)
            elif c == 'reason':
                self.tree.column(c, width=260, anchor=tk.W)
            elif c == 'has_cmdDectLock':
                self.tree.column(c, width=110, anchor=tk.CENTER)
            else:
                self.tree.column(c, width=90, anchor=tk.CENTER)
        self.tree.pack(fill=tk.BOTH, expand=True, side=tk.LEFT)
        vsb = ttk.Scrollbar(tree_wrap, orient='vertical', command=self.tree.yview)
        vsb.pack(side=tk.LEFT, fill=tk.Y)
        self.tree.configure(yscrollcommand=vsb.set)

        # Summary + export
        bottom = ttk.Frame(self, padding=(10, 8, 10, 10)); bottom.pack(fill=tk.X)
        self.summary_var = tk.StringVar()
        ttk.Label(bottom, textvariable=self.summary_var, font=('Segoe UI',10,'bold')).pack(side=tk.LEFT, padx=(0,10))

        env_frame = ttk.Frame(bottom)
        env_frame.pack(side=tk.LEFT)
        ttk.Label(env_frame, text='SVK').grid(row=0, column=0, padx=(0,2))
        svk_hw_cb = ttk.Combobox(env_frame, width=5, textvariable=self.svk_hw_var, values=['HW 1E','HW 1D','HW 1C','HW 1B'])
        svk_hw_cb.grid(row=0, column=1)
        svk_fw_cb = ttk.Combobox(env_frame, width=7, textvariable=self.svk_fw_var, values=['4.12.1','4.12.0','4.11.0'])
        svk_fw_cb.grid(row=0, column=2, padx=(0,8))
        ttk.Label(env_frame, text='CU').grid(row=0, column=3, padx=(0,2))
        cu_hw_cb = ttk.Combobox(env_frame, width=5, textvariable=self.cu_hw_var, values=['CU2','CU1'])
        cu_hw_cb.grid(row=0, column=4)
        cu_fw_cb = ttk.Combobox(env_frame, width=8, textvariable=self.cu_fw_var, values=['1.32.16','1.21.26','1.36.0'])
        cu_fw_cb.grid(row=0, column=5, padx=(0,8))
        for cb in (svk_hw_cb, svk_fw_cb, cu_hw_cb, cu_fw_cb):
            cb.bind('<<ComboboxSelected>>', lambda _e: self._update_summary_env())
        ttk.Button(bottom, text='Export CSV', command=self.export_csv).pack(side=tk.RIGHT)
        ttk.Button(bottom, text='Export JSON', command=self.export_json).pack(side=tk.RIGHT, padx=(0,6))

        # Campaign panel (hidden until toggled)
        self.campaign_frame = ttk.LabelFrame(self, text=UI_TERMS['PANEL_TITLE'])

        cf_top = ttk.Frame(self.campaign_frame); cf_top.pack(fill=tk.X, padx=6, pady=4)
        ttk.Label(cf_top, text='Target:').pack(side=tk.LEFT)
        self.camp_dest_var = tk.StringVar()
        self.camp_dest_combo = ttk.Combobox(cf_top, textvariable=self.camp_dest_var, width=24, values=[])
        self.camp_dest_combo.pack(side=tk.LEFT, padx=4)
        self.camp_dest_combo.bind('<KeyRelease>', lambda _e: self._filter_dest_history())
        self.camp_dest_combo.bind('<Return>', lambda _e: self._camp_add_dest())
        try: self._reload_dest_history()
        except Exception: pass
        ttk.Button(cf_top, text='Add', command=self._camp_add_dest).pack(side=tk.LEFT)
        ttk.Button(cf_top, text='CSV', command=self._camp_add_csv).pack(side=tk.LEFT, padx=(2,0))
        self.camp_list = tk.Listbox(self.campaign_frame, height=3); self.camp_list.pack(fill=tk.X, padx=6)
        self._build_campaign_ui()

        # Open Dialer panel by default to avoid wasted vertical space.
        # Window height is auto-expanded just enough to show the full panel.
        try:
            if not self.campaign_frame.winfo_ismapped():
                self.campaign_frame.pack(fill=tk.X, padx=8, pady=(0, 8))
                # Grow window just enough so Start/Delete/Clear are visible.
                self.after_idle(lambda: self._resize_window_for_dropdown_panel(self.campaign_frame))
                self.after(60, lambda: self._resize_window_for_dropdown_panel(self.campaign_frame))
                self.after(200, lambda: self._resize_window_for_dropdown_panel(self.campaign_frame))
                self.after(450, lambda: self._resize_window_for_dropdown_panel(self.campaign_frame))
        except Exception:
            pass

    # ---- Campaign UI ----
    def _build_campaign_ui(self):
        opts = ttk.Frame(self.campaign_frame); opts.pack(fill=tk.X, padx=6, pady=4)
        camp = (self._settings.get('campaign', {}) or {})
        self.camp_dur = tk.IntVar(value=int(camp.get('duration_s', 20) or 20))
        self.camp_gap = tk.IntVar(value=int(camp.get('pause_s', 20) or 20))
        self.camp_repeat = tk.IntVar(value=int(camp.get('repetitions', 1) or 1))
        self.camp_reuse_var = tk.IntVar(value=int(camp.get('reuse', 1) or 1))
        # PhonerLite profile (account) selection (read from sipper.ini)
        # We keep the stored value as the raw profile id (e.g. "72159@10.2.240.70")
        # but show a friendly label in the UI (e.g. "VoIP (72159@10.2.240.70)").
        self.phonerlite_profile_var = tk.StringVar(value=str(camp.get('phonerlite_profile') or '').strip())
        self.phonerlite_profile_display_var = tk.StringVar(value='')
        self._phonerlite_profile_display_to_id = {}
        ttk.Label(opts, text='Duration(s)').grid(row=0, column=0, padx=2, sticky='w')
        ttk.Entry(opts, textvariable=self.camp_dur, width=6).grid(row=0, column=1)
        ttk.Label(opts, text='Pause(s)').grid(row=0, column=2, padx=6, sticky='w')
        ttk.Entry(opts, textvariable=self.camp_gap, width=6).grid(row=0, column=3)
        ttk.Label(opts, text='Repetitions').grid(row=0, column=4, padx=6, sticky='w')
        ttk.Entry(opts, textvariable=self.camp_repeat, width=6).grid(row=0, column=5)
        ttk.Checkbutton(opts, text='Reuse', variable=self.camp_reuse_var).grid(row=0, column=6, padx=(10,2), sticky='w')
        ttk.Label(opts, text='Softphone').grid(row=1, column=0, padx=2, pady=(6,0), sticky='w')
        ttk.Label(opts, text='PhonerLite').grid(row=1, column=1, pady=(6,0), sticky='w')
        ttk.Button(opts, text='Launch', command=self._launch_softphone).grid(row=1, column=2, padx=(6,2), pady=(6,0), sticky='w')
        ttk.Label(opts, text='Account').grid(row=1, column=3, padx=(10,2), pady=(6,0), sticky='w')
        self.phonerlite_profile_cb = ttk.Combobox(opts, width=26, textvariable=self.phonerlite_profile_display_var, values=[], state='readonly')
        self.phonerlite_profile_cb.grid(row=1, column=4, pady=(6,0), sticky='w')
        self.phonerlite_profile_cb.bind('<<ComboboxSelected>>', lambda _e: self._on_phonerlite_profile_selected())
        actions = ttk.Frame(self.campaign_frame); actions.pack(fill=tk.X, padx=6, pady=(2,6))
        self.camp_status = tk.StringVar(value='Idle')
        self.camp_btn = ttk.Button(actions, text='Start', command=self._camp_toggle); self.camp_btn.pack(side=tk.LEFT)
        ttk.Button(actions, text='Delete', command=self._camp_del_selected).pack(side=tk.LEFT, padx=(6,2))
        ttk.Button(actions, text='Clear', command=self._camp_clear).pack(side=tk.LEFT, padx=(2,6))
        ttk.Label(actions, textvariable=self.camp_status, foreground='blue').pack(side=tk.LEFT, padx=8)
        self.camp_progress = ttk.Progressbar(actions, mode='indeterminate', length=130)
        self.camp_last_var = tk.StringVar(value='-')
        ttk.Label(actions, text='Last:').pack(side=tk.LEFT, padx=(10,2))
        ttk.Label(actions, textvariable=self.camp_last_var).pack(side=tk.LEFT)
        self._build_history_block()
        # Populate account list once UI is built
        self.after(50, self._refresh_phonerlite_profiles)

    def _on_phonerlite_profile_selected(self) -> None:
        try:
            disp = (self.phonerlite_profile_display_var.get() or '').strip()
            pid = self._phonerlite_profile_display_to_id.get(disp) or ''
            self.phonerlite_profile_var.set(pid)
        except Exception:
            pass
        try:
            self._save_settings()
        except Exception:
            pass

    def _guess_phonerlite_mode_label(self, profile_id: str, info: dict | None = None) -> str:
        """Best-effort label for a profile: VoIP vs GSM/VoLTE.

        Uses gateway/profile id heuristics. User can still see the raw id in parentheses.
        """
        try:
            gateway = ''
            if info and isinstance(info, dict):
                gateway = str(info.get('gateway') or '')
            hay = (gateway + ' ' + profile_id).lower()
            # Project-specific heuristic: gateways differ per mode.
            if '10.2.240.70' in hay or '10.2.' in hay:
                return 'VoIP'
            if '10.46.241.70' in hay or '10.46.' in hay:
                return 'GSM/VoLTE'
        except Exception:
            pass
        return ''

    def _on_softphone_selected(self) -> None:
        try:
            self._refresh_phonerlite_profiles()
        except Exception:
            pass
        try:
            self._save_settings()
        except Exception:
            pass

    def _refresh_phonerlite_profiles(self) -> None:
        """Refresh the PhonerLite account/profile dropdown by reading sipper.ini."""
        try:
            pref = (self.softphone_pref_var.get() or '').strip()
            if pref.lower() != 'phonerlite':
                if hasattr(self, 'phonerlite_profile_cb'):
                    self.phonerlite_profile_cb.configure(values=[])
                    self.phonerlite_profile_cb.configure(state='disabled')
                self.phonerlite_profile_display_var.set('')
                self.phonerlite_profile_var.set('')
                return

            exe = self._resolve_softphone_exe('auto')
            if not exe or exe.name.lower() != 'phonerlite.exe':
                self.phonerlite_profile_cb.configure(values=[])
                self.phonerlite_profile_cb.configure(state='disabled')
                return

            profiles: list[str] = []
            info_by_profile: dict[str, dict[str, str]] = {}
            try:
                from call_dialer import list_phonerlite_profiles, get_phonerlite_profiles_info  # type: ignore
                profiles = list_phonerlite_profiles(exe)
                info_by_profile = get_phonerlite_profiles_info(exe) or {}
            except Exception:
                profiles = []
                info_by_profile = {}

            # Build friendly display values.
            labels_by_id: dict[str, str] = {}
            for pid in profiles:
                labels_by_id[pid] = self._guess_phonerlite_mode_label(pid, info_by_profile.get(pid))

            # If we have complete + unique labels, show only labels (clean UI).
            all_labeled = bool(profiles) and all(labels_by_id.get(pid) for pid in profiles)
            unique_labels = len({labels_by_id.get(pid) for pid in profiles if labels_by_id.get(pid)}) == len(profiles)
            show_only_labels = all_labeled and unique_labels

            display_to_id = {}
            displays: list[str] = []
            for pid in profiles:
                label = labels_by_id.get(pid) or ''
                if show_only_labels and label:
                    disp = label
                else:
                    disp = f"{label} ({pid})" if label else pid
                display_to_id[disp] = pid
                displays.append(disp)

            self._phonerlite_profile_display_to_id = display_to_id
            self.phonerlite_profile_cb.configure(values=displays)
            self.phonerlite_profile_cb.configure(state=('readonly' if displays else 'disabled'))

            # Keep selection stable: stored raw id -> display
            cur_id = (self.phonerlite_profile_var.get() or '').strip()
            if displays:
                # pick matching display for current id
                chosen_disp = None
                if cur_id:
                    for disp, pid in display_to_id.items():
                        if pid == cur_id:
                            chosen_disp = disp
                            break
                if not chosen_disp:
                    chosen_disp = displays[0]
                    self.phonerlite_profile_var.set(display_to_id.get(chosen_disp, ''))
                self.phonerlite_profile_display_var.set(chosen_disp)
        except Exception:
            pass

    def _build_history_block(self):
        frame = ttk.Frame(self.campaign_frame)
        frame.pack(fill=tk.BOTH, expand=False, padx=6, pady=(0,6))

        # Collapsible: keep UI compact and avoid confusion.
        header = ttk.Frame(frame)
        header.pack(fill=tk.X)
        ttk.Label(header, text='History', font=('Segoe UI',9,'bold')).pack(side=tk.LEFT)
        self._camp_history_visible = False
        self._camp_history_toggle_txt = tk.StringVar(value='Show')
        ttk.Button(header, textvariable=self._camp_history_toggle_txt, command=self._toggle_campaign_history).pack(side=tk.RIGHT)

        self._camp_history_body = ttk.Frame(frame)
        # Body is hidden by default.

        self.camp_history = tk.Listbox(self._camp_history_body, height=4)
        self.camp_history.pack(fill=tk.X, pady=2)
        self.camp_history.bind('<Double-Button-1>', lambda _e: self._camp_use_history_item())

        btns = ttk.Frame(self._camp_history_body)
        btns.pack(fill=tk.X)
        ttk.Button(btns, text='Export', command=self._camp_export_history).pack(side=tk.LEFT)
        ttk.Button(btns, text='Clear', command=lambda: self.camp_history.delete(0, tk.END)).pack(side=tk.LEFT, padx=4)
        ttk.Button(btns, text='Reload list', command=self._reload_dest_history).pack(side=tk.LEFT, padx=(8,0))

    def _toggle_campaign_history(self) -> None:
        try:
            self._camp_history_visible = not bool(getattr(self, '_camp_history_visible', False))
            if self._camp_history_visible:
                self._camp_history_toggle_txt.set('Hide')
                self._camp_history_body.pack(fill=tk.X, pady=(2, 0))
                # If the campaign panel is open, expand window a bit to avoid shrinking main UI.
                try:
                    if self.campaign_frame.winfo_ismapped():
                        self.after_idle(lambda: self._resize_window_for_dropdown_panel(self.campaign_frame))
                except Exception:
                    pass
            else:
                self._camp_history_toggle_txt.set('Show')
                self._camp_history_body.pack_forget()
        except Exception:
            pass

    # ---- Campaign actions ----
    def toggle_campaign_panel(self):
        # Make the dropdown panel feel integrated: expand window when showing it,
        # and restore previous geometry when hiding it.
        try:
            self.update_idletasks()
        except Exception:
            pass

        if self.campaign_frame.winfo_ismapped():
            self.campaign_frame.pack_forget()
            try:
                prev_state = getattr(self, '_campaign_prev_state', None)
                prev_geom = getattr(self, '_campaign_prev_geom', None)
                # Restore pre-Dialer state/geometry.
                if prev_state and str(prev_state).lower() != 'zoomed':
                    try:
                        self.state(prev_state)
                    except Exception:
                        pass
                else:
                    # If it was zoomed before, keep zoomed.
                    try:
                        if str(prev_state).lower() == 'zoomed':
                            self.state('zoomed')
                    except Exception:
                        pass
                if prev_geom and isinstance(prev_geom, str) and 'x' in prev_geom and '+' in prev_geom:
                    try:
                        # If we are zoomed now, geometry won't matter; set after normal.
                        if str(self.state()).lower() != 'zoomed':
                            self.geometry(prev_geom)
                    except Exception:
                        pass
            except Exception:
                pass
            try:
                self._campaign_prev_size = None
                self._campaign_prev_state = None
                self._campaign_prev_geom = None
            except Exception:
                pass
        else:
            try:
                self.update_idletasks()
                # Keep previous info so we can restore when hiding.
                try:
                    self._campaign_prev_state = self.state()
                except Exception:
                    self._campaign_prev_state = None
                try:
                    self._campaign_prev_geom = self.winfo_geometry()
                except Exception:
                    self._campaign_prev_geom = None
                self._campaign_prev_size = (int(self.winfo_width() or 0), int(self.winfo_height() or 0))
            except Exception:
                self._campaign_prev_size = None
            self.campaign_frame.pack(fill=tk.X, padx=8, pady=(0,8))
            # Defer resize until Tk has computed requested sizes (used when not zoomed).
            try:
                if str(self.state()).lower() != 'zoomed':
                    self.after_idle(lambda: self._resize_window_for_dropdown_panel(self.campaign_frame))
                    # One extra retry helps on Windows when layout stabilizes a tick later.
                    self.after(60, lambda: self._resize_window_for_dropdown_panel(self.campaign_frame))
            except Exception:
                pass

    def _camp_add_dest(self):
        val = self.camp_dest_var.get().strip()
        if not val: return
        if val in self.campaign_targets:
            self.camp_dest_var.set('')
            return
        self.campaign_targets.append(val)
        self.camp_list.insert(tk.END, val)
        self._add_number_to_history(val)
        self.camp_dest_var.set('')

    def _camp_use_history_item(self) -> None:
        try:
            sel = self.camp_history.curselection()
            if not sel:
                return
            line = self.camp_history.get(sel[0])
            parts = [p.strip() for p in (line or '').split('|')]
            if len(parts) < 2:
                return
            target = parts[1]
            if not target:
                return
            self.camp_dest_var.set(target)
            self._camp_add_dest()
        except Exception:
            pass

    def _camp_add_csv(self):
        path = filedialog.askopenfilename(filetypes=[["CSV","*.csv"],["All","*.*"]])
        if not path: return
        try:
            import csv
            with open(path,'r',encoding='utf-8') as f:
                for row in csv.reader(f):
                    if not row: continue
                    num = row[0].strip()
                    if num and not num.startswith('#'):
                        self.campaign_targets.append(num)
                        self.camp_list.insert(tk.END, num)
        except Exception as e:
            messagebox.showerror('CSV', str(e))

    def _camp_del_selected(self):
        sel = list(self.camp_list.curselection()); sel.reverse()
        for i in sel:
            self.camp_list.delete(i)
            try: self.campaign_targets.pop(i)
            except Exception: pass

    def _camp_clear(self):
        self.campaign_targets.clear(); self.camp_list.delete(0, tk.END)

    def _camp_toggle(self):
        if not DialerConfig or not run_campaign:
            messagebox.showerror('Dialer','Failed to import call_dialer.py'); return
        if not self.campaign_running:
            if not self.campaign_targets:
                messagebox.showwarning('Campaign','Add at least one target'); return
            self.camp_btn.config(state='disabled')
            self.campaign_running = True
            self.camp_btn.config(text=UI_TERMS['START_BUTTON_ABORT'])
            self.camp_status.set(UI_TERMS['STATUS_RUNNING'])
            self.camp_progress.pack(side=tk.LEFT, padx=8); self.camp_progress.start(90)
            dur = max(1, int(self.camp_dur.get() or 1))
            gap = max(0, int(self.camp_gap.get() or 0))
            rep = max(1, int(self.camp_repeat.get() or 1))
            reuse = self.camp_reuse_var.get() == 1
            exe = self._resolve_softphone_exe('auto')
            if exe is None:
                messagebox.showerror('Softphone', f"Softphone not found. Install {SOFTPHONE_LABEL} first.")
                self.campaign_running = False
                self.camp_btn.config(text=UI_TERMS['START_BUTTON_START'], state='normal')
                self.camp_status.set(UI_TERMS['STATUS_READY'])
                if self.camp_progress.winfo_ismapped():
                    self.camp_progress.stop(); self.camp_progress.pack_forget()
                return
            else:
                phoner_path = str(exe)
            # If selecting a PhonerLite account, reuse_existing may keep the old profile.
            try:
                sel_soft = (self.softphone_pref_var.get() or '').strip().lower()
                sel_prof = (self.phonerlite_profile_var.get() or '').strip()
                if sel_soft == 'phonerlite' and sel_prof and reuse:
                    ok = messagebox.askyesno(
                        'PhonerLite account',
                        "You selected a PhonerLite account/profile, but 'Reuse' is enabled.\n\n"
                        "If PhonerLite is already running, it may not switch account until restarted.\n\n"
                        "Continue anyway?"
                    )
                    if not ok:
                        self.campaign_running = False
                        self.camp_btn.config(text=UI_TERMS['START_BUTTON_START'], state='normal')
                        self.camp_status.set(UI_TERMS['STATUS_READY'])
                        if self.camp_progress.winfo_ismapped():
                            self.camp_progress.stop(); self.camp_progress.pack_forget()
                        return
            except Exception:
                pass
            targets_copy = self.campaign_targets.copy()
            def run_thread():
                from call_dialer import DialerConfig as DC  # type: ignore
                sel_profile = ''
                try:
                    if Path(phoner_path).name.lower() == 'phonerlite.exe':
                        sel_profile = (self.phonerlite_profile_var.get() or '').strip()
                except Exception:
                    sel_profile = ''
                cfg = DC(
                    phoner_path=Path(phoner_path), targets=targets_copy,
                    call_duration_s=dur, pause_between_s=gap, repeat=rep,
                    reuse_existing=reuse, debug=True, gui_after_launch=False,
                    dial_wait=1.5 if not reuse else 0.0, sip_domain=None,
                    start_minimized=False, no_focus=False, hangup_timeout_s=2,
                    force_kill=(not reuse), honor_process_exit=True, extra_args=[],
                    phonerlite_profile=(sel_profile or None)
                )
                try:
                    run_campaign(cfg, on_call_end=self._camp_on_call_end)
                except Exception as e:
                    self._async_log(f'[campaign][ERROR] {e}')
                self.after(0, self._camp_finished)
            self.campaign_thread = threading.Thread(target=run_thread, daemon=True); self.campaign_thread.start()
            self.after(150, lambda: self.camp_btn.config(state='normal'))
        else:
            if request_abort: request_abort()
            self.camp_status.set('Aborting...')

    def _camp_on_call_end(self, _cfg, target: str, elapsed: float):
        self.after(0, lambda: self._camp_on_call_end_gui(target, elapsed))

    def _camp_on_call_end_gui(self, target: str, elapsed: float):
        self.camp_last_var.set(f'{target} {elapsed:.1f}s')
        try:
            ts = datetime.now(timezone.utc).strftime('%H:%M:%S')
            env = self._get_environment()
            self.camp_history.insert(tk.END, f"{ts} | {target} | {elapsed:.1f}s | SVK:{env['svk_hw']}:{env['svk_fw']} | CU:{env['cu_hw']}:{env['cu_fw']}")
            if self.camp_history.size() > 500:
                self.camp_history.delete(0, self.camp_history.size()-500)
            self._camp_persist_history(ts, target, elapsed, env)
            self._add_number_to_history(target)
        except Exception: pass
        if self.current_file and not self.analyzing:
            self.start_analysis()

    def _camp_finished(self):
        self.campaign_running = False
        self.camp_btn.config(text=UI_TERMS['START_BUTTON_START'])
        self.camp_status.set(UI_TERMS['STATUS_READY'])
        if self.camp_progress.winfo_ismapped():
            self.camp_progress.stop(); self.camp_progress.pack_forget()
        

    def _async_log(self, msg: str):
        print(msg)

    def _get_softphone_ini_paths(self) -> tuple[Path, Path]:
        """Return (portable_ini, appdata_ini) paths."""
        base = Path(__file__).resolve().parent
        portable_ini = base / 'bin' / 'PhonerLite' / 'PhonerLite.ini'
        appdata_ini = Path(os.environ.get('APPDATA', '')) / 'PhonerLite' / 'PhonerLite.ini'
        return portable_ini, appdata_ini

    def _installed_softphone_candidates(self) -> list[Path]:
        # Support both PhoneLite and PhonerLite (names vary by install/package).
        candidates: list[Path] = [
            Path(r"C:\Program Files\PhoneLite\PhoneLite.exe"),
            Path(r"C:\Program Files (x86)\PhoneLite\PhoneLite.exe"),
            Path(r"C:\Program Files\PhonerLite\PhonerLite.exe"),
            Path(r"C:\Program Files (x86)\PhonerLite\PhonerLite.exe"),
        ]
        for exe in SOFTPHONE_EXE_NAMES:
            candidates.extend(self._where_exe(exe))
        return self._unique_existing_paths(candidates)

    def _installed_phoner_candidates(self) -> list[Path]:
        # Kept for backwards compatibility; not used when PhoneLite-only.
        return []

    def _where_exe(self, exe_name: str) -> list[Path]:
        """Best-effort Windows PATH search via `where` (returns existing paths)."""
        try:
            import subprocess
            exe_name = (exe_name or '').strip()
            if not exe_name:
                return []
            # Important: capture stderr too, otherwise Windows prints
            # "INFORMACIÓN: no se pudo encontrar ningún archivo..." to the terminal.
            r = subprocess.run(
                ['where', exe_name],
                text=True,
                errors='ignore',
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            out = r.stdout or ''
            paths: list[Path] = []
            for line in out.splitlines():
                p = Path((line or '').strip(' \r\n\t"'))
                if p and p.exists():
                    paths.append(p)
            return paths
        except Exception:
            return []

    def _unique_existing_paths(self, paths: list[Path]) -> list[Path]:
        seen: set[str] = set()
        out: list[Path] = []
        for p in paths:
            try:
                if not p or not p.exists():
                    continue
                key = str(p).lower()
                if key in seen:
                    continue
                seen.add(key)
                out.append(p)
            except Exception:
                continue
        return out

    def _portable_phonerlite_candidate(self) -> Path:
        base = Path(__file__).resolve().parent
        return base / 'bin' / 'PhonerLite' / 'PhonerLite.exe'

    def _pick_installed_by_name(self, exe_name: str) -> Path | None:
        """Pick the first installed candidate matching the given exe filename."""
        try:
            exe_name_l = (exe_name or '').strip().lower()
            if not exe_name_l:
                return None
            for p in self._installed_softphone_candidates():
                try:
                    if p and p.exists() and p.name.lower() == exe_name_l:
                        return p
                except Exception:
                    continue
            return None
        except Exception:
            return None

    def _resolve_softphone_exe(self, source: str) -> Path | None:
        """Resolve which softphone executable to use.

        Modes:
        - portable: bundled `bin/PhonerLite/PhonerLite.exe`
        - installed: system-installed softphone candidates
        - auto: prefer portable, fallback to installed
        """
        source = (source or 'auto').strip().lower()
        # UI is PhonerLite-only now.

        # Portable PhonerLite (bundled) when requested.
        portable = self._portable_phonerlite_candidate()
        if source in ('portable',):
            try:
                return portable if portable.exists() else None
            except Exception:
                return None

        # Auto: PhonerLite only (prefer bundled portable, then installed PhonerLite/PhoneLite).
        if source == 'auto':
            try:
                if portable.exists():
                    return portable
            except Exception:
                pass
            return self._pick_installed_by_name('PhonerLite.exe') or self._pick_installed_by_name('PhoneLite.exe')

        # Installed mode: return any installed candidate.
        if source == 'installed':
            return next(iter(self._installed_softphone_candidates()), None)

        return next(iter(self._installed_softphone_candidates()), None)

    def _launch_softphone(self) -> None:
        """Explicitly launch the selected softphone (no dialing)."""
        try:
            # Reset debounce if user explicitly requests launch.
            self._last_softphone_launch_mono = 0.0
            exe = self._resolve_softphone_exe('auto')
            if not exe:
                messagebox.showerror(
                    'Launch softphone',
                    f"Softphone not found. Install {SOFTPHONE_LABEL} first."
                )
                return
            before = self._get_softphone_pids()
            self._ensure_softphone_running()

            # If nothing was running before, verify that something is running after launch.
            if not before:
                started = False
                deadline = time.monotonic() + 2.0
                while time.monotonic() < deadline:
                    if self._get_softphone_pids():
                        started = True
                        break
                    time.sleep(0.2)
                if not started:
                    messagebox.showerror(
                        'Launch softphone',
                        "Softphone did not start (process not detected).\n\n"
                        f"Tried: {exe}\n\n"
                        "Suggestions:\n"
                        "- Try launching it manually (double-click) to see any Windows error\n"
                        "- Check Windows Event Viewer -> Windows Logs -> Application\n"
                        f"- Ensure {SOFTPHONE_LABEL} is installed correctly"
                    )
                    return

                # Try to restore/bring to front in case it started minimized/hidden.
                try:
                    self._try_restore_softphone_window(prefer_pid=getattr(self, '_last_softphone_pid', None))
                except Exception:
                    pass
        except Exception as e:
            messagebox.showerror('Launch softphone', str(e))
    def _get_softphone_pids(self) -> set[int]:
        """Return running softphone PIDs (best-effort, Windows only).

        Uses tasklist so it works without OpenProcess privileges.
        """
        try:
            import subprocess
            import csv
            pids: set[int] = set()
            for exe in SOFTPHONE_EXE_NAMES:
                try:
                    out = subprocess.check_output(
                        ['tasklist', '/FI', f'IMAGENAME eq {exe}', '/FO', 'CSV', '/NH'],
                        text=True,
                        errors='ignore'
                    )
                except Exception:
                    continue
                for line in out.splitlines():
                    line = (line or '').strip()
                    if not line:
                        continue
                    up = line.upper()
                    # tasklist localization when no processes match
                    if up.startswith('INFO:') or up.startswith('INFORMACIÓN:') or up.startswith('INFORMACION:'):
                        continue
                    try:
                        row = next(csv.reader([line]))
                        if len(row) >= 2 and row[0].lower() == exe.lower():
                            pids.add(int(row[1]))
                    except Exception:
                        pass
            return pids
        except Exception:
            return set()

    def _ensure_softphone_running(self) -> None:
        """Launch softphone if not currently running (best-effort).

        This avoids the "toggle does nothing" case when the user closed the softphone.
        """
        try:
            if self._get_softphone_pids(): 
                return
            # Debounce: avoid spawning multiple instances due to repeated UI toggles/after() calls.
            now = time.monotonic()
            if now - getattr(self, '_last_softphone_launch_mono', 0.0) < 3.0:
                return
            import subprocess
            exe = self._resolve_softphone_exe('auto')
            if not exe:
                return
            proc = subprocess.Popen([str(exe)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                self._last_softphone_pid = int(proc.pid)
            except Exception:
                self._last_softphone_pid = None
            self._last_softphone_launch_mono = now
            self._async_log(f'[softphone] Launched {exe}')
        except Exception as e:
            self._async_log(f'[softphone][WARN] {e}')

    def _try_restore_softphone_window(self, prefer_pid: int | None = None) -> None:
        """Best-effort: restore and bring softphone window to front on Windows.

        Softphones can start minimized to tray depending on their last state.
        This tries to find any top-level window for the running softphone process and restore it.
        """
        if sys.platform != 'win32':
            return

        pids = list(self._get_softphone_pids())
        if prefer_pid and prefer_pid in pids:
            pids.remove(prefer_pid)
            pids.insert(0, prefer_pid)
        if not pids:
            return

        try:
            import ctypes
            from ctypes import wintypes
        except Exception:
            return

        user32 = ctypes.WinDLL('user32', use_last_error=True)

        EnumWindows = user32.EnumWindows
        EnumWindows.argtypes = [wintypes.WNDENUMPROC, wintypes.LPARAM]
        EnumWindows.restype = wintypes.BOOL

        GetWindowThreadProcessId = user32.GetWindowThreadProcessId
        GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
        GetWindowThreadProcessId.restype = wintypes.DWORD

        IsWindowVisible = user32.IsWindowVisible
        IsWindowVisible.argtypes = [wintypes.HWND]
        IsWindowVisible.restype = wintypes.BOOL

        ShowWindow = user32.ShowWindow
        ShowWindow.argtypes = [wintypes.HWND, ctypes.c_int]
        ShowWindow.restype = wintypes.BOOL

        SetForegroundWindow = user32.SetForegroundWindow
        SetForegroundWindow.argtypes = [wintypes.HWND]
        SetForegroundWindow.restype = wintypes.BOOL

        SW_RESTORE = 9

        target_hwnds: list[int] = []

        @wintypes.WNDENUMPROC
        def _enum_proc(hwnd, lparam):
            try:
                pid = wintypes.DWORD(0)
                GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
                if int(pid.value) in pids and IsWindowVisible(hwnd):
                    target_hwnds.append(int(hwnd))
            except Exception:
                pass
            return True

        EnumWindows(_enum_proc, 0)
        if not target_hwnds:
            # Might be tray-only; nothing we can restore.
            return

        # Restore the first visible window we find.
        hwnd = wintypes.HWND(target_hwnds[0])
        try:
            ShowWindow(hwnd, SW_RESTORE)
            SetForegroundWindow(hwnd)
        except Exception:
            pass

    def _camp_export_history(self):
        if self.camp_history.size() == 0:
            messagebox.showinfo('History','No calls registered'); return
        path = filedialog.asksaveasfilename(defaultextension='.csv', filetypes=[["CSV","*.csv"]])
        if not path: return
        try:
            import csv
            with open(path,'w',newline='',encoding='utf-8') as f:
                w = csv.writer(f); w.writerow(['time_utc','target','duration_s','svk_hw','svk_fw','cu_hw','cu_fw'])
                for i in range(self.camp_history.size()):
                    line = self.camp_history.get(i)
                    parts = [p.strip() for p in line.split('|')]
                    # Expected: ts | target | dur | SVK:hw:fw | CU:hw:fw
                    if len(parts) >= 5:
                        ts_p = parts[0]
                        tgt_p = parts[1]
                        dur_p = parts[2].rstrip('s')
                        svk_p = parts[3]
                        cu_p  = parts[4]
                        def parse_env(seg: str):
                            try:
                                _tag, hw, fw = seg.split(':',2)
                                return hw, fw
                            except Exception:
                                return '', ''
                        svk_hw, svk_fw = parse_env(svk_p)
                        cu_hw, cu_fw = parse_env(cu_p)
                        w.writerow([ts_p, tgt_p, dur_p, svk_hw, svk_fw, cu_hw, cu_fw])
            messagebox.showinfo('History', f'Exported to {path}')
        except Exception as e:
            messagebox.showerror('History', str(e))

    def _camp_persist_history(self, ts: str, target: str, elapsed: float, env: dict):
        try:
            hist = Path(__file__).resolve().parent / 'call_history.csv'
            new = not hist.exists()
            import csv
            with open(hist,'a',encoding='utf-8',newline='') as f:
                w=csv.writer(f)
                if new: w.writerow(['utc_time','target','duration_s','svk_hw','svk_fw','cu_hw','cu_fw'])
                w.writerow([ts,target,f'{elapsed:.2f}', env.get('svk_hw',''), env.get('svk_fw',''), env.get('cu_hw',''), env.get('cu_fw','')])
        except Exception: pass

    def _reload_dest_history(self):
        try:
            hist = Path(__file__).resolve().parent / 'call_history.csv'
            if not hist.exists(): return
            import csv
            nums=[]
            with open(hist,'r',encoding='utf-8') as f:
                for row in csv.reader(f):
                    if not row or row[0]=='utc_time': continue
                    if len(row)>=2:
                        n=row[1].strip();
                        if n and n not in nums: nums.append(n)
            nums.reverse(); self.camp_dest_combo['values']=nums[:200]
        except Exception: pass

    def _add_number_to_history(self, number: str):
        try:
            cur=list(self.camp_dest_combo['values'])
            if number in cur: cur.remove(number)
            cur.insert(0, number)
            self.camp_dest_combo['values']=cur[:200]
        except Exception: pass

    def _filter_dest_history(self):
        try:
            typed=self.camp_dest_var.get().strip().lower()
            if not typed: return
            vals=list(self.camp_dest_combo['values'])
            matches=[v for v in vals if typed in v.lower()]
            self.camp_dest_combo['values']=matches if matches else vals
        except Exception: pass

    def _auto_prepare_phonerlite(self):
        # PhoneLite-only mode: nothing to prepare.
        return

    # ---- Analysis ----
    def select_file(self):
        path = filedialog.askopenfilename(title='Select log', filetypes=[["Log/Text","*.log *.txt *.*"],["All","*.*"]])
        if not path: return
        self.file_var.set(path); print(f'[GUI] Selected file: {path}')
        self.start_analysis()

    def set_status(self, text: str):
        self.status_var.set(text); self.update_idletasks()

    def clear_results(self):
        for iid in self.tree.get_children(): self.tree.delete(iid)
        self.summary_var.set(''); self.full_calls=[]; self._clear_detail()

    def clear_all(self):
        self.search_var.set(''); self.filter_ok.set(1); self.filter_ko.set(1)
        self.clear_results(); self.apply_filters()

    def start_analysis(self):
        if self.analyzing: return
        path = self.file_var.get().strip()
        if not path:
            messagebox.showwarning('Missing file','Select a log file'); return
        if not os.path.isfile(path):
            messagebox.showerror('File not found', path); return
        self.clear_results(); self.set_status('Analyzing...'); self._set_busy(True)
        threading.Thread(target=self._analyze_thread, args=(path,), daemon=True).start()

    def refresh_analysis(self):
        # Prefer refreshing whatever is currently in the file box.
        if self.file_var.get().strip():
            self.start_analysis()

    def _analyze_thread(self, path: str):
        start = datetime.now()
        try:
            # Chequeo de cmdDectLock en el log
            found_cmd_dectlock = False
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    for line in f:
                        if 'cmddectlock' in line.lower():
                            found_cmd_dectlock = True
                            break
            except Exception:
                pass
            data = analyze_calls(path)
            if found_cmd_dectlock:
                self.after(0, lambda: messagebox.showinfo('cmdDectLock', 'Se ha detectado cmdDectLock en el log.'))
        except Exception as e:
            tb = traceback.format_exc(limit=6)
            print(f'[GUI][ERROR] {e}\n{tb}')
            self.after(0, lambda: (self.set_status(f'Error: {e}'), self._set_busy(False), messagebox.showerror('Error', str(e))))
            return
        elapsed = (datetime.now() - start).total_seconds()*1000
        self.after(0, lambda: self._populate(data, elapsed))
        self.current_file = path

    def _populate(self, data: dict, elapsed_ms: float):
        self.full_calls = data.get('calls', [])
        self._elapsed_last = elapsed_ms
        self._totals_last = data.get('totals', {})
        self.apply_filters(); self.set_status('Ready'); self._schedule_auto_refresh(); self._set_busy(False)
        if not self.full_calls:
            messagebox.showinfo('No results','No calls detected (#tag=2WV#). Check the file.')
            print(f'[GUI] No results in {self.current_file} (0 calls)')

    # ---- Filtering / display ----
    def apply_filters(self):
        for iid in self.tree.get_children(): self.tree.delete(iid)
        term = self.search_var.get().strip().lower()
        show_ok = self.filter_ok.get()==1; show_ko = self.filter_ko.get()==1
        filtered=[]
        for row in self.full_calls:
            v=row.get('verdict')
            if (v=='OK' and not show_ok) or (v=='KO' and not show_ko): continue
            if term:
                blob=' '.join(str(row.get(k,'')) for k in row.keys()).lower()
                if term not in blob: continue
            filtered.append(row)
        for r in filtered:
            verdict = r.get('verdict')
            tags = (verdict,)
            audio_val = (r.get('audio_ok','') or '').upper()
            if audio_val == 'YES':
                tags += ('AUDIO_OK',)
            else:
                tags += ('AUDIO_MISS',)
            # Corrige reason: si es 'rejected', mostrar vacío
            values = []
            for c in self.columns:
                if c == 'reason':
                    val = r.get('reason','')
                    if val.strip().lower() == 'rejected':
                        val = ''
                    values.append(val)
                elif c == 'has_cmdDectLock':
                    v = r.get('has_cmdDectLock','')
                    if v is True or v == 'True' or v == 1:
                        values.append('Sí')
                    else:
                        values.append('No')
                else:
                    values.append(r.get(c,''))
            self.tree.insert('', tk.END, values=values, tags=tags)
        # Output in black (default Treeview style); use background cues instead of colored text.
        self.tree.tag_configure('OK')
        self.tree.tag_configure('KO', background='#fff4f4')
        self.tree.tag_configure('AUDIO_OK', background='#e6ffe6')
        self.tree.tag_configure('AUDIO_MISS', background='#ffecec')
        t = getattr(self,'_totals_last',{})
        if t:
            audio_total = sum(1 for r in self.full_calls if r.get('status')=='accepted')
            audio_ok = sum(1 for r in self.full_calls if r.get('audio_ok')=='YES')
            audio_rate = (audio_ok/audio_total*100) if audio_total else 0.0
            env = self._get_environment()
            summary = (
                f"Total: {t.get('total_calls',0)} Accepted: {t.get('accepted',0)} Rejected: {t.get('rejected',0)} "
                f"Rate: {t.get('acceptance_rate_pct',0):.1f}% | AudioOK: {audio_ok}/{audio_total} ({audio_rate:.1f}%) | "
                f"{getattr(self,'_elapsed_last',0):.0f} ms | Shown: {len(filtered)} | "
                f"SVK {env['svk_hw']} {env['svk_fw']} | CU {env['cu_hw']} {env['cu_fw']}"
            )
            self.summary_var.set(summary)

    def clear_search(self):
        self.search_var.set(''); self.apply_filters()

    def on_row_select(self, _evt):
        # Detail panel removed; keep method for compatibility (no-op).
        if not hasattr(self, 'detail_txt'):
            return
        sel=self.tree.selection()
        if not sel: self._clear_detail(); return
        values=self.tree.item(sel[0],'values')
        row_dict={c: values[i] for i,c in enumerate(self.columns)}
        
        # Create compact summary for first tab
        summary_lines = []
        summary_lines.append(f"Call #{row_dict.get('call_number', 'N/A')}")
        summary_lines.append(f"Status: {row_dict.get('status', 'N/A')}")
        summary_lines.append(f"Verdict: {row_dict.get('verdict', 'N/A')}")
        summary_lines.append(f"Type: {row_dict.get('type', 'N/A')}")
        summary_lines.append(f"Remote: {row_dict.get('remote', 'N/A')}")
        summary_lines.append(f"Duration: {row_dict.get('duration_ms', 'N/A')} ms")
        summary_lines.append(f"Join time: {row_dict.get('time_to_join_ms', 'N/A')} ms")
        summary_lines.append(f"Audio OK: {row_dict.get('audio_ok', 'N/A')}")
        if row_dict.get('reason'):
            summary_lines.append(f"Reason: {row_dict.get('reason', '')}")
        
        self._set_detail('\n'.join(summary_lines))
        
        # Set full details in second tab
        try:
            cn=row_dict.get('call_number')
            for fc in self.full_calls:
                if fc.get('call_number')==cn:
                    full_text = json.dumps(fc, ensure_ascii=False, indent=2)
                    self.detail_full_txt.configure(state='normal')
                    self.detail_full_txt.delete('1.0', tk.END)
                    self.detail_full_txt.insert(tk.END, full_text)
                    self.detail_full_txt.configure(state='disabled')
                    break
        except Exception: pass

    def _set_detail(self, text: str):
        if not hasattr(self, 'detail_txt'):
            return
        self.detail_txt.configure(state='normal'); self.detail_txt.delete('1.0', tk.END)
        self.detail_txt.insert(tk.END, text); self.detail_txt.configure(state='disabled')

    def _clear_detail(self):
        if not hasattr(self, 'detail_txt'):
            return
        self._set_detail('')
        try:
            if hasattr(self, 'detail_full_txt'):
                self.detail_full_txt.configure(state='normal')
                self.detail_full_txt.delete('1.0', tk.END)
                self.detail_full_txt.configure(state='disabled')
        except Exception:
            pass

    def sort_by_column(self, col: str, reverse: bool):
        data=[]
        for iid in self.tree.get_children(''):
            val=self.tree.set(iid, col)
            try: key=float(val) if val!='' else val
            except Exception: key=val
            data.append((key,iid))
        data.sort(key=lambda x:x[0], reverse=reverse)
        for idx,(_k,iid) in enumerate(data): self.tree.move(iid,'',idx)
        self.tree.heading(col, command=lambda: self.sort_by_column(col, not reverse))

    # ---- Auto refresh ----
    def _toggle_auto_refresh(self):
        if self.auto_refresh_var.get()==0 and self.auto_refresh_job:
            self.after_cancel(self.auto_refresh_job); self.auto_refresh_job=None
        else:
            self._schedule_auto_refresh()

    def _schedule_auto_refresh(self):
        if self.auto_refresh_var.get()==0 or not self.current_file: return
        if self.auto_refresh_job: self.after_cancel(self.auto_refresh_job)
        interval=max(5,int(self.auto_refresh_secs.get() or 10))*1000
        self.auto_refresh_job = self.after(interval, self.refresh_analysis)

    def _set_busy(self, on: bool):
        self.analyzing = on
        try:
            if on:
                self.progress.grid()
                self.progress.start(80)
            else:
                self.progress.stop()
                self.progress.grid_remove()
        except Exception:
            pass

    # ---- Export ----
    def export_json(self):
        if not self.full_calls:
            messagebox.showinfo('No data','No results to export'); return
        path = filedialog.asksaveasfilename(defaultextension='.json', filetypes=[["JSON","*.json"]])
        if not path: return
        try:
            payload={
                'generated_at': datetime.utcnow().isoformat(timespec='seconds')+'Z',
                'file': self.current_file,
                'environment': self._get_environment(),
                'calls': self.full_calls
            }
            with open(path,'w',encoding='utf-8') as f: json.dump(payload,f,ensure_ascii=False,indent=2)
            messagebox.showinfo('Exported', f'JSON saved to {path}')
        except Exception as e:
            messagebox.showerror('Error', str(e))

    def export_csv(self):
        if not self.tree.get_children():
            messagebox.showinfo('No data','No results to export'); return
        path = filedialog.asksaveasfilename(defaultextension='.csv', filetypes=[["CSV","*.csv"]])
        if not path: return
        import csv
        try:
            with open(path,'w',newline='',encoding='utf-8') as f:
                env = self._get_environment()
                # Totals & audio stats
                t = getattr(self,'_totals_last',{}) or {}
                total_calls = t.get('total_calls', len(self.full_calls))
                accepted = t.get('accepted', sum(1 for r in self.full_calls if r.get('status')=='accepted'))
                rejected = t.get('rejected', total_calls - accepted)
                acc_rate = t.get('acceptance_rate_pct', (accepted/total_calls*100) if total_calls else 0.0)
                audio_total = sum(1 for r in self.full_calls if r.get('status')=='accepted')
                audio_ok = sum(1 for r in self.full_calls if r.get('audio_ok')=='YES')
                audio_rate = (audio_ok/audio_total*100) if audio_total else 0.0
                # Duration aggregations
                durations = []
                for r in self.full_calls:
                    try:
                        d = int(r.get('duration_ms') or 0)
                        if d >= 0: durations.append(d)
                    except Exception:
                        pass
                total_duration = sum(durations)
                avg_duration = (total_duration/len(durations)) if durations else 0.0
                # Metadata comment lines (start with # so parsers can skip)
                f.write(f"# Summary: TotalCalls={total_calls} Accepted={accepted} Rejected={rejected} AcceptanceRate={acc_rate:.1f}%\n")
                f.write(f"# Audio: AudioOK={audio_ok}/{audio_total} ({audio_rate:.1f}%) TotalDurationMs={total_duration} AvgDurationMs={avg_duration:.1f}\n")
                f.write(f"# Environment: SVK_HW={env['svk_hw']} SVK_FW={env['svk_fw']} CU_HW={env['cu_hw']} CU_FW={env['cu_fw']} GeneratedUTC={datetime.utcnow().isoformat(timespec='seconds')}Z\n")
                f.write("# Columns below: " + ','.join(self.columns + ['svk_hw','svk_fw','cu_hw','cu_fw']) + "\n")
                w=csv.writer(f)
                extra_cols = ['svk_hw','svk_fw','cu_hw','cu_fw']
                w.writerow(self.columns + extra_cols)
                for iid in self.tree.get_children():
                    row = list(self.tree.item(iid,'values'))
                    row.extend([env['svk_hw'], env['svk_fw'], env['cu_hw'], env['cu_fw']])
                    w.writerow(row)
            messagebox.showinfo('Exported', f'CSV saved to {path}')
        except Exception as e:
            messagebox.showerror('Error', str(e))

    # ---- Environment helpers ----
    def _get_environment(self) -> dict:
        return {
            'svk_hw': self.svk_hw_var.get().strip(),
            'svk_fw': self.svk_fw_var.get().strip(),
            'cu_hw' : self.cu_hw_var.get().strip(),
            'cu_fw' : self.cu_fw_var.get().strip(),
        }

    def _update_summary_env(self):
        # Rebuild summary with new env values if already computed
        try:
            self.apply_filters()
        except Exception:
            pass


    def select_file(self):
        path = filedialog.askopenfilename(
            title="Seleccionar log",
            filetypes=[("Log/Texto", "*.log *.txt *.*"), ("Todos", "*.*")]
        )
        if not path:
            return
        self.file_var.set(path)
        print(f"[GUI] Archivo seleccionado: {path}")
        # Lanzar análisis automáticamente para ahorrar clic
        self.start_analysis()

    def set_status(self, text: str):
        self.status_var.set(text)
        self.update_idletasks()

    def clear_results(self):
        for iid in self.tree.get_children():
            self.tree.delete(iid)
        self.summary_var.set("")
        self.full_calls = []
        self._clear_detail()

    def clear_all(self):
        self.search_var.set("")
        self.filter_ok.set(1)
        self.filter_ko.set(1)
        self.clear_results()
        self.apply_filters()

    def start_analysis(self):
        if self.analyzing:
            return
        path = self.file_var.get().strip()
        if not path:
            messagebox.showwarning("Falta archivo", "Seleccione un fichero de log")
            return
        if not os.path.isfile(path):
            messagebox.showerror("Archivo no encontrado", path)
            return
        self.clear_results()
        self.set_status("Analizando...")
        self._set_busy(True)
        threading.Thread(target=self._analyze_thread, args=(path,), daemon=True).start()

    def refresh_analysis(self):
        if not self.current_file:
            return
        self.start_analysis()

    def _analyze_thread(self, path: str):
        start = datetime.now()
        try:
            data = analyze_calls(path)
        except Exception as e:
            tb = traceback.format_exc(limit=6)
            print(f"[GUI][ERROR] Analizando {path}: {e}\n{tb}")
            self.after(0, lambda: (self.set_status(f"Error: {e}"), self._set_busy(False), messagebox.showerror("Error analizando", str(e))))
            return
        elapsed = (datetime.now() - start).total_seconds() * 1000
        self.after(0, lambda: self._populate(data, elapsed))
        self.current_file = path

    def _populate(self, data: dict, elapsed_ms: float):
        self.full_calls = data.get('calls', [])
        self._elapsed_last = elapsed_ms
        self._totals_last = data.get('totals', {})
        self.apply_filters()
        self.set_status("Listo")
        self._schedule_auto_refresh()
        self._set_busy(False)
        if not self.full_calls:
            # Mensaje informativo si no hubo coincidencias
            messagebox.showinfo("Sin resultados", "No se detectaron llamadas (#tag=2WV#). Verifique el archivo.")
            print(f"[GUI] Sin resultados en {self.current_file} (0 llamadas)")

    # Filtrado / vista
    def apply_filters(self):
        for iid in self.tree.get_children():
            self.tree.delete(iid)
        term = self.search_var.get().strip().lower()
        show_ok = self.filter_ok.get() == 1
        show_ko = self.filter_ko.get() == 1
        filtered = []
        for row in self.full_calls:
            v = row.get('verdict')
            if (v == 'OK' and not show_ok) or (v == 'KO' and not show_ko):
                continue
            if term:
                blob = ' '.join(str(row.get(k, '')) for k in row.keys()).lower()
                if term not in blob:
                    continue
            filtered.append(row)
        for r in filtered:
            verdict = r.get('verdict')
            iid = self.tree.insert('', tk.END, values=[r.get(c, '') for c in self.tree['columns']], tags=(verdict,))
            # Color específico de audio_ok si existe
            try:
                audio_val = r.get('audio_ok','').upper()
                if audio_val == 'YES':
                    self.tree.item(iid, tags=self.tree.item(iid,'tags') + ('AUDIO_OK',))
                elif audio_val == '' or audio_val == 'NO':
                    self.tree.item(iid, tags=self.tree.item(iid,'tags') + ('AUDIO_MISS',))
            except Exception:
                pass
        # Keep text black; use gentle backgrounds for cues
        self.tree.tag_configure('OK', foreground='#000')
        self.tree.tag_configure('KO', foreground='#000', background='#ffecec')
        self.tree.tag_configure('AUDIO_OK', background='#e6ffe6')
        self.tree.tag_configure('AUDIO_MISS', background='#fff3cd')
        t = getattr(self, '_totals_last', {})
        if t:
            audio_total = sum(1 for r in self.full_calls if r.get('status')=='accepted')
            audio_ok = sum(1 for r in self.full_calls if r.get('audio_ok')=='YES')
            audio_rate = (audio_ok/audio_total*100) if audio_total else 0.0
            self.summary_var.set(
                f"Total: {t.get('total_calls',0)} Aceptadas: {t.get('accepted',0)} Rechazadas: {t.get('rejected',0)} "
                f"Rate: {t.get('acceptance_rate_pct',0):.1f}% | AudioOK: {audio_ok}/{audio_total} ({audio_rate:.1f}%) | "
                f"{getattr(self,'_elapsed_last',0):.0f} ms | Mostradas: {len(filtered)}"
            )

    def clear_search(self):
        self.search_var.set("")
        self.apply_filters()

    def on_row_select(self, _evt):
        # Detail panel was removed to make the UI more compact.
        # Keep handler as a no-op so selection never breaks analysis.
        return

    def _set_detail(self, text: str):
        # Detail panel removed; preserve API for legacy callers.
        return

    def _clear_detail(self):
        return

    def sort_by_column(self, col: str, reverse: bool):
        data = []
        for iid in self.tree.get_children(''):
            val = self.tree.set(iid, col)
            try:
                key = float(val) if val != '' else val
            except Exception:
                key = val
            data.append((key, iid))
        data.sort(key=lambda x: x[0], reverse=reverse)
        for idx, (_k, iid) in enumerate(data):
            self.tree.move(iid, '', idx)
        self.tree.heading(col, command=lambda: self.sort_by_column(col, not reverse))

    # Auto refresh / busy
    def _toggle_auto_refresh(self):
        if self.auto_refresh_var.get() == 0 and self.auto_refresh_job:
            self.after_cancel(self.auto_refresh_job)
            self.auto_refresh_job = None
        else:
            self._schedule_auto_refresh()

    def _schedule_auto_refresh(self):
        if self.auto_refresh_var.get() == 0 or not self.current_file:
            return
        if self.auto_refresh_job:
            self.after_cancel(self.auto_refresh_job)
        interval = max(5, int(self.auto_refresh_secs.get() or 10)) * 1000
        self.auto_refresh_job = self.after(interval, self.refresh_analysis)

    def _set_busy(self, on: bool):
        self.analyzing = on
        try:
            if on:
                self.progress.grid()
                self.progress.start(80)
            else:
                self.progress.stop()
                self.progress.grid_remove()
        except Exception:
            pass

    # Exportaciones
    def export_json(self):
        if not self.full_calls:
            messagebox.showinfo("Sin datos", "No hay resultados para exportar")
            return
        path = filedialog.asksaveasfilename(defaultextension=".json", filetypes=[("JSON", "*.json")])
        if not path:
            return
        try:
            payload = {
                'generated_at': datetime.utcnow().isoformat(timespec='seconds') + 'Z',
                'file': self.current_file,
                'calls': self.full_calls,
            }
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
            messagebox.showinfo("Exportado", f"JSON guardado en {path}")
        except Exception as e:
            messagebox.showerror("Error", str(e))

    def export_csv(self):
        if not self.tree.get_children():
            messagebox.showinfo("Sin datos", "No hay resultados para exportar")
            return
        path = filedialog.asksaveasfilename(defaultextension=".csv", filetypes=[("CSV", "*.csv")])
        if not path:
            return
        import csv
        cols = self.tree['columns']
        try:
            with open(path, 'w', newline='', encoding='utf-8') as f:
                w = csv.writer(f)
                w.writerow(cols)
                for iid in self.tree.get_children():
                    w.writerow(self.tree.item(iid, 'values'))
            messagebox.showinfo("Exportado", f"CSV guardado en {path}")
        except Exception as e:
            messagebox.showerror("Error", str(e))


if __name__ == '__main__':
    app = CallAnalyzerGUI()
    app.mainloop()
