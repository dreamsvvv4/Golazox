"""
Modem Check GUI
----------------
Aplicación para gestionar secuencias de comandos MediaUserRequest y ChangeStatus.
Mejoras: modularidad, validaciones, manejo de errores, docstrings, PEP8.
"""

import os
import sys
import threading
import concurrent.futures
import tempfile
import atexit
import signal
import subprocess
import logging
import json
import re


# Modern theme: ttkbootstrap
import tkinter as tk
from tkinter import messagebox
from tkinter.font import Font
from typing import Dict, Any, List, Optional
import ttkbootstrap as tb
from ttkbootstrap.constants import *
from tkinter import ttk

# Configuración de logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')

# Parámetros base de ejemplo para MediaUserRequest
instalaciones = [
    {
        'Installation Number': 5499266,
        'Country': 'ES',
        'Orion_dev_id': 6,
        'CU_VERSION': 2,
        'mediaType': 1,
        'resolutionFormat': 0,
        'numberOfPicture': 1
    },
    {
        'Installation Number': 5499266,
        'Country': 'ES',
        'Orion_dev_id': 4,
        'CU_VERSION': 2,
        'mediaType': 1,
        'resolutionFormat': 6,
        'numberOfPicture': 1
    }
]

# Parámetros base de ejemplo para ChangeStatus
changestatus_params = {
    'Installation Number': 5499266,
    'Country': 'ES',
    'typeOfInformation': '3',
}

# Clase principal de la aplicación
class App(tb.Window):
    def __init__(self):
        super().__init__(themename="darkly")  # Puedes cambiar a 'superhero', 'cyborg', etc.
        self.title("UltraProtom")
        self.geometry('900x650')
        self.resizable(True, True)
        # ...existing code...

    def run_rcmc(self):
        params = {k: v.get() if hasattr(v, 'get') else v.get() for k, v in self.entries_rcmc.items()}
        env = os.environ.copy()
        # Canal: extraer solo el número
        channel_value = params['channel'].split(' - ')[0].strip() if ' - ' in params['channel'] else params['channel']
        env_map = {
            'CODINSTALACION': params['codInstalacion'],
            'CHANNEL': channel_value,
            'ORDERID': params['orderid'],
            'COMMANDID': params['commandid']
        }
        for k, v in env_map.items():
            env_key = f'RCMC_{k.upper()}'
            env[env_key] = v
        def worker():
            try:
                import subprocess, sys
                script_path = os.path.join(os.path.dirname(__file__), 'ReportCommunicationModuleByChannel.py')
                proc = subprocess.Popen([sys.executable, script_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
                self._child_procs.append(proc)
                for line in proc.stdout:
                    self.output.after(0, lambda l=line: self._insert_output_line(l))
                stdout, stderr = proc.communicate()
                if stderr:
                    self.output.after(0, lambda: self._insert_output_line("[STDERR] " + stderr + "\n"))
            except Exception as e:
                self.output.after(0, lambda: messagebox.showerror('Error', str(e)))
        t = threading.Thread(target=worker, daemon=True)
        self._child_threads.append(t)
        t.start()

    def __init__(self):
        super().__init__()
        self.title('UltraProtom')
        self.geometry('900x650')
        self.resizable(True, True)
        self._child_threads = []
        self._child_procs = []
        self._stop_seq_flag = threading.Event()
        self.protocol("WM_DELETE_WINDOW", self.on_close)

        # --- Estilos premium fusionados eliminados (ahora los maneja ttkbootstrap) ---
        self.option_add("*TEntry*background", "#23272F")
        self.option_add("*TEntry*foreground", "#F8F8F8")
        self.option_add("*TEntry*insertBackground", "#F8F8F8")
        self.option_add("*TCombobox*background", "#23272F")
        self.option_add("*TCombobox*foreground", "#F8F8F8")
        self.option_add("*TCombobox*insertBackground", "#F8F8F8")
        self.option_add("*TLabelframe*background", "#23272F")
        self.option_add("*TLabelframe*foreground", "#F8F8F8")
        self.option_add("*TLabelframe.Label*background", "#23272F")
        self.option_add("*TLabelframe.Label*foreground", "#00BFFF")
        self.option_add("*TLabelframe.Label*font", "Segoe UI 12 bold")
        self.option_add("*Text*background", "#181A20")
        self.option_add("*Text*foreground", "#F8F8F8")
        self.option_add("*Text*insertBackground", "#F8F8F8")
        self.option_add("*Listbox*background", "#23272F")
        self.option_add("*Listbox*foreground", "#F8F8F8")
        self.option_add("*Listbox*font", "Segoe UI 12")

        # --- Menú superior ---
        self.current_theme = 'darkly'
        menubar = tk.Menu(self)
        file_menu = tk.Menu(menubar, tearoff=0)
        file_menu.add_command(label="Exit", command=self.on_close)
        menubar.add_cascade(label="File", menu=file_menu)

        view_menu = tk.Menu(menubar, tearoff=0)
        theme_menu = tk.Menu(view_menu, tearoff=0)
        for theme in ("darkly", "superhero", "cyborg", "flatly", "cosmo"):
            theme_menu.add_command(label=theme.capitalize(), command=lambda t=theme: self._set_theme(t))
        view_menu.add_cascade(label="Theme", menu=theme_menu)
        menubar.add_cascade(label="View", menu=view_menu)

        help_menu = tk.Menu(menubar, tearoff=0)
        help_menu.add_command(label="About", command=lambda: messagebox.showinfo("About", "UltraProtom\nModem tools GUI"))
        menubar.add_cascade(label="Help", menu=help_menu)
        self.config(menu=menubar)

        # --- Logo y borde superior ---
        top_frame = ttk.Frame(self, style='TLabelframe')
        top_frame.pack(side='top', fill='x', pady=(0, 8))
        logo_label = ttk.Label(top_frame, text="🟦 UltraProtom", font=("Segoe UI", 16, "bold"), foreground="#00BFFF")
        logo_label.pack(side='left', padx=(18, 0), pady=8)
        sep = ttk.Separator(self, orient='horizontal')
        sep.pack(fill='x', padx=0, pady=(0, 8))

        # ...existing code...
        self.rcmc_channel_var = tk.StringVar(value="2 - SMS")
        channel_options = [
            "0 - Ethernet",
            "1 - GPRS",
            "2 - SMS",
            "3 - WiFi"
        ]
        channel_menu = ttk.Combobox(self.form_frame_rcmc, textvariable=self.rcmc_channel_var, state='readonly', values=channel_options)
        channel_menu.grid(row=row_rcmc, column=1, padx=12, pady=6, sticky='ew')
        self.entries_rcmc['channel'] = self.rcmc_channel_var
        row_rcmc += 1
        # orderid y commandid ocultos (por defecto)
        self.entries_rcmc['orderid'] = tk.StringVar(value='ReportCommunicationModuleByChannel')
        self.entries_rcmc['commandid'] = tk.StringVar(value='1142')
        # Botón de ejecución (se conectará en el siguiente paso)
        self.btn_run_rcmc = ttk.Button(self.form_frame_rcmc, text='▶️ Run ReportCommunicationModuleByChannel', width=32, command=self.run_rcmc, style='primary.TButton')
        self.btn_run_rcmc.grid(row=row_rcmc, column=0, columnspan=2, pady=18, sticky='ew')
        self.btn_run_rcmc.configure(style='primary.TButton')
        self._add_tooltip(self.btn_run_rcmc, "Run ReportCommunicationModuleByChannel with selected parameters.")
    def run_remotereboot(self):
        params = {k: v.get() for k, v in self.entries_remotereboot.items()}
        env = os.environ.copy()
        for k, v in params.items():
            env_key = f'REMOTEREBOOT_{k.upper()}'
            env[env_key] = v
        def worker():
            try:
                import subprocess, sys
                script_path = os.path.join(os.path.dirname(__file__), 'RemoteReboot.py')
                proc = subprocess.Popen([sys.executable, script_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
                self._child_procs.append(proc)
                for line in proc.stdout:
                    self.output.after(0, lambda l=line: self._insert_output_line(l))
                stdout, stderr = proc.communicate()
                if stderr:
                    self.output.after(0, lambda: self._insert_output_line("[STDERR] " + stderr + "\n"))
            except Exception as e:
                self.output.after(0, lambda: messagebox.showerror('Error', str(e)))
        t = threading.Thread(target=worker, daemon=True)
        self._child_threads.append(t)
        t.start()
    def run_remotedisarm(self):
        params = {k: v.get() for k, v in self.entries_remotedisarm.items()}
        env = os.environ.copy()
        for k, v in params.items():
            env_key = f'REMOTEDISARM_{k.upper()}'
            env[env_key] = v
        def worker():
            try:
                import subprocess, sys
                script_path = os.path.join(os.path.dirname(__file__), 'RemoteDisarm.py')
                proc = subprocess.Popen([sys.executable, script_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
                self._child_procs.append(proc)
                for line in proc.stdout:
                    self.output.after(0, lambda l=line: self._insert_output_line(l))
                stdout, stderr = proc.communicate()
                if stderr:
                    self.output.after(0, lambda: self._insert_output_line("[STDERR] " + stderr + "\n"))
            except Exception as e:
                self.output.after(0, lambda: messagebox.showerror('Error', str(e)))
        t = threading.Thread(target=worker, daemon=True)
        self._child_threads.append(t)
        t.start()
    def run_remotearm(self):
        params = {k: v.get() for k, v in self.entries_remotearm.items()}
        env = os.environ.copy()
        for k, v in params.items():
            env_key = f'REMOTEARM_{k.upper()}'
            env[env_key] = v
        def worker():
            try:
                import subprocess, sys
                script_path = os.path.join(os.path.dirname(__file__), 'RemoteArm.py')
                proc = subprocess.Popen([sys.executable, script_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
                self._child_procs.append(proc)
                for line in proc.stdout:
                    self.output.after(0, lambda l=line: self._insert_output_line(l))
                stdout, stderr = proc.communicate()
                if stderr:
                    self.output.after(0, lambda: self._insert_output_line("[STDERR] " + stderr + "\n"))
            except Exception as e:
                self.output.after(0, lambda: messagebox.showerror('Error', str(e)))
        t = threading.Thread(target=worker, daemon=True)
        self._child_threads.append(t)
        t.start()

    """
    Ventana principal de la aplicación Modem Check GUI.
    """

    def validate_int(self, value: str, field_name: str) -> Optional[int]:
        """Valida que el valor sea un entero. Muestra error si no lo es."""
        try:
            return int(value)
        except Exception:
            messagebox.showerror("Validation error", f"The field '{field_name}' must be an integer.")
            logging.error(f"Validation error: {field_name} must be int, got '{value}'")
            return None

    def validate_float(self, value: str, field_name: str) -> Optional[float]:
        """Valida que el valor sea un float positivo."""
        try:
            val = float(value)
            if val < 0:
                raise ValueError
            return val
        except Exception:
            messagebox.showerror("Validation error", f"The field '{field_name}' must be a positive number.")
            logging.error(f"Validation error: {field_name} must be positive float, got '{value}'")
            return None

    def update_paso(self) -> None:
        """Actualiza el paso seleccionado en la secuencia con los valores actuales del formulario, validando los campos."""
        sel = self.listbox_secuencia.curselection()
        if not sel:
            messagebox.showinfo("Update step", "Select a step to update.")
            return
        idx = sel[0]
        existing_nombre = None
        try:
            existing_nombre = self.pasos_seleccionados[idx].get("nombre")
        except Exception:
            existing_nombre = None
        paso_idx = self.combo_paso.current()
        if paso_idx < 0:
            return
        paso_nombre = self.pasos_disponibles[paso_idx][0]

        # Safety: prevent accidentally changing step type (common source of "everything becomes PTS").
        if existing_nombre and paso_nombre != existing_nombre:
            try:
                change_type = messagebox.askyesno(
                    "Change step type?",
                    f"You selected a '{existing_nombre}' step, but the form is set to '{paso_nombre}'.\n\nDo you want to change the step type?",
                )
            except Exception:
                change_type = False
            if not change_type:
                paso_nombre = existing_nombre
                # Keep UI in sync as well
                try:
                    for i, (k, _label) in enumerate(self.pasos_disponibles):
                        if k == existing_nombre:
                            try:
                                self.combo_paso.current(i)
                                self.combo_paso.event_generate('<<ComboboxSelected>>')
                                break
                            except Exception:
                                pass
                except Exception:
                    pass
        else:
            inst_num = self.validate_int(self.seq_inst_num_var.get(), 'Installation number')
            if inst_num is None:
                return
            params = {
                "Installation Number": str(inst_num),
                "Country": self.seq_country_var.get(),
                "typeOfInformation": paso_nombre
            }
        self.pasos_seleccionados[idx] = {"nombre": paso_nombre, "espera": str(wait_time), "params": params}
        self._refresh_listbox_secuencia()
        self.listbox_secuencia.selection_set(idx)
        self._update_step_buttons_state()

    def _on_secuencia_listbox_select(self, event=None):
        """Sync the sequence editor form with the selected step.

        Without this, clicking 'Update' can unintentionally overwrite the step type
        (e.g., multiple ChangeStatus steps turning into PTS).
        """
        self._update_step_buttons_state()
        try:
            sel = self.listbox_secuencia.curselection()
            if not sel:
                return
            idx = sel[0]
            if idx < 0 or idx >= len(self.pasos_seleccionados):
                return
            paso = self.pasos_seleccionados[idx]
            nombre = paso.get("nombre", "")
            espera = paso.get("espera", "2")
            params = paso.get("params", {}) or {}

            # Set step type combobox to match selected step
            for i, (k, _label) in enumerate(getattr(self, 'pasos_disponibles', [])):
                if k == nombre:
                    try:
                        self.combo_paso.current(i)
                        # Trigger frame switching logic defined in _init_secuencia_tab
                        self.combo_paso.event_generate('<<ComboboxSelected>>')
                    except Exception:
                        pass
                    break

            # Wait time
            try:
                self.seq_wait_time_var.set(str(espera))
            except Exception:
                pass

            # Populate commonly used fields
            if nombre == "MediaUserRequest":
                try:
                    if 'Installation Number' in params:
                        self.seq_inst_num_var.set(str(params.get('Installation Number', '')))
                    if 'Country' in params:
                        self.seq_country_var.set(str(params.get('Country', '')))
                    if 'numberOfPicture' in params:
                        self.seq_num_pics_var.set(str(params.get('numberOfPicture', '1')))
                    if 'camera_type' in params:
                        self.seq_camera_type_var.set(str(params.get('camera_type', 'Orion')))
                    if 'deviceId' in params:
                        self.seq_device_id_var.set(str(params.get('deviceId', '06')))
                    if 'media_type' in params:
                        self.seq_media_type_var.set(str(params.get('media_type', '1 = Photo')))
                    if 'resolution' in params:
                        self.seq_resolution_var.set(str(params.get('resolution', '1 = Minimum')))
                except Exception:
                    pass
            elif nombre in ["CCS", "PTS", "ITS", "NTS", "UTS", "LOS"]:
                try:
                    if 'Installation Number' in params:
                        self.seq_inst_num_var.set(str(params.get('Installation Number', '')))
                    if 'Country' in params:
                        self.seq_country_var.set(str(params.get('Country', '')))
                except Exception:
                    pass
            elif nombre == "DoorLock":
                try:
                    if 'deviceId' in params:
                        self.seq_doorlock_deviceid_var.set(str(params.get('deviceId', '01')))
                    # Expect lock to be '1' or '0' in stored params
                    lock_val = str(params.get('lock', '1')).strip()
                    self.seq_doorlock_lock_var.set("1 = Lock" if lock_val == '1' else "0 = Unlock")
                except Exception:
                    pass
            elif nombre == "ReportCommunicationModuleByChannel":
                try:
                    if 'codInstalacion' in params:
                        self.seq_rcmc_codinst_var.set(str(params.get('codInstalacion', '')))
                    if 'channel' in params:
                        self.seq_rcmc_channel_var.set(str(params.get('channel', '2 - SMS')))
                except Exception:
                    pass
            elif nombre == "RemoteArm":
                try:
                    self.seq_remotearm_codinst_var.set(str(params.get('codInstalacion', self.seq_remotearm_codinst_var.get())))
                    self.seq_remotearm_codpais_var.set(str(params.get('codPais', self.seq_remotearm_codpais_var.get())))
                    self.seq_remotearm_orderid_var.set(str(params.get('orderid', self.seq_remotearm_orderid_var.get())))
                    self.seq_remotearm_userid_var.set(str(params.get('userId', self.seq_remotearm_userid_var.get())))
                    self.seq_remotearm_armmode_var.set(str(params.get('armMode', self.seq_remotearm_armmode_var.get())))
                except Exception:
                    pass
            elif nombre == "RemoteDisarm":
                try:
                    self.seq_remotedisarm_codinst_var.set(str(params.get('codInstalacion', self.seq_remotedisarm_codinst_var.get())))
                    self.seq_remotedisarm_codpais_var.set(str(params.get('codPais', self.seq_remotedisarm_codpais_var.get())))
                    self.seq_remotedisarm_orderid_var.set(str(params.get('orderid', self.seq_remotedisarm_orderid_var.get())))
                    self.seq_remotedisarm_userid_var.set(str(params.get('userId', self.seq_remotedisarm_userid_var.get())))
                    self.seq_remotedisarm_armmode_var.set(str(params.get('armMode', self.seq_remotedisarm_armmode_var.get())))
                except Exception:
                    pass
            elif nombre == "RemoteReboot":
                try:
                    self.seq_remotereboot_codinst_var.set(str(params.get('codInstalacion', self.seq_remotereboot_codinst_var.get())))
                    self.seq_remotereboot_codpais_var.set(str(params.get('codPais', self.seq_remotereboot_codpais_var.get())))
                    self.seq_remotereboot_orderid_var.set(str(params.get('orderid', self.seq_remotereboot_orderid_var.get())))
                    self.seq_remotereboot_userid_var.set(str(params.get('userId', self.seq_remotereboot_userid_var.get())))
                    if 'deviceId' in params:
                        self.seq_remotereboot_deviceid_var.set(str(params.get('deviceId', self.seq_remotereboot_deviceid_var.get())))
                    if 'deviceType' in params:
                        self.seq_remotereboot_devicetype_var.set(str(params.get('deviceType', self.seq_remotereboot_devicetype_var.get())))
                except Exception:
                    pass
        except Exception:
            # Never let UI selection crash the app
            return
    def __init__(self):
        super().__init__(themename='flatly')
        self.current_theme = 'flatly'
        self.title('UltraProtom Sequence')
        # Default startup size: keep it reasonable (output size follows window size)
        try:
            sw = self.winfo_screenwidth()
            sh = self.winfo_screenheight()
            w = min(1400, int(sw * 0.92))
            h = min(900, int(sh * 0.85))
            self.geometry(f"{w}x{h}")
        except Exception:
            self.geometry('1400x900')
        self.resizable(True, True)
        self._child_threads = []
        self._child_procs = []
        self._stop_seq_flag = threading.Event()
        self.protocol("WM_DELETE_WINDOW", self.on_close)

        # --- Estilos modernos eliminados (ahora los maneja ttkbootstrap) ---

        # --- Layout principal con PanedWindow (responsivo) ---
        main_paned = ttk.Panedwindow(self, orient='horizontal')
        self._main_paned = main_paned
        main_paned.pack(fill='both', expand=True, padx=16, pady=16)

        left_pane = ttk.Frame(main_paned)
        right_pane = ttk.Frame(main_paned)
        # Default like before: output pane gets more room
        main_paned.add(left_pane, weight=1)
        main_paned.add(right_pane, weight=3)

        # Never allow the left pane (tabs) to collapse completely
        MIN_LEFT = 520
        # Right pane minimum width (varies by tab; Operation wants a bit more output)
        self._paned_min_right = 420
        # Default: Operation-friendly split (Sequence can choose a narrower output)
        self._paned_ratio_operation = 0.35
        self._paned_ratio_sequence = 0.78
        self._paned_ratio = self._paned_ratio_operation
        self._paned_resize_after_id = None
        try:
            main_paned.paneconfigure(left_pane, minsize=MIN_LEFT)
            main_paned.paneconfigure(right_pane, minsize=self._paned_min_right)
        except Exception:
            pass

        def _clamp_sash(total_width: int, desired_pos: int) -> int:
            min_right = int(getattr(self, '_paned_min_right', 0) or 0)
            max_left = max(MIN_LEFT, total_width - min_right)
            return max(MIN_LEFT, min(max_left, desired_pos))

        def _apply_sash_for_current_width():
            try:
                self.update_idletasks()
                total = main_paned.winfo_width() or self.winfo_width() or 0
                if total <= 1:
                    return
                desired = int(total * float(getattr(self, '_paned_ratio', 0.33)))
                main_paned.sashpos(0, _clamp_sash(total, desired))
            except Exception:
                pass

        # Expose to other handlers
        self._apply_paned_sash = _apply_sash_for_current_width

        def _schedule_apply_sash(event=None):
            # Throttle: resizing generates many events
            try:
                if self._paned_resize_after_id is not None:
                    self.after_cancel(self._paned_resize_after_id)
            except Exception:
                pass
            self._paned_resize_after_id = self.after(80, _apply_sash_for_current_width)

        self._schedule_paned_sash = _schedule_apply_sash

        def _capture_ratio(event=None):
            """Capture ratio after the user drags the sash."""
            try:
                total = main_paned.winfo_width() or 0
                if total <= 1:
                    return
                pos = int(main_paned.sashpos(0))
                # Keep ratio sane, but preserve intent
                try:
                    current_tab = self.notebook.tab(self.notebook.select(), 'text')
                except Exception:
                    current_tab = None
                # Operation: allow larger output if desired; Sequence: keep output relatively narrow
                if current_tab == 'Sequence':
                    ratio = max(0.55, min(0.92, pos / total))
                else:
                    ratio = max(0.15, min(0.85, pos / total))
                self._paned_ratio = ratio
                # Persist per tab so Sequence can be wider without breaking Operation
                if current_tab == 'Sequence':
                    self._paned_ratio_sequence = ratio
                else:
                    self._paned_ratio_operation = ratio
            except Exception:
                pass

        # Keep panes consistent on maximize/minimize/restore and any resize
        self.bind('<Configure>', _schedule_apply_sash)
        # When user drags the separator, store the new ratio
        main_paned.bind('<ButtonRelease-1>', _capture_ratio)

        # Favor output space by default (user can drag the sash anytime)
        def _set_initial_sash():
            try:
                self.update_idletasks()
                total = main_paned.winfo_width() or self.winfo_width() or 0
                if total <= 1:
                    # Window not measured yet; retry shortly
                    self.after(120, _set_initial_sash)
                    return
                desired = int(total * float(getattr(self, '_paned_ratio', 0.33)))
                main_paned.sashpos(0, _clamp_sash(total, desired))
            except Exception:
                pass
        self.after(80, _set_initial_sash)

        # --- Notebook (tabs) a la izquierda ---
        self.notebook = ttk.Notebook(left_pane)
        self.notebook.pack(fill='both', expand=True)

        def _on_tab_changed(event=None):
            """Apply per-tab split without changing window state."""
            try:
                tab = self.notebook.tab(self.notebook.select(), 'text')
            except Exception:
                tab = None

            if tab == 'Sequence':
                # Sequence: reduce output pane
                self._paned_min_right = 260
                try:
                    main_paned.paneconfigure(right_pane, minsize=self._paned_min_right)
                except Exception:
                    pass
                self._paned_ratio = float(getattr(self, '_paned_ratio_sequence', 0.78))
                try:
                    self._schedule_paned_sash()
                except Exception:
                    pass

            elif tab == 'Operation':
                # Operation: keep output visible
                self._paned_min_right = 420
                try:
                    main_paned.paneconfigure(right_pane, minsize=self._paned_min_right)
                except Exception:
                    pass
                self._paned_ratio = float(getattr(self, '_paned_ratio_operation', 0.35))
                try:
                    self._schedule_paned_sash()
                except Exception:
                    pass

        self.notebook.bind('<<NotebookTabChanged>>', _on_tab_changed)

        # --- Consola de salida a la derecha ---
        output_frame = ttk.Frame(right_pane)
        output_frame.pack(fill='both', expand=True)
        # Use grid inside the output frame so the bottom buttons are always visible
        output_frame.grid_rowconfigure(1, weight=1)
        output_frame.grid_columnconfigure(0, weight=1)

        # Toolbar de salida: modo Verbose
        self.verbose_var = tk.BooleanVar(value=False)
        output_toolbar = ttk.Frame(output_frame)
        output_toolbar.grid(row=0, column=0, sticky='ew', padx=0, pady=(0, 6))
        verbose_chk = ttk.Checkbutton(output_toolbar, text='Verbose output', variable=self.verbose_var, command=self._update_status)
        verbose_chk.pack(side='right')
        verbose_chk.configure()

        # Status bar inferior
        status_frame = ttk.Frame(self)
        status_frame.pack(side='bottom', fill='x')
        self.status_var = tk.StringVar(value=f"Theme: {self.current_theme} • Verbose: Off")
        self.status_label = ttk.Label(status_frame, textvariable=self.status_var, anchor='w')
        self.status_label.pack(fill='x', padx=16, pady=4)
        self.output = tk.Text(
            output_frame,
            # Keep requested size small so the window can be compact
            height=1,
            width=1,
            font=('Consolas', 10),
            relief='flat',
            borderwidth=0,
            wrap='word',
            highlightthickness=0,
        )
        self.output.grid(row=1, column=0, sticky='nsew', padx=0, pady=0)
        self._style_output_console()

        # --- Clear Screen and Stop Sequence buttons aligned horizontally ---
        btns_output_frame = ttk.Frame(output_frame)
        btns_output_frame.grid(row=2, column=0, sticky='ew', pady=(8, 0))
        self.btn_clear = ttk.Button(btns_output_frame, text='🧹 Clear Screen', width=16, command=self.clear_output, style='secondary.TButton')
        self.btn_clear.pack(side='left', padx=(0, 8))
        self.btn_clear.configure(style='secondary.TButton')
        self._add_tooltip(self.btn_clear, "Clear the output console.")

        self.btn_stop_seq = ttk.Button(btns_output_frame, text='⏹ Stop Sequence', width=16, command=self.stop_secuencia, style='danger.TButton')
        self.btn_stop_seq.pack(side='left')
        self.btn_stop_seq.configure(style='danger.TButton')
        self._add_tooltip(self.btn_stop_seq, "Stop the current running sequence.")

        # --- Pestaña Unificada (Operación, carga inmediata) ---
        self.tab_unificada = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_unificada, text='Operation')
        self._init_operacion_tab()

        # --- Pestaña Secuencia (nueva, modularizada) ---
        self._init_secuencia_tab()

        # Apply per-tab sizing on first render
        self.after(120, _on_tab_changed)

    def _init_secuencia_tab(self):
        """Initializes the sequence tab and all its widgets (improved visually, all texts in English)."""
        import tkinter as tk
        SECTION_PADX = 12
        SECTION_PADY = (6, 4)
        self.tab_secuencia = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_secuencia, text='Sequence')

        secuencia_label = ttk.Label(self.tab_secuencia, text="Step sequence (edit, move and run):", font=("Segoe UI", 12, "bold"))
        secuencia_label.pack(pady=(12, 6))

        # Available steps list
        self.pasos_disponibles = [
            ("MediaUserRequest", "MediaUserRequest"),
            ("CCS", "ChangeStatus CCS"),
            ("PTS", "ChangeStatus PTS"),
            ("ITS", "ChangeStatus ITS"),
            ("NTS", "ChangeStatus NTS"),
            ("UTS", "ChangeStatus UTS"),
            ("LOS", "ChangeStatus LOS"),
            ("DoorLock", "DoorLock"),
            ("ReportCommunicationModuleByChannel", "ReportCommunicationModuleByChannel"),
            ("RemoteArm", "RemoteArm"),
            ("RemoteDisarm", "RemoteDisarm"),
            ("RemoteReboot", "RemoteReboot")
        ]
        # --- Parámetros para ReportCommunicationModuleByChannel en secuencia ---
        self.frame_param_rcmc_seq = ttk.LabelFrame(self.tab_secuencia, text="ReportCommunicationModuleByChannel parameters", style='TLabelframe')
        self.seq_rcmc_codinst_var = tk.StringVar(value="5912095")
        self.seq_rcmc_channel_var = tk.StringVar(value="2 - SMS")
        ttk.Label(self.frame_param_rcmc_seq, text="codInstalacion:").grid(row=0, column=0, sticky='e', padx=8, pady=6)
        entry_codinst = ttk.Entry(self.frame_param_rcmc_seq, textvariable=self.seq_rcmc_codinst_var, width=20)
        entry_codinst.grid(row=0, column=1, padx=12, pady=6, sticky='ew')
        ttk.Label(self.frame_param_rcmc_seq, text="channel:").grid(row=1, column=0, sticky='e', padx=8, pady=6)
        channel_options = ["0 - Ethernet", "1 - GPRS", "2 - SMS", "3 - WiFi"]
        channel_menu = ttk.Combobox(self.frame_param_rcmc_seq, textvariable=self.seq_rcmc_channel_var, state='readonly', values=channel_options)
        channel_menu.grid(row=1, column=1, padx=12, pady=6, sticky='ew')
        # Para uso en la lógica de secuencia, agregar acceso a estos parámetros como se hace con otros comandos.
        # RemoteArm parameters for sequence tab
        self.frame_param_remotearm = ttk.LabelFrame(self.tab_secuencia, text="RemoteArm parameters", style='TLabelframe')
        # No pack aquí, se hará dinámico
        ttk.Label(self.frame_param_remotearm, text="codInstalacion:").grid(row=0, column=0, sticky='e', padx=5, pady=2)
        self.seq_remotearm_codinst_var = tk.StringVar(value="5499266")
        entry_codinst = ttk.Entry(self.frame_param_remotearm, textvariable=self.seq_remotearm_codinst_var, width=16)
        entry_codinst.grid(row=0, column=1, padx=8, pady=2, sticky='ew')
        ttk.Label(self.frame_param_remotearm, text="codPais:").grid(row=1, column=0, sticky='e', padx=5, pady=2)
        self.seq_remotearm_codpais_var = tk.StringVar(value="ESP")
        entry_codpais = ttk.Entry(self.frame_param_remotearm, textvariable=self.seq_remotearm_codpais_var, width=8)
        entry_codpais.grid(row=1, column=1, padx=8, pady=2, sticky='ew')
        ttk.Label(self.frame_param_remotearm, text="orderid:").grid(row=2, column=0, sticky='e', padx=5, pady=2)
        self.seq_remotearm_orderid_var = tk.StringVar(value="RemoteArm")
        entry_orderid = ttk.Entry(self.frame_param_remotearm, textvariable=self.seq_remotearm_orderid_var, width=16)
        entry_orderid.grid(row=2, column=1, padx=8, pady=2, sticky='ew')
        ttk.Label(self.frame_param_remotearm, text="userId:").grid(row=3, column=0, sticky='e', padx=5, pady=2)
        self.seq_remotearm_userid_var = tk.StringVar(value="00")
        entry_userid = ttk.Entry(self.frame_param_remotearm, textvariable=self.seq_remotearm_userid_var, width=8)
        entry_userid.grid(row=3, column=1, padx=8, pady=2, sticky='ew')
        # ArmMode dropdown with descriptions
        arm_modes = [
            ("01", "Main Area - Arm Mode 1 (Arm Away)"),
            ("02", "Main Area - Arm Mode 2 (Arm Home)"),
            ("21", "Perimeter"),
            ("23", "Perimeter + arm away (Main Area - Arm Mode 1)"),
            ("24", "Perimeter + Arm Home (Main Area - Arm Mode 2)")
        ]
        ttk.Label(self.frame_param_remotearm, text="armMode:").grid(row=4, column=0, sticky='e', padx=5, pady=2)
        self.seq_remotearm_armmode_var = tk.StringVar(value="23")
        arm_mode_menu = ttk.Combobox(self.frame_param_remotearm, textvariable=self.seq_remotearm_armmode_var, state='readonly',
            values=[f"{code} - {desc}" for code, desc in arm_modes])
        arm_mode_menu.grid(row=4, column=1, padx=8, pady=2, sticky='ew')
        def update_seq_armmode_var(event=None):
            val = self.seq_remotearm_armmode_var.get()
            code = val.split(' - ')[0] if ' - ' in val else val
            self.seq_remotearm_armmode_var.set(code)
        arm_mode_menu.bind('<<ComboboxSelected>>', update_seq_armmode_var)
        arm_mode_menu.current(3)  # Default to 23
        update_seq_armmode_var()
        self.frame_param_remotearm.grid_columnconfigure(1, weight=1)

        # RemoteDisarm parameters for sequence tab
        self.frame_param_remotedisarm = ttk.LabelFrame(self.tab_secuencia, text="RemoteDisarm parameters", style='TLabelframe')
        ttk.Label(self.frame_param_remotedisarm, text="codInstalacion:").grid(row=0, column=0, sticky='e', padx=5, pady=2)
        self.seq_remotedisarm_codinst_var = tk.StringVar(value="5499266")
        entry_codinst_disarm = ttk.Entry(self.frame_param_remotedisarm, textvariable=self.seq_remotedisarm_codinst_var, width=16)
        entry_codinst_disarm.grid(row=0, column=1, padx=8, pady=2, sticky='ew')
        ttk.Label(self.frame_param_remotedisarm, text="codPais:").grid(row=1, column=0, sticky='e', padx=5, pady=2)
        self.seq_remotedisarm_codpais_var = tk.StringVar(value="ESP")
        entry_codpais_disarm = ttk.Entry(self.frame_param_remotedisarm, textvariable=self.seq_remotedisarm_codpais_var, width=8)
        entry_codpais_disarm.grid(row=1, column=1, padx=8, pady=2, sticky='ew')
        ttk.Label(self.frame_param_remotedisarm, text="orderid:").grid(row=2, column=0, sticky='e', padx=5, pady=2)
        self.seq_remotedisarm_orderid_var = tk.StringVar(value="RemoteDisarm")
        entry_orderid_disarm = ttk.Entry(self.frame_param_remotedisarm, textvariable=self.seq_remotedisarm_orderid_var, width=16)
        entry_orderid_disarm.grid(row=2, column=1, padx=8, pady=2, sticky='ew')
        ttk.Label(self.frame_param_remotedisarm, text="userId:").grid(row=3, column=0, sticky='e', padx=5, pady=2)
        self.seq_remotedisarm_userid_var = tk.StringVar(value="00")
        entry_userid_disarm = ttk.Entry(self.frame_param_remotedisarm, textvariable=self.seq_remotedisarm_userid_var, width=8)
        entry_userid_disarm.grid(row=3, column=1, padx=8, pady=2, sticky='ew')
        # ArmMode dropdown for RemoteDisarm
        disarm_arm_modes = [
            ("00", "Disarm All Areas"),
            ("10", "Disarm Main Area Only"),
            ("20", "Disarm Perimeter Only")
        ]
        ttk.Label(self.frame_param_remotedisarm, text="armMode:").grid(row=4, column=0, sticky='e', padx=5, pady=2)
        self.seq_remotedisarm_armmode_var = tk.StringVar(value="00")
        disarm_mode_menu = ttk.Combobox(self.frame_param_remotedisarm, textvariable=self.seq_remotedisarm_armmode_var, state='readonly',
            values=[f"{code} - {desc}" for code, desc in disarm_arm_modes])
        disarm_mode_menu.grid(row=4, column=1, padx=8, pady=2, sticky='ew')
        def update_seq_disarmmode_var(event=None):
            val = self.seq_remotedisarm_armmode_var.get()
            code = val.split(' - ')[0] if ' - ' in val else val
            self.seq_remotedisarm_armmode_var.set(code)
        disarm_mode_menu.bind('<<ComboboxSelected>>', update_seq_disarmmode_var)
        disarm_mode_menu.current(0)  # Default to 00
        update_seq_disarmmode_var()
        self.frame_param_remotedisarm.grid_columnconfigure(1, weight=1)

        # RemoteReboot parameters for sequence tab
        self.frame_param_remotereboot = ttk.LabelFrame(self.tab_secuencia, text="RemoteReboot parameters", style='TLabelframe')
        ttk.Label(self.frame_param_remotereboot, text="codInstalacion:").grid(row=0, column=0, sticky='e', padx=5, pady=2)
        self.seq_remotereboot_codinst_var = tk.StringVar(value="5499266")
        entry_codinst_reboot = ttk.Entry(self.frame_param_remotereboot, textvariable=self.seq_remotereboot_codinst_var, width=16)
        entry_codinst_reboot.grid(row=0, column=1, padx=8, pady=2, sticky='ew')
        # codPais and orderid are fixed for RemoteReboot and should not be user-editable
        self.seq_remotereboot_codpais_var = tk.StringVar(value="ESP")
        self.seq_remotereboot_orderid_var = tk.StringVar(value="ResetPanelOrDevice")

        ttk.Label(self.frame_param_remotereboot, text="userId:").grid(row=1, column=0, sticky='e', padx=5, pady=2)
        self.seq_remotereboot_userid_var = tk.StringVar(value="00")
        entry_userid_reboot = ttk.Entry(self.frame_param_remotereboot, textvariable=self.seq_remotereboot_userid_var, width=8)
        entry_userid_reboot.grid(row=1, column=1, padx=8, pady=2, sticky='ew')
        ttk.Label(self.frame_param_remotereboot, text="deviceType:").grid(row=2, column=0, sticky='e', padx=5, pady=2)
        # Use a dropdown for common device types, but keep storing only the numeric code.
        seq_reboot_device_types = [
            ("Central Unit", "100"),
            ("MoM Smart Shock Sensor", "101"),
            ("MoM Indoor PIR", "102"),
            ("Croptex (outdoor PIR)", "103"),
            ("MoM Zero Vision", "104"),
            ("Orion Camera", "106"),
            ("Aquila Camera", "107"),
            ("MoM Smart Panic Button", "120"),
            ("MoM Smoke Detector", "121"),
            ("MoM Smart Water Detector", "122"),
            ("Smart Plug", "130"),
            ("MoM Verisure Portal (7'')", "140"),
            ("MoM Smart Dot", "141"),
            ("MoM siren Voice Keypad", "142"),
            ("MoM Keyfob", "162"),
            ("DoorLock", "163"),
        ]
        self.seq_remotereboot_devicetype_var = tk.StringVar(value="106")
        self.seq_remotereboot_devicetype_display_var = tk.StringVar()
        reboot_type_menu = ttk.Combobox(
            self.frame_param_remotereboot,
            textvariable=self.seq_remotereboot_devicetype_display_var,
            state='readonly',
            values=[f"{name} ({code})" for name, code in seq_reboot_device_types],
            width=22
        )
        reboot_type_menu.grid(row=2, column=1, padx=8, pady=2, sticky='ew')

        def _sync_seq_reboot_devicetype(event=None):
            val = self.seq_remotereboot_devicetype_display_var.get().strip()
            if '(' in val and ')' in val:
                code = val.split('(')[-1].split(')')[0].strip()
                self.seq_remotereboot_devicetype_var.set(code)
            elif val:
                self.seq_remotereboot_devicetype_var.set(val)

        reboot_type_menu.bind('<<ComboboxSelected>>', _sync_seq_reboot_devicetype)

        # Initialize dropdown selection from the stored code (default 106)
        initial_code = str(self.seq_remotereboot_devicetype_var.get()).strip()
        initial_index = 0
        for i, (_, code) in enumerate(seq_reboot_device_types):
            if str(code) == initial_code:
                initial_index = i
                break
        reboot_type_menu.current(initial_index)
        _sync_seq_reboot_devicetype()
        ttk.Label(self.frame_param_remotereboot, text="deviceId:").grid(row=3, column=0, sticky='e', padx=5, pady=2)
        self.seq_remotereboot_deviceid_var = tk.StringVar(value="01")
        entry_deviceid_reboot = ttk.Entry(self.frame_param_remotereboot, textvariable=self.seq_remotereboot_deviceid_var, width=8)
        entry_deviceid_reboot.grid(row=3, column=1, padx=8, pady=2, sticky='ew')
        self.frame_param_remotereboot.grid_columnconfigure(1, weight=1)

        self.pasos_seleccionados = []

        # --- Visual group for sequence editing ---
        group_secuencia = ttk.LabelFrame(self.tab_secuencia, text="Edit sequence steps", style='TLabelframe')
        group_secuencia.pack(pady=(8, 14), padx=SECTION_PADX, fill='x')
        group_secuencia.grid_columnconfigure(0, weight=1)
        group_secuencia.grid_columnconfigure(1, weight=0)

        # Row 0: Combobox and label for step type
        ttk.Label(group_secuencia, text="Step type to add:").grid(row=0, column=0, sticky='w', padx=(4, 8), pady=(8, 4))
        self.combo_paso = ttk.Combobox(group_secuencia, state='readonly', values=[p[1] for p in self.pasos_disponibles], width=22)
        self.combo_paso.grid(row=0, column=1, sticky='w', padx=(0, 8), pady=(8, 4))
        self.combo_paso.set(self.pasos_disponibles[0][1])
        self.combo_paso.tooltip = self._add_tooltip(self.combo_paso, "Select the type of step to add to the sequence.")

        # Row 1: Listbox and action buttons
        self.listbox_secuencia = tk.Listbox(group_secuencia, height=9, selectmode=tk.SINGLE, font=("Segoe UI", 11))
        self.listbox_secuencia.grid(row=1, column=0, padx=(4, 12), pady=(2, 10), sticky='nsew')
        self.listbox_secuencia.bind('<Double-Button-1>', self.edit_paso_wait_time)
        self.listbox_secuencia.tooltip = self._add_tooltip(self.listbox_secuencia, "Step list. Double click to edit wait time.")

        btns_frame = ttk.Frame(group_secuencia)
        btns_frame.grid(row=1, column=1, sticky='n', padx=(0, 2), pady=(2, 10))
        button_font = ('Segoe UI', 11, 'bold')
        self.btn_add = ttk.Button(btns_frame, text="➕ Add", width=16, command=self.add_paso, style='secondary.TButton')
        self.btn_add.pack(fill='x', pady=3)
        self.btn_add.configure(style='secondary.TButton')
        self._add_tooltip(self.btn_add, "Add step to the sequence.")
        self.btn_update = ttk.Button(btns_frame, text="✏️ Update", width=16, command=self.update_paso, style='secondary.TButton')
        self.btn_update.pack(fill='x', pady=3)
        self.btn_update.configure(style='secondary.TButton')
        self._add_tooltip(self.btn_update, "Update the selected step.")
        self.btn_remove = ttk.Button(btns_frame, text="🗑 Delete", width=16, command=self.remove_paso, style='danger.TButton')
        self.btn_remove.pack(fill='x', pady=3)
        self.btn_remove.configure(style='danger.TButton')
        self._add_tooltip(self.btn_remove, "Delete the selected step.")
        self.btn_up = ttk.Button(btns_frame, text="⬆ Up", width=16, command=self.move_paso_up, style='secondary.TButton')
        self.btn_up.pack(fill='x', pady=3)
        self.btn_up.configure(style='secondary.TButton')
        self._add_tooltip(self.btn_up, "Move the selected step up.")
        self.btn_down = ttk.Button(btns_frame, text="⬇ Down", width=16, command=self.move_paso_down, style='secondary.TButton')
        self.btn_down.pack(fill='x', pady=3)
        self.btn_down.configure(style='secondary.TButton')
        self._add_tooltip(self.btn_down, "Move the selected step down.")

        # Enable/disable buttons according to selection
        self.listbox_secuencia.bind('<<ListboxSelect>>', self._on_secuencia_listbox_select)
        self._update_step_buttons_state()

        # MediaUserRequest parameters (more configurable)
        self.frame_param_mur = ttk.LabelFrame(self.tab_secuencia, text="MediaUserRequest parameters", style='TLabelframe')
        # No pack aquí, se hará dinámico
        ttk.Label(self.frame_param_mur, text="Number of photos:").grid(row=0, column=0, sticky='e', padx=5, pady=2)
        self.seq_num_pics_var = tk.StringVar(value="1")
        num_pics_menu = ttk.Combobox(self.frame_param_mur, textvariable=self.seq_num_pics_var, state='readonly', values=[str(i) for i in range(1, 6)])
        num_pics_menu.grid(row=0, column=1, padx=8, pady=2, sticky='ew')
        self._add_tooltip(num_pics_menu, "Select the number of photos to request.")
        ttk.Label(self.frame_param_mur, text="Camera type:").grid(row=1, column=0, sticky='e', padx=5, pady=2)
        self.seq_camera_type_var = tk.StringVar(value="Orion")
        camera_types = ["Orion", "Aquila", "Croptex"]
        camera_menu = ttk.Combobox(self.frame_param_mur, textvariable=self.seq_camera_type_var, state='readonly', values=camera_types)
        camera_menu.grid(row=1, column=1, padx=8, pady=2, sticky='ew')
        self._add_tooltip(camera_menu, "Select the camera type.")
        ttk.Label(self.frame_param_mur, text="Device ID:").grid(row=2, column=0, sticky='e', padx=5, pady=2)
        self.seq_device_id_var = tk.StringVar(value="06")
        entry_device_id = ttk.Entry(self.frame_param_mur, textvariable=self.seq_device_id_var, width=8)
        entry_device_id.grid(row=2, column=1, padx=8, pady=2, sticky='ew')
        self._add_tooltip(entry_device_id, "Device ID (number).")
        # CU_VERSION is fixed and not configurable
        self.seq_cu_version_var = tk.StringVar(value="2")
        ttk.Label(self.frame_param_mur, text="Media type:").grid(row=4, column=0, sticky='e', padx=5, pady=2)
        self.seq_media_type_var = tk.StringVar(value="1 = Photo")
        media_types = ["1 = Photo", "2 = Video", "3 = Audio"]
        media_menu = ttk.Combobox(self.frame_param_mur, textvariable=self.seq_media_type_var, state='readonly', values=media_types)
        media_menu.grid(row=4, column=1, padx=8, pady=2, sticky='ew')
        self._add_tooltip(media_menu, "Select the media type.")
        ttk.Label(self.frame_param_mur, text="Resolution:").grid(row=5, column=0, sticky='e', padx=5, pady=2)
        self.seq_resolution_var = tk.StringVar(value="1 = Minimum")
        resolution_options = ["1 = Minimum", "2 = Small", "3 = Low", "4 = Medium", "5 = High", "6 = FHD"]
        resolution_menu = ttk.Combobox(self.frame_param_mur, textvariable=self.seq_resolution_var, state='readonly', values=resolution_options)
        resolution_menu.grid(row=5, column=1, padx=8, pady=2, sticky='ew')
        self._add_tooltip(resolution_menu, "Select the image resolution.")
        self.frame_param_mur.grid_columnconfigure(1, weight=1)

        # ChangeStatus parameters (status type)
        self.frame_param_status = ttk.LabelFrame(self.tab_secuencia, text="General sequence parameters", style='TLabelframe')
        # No pack aquí, se hará dinámico
        ttk.Label(self.frame_param_status, text="Installation number:").grid(row=0, column=0, sticky='e', padx=5, pady=2)
        self.seq_inst_num_var = tk.StringVar(value=str(changestatus_params['Installation Number']))
        entry_inst_num = ttk.Entry(self.frame_param_status, textvariable=self.seq_inst_num_var, width=16)
        entry_inst_num.grid(row=0, column=1, padx=8, pady=2, sticky='ew')
        self._add_tooltip(entry_inst_num, "Installation number (integer).")
        ttk.Label(self.frame_param_status, text="Country:").grid(row=1, column=0, sticky='e', padx=5, pady=2)
        self.seq_country_var = tk.StringVar(value=changestatus_params['Country'])
        entry_country = ttk.Entry(self.frame_param_status, textvariable=self.seq_country_var, width=8)
        entry_country.grid(row=1, column=1, padx=8, pady=2, sticky='ew')
        self._add_tooltip(entry_country, "Country code (e.g. ES).")
        self.frame_param_status.grid_columnconfigure(1, weight=1)

        # DoorLock parameters for sequence tab
        self.frame_param_doorlock = ttk.LabelFrame(self.tab_secuencia, text="DoorLock parameters", style='TLabelframe')
        # No pack aquí, se hará dinámico

        # Mostrar solo el frame relevante según el paso seleccionado
        def update_param_frame(event=None):
            paso = self.combo_paso.get()
            for frame in [self.frame_param_mur, self.frame_param_doorlock, self.frame_param_status, self.frame_param_remotearm, self.frame_param_remotedisarm, self.frame_param_remotereboot, self.frame_param_rcmc_seq]:
                frame.pack_forget()
            if paso == "MediaUserRequest":
                self.frame_param_mur.pack(pady=SECTION_PADY, padx=SECTION_PADX, fill='x')
            elif paso == "DoorLock":
                self.frame_param_doorlock.pack(pady=SECTION_PADY, padx=SECTION_PADX, fill='x')
            elif paso == "ReportCommunicationModuleByChannel":
                self.frame_param_rcmc_seq.pack(pady=SECTION_PADY, padx=SECTION_PADX, fill='x')
            elif paso == "RemoteArm":
                self.frame_param_remotearm.pack(pady=SECTION_PADY, padx=SECTION_PADX, fill='x')
            elif paso == "RemoteDisarm":
                self.frame_param_remotedisarm.pack(pady=SECTION_PADY, padx=SECTION_PADX, fill='x')
            elif paso == "RemoteReboot":
                self.frame_param_remotereboot.pack(pady=SECTION_PADY, padx=SECTION_PADX, fill='x')
            else:
                self.frame_param_status.pack(pady=SECTION_PADY, padx=SECTION_PADX, fill='x')
        self.combo_paso.bind('<<ComboboxSelected>>', update_param_frame)
        update_param_frame()
        ttk.Label(self.frame_param_doorlock, text="Device ID:").grid(row=0, column=0, sticky='e', padx=5, pady=2)
        self.seq_doorlock_deviceid_var = tk.StringVar(value="01")
        entry_doorlock_deviceid = ttk.Entry(self.frame_param_doorlock, textvariable=self.seq_doorlock_deviceid_var, width=8)
        entry_doorlock_deviceid.grid(row=0, column=1, padx=8, pady=2, sticky='ew')
        self._add_tooltip(entry_doorlock_deviceid, "Device ID for DoorLock (number, e.g. 01)")
        ttk.Label(self.frame_param_doorlock, text="Lock/Unlock:").grid(row=1, column=0, sticky='e', padx=5, pady=2)
        self.seq_doorlock_lock_var = tk.StringVar(value="1 = Lock")
        lock_options = ["1 = Lock", "0 = Unlock"]
        lock_menu = ttk.Combobox(self.frame_param_doorlock, textvariable=self.seq_doorlock_lock_var, state='readonly', values=lock_options)
        lock_menu.grid(row=1, column=1, padx=8, pady=2, sticky='ew')
        self._add_tooltip(lock_menu, "Select Lock or Unlock command.")
        self.frame_param_doorlock.grid_columnconfigure(1, weight=1)

        # Wait time between steps
        self.frame_param_wait = ttk.LabelFrame(self.tab_secuencia, text="Time between steps (seconds)", style='TLabelframe')
        self.frame_param_wait.pack(pady=SECTION_PADY, padx=SECTION_PADX, fill='x')
        ttk.Label(self.frame_param_wait, text="Wait between steps:").grid(row=0, column=0, sticky='e', padx=5, pady=2)
        self.seq_wait_time_var = tk.StringVar(value="2")
        entry_wait = ttk.Entry(self.frame_param_wait, textvariable=self.seq_wait_time_var, width=8)
        entry_wait.grid(row=0, column=1, padx=8, pady=2, sticky='ew')
        self._add_tooltip(entry_wait, "Seconds to wait between each step.")
        self.frame_param_wait.grid_columnconfigure(1, weight=1)

        # Sequence repetitions group
        self.frame_param_repeat = ttk.LabelFrame(self.tab_secuencia, text="Sequence repetitions", style='TLabelframe')
        self.frame_param_repeat.pack(pady=(SECTION_PADY[0], 12), padx=SECTION_PADX, fill='x')
        ttk.Label(self.frame_param_repeat, text="Repeat sequence:").grid(row=0, column=0, sticky='e', padx=5, pady=2)
        self.seq_repeat_var = tk.StringVar(value="1")
        entry_repeat = ttk.Entry(self.frame_param_repeat, textvariable=self.seq_repeat_var, width=8)
        entry_repeat.grid(row=0, column=1, padx=8, pady=2, sticky='ew')
        self._add_tooltip(entry_repeat, "Number of repetitions of the sequence.")
        self.frame_param_repeat.grid_columnconfigure(1, weight=1)

        # Run sequence button
        run_seq_frame = ttk.Frame(self.tab_secuencia)
        run_seq_frame.pack(pady=(10, 14), padx=SECTION_PADX, fill='x')
        btn_run_seq = ttk.Button(run_seq_frame, text="▶️ Run sequence", width=24, command=self.run_secuencia_personalizada, style='primary.TButton')
        btn_run_seq.pack(side='top', fill='x', padx=4, pady=4)
        btn_run_seq.configure(style='primary.TButton')
        self._add_tooltip(btn_run_seq, "Run the defined step sequence.")

    def _add_tooltip(self, widget, text):
        """Añade un tooltip simple a un widget."""
        import tkinter as tk
        tooltip = tk.Toplevel(widget)
        tooltip.withdraw()
        tooltip.overrideredirect(True)
        try:
            colors = tb.Style().colors
            tip_bg = getattr(colors, 'bg', '#ffffff')
            tip_fg = getattr(colors, 'fg', '#000000')
        except Exception:
            tip_bg = '#ffffff'
            tip_fg = '#000000'
        label = tk.Label(
            tooltip,
            text=text,
            background=tip_bg,
            foreground=tip_fg,
            relief="solid",
            borderwidth=1,
            font=("Segoe UI", 9),
        )
        label.pack(ipadx=4, ipady=2)
        def enter(event):
            x = widget.winfo_rootx() + 30
            y = widget.winfo_rooty() + 20
            tooltip.geometry(f"+{x}+{y}")
            tooltip.deiconify()
        def leave(event):
            tooltip.withdraw()
        widget.bind("<Enter>", enter)
        widget.bind("<Leave>", leave)
        return tooltip

    def add_paso(self) -> None:
        """
        Añade un paso a la secuencia, validando los campos y usando funciones auxiliares.
        """
        paso_idx = self.combo_paso.current()
        if paso_idx < 0:
            return
        paso_nombre = self.pasos_disponibles[paso_idx][0]
        wait_time = self.validate_float(self.seq_wait_time_var.get(), 'Wait between steps')
        if wait_time is None:
            return
        if paso_nombre == "MediaUserRequest":
            numberOfPicture = self.validate_int(self.seq_num_pics_var.get(), 'Number of photos')
            deviceId = self.validate_int(self.seq_device_id_var.get(), 'Device ID')
            inst_num = self.validate_int(self.seq_inst_num_var.get(), 'Installation number')
            cu_version = 2
            if None in (numberOfPicture, deviceId, inst_num):
                return
            params = {
                "numberOfPicture": str(numberOfPicture),
                "camera_type": self.seq_camera_type_var.get(),
                "deviceId": str(deviceId).zfill(2),
                "CU_VERSION": str(cu_version),
                "media_type": self.seq_media_type_var.get(),
                "resolution": self.seq_resolution_var.get(),
                "Installation Number": str(inst_num),
                "Country": self.seq_country_var.get()
            }
            self.pasos_seleccionados.append({"nombre": paso_nombre, "espera": str(wait_time), "params": params})
        elif paso_nombre == "DoorLock":
            pais = self.seq_country_var.get()
            idinst = self.seq_inst_num_var.get()
            deviceType = "163"
            deviceId = self.seq_doorlock_deviceid_var.get()
            lock = self.seq_doorlock_lock_var.get().split('=')[0].strip()
            reserved = "0000000000000000"
            params = {
                "pais": pais,
                "idInstalacion": idinst,
                "deviceType": deviceType,
                "deviceId": deviceId,
                "lock": lock,
                "reserved": reserved
            }
            self.pasos_seleccionados.append({"nombre": paso_nombre, "espera": str(wait_time), "params": params})
        elif paso_nombre == "ReportCommunicationModuleByChannel":
            codInstalacion = self.seq_rcmc_codinst_var.get()
            channel = self.seq_rcmc_channel_var.get()
            params = {
                "codInstalacion": codInstalacion,
                "channel": channel
            }
            self.pasos_seleccionados.append({"nombre": paso_nombre, "espera": str(wait_time), "params": params})
        elif paso_nombre == "RemoteArm":
            codInstalacion = self.seq_remotearm_codinst_var.get()
            codPais = self.seq_remotearm_codpais_var.get()
            orderid = self.seq_remotearm_orderid_var.get()
            userId = self.seq_remotearm_userid_var.get()
            armMode = self.seq_remotearm_armmode_var.get()
            params = {
                "codInstalacion": codInstalacion,
                "codPais": codPais,
                "orderid": orderid,
                "userId": userId,
                "armMode": armMode
            }
            self.pasos_seleccionados.append({"nombre": paso_nombre, "espera": str(wait_time), "params": params})
        elif paso_nombre == "RemoteDisarm":
            codInstalacion = self.seq_remotedisarm_codinst_var.get()
            codPais = self.seq_remotedisarm_codpais_var.get()
            orderid = self.seq_remotedisarm_orderid_var.get()
            userId = self.seq_remotedisarm_userid_var.get()
            armMode = self.seq_remotedisarm_armmode_var.get()
            params = {
                "codInstalacion": codInstalacion,
                "codPais": codPais,
                "orderid": orderid,
                "userId": userId,
                "armMode": armMode
            }
            self.pasos_seleccionados.append({"nombre": paso_nombre, "espera": str(wait_time), "params": params})
        elif paso_nombre == "RemoteReboot":
            codInstalacion = self.seq_remotereboot_codinst_var.get()
            codPais = self.seq_remotereboot_codpais_var.get()
            orderid = self.seq_remotereboot_orderid_var.get()
            userId = self.seq_remotereboot_userid_var.get()
            deviceId = self.seq_remotereboot_deviceid_var.get()
            deviceType = self.seq_remotereboot_devicetype_var.get()
            params = {
                "codInstalacion": codInstalacion,
                "codPais": codPais,
                "orderid": orderid,
                "userId": userId,
                "deviceId": deviceId,
                "deviceType": deviceType
            }
            self.pasos_seleccionados.append({"nombre": paso_nombre, "espera": str(wait_time), "params": params})
        else:
            inst_num = self.validate_int(self.seq_inst_num_var.get(), 'Installation number')
            if inst_num is None:
                return
            params = {
                "Installation Number": str(inst_num),
                "Country": self.seq_country_var.get(),
                "typeOfInformation": paso_nombre
            }
            self.pasos_seleccionados.append({"nombre": paso_nombre, "espera": str(wait_time), "params": params})
        self._refresh_listbox_secuencia()
        self._update_step_buttons_state()


    def remove_paso(self) -> None:
        sel = self.listbox_secuencia.curselection()
        if not sel:
            return
        idx = sel[0]
        if 0 <= idx < len(self.pasos_seleccionados):
            del self.pasos_seleccionados[idx]
            self._refresh_listbox_secuencia()
            self._update_step_buttons_state()

    def move_paso_up(self) -> None:
        sel = self.listbox_secuencia.curselection()
        if not sel or sel[0] == 0:
            return
        idx = sel[0]
        paso = self.pasos_seleccionados.pop(idx)
        self.pasos_seleccionados.insert(idx-1, paso)
        self._refresh_listbox_secuencia()
        self.listbox_secuencia.selection_set(idx-1)
        self._update_step_buttons_state()

    def move_paso_down(self) -> None:
        sel = self.listbox_secuencia.curselection()
        if not sel or sel[0] == len(self.pasos_seleccionados)-1:
            return
        idx = sel[0]
        paso = self.pasos_seleccionados.pop(idx)
        self.pasos_seleccionados.insert(idx+1, paso)
        self._refresh_listbox_secuencia()
        self.listbox_secuencia.selection_set(idx+1)
        self._update_step_buttons_state()
    def _refresh_listbox_secuencia(self) -> None:
        self.listbox_secuencia.delete(0, tk.END)
        for paso in self.pasos_seleccionados:
            nombre = paso["nombre"]
            espera = paso["espera"]
            params = paso["params"]
            resumen = ""
            if nombre == "MediaUserRequest":
                resumen = f"cam: {params.get('camera_type', '')}, devId: {params.get('deviceId', '')}, pics: {params.get('numberOfPicture', '')}"
            elif nombre in ["CCS", "PTS", "ITS", "NTS", "UTS", "LOS"]:
                resumen = f"type: {params.get('typeOfInformation', '')}"
            elif nombre == "DoorLock":
                resumen = f"devId: {params.get('deviceId', '')}, lock: {params.get('lock', '')}"
            self.listbox_secuencia.insert(tk.END, f"{nombre:<18} [wait: {espera}s] {resumen}")

        self._update_step_buttons_state()

    def _update_step_buttons_state(self, event=None):
        """Habilita o deshabilita los botones de edición de pasos según la selección y la lista."""
        n = len(self.pasos_seleccionados)
        sel = self.listbox_secuencia.curselection()
        has_sel = bool(sel)
        # Siempre se puede añadir
        self.btn_add.config(state=tk.NORMAL)
        # Solo se puede actualizar, eliminar, subir o bajar si hay selección y elementos
        state = tk.NORMAL if has_sel and n > 0 else tk.DISABLED
        self.btn_update.config(state=state)
        self.btn_remove.config(state=state)
        # Up solo si no es el primero
        if has_sel and sel[0] > 0:
            self.btn_up.config(state=tk.NORMAL)
        else:
            self.btn_up.config(state=tk.DISABLED)
        # Down solo si no es el último
        if has_sel and sel[0] < n-1:
            self.btn_down.config(state=tk.NORMAL)
        else:
            self.btn_down.config(state=tk.DISABLED)

    def edit_paso_wait_time(self, event=None):
        # No hace nada, edición solo por botón 'Actualizar paso'
        pass

    def _open_paso_config_dialog(self, *args, **kwargs):
        # Ya no se usa
        pass

    def _insert_output_line(self, line: str):
        """Insert a line into the output Text with cleaning/formatting.
        Honors self.verbose_var to suppress noisy content like curl progress.
        """
        # If a combined stderr blob, split into lines to allow filtering.
        # IMPORTANT: only split when stderr contains multiple lines; otherwise we'd recurse forever
        # on a single line that ends with a trailing newline.
        if line.startswith("[STDERR]") and line.count("\n") > 1:
            for sub in line.splitlines():
                if not sub:
                    continue
                # Keep prefix only on the first line to improve readability.
                if sub.startswith("[STDERR]"):
                    self._insert_output_line(sub + "\n")
                else:
                    self._insert_output_line(sub + "\n")
            return

        cleaned, tag = self._format_console_line(line)
        if cleaned is None:
            return  # suppressed
        if tag:
            self.output.insert(tk.END, cleaned, tag)
        else:
            self.output.insert(tk.END, cleaned)

    def _format_console_line(self, line: str):
        """Return (text, tag) for a console line, or (None, None) to suppress.
        Implements simple pretty-printing for known patterns.
        """
        l = line.strip()
        verbose = bool(self.verbose_var.get())

        # Suppress curl progress lines when not verbose
        if not verbose:
            if "% Total" in l and "Dload" in l and "Upload" in l:
                return (None, None)
            # Lines that look like progress metrics only
            if re.match(r"^\s*\d+\s+\d+\s+\d+\s+\d+", l):
                return (None, None)

        # Pretty messages for auth and session
        # Spanish verbose header -> compact summary
        m_hdr = re.match(r"^######\s+Enviando\s+comando\s+(\w+)\s+a\s+la\s+instalación\s+(\d+)\s+país\s+(\w+)\s+canal\s+(\d+)$", l)
        if m_hdr:
            cmd, inst, pais, canal = m_hdr.groups()
            return (f"▶ {cmd} • Inst {inst} • {pais} • ch {canal}\n", 'info')

        if l.startswith("First we need to get the auth token"):
            return ("🔐 Getting auth token...\n", 'info')
        if l.startswith("curl -k -X POST") and "commands" in l and not verbose:
            return ("➡ Sending command to API...\n", 'info')
        if l.startswith("curl -k -X POST") and "oauth2/token" in l and not verbose:
            return ("➡ Requesting OAuth2 token...\n", 'info')
        # Final confirmation in Spanish -> concise success
        m_sent = re.match(r"^Comando\s+(.+)\s+enviado\.?$", l)
        if m_sent:
            cmd = m_sent.group(1)
            return (f"✅ {cmd} enviado.\n", 'ok')

        # Responses with JSON payload
        m = re.match(r"^Response:\s*b'(.*)'$", l)
        if m:
            payload = m.group(1)
            try:
                data = json.loads(payload)
                if 'access_token' in data:
                    exp = data.get('expires_in')
                    msg = f"🔐 Token acquired (expires_in: {exp}s)\n" if exp is not None else "🔐 Token acquired\n"
                    return (msg, 'ok')
                if 'sessionId' in data:
                    return (f"🆔 Session: {data['sessionId']}\n", 'ok')
            except Exception:
                # Fall back to raw when JSON fails
                pass

        # Tagging defaults
        tag = None
        if any(x in l for x in ["[OK]", "OK Solicitud enviada", "✓ SUCCESS", "SUCCESS", "sessionId"]):
            tag = 'ok'
        elif any(x in l for x in ["ERROR", "[Error", "✗ ERROR", "Traceback"]):
            tag = 'error'
        elif any(x in l for x in ["INTERRUPTED", "⚠"]):
            tag = 'warn'
        elif "[STDERR]" in l:
            # stderr but not progress -> show as warn unless verbose
            tag = 'stderr'
            if not verbose and ("% Total" in l or re.match(r"^\s*\d+\s+\d+\s+\d+\s+\d+", l)):
                return (None, None)
        elif any(x in l for x in ["Executing", "Waiting", "END OF SEQUENCE"]):
            tag = 'info'
        return (line, tag)

    def _set_theme(self, name: str):
        """Cambiar tema ttkbootstrap en caliente y reflejarlo en la barra de estado."""
        try:
            tb.Style().theme_use(name)
            self.current_theme = name
            self._style_output_console()
            self._update_status()
        except Exception as e:
            messagebox.showerror('Theme error', str(e))

    def _style_output_console(self):
        """Aplica un estilo premium: app clara + consola de salida oscura basada en el tema."""
        if not hasattr(self, 'output'):
            return
        try:
            colors = tb.Style().colors
        except Exception:
            return

        # Keep output console dark regardless of overall theme (but derive colors from theme).
        console_bg = getattr(colors, 'dark', colors.selectbg)
        console_fg = getattr(colors, 'light', colors.selectfg)

        try:
            self.output.configure(
                background=console_bg,
                foreground=console_fg,
                insertbackground=console_fg,
                selectbackground=getattr(colors, 'selectbg', console_bg),
                selectforeground=getattr(colors, 'selectfg', console_fg),
            )
        except Exception:
            # Some tk options can fail on certain platforms/themes; keep best-effort.
            pass

        base_font = ('Consolas', 12)
        self.output.tag_configure('ok', foreground=getattr(colors, 'success', console_fg), font=(base_font[0], base_font[1], 'bold'))
        self.output.tag_configure('error', foreground=getattr(colors, 'danger', console_fg), font=(base_font[0], base_font[1], 'bold'))
        self.output.tag_configure('warn', foreground=getattr(colors, 'warning', console_fg), font=(base_font[0], base_font[1], 'bold'))
        self.output.tag_configure('stderr', foreground=getattr(colors, 'danger', console_fg), font=(base_font[0], base_font[1], 'italic'))
        self.output.tag_configure('info', foreground=getattr(colors, 'info', console_fg), font=(base_font[0], base_font[1], 'bold'))

    def _update_status(self):
        try:
            verbose = getattr(self, 'verbose_var', None)
            verbose_txt = 'On' if (verbose.get() if verbose is not None else False) else 'Off'
            theme = getattr(self, 'current_theme', 'darkly')
            if hasattr(self, 'status_var'):
                self.status_var.set(f"Theme: {theme} • Verbose: {verbose_txt}")
        except Exception:
            # Fail silent if called too early during widget construction
            pass

    def run_secuencia_personalizada(self):
        # Deshabilitar botones de pasos mientras corre la secuencia
        self.btn_add.config(state=tk.DISABLED)
        self.btn_update.config(state=tk.DISABLED)
        self.btn_remove.config(state=tk.DISABLED)
        self.btn_up.config(state=tk.DISABLED)
        self.btn_down.config(state=tk.DISABLED)
        pasos = list(self.pasos_seleccionados)
        if not pasos:
            self.output.after(0, lambda: self._show_result("Empty sequence. Add steps to execute."))
            return
        try:
            repeat_count = int(self.seq_repeat_var.get())
            if repeat_count < 1:
                repeat_count = 1
        except Exception:
            repeat_count = 1
        self._stop_seq_flag.clear()
        def worker():
            import time
            self.output.after(0, lambda: self.output.delete(1.0, tk.END))
            for rep in range(repeat_count):
                if self._stop_seq_flag.is_set():
                    self.output.after(0, lambda: self._insert_output_line("\n--- SEQUENCE STOPPED BY USER ---\n"))
                    break
                self.output.after(0, lambda r=rep+1: self._insert_output_line(f"\n--- REPETITION {r} ---\n"))
                for idx, paso in enumerate(pasos, 1):
                    if self._stop_seq_flag.is_set():
                        self.output.after(0, lambda: self._insert_output_line("\n--- SEQUENCE STOPPED BY USER ---\n"))
                        break
                    nombre = paso["nombre"]
                    espera_val = 2.0
                    try:
                        espera_val = float(paso["espera"])
                    except Exception:
                        pass
                    params = paso["params"]
                    # Log y espera antes de cada paso (incluido el primero para máxima claridad)
                    self.output.after(0, lambda: self._insert_output_line(f"[DEBUG] Waiting {espera_val} seconds before {nombre}...\n"))
                    time.sleep(espera_val)
                    if nombre == "MediaUserRequest":
                        self.output.after(0, lambda: self._insert_output_line("Executing MediaUserRequest command...\n"))
                        # Custom info line for MediaUserRequest
                        try:
                            num_pics = int(params.get('numberOfPicture', '1'))
                        except Exception:
                            num_pics = 1
                        inst_num = params.get('Installation Number', '')
                        country = params.get('Country', '')
                        resolution = params.get('resolution', '1 = Minimum')
                        camera = params.get('camera_type', 'Orion')
                        self.output.after(0, lambda: self._insert_output_line(f"Requesting {num_pics} image(s) from installation {inst_num} ({country}) with resolution {resolution} and camera {camera}\n"))
                        env = os.environ.copy()
                        env['MUR_INSTALLATION_NUMBER'] = str(inst_num)
                        env['MUR_COUNTRY'] = str(country)
                        env['MUR_NUMBEROFPICTURE'] = str(num_pics)
                        env['MUR_DEVICEID'] = str(params.get('deviceId', '06'))
                        # CU_VERSION is fixed and not configurable
                        env['MUR_CU_VERSION'] = '2'
                        camera_types_map = {"Orion": 106, "Aquila": 107, "Croptex": 103}
                        env['MUR_DEVICETYPE'] = str(camera_types_map.get(camera, 106))
                        media_types_map = {"1 = Photo": 1, "2 = Video": 2, "3 = Audio": 3}
                        env['MUR_MEDIATYPE'] = str(media_types_map.get(params.get('media_type', '1 = Photo'), 1))
                        resolution_map = {"1 = Minimum": 1, "2 = Small": 2, "3 = Low": 3, "4 = Medium": 4, "5 = High": 5, "6 = FHD": 6}
                        env['MUR_RESOLUTIONFORMAT'] = str(resolution_map.get(resolution, 1))
                        script_path = os.path.join(os.path.dirname(__file__), 'MediaUserRequest.py')
                        proc = subprocess.Popen([sys.executable, script_path, '1'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
                        self._child_procs.append(proc)
                        paso_out = ""
                        for line in proc.stdout:
                            # Replace Spanish '[OK] Solicitud enviada.' with English
                            if '[OK] Solicitud enviada' in line:
                                line = line.replace('[OK] Solicitud enviada', '[OK] Request sent')
                            if self._stop_seq_flag.is_set():
                                proc.terminate()
                                break
                            self.output.after(0, lambda l=line: self._insert_output_line(l))
                            paso_out += line
                        stdout, stderr = proc.communicate()
                        if stderr:
                            self.output.after(0, lambda: self._insert_output_line("[STDERR] " + stderr + "\n"))
                    elif nombre in ["CCS", "PTS", "ITS", "NTS", "UTS", "LOS"]:
                        status_map = {"NTS": 1, "ITS": 2, "CCS": 3, "PTS": 4, "UTS": 5, "LOS": 6}
                        tipo = status_map[nombre]
                        try:
                            tipo = int(tipo)
                        except Exception:
                            self.output.after(0, lambda: self._insert_output_line(f"[Error: invalid status type for {nombre}]\n"))
                            continue
                        inst_num = params.get('Installation Number', '5499266')
                        country = params.get('Country', 'ES')
                        # ChangeStatusOfTransmissions expects: op_status, inst, country, n_iter
                        args = [str(tipo), str(inst_num), str(country), '1']
                        self.output.after(0, lambda n=nombre, t=tipo, i=inst_num, c=country: self._insert_output_line(
                            f"[DEBUG] ChangeStatus step '{n}' -> op_status={t} inst={i} country={c}\n"
                        ))
                        self.output.after(0, lambda: self._insert_output_line(f"Executing {nombre} command...\n"))
                        script_path = os.path.join(os.path.dirname(__file__), 'ChangeStatusOfTransmissions.py')
                        cmd = [sys.executable, script_path] + args
                        self.output.after(0, lambda c=cmd: self._insert_output_line(f"[DEBUG] Spawn: {c}\n"))
                        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                        self._child_procs.append(proc)
                        paso_out = ""
                        for line in proc.stdout:
                            if self._stop_seq_flag.is_set():
                                proc.terminate()
                                break
                            self.output.after(0, lambda l=line: self._insert_output_line(l))
                            paso_out += line
                        stdout, stderr = proc.communicate()
                        if stderr:
                            self.output.after(0, lambda: self._insert_output_line("[STDERR] " + stderr + "\n"))
                    elif nombre == "ReportCommunicationModuleByChannel":
                        self.output.after(0, lambda: self._insert_output_line("Executing ReportCommunicationModuleByChannel command...\n"))
                        env = os.environ.copy()
                        env['RCMC_CODINSTALACION'] = params['codInstalacion']
                        channel_value = params['channel'].split(' - ')[0].strip() if ' - ' in params['channel'] else params['channel']
                        env['RCMC_CHANNEL'] = channel_value
                        env['RCMC_ORDERID'] = 'ReportCommunicationModuleByChannel'
                        env['RCMC_COMMANDID'] = '1142'
                        script_path = os.path.join(os.path.dirname(__file__), 'ReportCommunicationModuleByChannel.py')
                        proc = subprocess.Popen([sys.executable, script_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
                        self._child_procs.append(proc)
                        paso_out = ""
                        for line in proc.stdout:
                            if self._stop_seq_flag.is_set():
                                proc.terminate()
                                break
                            self.output.after(0, lambda l=line: self._insert_output_line(l))
                            paso_out += line
                        stdout, stderr = proc.communicate()
                        if stderr:
                            self.output.after(0, lambda: self._insert_output_line("[STDERR] " + stderr + "\n"))
                    elif nombre == "DoorLock":
                        self.output.after(0, lambda: self._insert_output_line("Executing DoorLock command...\n"))
                        env = os.environ.copy()
                        env['LUD_PAIS'] = params['pais']
                        env['LUD_IDINSTALACION'] = params['idInstalacion']
                        env['LUD_DEVICETYPE'] = params['deviceType']
                        env['LUD_DEVICEID'] = params['deviceId']
                        env['LUD_LOCK'] = params['lock']
                        env['LUD_RESERVED'] = params['reserved']
                        script_path = os.path.join(os.path.dirname(__file__), 'LockUnlockDoorlock.py')
                        proc = subprocess.Popen([sys.executable, script_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
                        self._child_procs.append(proc)
                        paso_out = ""
                        for line in proc.stdout:
                            if self._stop_seq_flag.is_set():
                                proc.terminate()
                                break
                            self.output.after(0, lambda l=line: self._insert_output_line(l))
                            paso_out += line
                        stdout, stderr = proc.communicate()
                        if stderr:
                            self.output.after(0, lambda: self._insert_output_line("[STDERR] " + stderr + "\n"))
                    elif nombre == "RemoteArm":
                        self.output.after(0, lambda: self._insert_output_line("Executing RemoteArm command...\n"))
                        env = os.environ.copy()
                        env['REMOTEARM_CODINSTALACION'] = params['codInstalacion']
                        env['REMOTEARM_CODPAIS'] = params['codPais']
                        env['REMOTEARM_ORDERID'] = params['orderid']
                        env['REMOTEARM_USERID'] = params['userId']
                        env['REMOTEARM_ARMMODE'] = params['armMode']
                        script_path = os.path.join(os.path.dirname(__file__), 'RemoteArm.py')
                        proc = subprocess.Popen([sys.executable, script_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
                        self._child_procs.append(proc)
                        paso_out = ""
                        for line in proc.stdout:
                            if self._stop_seq_flag.is_set():
                                proc.terminate()
                                break
                            self.output.after(0, lambda l=line: self._insert_output_line(l))
                            paso_out += line
                        stdout, stderr = proc.communicate()
                        if stderr:
                            self.output.after(0, lambda: self._insert_output_line("[STDERR] " + stderr + "\n"))
                    elif nombre == "RemoteDisarm":
                        self.output.after(0, lambda: self._insert_output_line("Executing RemoteDisarm command...\n"))
                        env = os.environ.copy()
                        env['REMOTEDISARM_CODINSTALACION'] = params['codInstalacion']
                        env['REMOTEDISARM_CODPAIS'] = params['codPais']
                        env['REMOTEDISARM_ORDERID'] = params['orderid']
                        env['REMOTEDISARM_USERID'] = params['userId']
                        env['REMOTEDISARM_ARMMODE'] = params['armMode']
                        if 'alarmPartition' in params:
                            env['REMOTEDISARM_ALARMPARTITION'] = params['alarmPartition']
                        script_path = os.path.join(os.path.dirname(__file__), 'RemoteDisarm.py')
                        proc = subprocess.Popen([sys.executable, script_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
                        self._child_procs.append(proc)
                        paso_out = ""
                        for line in proc.stdout:
                            if self._stop_seq_flag.is_set():
                                proc.terminate()
                                break
                            self.output.after(0, lambda l=line: self._insert_output_line(l))
                            paso_out += line
                        stdout, stderr = proc.communicate()
                        if stderr:
                            self.output.after(0, lambda: self._insert_output_line("[STDERR] " + stderr + "\n"))
                    elif nombre == "RemoteReboot":
                        self.output.after(0, lambda: self._insert_output_line("Executing RemoteReboot command...\n"))
                        env = os.environ.copy()
                        env['REMOTEREBOOT_CODINSTALACION'] = params['codInstalacion']
                        env['REMOTEREBOOT_CODPAIS'] = params['codPais']
                        env['REMOTEREBOOT_ORDERID'] = params['orderid']
                        env['REMOTEREBOOT_USERID'] = params['userId']
                        env['REMOTEREBOOT_DEVICEID'] = params['deviceId']
                        env['REMOTEREBOOT_DEVICETYPE'] = params['deviceType']
                        script_path = os.path.join(os.path.dirname(__file__), 'RemoteReboot.py')
                        proc = subprocess.Popen([sys.executable, script_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
                        self._child_procs.append(proc)
                        paso_out = ""
                        for line in proc.stdout:
                            if self._stop_seq_flag.is_set():
                                proc.terminate()
                                break
                            self.output.after(0, lambda l=line: self._insert_output_line(l))
                            paso_out += line
                        stdout, stderr = proc.communicate()
                        if stderr:
                            self.output.after(0, lambda: self._insert_output_line("[STDERR] " + stderr + "\n"))
                    else:
                        self.output.after(0, lambda: self._insert_output_line(f"[Unknown step: {nombre}]\n"))
                # End of repetition
            self.output.after(0, lambda: self._insert_output_line(f"\n=== END OF SEQUENCE (total repetitions: {repeat_count}) ===\n"))
            # Rehabilitar botones al terminar
            self.output.after(0, self._update_step_buttons_state)
        t = threading.Thread(target=worker, daemon=True)
        self._child_threads.append(t)
        t.start()

    def stop_secuencia(self):
        self._stop_seq_flag.set()
        # Terminar todos los procesos hijos relacionados con la secuencia
        for proc in getattr(self, '_child_procs', []):
            try:
                if proc.poll() is None:
                    proc.terminate()
            except Exception:
                pass

        # Eliminar el combobox de selección de instalación duplicado (ya no se crea aquí)

        self.entries_media = {}
        # CU_VERSION is fixed for MediaUserRequest and should not be user-editable
        self.entries_media['CU_VERSION'] = tk.StringVar(value='2')
        # Menú desplegable para tipo de cámara
        self.camera_type_var = tk.StringVar(value="Orion")
        camera_types = {"Orion": 106, "Aquila": 107, "Croptex": 103}
        camera_device_ids = {"Orion": 6, "Aquila": 4, "Croptex": 7}
        ttk.Label(self.form_frame_media, text="Camera type:").grid(row=1, column=0, sticky='e', padx=5, pady=3)
        camera_menu = ttk.Combobox(self.form_frame_media, textvariable=self.camera_type_var, state='readonly', values=list(camera_types.keys()))
        camera_menu.grid(row=1, column=1, padx=12, pady=6, sticky='ew')
        def suggest_device_id(event=None):
            cam = self.camera_type_var.get()
            device_id = camera_device_ids.get(cam, 6)
            entry = self.entries_media.get('deviceId')
            if entry and not entry.get():
                entry.insert(0, str(device_id).zfill(2))
        camera_menu.bind('<<ComboboxSelected>>', suggest_device_id)
        self.media_type_var = tk.StringVar(value="Photo")
        media_types = [
            ("1 = Photo", 1),
            ("2 = Video", 2),
            ("3 = Audio", 3)
        ]
        ttk.Label(self.form_frame_media, text="Media type:").grid(row=2, column=0, sticky='e', padx=5, pady=3)
        media_menu = ttk.Combobox(self.form_frame_media, textvariable=self.media_type_var, state='readonly', values=[mt[0] for mt in media_types])
        media_menu.grid(row=2, column=1, padx=12, pady=6, sticky='ew')
        self.resolution_var = tk.StringVar(value="1 = Minimum")
        resolution_options = [
            ("1 = Minimum", 1),
            ("2 = Small", 2),
            ("3 = Low", 3),
            ("4 = Medium", 4),
            ("5 = High", 5),
            ("6 = FHD", 6)
        ]
        ttk.Label(self.form_frame_media, text="Resolution:").grid(row=3, column=0, sticky='e', padx=5, pady=3)
        resolution_menu = ttk.Combobox(self.form_frame_media, textvariable=self.resolution_var, state='readonly', values=[r[0] for r in resolution_options])
        resolution_menu.grid(row=3, column=1, padx=12, pady=6, sticky='ew')
        self.num_pics_var = tk.StringVar(value="1")
        ttk.Label(self.form_frame_media, text="Number of photos:").grid(row=4, column=0, sticky='e', padx=5, pady=3)
        num_pics_menu = ttk.Combobox(self.form_frame_media, textvariable=self.num_pics_var, state='readonly', values=[str(i) for i in range(1, 6)])
        num_pics_menu.grid(row=4, column=1, padx=12, pady=6, sticky='ew')
        row_offset = 5
        for i, key in enumerate(instalaciones[0].keys()):
            if key in ('mediaType', 'resolutionFormat', 'numberOfPicture', 'Orion_dev_id', 'CU_VERSION'):
                continue
            ttk.Label(self.form_frame_media, text=key).grid(row=i+row_offset, column=0, sticky='e', padx=8, pady=6)
            entry = ttk.Entry(self.form_frame_media, width=26)
            entry.grid(row=i+row_offset, column=1, padx=12, pady=6, sticky='ew')
            self.entries_media[key] = entry
        if 'deviceId' not in self.entries_media:
            ttk.Label(self.form_frame_media, text='deviceId').grid(row=len(self.entries_media)+row_offset, column=0, sticky='e', padx=8, pady=6)
            entry = ttk.Entry(self.form_frame_media, width=26)
            entry.grid(row=len(self.entries_media)+row_offset, column=1, padx=12, pady=6, sticky='ew')
            self.entries_media['deviceId'] = entry
        # Inicializar los campos con la primera instalación por defecto
        self.set_installation_fields(self.unique_instalaciones[0])
        self.after(100, lambda: camera_menu.event_generate('<<ComboboxSelected>>'))
        btn_media = ttk.Button(self.form_frame_media, text='▶️ Run MediaUserRequest', width=22, command=self.run_media_user_request, style='primary.TButton')
        btn_media.grid(row=len(self.entries_media)+row_offset, column=0, columnspan=2, pady=18)
        btn_media.configure(style='primary.TButton')
        self._add_tooltip(btn_media, "Run MediaUserRequest with current form inputs.")

        # --- Formulario ChangeStatus (igual que antes, pero en self.form_frame_status) ---
        self.entries_status = {}
        ttk.Label(self.form_frame_status, text='Installation number:').grid(row=0, column=0, sticky='e', padx=5, pady=3)
        entry_num = ttk.Entry(self.form_frame_status, width=22)
        entry_num.grid(row=0, column=1, padx=12, pady=6, sticky='ew')
        entry_num.insert(0, str(changestatus_params['Installation Number']))
        self.entries_status['Installation Number'] = entry_num
        ttk.Label(self.form_frame_status, text='Country:').grid(row=1, column=0, sticky='e', padx=5, pady=3)
        entry_country = ttk.Entry(self.form_frame_status, width=22)
        entry_country.grid(row=1, column=1, padx=12, pady=6, sticky='ew')
        entry_country.insert(0, str(changestatus_params['Country']))
        self.entries_status['Country'] = entry_country
        ttk.Label(self.form_frame_status, text='Status type:').grid(row=2, column=0, sticky='e', padx=5, pady=3)
        self.status_options = [
            ('1', 'NTS'),
            ('2', 'ITS'),
            ('3', 'CCS'),
            ('4', 'PTS'),
            ('5', 'UTS'),
            ('6', 'LOS')
        ]
        self.status_var = tk.StringVar()
        self.status_var.set(changestatus_params['typeOfInformation'])
        status_menu = ttk.Combobox(self.form_frame_status, textvariable=self.status_var, state='readonly',
                                   values=[f"{code} = {desc}" for code, desc in self.status_options])
        status_menu.grid(row=2, column=1, padx=12, pady=6, sticky='ew')
        for idx, (code, desc) in enumerate(self.status_options):
            if code == str(changestatus_params['typeOfInformation']):
                status_menu.current(idx)
                break
        self.entries_status['typeOfInformation'] = self.status_var
        btn_status = ttk.Button(self.form_frame_status, text='▶️ Run ChangeStatus', width=22, command=self.run_changestatus, style='primary.TButton')
        btn_status.grid(row=3, column=0, columnspan=2, pady=18)
        btn_status.configure(style='primary.TButton')
        self._add_tooltip(btn_status, "Run ChangeStatus with selected status.")


    def _init_operacion_tab(self):
        self.opciones_operacion = [
            "MediaUserRequest",
            "ChangeStatus",
            "DoorLock",
            "ReportCommunicationModuleByChannel",
            "RemoteArm",
            "RemoteDisarm",
            "RemoteReboot",
            "RemoteSystemFaultStatus"
        ]
        self.operacion_var = tk.StringVar(value=self.opciones_operacion[0])
        operacion_menu = ttk.Combobox(self.tab_unificada, textvariable=self.operacion_var, state='readonly', values=self.opciones_operacion)
        operacion_menu.pack(fill='x', padx=16, pady=(10, 12))
        operacion_menu.bind('<<ComboboxSelected>>', self.mostrar_formulario_operacion)

        # Bulk-send button: opens a small dialog to paste/ read list of installations
        bulk_btn = ttk.Button(self.tab_unificada, text='📤 Bulk send (paste list)', width=24, command=self.open_bulk_dialog, style='warning.TButton')
        bulk_btn.pack(fill='x', padx=16, pady=(0, 12))
        bulk_btn.configure(style='warning.TButton')

        # Frame para los formularios contextuales
        self.form_frame_media = ttk.Frame(self.tab_unificada)
        self.form_frame_status = ttk.Frame(self.tab_unificada)
        self.form_frame_doorlock = ttk.Frame(self.tab_unificada)
        self.form_frame_remotearm = ttk.Frame(self.tab_unificada)
        self.form_frame_remotedisarm = ttk.Frame(self.tab_unificada)
        self.form_frame_remotereboot = ttk.Frame(self.tab_unificada)
        self.form_frame_media.pack(fill='both', expand=True, padx=24, pady=12)
        self.form_frame_status.pack_forget()
        self.form_frame_doorlock.pack_forget()
        self.form_frame_remotearm.pack_forget()
        self.form_frame_remotedisarm.pack_forget()
        self.form_frame_remotereboot.pack_forget()

        # --- Formulario RemoteReboot ---
        self.entries_remotereboot = {}
        row_reboot = 0
        # Only show codInstalacion, codPais, deviceType, deviceId
        # Device types for dropdown
        device_types = [
            ("Central Unit", 100),
            ("MoM Smart Shock Sensor", 101),
            ("MoM Indoor PIR", 102),
            ("MoM Zero Vision", 104),
            ("MoM Smart Panic Button", 120),
            ("MoM Smoke Detector", 121),
            ("MoM Smart Water Detector", 122),
            ("Smart Plug", 130),
            ("MoM Verisure Portal (7'')", 140),
            ("MoM Smart Dot", 141),
            ("MoM siren Voice Keypad", 142),
            ("MoM Keyfob", 162),
            ("Croptex (outdoor PIR)", 103),
        ]
        # ...existing code for RemoteReboot...

        # --- Formulario ReportCommunicationModuleByChannel ---
        self.form_frame_rcmc = ttk.Frame(self.tab_unificada)
        self.entries_rcmc = {}
        row_rcmc = 0
        # Solo codInstalacion
        ttk.Label(self.form_frame_rcmc, text="codInstalacion:").grid(row=row_rcmc, column=0, sticky='e', padx=8, pady=6)
        entry_codinst = ttk.Entry(self.form_frame_rcmc, width=20)
        entry_codinst.grid(row=row_rcmc, column=1, padx=12, pady=6, sticky='ew')
        entry_codinst.insert(0, '5912095')
        self.entries_rcmc['codInstalacion'] = entry_codinst
        row_rcmc += 1
        # Canal combobox
        ttk.Label(self.form_frame_rcmc, text="channel:").grid(row=row_rcmc, column=0, sticky='e', padx=8, pady=6)
        self.rcmc_channel_var = tk.StringVar(value="2 - SMS")
        channel_options = [
            "0 - Ethernet",
            "1 - GPRS",
            "2 - SMS",
            "3 - WiFi"
        ]
        channel_menu = ttk.Combobox(self.form_frame_rcmc, textvariable=self.rcmc_channel_var, state='readonly', values=channel_options)
        channel_menu.grid(row=row_rcmc, column=1, padx=12, pady=6, sticky='ew')
        self.entries_rcmc['channel'] = self.rcmc_channel_var
        row_rcmc += 1
        # orderid y commandid ocultos (por defecto)
        self.entries_rcmc['orderid'] = tk.StringVar(value='ReportCommunicationModuleByChannel')
        self.entries_rcmc['commandid'] = tk.StringVar(value='1142')
        # Botón de ejecución
        self.btn_run_rcmc = ttk.Button(self.form_frame_rcmc, text='▶️ Run ReportCommunicationModuleByChannel', width=32, command=self.run_rcmc)
        self.btn_run_rcmc.grid(row=row_rcmc, column=0, columnspan=2, pady=18, sticky='ew')
        self.btn_run_rcmc.configure(style='TButton')
        self._add_tooltip(self.btn_run_rcmc, "Run ReportCommunicationModuleByChannel with selected parameters.")
        # ...existing code...
        # codInstalacion
        ttk.Label(self.form_frame_remotereboot, text="codInstalacion:").grid(row=row_reboot, column=0, sticky='e', padx=8, pady=6)
        entry_reboot_codinst = ttk.Entry(self.form_frame_remotereboot, width=20)
        entry_reboot_codinst.grid(row=row_reboot, column=1, padx=12, pady=6, sticky='ew')
        entry_reboot_codinst.insert(0, '5499266')
        self.entries_remotereboot['codInstalacion'] = entry_reboot_codinst
        row_reboot += 1
        # codPais is fixed for RemoteReboot and should not be user-editable
        self.entries_remotereboot['codPais'] = tk.StringVar(value='ESP')
        # deviceType dropdown
        ttk.Label(self.form_frame_remotereboot, text="deviceType:").grid(row=row_reboot, column=0, sticky='e', padx=8, pady=6)
        device_type_var = tk.StringVar(value='106')
        device_type_menu = ttk.Combobox(self.form_frame_remotereboot, textvariable=device_type_var, state='readonly',
            values=[f"{name} ({code})" for name, code in device_types])
        device_type_menu.grid(row=row_reboot, column=1, padx=12, pady=6, sticky='ew')
        # Set value as code only
        def update_device_type_var(event=None):
            val = device_type_var.get()
            if '(' in val and ')' in val:
                code = val.split('(')[-1].split(')')[0].strip()
                device_type_var.set(code)
        device_type_menu.bind('<<ComboboxSelected>>', update_device_type_var)
        device_type_menu.current([code for _, code in device_types].index(106) if 106 in [code for _, code in device_types] else 0)
        self.entries_remotereboot['deviceType'] = device_type_var
        row_reboot += 1
        # deviceId
        ttk.Label(self.form_frame_remotereboot, text="deviceId:").grid(row=row_reboot, column=0, sticky='e', padx=8, pady=6)
        entry_deviceid = ttk.Entry(self.form_frame_remotereboot, width=20)
        entry_deviceid.grid(row=row_reboot, column=1, padx=12, pady=6, sticky='ew')
        entry_deviceid.insert(0, '01')
        self.entries_remotereboot['deviceId'] = entry_deviceid
        row_reboot += 1
        # Hidden fields: orderid and userId (set default values, not shown)
        self.entries_remotereboot['orderid'] = tk.StringVar(value='ResetPanelOrDevice')
        self.entries_remotereboot['userId'] = tk.StringVar(value='00')
        btn_remotereboot = ttk.Button(self.form_frame_remotereboot, text='▶️ Run RemoteReboot', width=22, command=self.run_remotereboot if hasattr(self, 'run_remotereboot') else lambda: None, style='primary.TButton')
        btn_remotereboot.grid(row=row_reboot, column=0, columnspan=2, pady=18, sticky='ew')
        btn_remotereboot.configure(style='primary.TButton')
        self._add_tooltip(btn_remotereboot, "Reboot the selected device or panel.")

        self.form_frame_remotereboot.grid_columnconfigure(0, weight=0)
        self.form_frame_remotereboot.grid_columnconfigure(1, weight=1)

        # --- Formulario RemoteArm ---
        self.entries_remotearm = {}
        row = 0
        campos_remotearm = [
            ("codInstalacion", '5499266'),
            ("codPais", 'ESP'),
            ("orderid", 'RemoteArm'),
            ("userId", '00'),
        ]
        for label, default in campos_remotearm:
            ttk.Label(self.form_frame_remotearm, text=label+':').grid(row=row, column=0, sticky='e', padx=8, pady=6)
            entry = ttk.Entry(self.form_frame_remotearm, width=20)
            entry.grid(row=row, column=1, padx=12, pady=6, sticky='ew')
            entry.insert(0, default)
            self.entries_remotearm[label] = entry
            row += 1

        # ArmMode dropdown with descriptions
        arm_modes = [
            ("01", "Main Area - Arm Mode 1 (Arm Away)"),
            ("02", "Main Area - Arm Mode 2 (Arm Home)"),
            ("21", "Perimeter"),
            ("23", "Perimeter + arm away (Main Area - Arm Mode 1)"),
            ("24", "Perimeter + Arm Home (Main Area - Arm Mode 2)")
        ]
        ttk.Label(self.form_frame_remotearm, text="armMode:").grid(row=row, column=0, sticky='e', padx=8, pady=6)
        self.armmode_var = tk.StringVar(value="23")
        arm_mode_menu = ttk.Combobox(self.form_frame_remotearm, textvariable=self.armmode_var, state='readonly',
            values=[f"{code} - {desc}" for code, desc in arm_modes])
        arm_mode_menu.grid(row=row, column=1, padx=12, pady=6, sticky='ew')
        # Store only the code in entries_remotearm for script compatibility
        def update_armmode_var(event=None):
            val = self.armmode_var.get()
            code = val.split(' - ')[0] if ' - ' in val else val
            self.entries_remotearm['armMode'] = tk.StringVar(value=code)
        arm_mode_menu.bind('<<ComboboxSelected>>', update_armmode_var)
        # Set initial value
        arm_mode_menu.current(3)  # Default to 23
        update_armmode_var()

        self.form_frame_remotearm.grid_columnconfigure(0, weight=0)
        self.form_frame_remotearm.grid_columnconfigure(1, weight=1)
        row += 1
        btn_remotearm = ttk.Button(self.form_frame_remotearm, text='▶️ Run RemoteArm', width=22, command=self.run_remotearm if hasattr(self, 'run_remotearm') else lambda: None, style='primary.TButton')
        btn_remotearm.grid(row=row, column=0, columnspan=2, pady=18, sticky='ew')
        btn_remotearm.configure(style='primary.TButton')
        self._add_tooltip(btn_remotearm, "Send RemoteArm command with chosen arm mode.")

        # --- Formulario RemoteDisarm ---
        self.form_frame_remotedisarm = ttk.Frame(self.tab_unificada)
        self.entries_remotedisarm = {}
        row_disarm = 0
        campos_remotedisarm = [
            ("codInstalacion", '5499266'),
            ("codPais", 'ESP'),
            ("orderid", 'RemoteDisarm'),
            ("userId", '00'),
        ]
        for label, default in campos_remotedisarm:
            ttk.Label(self.form_frame_remotedisarm, text=label+':').grid(row=row_disarm, column=0, sticky='e', padx=8, pady=6)
            entry = ttk.Entry(self.form_frame_remotedisarm, width=20)
            entry.grid(row=row_disarm, column=1, padx=12, pady=6, sticky='ew')
            entry.insert(0, default)
            self.entries_remotedisarm[label] = entry
            row_disarm += 1

        # ArmMode dropdown for RemoteDisarm (with its own options)
        disarm_arm_modes = [
            ("00", "Disarm All Areas"),
            ("10", "Disarm Main Area Only"),
            ("20", "Disarm Perimeter Only")
        ]
        ttk.Label(self.form_frame_remotedisarm, text="armMode:").grid(row=row_disarm, column=0, sticky='e', padx=8, pady=6)
        self.armmode_disarm_var = tk.StringVar(value="00")
        disarm_mode_menu = ttk.Combobox(self.form_frame_remotedisarm, textvariable=self.armmode_disarm_var, state='readonly',
            values=[f"{code} - {desc}" for code, desc in disarm_arm_modes])
        disarm_mode_menu.grid(row=row_disarm, column=1, padx=12, pady=6, sticky='ew')
        def update_disarmmode_var(event=None):
            val = self.armmode_disarm_var.get()
            code = val.split(' - ')[0] if ' - ' in val else val
            self.entries_remotedisarm['armMode'] = tk.StringVar(value=code)
        disarm_mode_menu.bind('<<ComboboxSelected>>', update_disarmmode_var)
        disarm_mode_menu.current(0)  # Default to 00
        update_disarmmode_var()

        self.form_frame_remotedisarm.grid_columnconfigure(0, weight=0)
        self.form_frame_remotedisarm.grid_columnconfigure(1, weight=1)
        row_disarm += 1
        btn_remotedisarm = ttk.Button(self.form_frame_remotedisarm, text='▶️ Run RemoteDisarm', width=22, command=self.run_remotedisarm if hasattr(self, 'run_remotedisarm') else lambda: None, style='primary.TButton')
        btn_remotedisarm.grid(row=row_disarm, column=0, columnspan=2, pady=18, sticky='ew')
        btn_remotedisarm.configure(style='primary.TButton')
        self._add_tooltip(btn_remotedisarm, "Send RemoteDisarm command with chosen disarm mode.")

        # --- Formulario MediaUserRequest (grid unificado y alineación profesional) ---
        unique_instalaciones = []
        seen = set()
        for inst in instalaciones:
            key = (inst['Installation Number'], inst['Country'])
            if key not in seen:
                seen.add(key)
                unique_instalaciones.append(inst)
        self.unique_instalaciones = unique_instalaciones
        self.selected_index = tk.IntVar(value=0)

        self.entries_media = {}
        self.camera_type_var = tk.StringVar(value="Orion")
        camera_types = {"Orion": 106, "Aquila": 107, "Croptex": 103}
        camera_device_ids = {"Orion": 6, "Aquila": 4, "Croptex": 7}

        # Configuración de columnas para expansión
        self.form_frame_media.grid_columnconfigure(0, weight=0)
        self.form_frame_media.grid_columnconfigure(1, weight=1)

        # Campos principales
        campos = [
            ("Camera Type", self.camera_type_var, ttk.Combobox, list(camera_types.keys())),
            ("Media Type", tk.StringVar(value="Photo"), ttk.Combobox, ["1 = Photo", "2 = Video", "3 = Audio"]),
            ("Resolution", tk.StringVar(value="1 = Minimum"), ttk.Combobox, ["1 = Minimum", "2 = Small", "3 = Low", "4 = Medium", "5 = High", "6 = FHD"]),
            ("Number of Pictures", tk.StringVar(value="1"), ttk.Combobox, [str(i) for i in range(1, 6)])
        ]
        self.media_type_var = campos[1][1]
        self.resolution_var = campos[2][1]
        self.num_pics_var = campos[3][1]
        for idx, (label, var, widget, values) in enumerate(campos):
            ttk.Label(self.form_frame_media, text=label).grid(row=idx+1, column=0, sticky='e', padx=8, pady=6)
            w = widget(self.form_frame_media, textvariable=var, state='readonly', values=values)
            w.grid(row=idx+1, column=1, padx=12, pady=6, sticky='ew')
            if label == "Camera Type":
                def suggest_device_id(event=None):
                    cam = self.camera_type_var.get()
                    device_id = camera_device_ids.get(cam, 6)
                    entry = self.entries_media.get('deviceId')
                    if entry and not entry.get():
                        entry.insert(0, str(device_id).zfill(2))
                w.bind('<<ComboboxSelected>>', suggest_device_id)
            if label == "Media Type":
                media_menu = w
            if label == "Resolution":
                resolution_menu = w
            if label == "Number of Pictures":
                num_pics_menu = w

        # Campos adicionales
        row_offset = len(campos) + 1
        entry_count = 0
        for key in instalaciones[0].keys():
            if key in ('mediaType', 'resolutionFormat', 'numberOfPicture', 'Orion_dev_id', 'CU_VERSION'):
                continue
            ttk.Label(self.form_frame_media, text=key).grid(row=entry_count+row_offset, column=0, sticky='e', padx=8, pady=6)
            entry = ttk.Entry(self.form_frame_media, width=26)
            entry.grid(row=entry_count+row_offset, column=1, padx=12, pady=6, sticky='ew')
            self.entries_media[key] = entry
            entry_count += 1
        if 'deviceId' not in self.entries_media:
            ttk.Label(self.form_frame_media, text='deviceId').grid(row=entry_count+row_offset, column=0, sticky='e', padx=8, pady=6)
            entry = ttk.Entry(self.form_frame_media, width=26)
            entry.grid(row=entry_count+row_offset, column=1, padx=12, pady=6, sticky='ew')
            self.entries_media['deviceId'] = entry
            entry_count += 1
        self.set_installation_fields(self.unique_instalaciones[0])
        self.after(100, lambda: campos[0][2](self.form_frame_media, textvariable=self.camera_type_var, state='readonly', values=list(camera_types.keys())).event_generate('<<ComboboxSelected>>'))
        btn_media = ttk.Button(self.form_frame_media, text='▶️ Run MediaUserRequest', width=22, command=self.run_media_user_request, style='primary.TButton')
        btn_media.grid(row=entry_count+row_offset, column=0, columnspan=2, pady=18, sticky='ew')
        btn_media.configure(style='primary.TButton')
        self._add_tooltip(btn_media, "Run MediaUserRequest with current form inputs.")

        # --- Formulario ChangeStatus (igual que antes, pero en self.form_frame_status) ---
        self.entries_status = {}
        ttk.Label(self.form_frame_status, text='Installation Number').grid(row=0, column=0, sticky='e', padx=5, pady=3)
        entry_num = ttk.Entry(self.form_frame_status, width=22)
        entry_num.grid(row=0, column=1, padx=12, pady=6, sticky='ew')
        entry_num.insert(0, str(changestatus_params['Installation Number']))
        self.entries_status['Installation Number'] = entry_num
        ttk.Label(self.form_frame_status, text='Country').grid(row=1, column=0, sticky='e', padx=5, pady=3)
        entry_country = ttk.Entry(self.form_frame_status, width=22)
        entry_country.grid(row=1, column=1, padx=12, pady=6, sticky='ew')
        entry_country.insert(0, str(changestatus_params['Country']))
        self.entries_status['Country'] = entry_country
        ttk.Label(self.form_frame_status, text='typeOfInformation').grid(row=2, column=0, sticky='e', padx=5, pady=3)
        self.status_options = [
            ('1', 'NTS'),
            ('2', 'ITS'),
            ('3', 'CCS'),
            ('4', 'PTS'),
            ('5', 'UTS'),
            ('6', 'LOS')
        ]
        self.status_var = tk.StringVar()
        self.status_var.set(changestatus_params['typeOfInformation'])
        status_menu = ttk.Combobox(self.form_frame_status, textvariable=self.status_var, state='readonly',
                                   values=[f"{code} = {desc}" for code, desc in self.status_options])
        status_menu.grid(row=2, column=1, padx=12, pady=6, sticky='ew')
        for idx, (code, desc) in enumerate(self.status_options):
            if code == str(changestatus_params['typeOfInformation']):
                status_menu.current(idx)
                break
        self.entries_status['typeOfInformation'] = self.status_var
        btn_status = ttk.Button(self.form_frame_status, text='▶️ Run ChangeStatus', width=22, command=self.run_changestatus, style='primary.TButton')
        btn_status.grid(row=3, column=0, columnspan=2, pady=18)
        btn_status.configure(style='primary.TButton')
        self._add_tooltip(btn_status, "Run ChangeStatus with selected status.")

        # --- Formulario DoorLock ---
        self.entries_doorlock = {}
        row = 0
        ttk.Label(self.form_frame_doorlock, text='País:').grid(row=row, column=0, sticky='e', padx=8, pady=6)
        entry_pais = ttk.Entry(self.form_frame_doorlock, width=12)
        entry_pais.grid(row=row, column=1, padx=12, pady=6, sticky='ew')
        entry_pais.insert(0, 'ESP')
        self.entries_doorlock['pais'] = entry_pais
        row += 1
        ttk.Label(self.form_frame_doorlock, text='ID Instalación:').grid(row=row, column=0, sticky='e', padx=8, pady=6)
        entry_idinst = ttk.Entry(self.form_frame_doorlock, width=16)
        entry_idinst.grid(row=row, column=1, padx=12, pady=6, sticky='ew')
        entry_idinst.insert(0, '5912095')
        self.entries_doorlock['idInstalacion'] = entry_idinst
        row += 1
        ttk.Label(self.form_frame_doorlock, text='deviceType:').grid(row=row, column=0, sticky='e', padx=8, pady=6)
        entry_devtype = ttk.Entry(self.form_frame_doorlock, width=8)
        entry_devtype.grid(row=row, column=1, padx=12, pady=6, sticky='ew')
        entry_devtype.insert(0, '163')
        self.entries_doorlock['deviceType'] = entry_devtype
        row += 1
        ttk.Label(self.form_frame_doorlock, text='deviceId:').grid(row=row, column=0, sticky='e', padx=8, pady=6)
        entry_devid = ttk.Entry(self.form_frame_doorlock, width=8)
        entry_devid.grid(row=row, column=1, padx=12, pady=6, sticky='ew')
        entry_devid.insert(0, '01')
        self.entries_doorlock['deviceId'] = entry_devid
        row += 1
        ttk.Label(self.form_frame_doorlock, text='Lock/Unlock:').grid(row=row, column=0, sticky='e', padx=8, pady=6)
        lock_var = tk.StringVar(value='1')
        lock_menu = ttk.Combobox(self.form_frame_doorlock, textvariable=lock_var, state='readonly', values=[('1', 'Lock'), ('0', 'Unlock')])
        lock_menu['values'] = ['1 = Lock', '0 = Unlock']
        lock_menu.grid(row=row, column=1, padx=12, pady=6, sticky='ew')
        self.entries_doorlock['lock'] = lock_var
        row += 1
        ttk.Label(self.form_frame_doorlock, text='Reserved:').grid(row=row, column=0, sticky='e', padx=8, pady=6)
        entry_reserved = ttk.Entry(self.form_frame_doorlock, width=20)
        entry_reserved.grid(row=row, column=1, padx=12, pady=6, sticky='ew')
        entry_reserved.insert(0, '0000000000000000')
        self.entries_doorlock['reserved'] = entry_reserved
        row += 1
        btn_doorlock = ttk.Button(self.form_frame_doorlock, text='▶️ Run DoorLock', width=22, command=self.run_doorlock, style='primary.TButton')
        btn_doorlock.grid(row=row, column=0, columnspan=2, pady=18, sticky='ew')
        btn_doorlock.configure(style='primary.TButton')
        self._add_tooltip(btn_doorlock, "Send DoorLock/Unlock command with current parameters.")

    def mostrar_formulario_operacion(self, event=None):
        """
        Muestra el formulario correspondiente y oculta el otro, manteniendo la alineación centrada.
        """
        self.form_frame_media.pack_forget()
        self.form_frame_status.pack_forget()
        self.form_frame_doorlock.pack_forget()
        self.form_frame_rcmc.pack_forget()
        self.form_frame_remotearm.pack_forget()
        self.form_frame_remotedisarm.pack_forget()
        self.form_frame_remotereboot.pack_forget()
        op = self.operacion_var.get()
        if op == "MediaUserRequest":
            self.form_frame_media.pack(fill='both', expand=True, padx=16, pady=12)
        elif op == "ChangeStatus":
            self.form_frame_status.pack(fill='both', expand=True, padx=16, pady=12)
        elif op == "DoorLock":
            self.form_frame_doorlock.pack(fill='both', expand=True, padx=16, pady=12)
        elif op == "ReportCommunicationModuleByChannel":
            self.form_frame_rcmc.pack(fill='both', expand=True, padx=16, pady=12)
        elif op == "RemoteArm":
            self.form_frame_remotearm.pack(fill='both', expand=True, padx=16, pady=12)
        elif op == "RemoteDisarm":
            self.form_frame_remotedisarm.pack(fill='both', expand=True, padx=16, pady=12)
        elif op == "RemoteReboot":
            self.form_frame_remotereboot.pack(fill='both', expand=True, padx=16, pady=12)
        elif op == "RemoteSystemFaultStatus":
            # Reuse the RemoteReboot form for RemoteSystemFaultStatus (only installation id required)
            self.form_frame_remotereboot.pack(fill='both', expand=True, padx=16, pady=12)

    def run_doorlock(self):
        params = {k: v.get() if hasattr(v, 'get') else v.get() for k, v in self.entries_doorlock.items()}
        env = os.environ.copy()
        env['LUD_PAIS'] = params['pais']
        env['LUD_IDINSTALACION'] = params['idInstalacion']
        env['LUD_DEVICETYPE'] = params['deviceType']
        env['LUD_DEVICEID'] = params['deviceId']
        env['LUD_LOCK'] = params['lock'].split('=')[0].strip() if '=' in params['lock'] else params['lock']
        env['LUD_RESERVED'] = params['reserved']
        def worker():
            try:
                import subprocess, sys
                script_path = os.path.join(os.path.dirname(__file__), 'LockUnlockDoorlock.py')
                proc = subprocess.Popen([sys.executable, script_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
                self._child_procs.append(proc)
                for line in proc.stdout:
                    self.output.after(0, lambda l=line: self._insert_output_line(l))
                stdout, stderr = proc.communicate()
                if stderr:
                    self.output.after(0, lambda: self._insert_output_line("[STDERR] " + stderr + "\n"))
            except Exception as e:
                self.output.after(0, lambda: messagebox.showerror('Error', str(e)))
        t = threading.Thread(target=worker, daemon=True)
        self._child_threads.append(t)
        t.start()

    def run_media_user_request(self):
        params = {k: v.get() if hasattr(v, 'get') else v.get() for k, v in self.entries_media.items()}
        env = os.environ.copy()
        env['MUR_INSTALLATION_NUMBER'] = str(params.get('Installation Number', ''))
        env['MUR_COUNTRY'] = str(params.get('Country', ''))
        env['MUR_NUMBEROFPICTURE'] = str(params.get('numberOfPicture', '1'))
        env['MUR_DEVICEID'] = str(params.get('deviceId', '06'))
        # CU_VERSION is fixed and not configurable
        env['MUR_CU_VERSION'] = '2'
        camera_types_map = {"Orion": 106, "Aquila": 107, "Croptex": 103}
        env['MUR_DEVICETYPE'] = str(camera_types_map.get(params.get('camera_type', 'Orion'), 106))
        media_types_map = {"1 = Photo": 1, "2 = Video": 2, "3 = Audio": 3, "Photo": 1, "Video": 2, "Audio": 3}
        env['MUR_MEDIATYPE'] = str(media_types_map.get(params.get('media_type', '1 = Photo'), 1))
        resolution_map = {"1 = Minimum": 1, "2 = Small": 2, "3 = Low": 3, "4 = Medium": 4, "5 = High": 5, "6 = FHD": 6}
        env['MUR_RESOLUTIONFORMAT'] = str(resolution_map.get(params.get('resolution', '1 = Minimum'), 1))
        def worker():
            try:
                import subprocess, sys
                script_path = os.path.join(os.path.dirname(__file__), 'MediaUserRequest.py')
                proc = subprocess.Popen([sys.executable, script_path, '1'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
                self._child_procs.append(proc)
                for line in proc.stdout:
                    self.output.after(0, lambda l=line: self._insert_output_line(l))
                stdout, stderr = proc.communicate()
                if stderr:
                    self.output.after(0, lambda: self._insert_output_line("[STDERR] " + stderr + "\n"))
            except Exception as e:
                self.output.after(0, lambda: messagebox.showerror('Error', str(e)))
        t = threading.Thread(target=worker, daemon=True)
        self._child_threads.append(t)
        t.start()

    def run_changestatus(self):
        params = {k: v.get() if hasattr(v, 'get') else v.get() for k, v in self.entries_status.items()}
        inst_num = params.get('Installation Number', '')
        country = params.get('Country', '')
        type_info = params.get('typeOfInformation', '3')
        # Mapear el valor del combobox si es necesario
        if isinstance(type_info, str) and '=' in type_info:
            type_info = type_info.split('=')[0].strip()
        def worker():
            try:
                import subprocess, sys
                script_path = os.path.join(os.path.dirname(__file__), 'ChangeStatusOfTransmissions.py')
                # args: op_status, installation_num, country, n_iter
                args = [str(type_info), str(inst_num), str(country), '1']
                cmd = [sys.executable, script_path] + args
                self.output.after(0, lambda c=cmd: self._insert_output_line(f"[DEBUG] Spawn: {c}\n"))
                proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                self._child_procs.append(proc)
                for line in proc.stdout:
                    self.output.after(0, lambda l=line: self._insert_output_line(l))
                stdout, stderr = proc.communicate()
                if stderr:
                    self.output.after(0, lambda: self._insert_output_line("[STDERR] " + stderr + "\n"))
            except Exception as e:
                self.output.after(0, lambda: messagebox.showerror('Error', str(e)))
        t = threading.Thread(target=worker, daemon=True)
        self._child_threads.append(t)
        t.start()

    def open_bulk_dialog(self):
        """Open a small dialog to paste newline-separated installation IDs and options."""
        dlg = tk.Toplevel(self)
        dlg.title("Bulk send installations")
        dlg.geometry('900x700')
        dlg.transient(self)
        ttk.Label(dlg, text="Paste installation numbers (one per line) or CSV with first column as installation:").pack(anchor='w', padx=12, pady=(12, 4))
        txt = tk.Text(dlg, height=22, width=100, font=('Consolas', 10))
        txt.pack(padx=12, pady=4, fill='both', expand=True)

        options_frame = ttk.Frame(dlg)
        options_frame.pack(fill='x', padx=12, pady=(4, 8))
        ttk.Label(options_frame, text='Concurrency:').pack(side='left')
        concurrency_var = tk.IntVar(value=6)
        concurrency_spin = ttk.Spinbox(options_frame, from_=1, to=50, textvariable=concurrency_var, width=6)
        concurrency_spin.pack(side='left', padx=(6, 12))
        dry_var = tk.BooleanVar(value=False)
        dry_chk = ttk.Checkbutton(options_frame, text='Dry run (no execute)', variable=dry_var)
        dry_chk.pack(side='left')
        # Load CSV/XLSX button
        def _load_csv():
            from tkinter import filedialog
            path = filedialog.askopenfilename(title='Select CSV/Excel file', filetypes=[('CSV files', '*.csv'), ('Excel files', '*.xlsx;*.xls'), ('Text files', '*.txt'), ('All files', '*.*')])
            if not path:
                return

            lower = path.lower()
            # Detect xlsx by extension or by zip magic (xlsx files are zip archives)
            is_xlsx = False
            try:
                import zipfile
                if zipfile.is_zipfile(path):
                    is_xlsx = True
            except Exception:
                is_xlsx = lower.endswith('.xlsx')

            if lower.endswith('.xls'):
                messagebox.showwarning('Unsupported format', 'Old Excel (.xls) not supported. Please save as .xlsx or export to CSV.')
                return

            if is_xlsx or lower.endswith('.xlsx'):
                # Try to read with openpyxl (install if requested)
                try:
                    import openpyxl
                except Exception:
                    do_install = messagebox.askyesno('openpyxl missing', 'The package "openpyxl" is required to read .xlsx files. Attempt to install it now?')
                    if do_install:
                        try:
                            import subprocess, sys
                            self._insert_output_line('[INFO] Installing openpyxl via pip...\n')
                            subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'openpyxl'])
                            import importlib
                            importlib.invalidate_caches()
                            import openpyxl
                        except Exception as e:
                            messagebox.showerror('Install failed', f'Failed to install openpyxl: {e}')
                            return
                    else:
                        messagebox.showinfo('Abort', 'Cannot read .xlsx without openpyxl. Choose CSV instead.')
                        return
                try:
                    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
                    sheet = wb.active
                    values = []
                    for row in sheet.iter_rows(min_row=1, values_only=True):
                        if not row:
                            continue
                        cell = row[0]
                        if cell is None:
                            continue
                        if isinstance(cell, (int,)):
                            values.append(str(cell))
                        else:
                            s = str(cell).strip()
                            if s:
                                values.append(s)
                    wb.close()
                    txt.delete('1.0', tk.END)
                    txt.insert('1.0', '\n'.join(values))
                    messagebox.showinfo('Excel loaded', f"Loaded {len(values)} rows from '{os.path.basename(path)}'.")
                    return
                except Exception as e:
                    messagebox.showerror('Error reading Excel', str(e))
                    return

            # Fallback: treat as text/CSV — try common encodings
            encodings = ['utf-8', 'cp1252', 'latin-1', 'iso-8859-1']
            content = None
            used_enc = None
            last_err = None
            for enc in encodings:
                try:
                    with open(path, 'r', encoding=enc) as fh:
                        content = fh.read()
                    used_enc = enc
                    break
                except Exception as e:
                    last_err = e
                    continue
            if content is None:
                try:
                    with open(path, 'r', encoding='utf-8', errors='replace') as fh:
                        content = fh.read()
                    used_enc = 'utf-8 (with replacement)'
                except Exception:
                    messagebox.showerror('Error loading CSV', f'Failed to read file: {last_err}')
                    return
            if content.startswith('\ufeff'):
                content = content.lstrip('\ufeff')
            txt.delete('1.0', tk.END)
            txt.insert('1.0', content)
            try:
                messagebox.showinfo('CSV loaded', f"Loaded '{os.path.basename(path)}' using encoding: {used_enc}")
            except Exception:
                pass
        load_btn = ttk.Button(options_frame, text='Load CSV', command=_load_csv)
        load_btn.pack(side='right')

        def on_submit():
            raw = txt.get('1.0', tk.END).strip()
            if not raw:
                messagebox.showerror('Error', 'No installations provided')
                return
            # Extract numbers from CSV or lines and normalize
            import re
            lines = [l.strip() for l in raw.splitlines() if l.strip()]
            raw_values = []
            for l in lines:
                # If CSV, take first cell
                cell = l.split(',')[0].strip() if ',' in l else l
                # Try to extract first contiguous digits sequence
                m = re.search(r"(\d+)", cell)
                if m:
                    raw_values.append(m.group(1))
                else:
                    raw_values.append(cell)
            # Normalize: strip, keep only values that look like digits, dedupe preserving order
            installs = []
            seen = set()
            invalid = []
            for v in raw_values:
                s = str(v).strip()
                if not s:
                    continue
                if s.isdigit():
                    if s not in seen:
                        installs.append(s)
                        seen.add(s)
                else:
                    invalid.append(s)
            # Summary confirmation
            total_in = len(lines)
            valid_count = len(installs)
            invalid_count = len(invalid)
            dup_removed = total_in - valid_count - invalid_count
            summary = f"Input rows: {total_in}\nValid installations: {valid_count}\nInvalid rows: {invalid_count}\nDuplicates removed: {dup_removed}\n\nProceed with the bulk operation?"
            proceed = messagebox.askyesno('Confirm bulk', summary)
            if not proceed:
                return
            dlg.destroy()
            op = self.operacion_var.get()
            # Build params from current visible form fields
            params = {}
            # gather common params depending on op
            if op == 'ChangeStatus':
                params = {k: v.get() if hasattr(v, 'get') else v.get() for k, v in self.entries_status.items()}
            elif op == 'MediaUserRequest':
                params = {k: v.get() if hasattr(v, 'get') else v.get() for k, v in self.entries_media.items()}
            elif op == 'DoorLock':
                params = {k: v.get() if hasattr(v, 'get') else v.get() for k, v in self.entries_doorlock.items()}
            elif op == 'ReportCommunicationModuleByChannel':
                params = {k: v.get() if hasattr(v, 'get') else v.get() for k, v in self.entries_rcmc.items()}
            elif op == 'RemoteArm':
                params = {k: v.get() if hasattr(v, 'get') else v.get() for k, v in self.entries_remotearm.items()}
            elif op == 'RemoteDisarm':
                params = {k: v.get() if hasattr(v, 'get') else v.get() for k, v in self.entries_remotedisarm.items()}
            elif op == 'RemoteReboot':
                params = {k: v.get() if hasattr(v, 'get') else v.get() for k, v in self.entries_remotereboot.items()}
            else:
                params = {}
            # Launch bulk operation in background
            t = threading.Thread(target=self.run_bulk_operation, args=(op, installs, params, concurrency_var.get(), dry_var.get()), daemon=True)
            self._child_threads.append(t)
            t.start()

        btn_frame = ttk.Frame(dlg)
        btn_frame.pack(fill='x', padx=12, pady=(0, 12))
        ttk.Button(btn_frame, text='Cancel', command=dlg.destroy).pack(side='right', padx=(8, 0))
        ttk.Button(btn_frame, text='Start Bulk', command=on_submit, style='primary.TButton').pack(side='right')

    def run_bulk_operation(self, operation: str, installations: List[str], params: Dict[str, Any], concurrency: int = 6, dry_run: bool = False):
        """Execute the selected operation against multiple installations concurrently.
        Results and progress are written to the main output console.
        """
        import time, subprocess, sys, tempfile, json

        def _get_token():
            bashCmdToken = ''' curl -k -X POST https://m2maio.gtm.securitasdirect.local:9443/oauth2/token -d "grant_type=client_credentials" -H "Authorization: Basic U2ZIYm5MMEhNVmMxNmNuRms1OXV6Y3JhcHpvYTpabldySmlVVzhOY1QzUTRGVzFnUTdiYWxSUklh" '''
            try:
                res = subprocess.run(bashCmdToken, shell=True, capture_output=True, text=True, timeout=15)
                out = res.stdout or res.stderr or ''
                try:
                    data = json.loads(out)
                    return data.get('access_token', '')
                except Exception:
                    try:
                        # fallback to eval as older scripts used
                        data = eval(out)
                        return data.get('access_token', '') if isinstance(data, dict) else ''
                    except Exception:
                        return ''
            except Exception:
                return ''

        def change_status_of_transmissions(op_status, inst_id, country='ES', n_iter=1):
            token = _get_token() or 'token-prueba-local'
            parametros = [{"key": "typeOfInformation", "value": str(op_status)}]
            order_parameters = ",".join([f'{{ \\\"key\\\": \\\"{p["key"]}\\\", \\\"value\\\": \\\"{p["value"]}\\\" }}' for p in parametros])
            bashCmdChangeStatus = f''' curl -k -X POST "https://m2maio.gtm.securitasdirect.local:8243/protom/validationverification-service/sdvecu/v1.0/commands" -H "accept: */*" -H "Content-Type: application/json" -H "Authorization: Bearer {token}" -d "{{ \\\"answerInfo\\\": {{ \\\"answerType\\\": \\\"NONE\\\", \\\"answerURL\\\": \\\"NONE\\\" }}, \\\"device\\\": {{ \\\"country\\\": \\\"{country}\\\", \\\"installationNum\\\": \\\"{inst_id}\\\" }}, \\\"order\\\": {{ \\\"orderId\\\": \\\"ChangeStatusOfTransmissions\\\", \\\"parameters\\\": [ {order_parameters} ] }}, \\\"processId\\\": \\\"suki\\\", \\\"session\\\": {{ \\\"finalStep\\\": false, \\\"firstStep\\\": true, \\\"persistent\\\": false }} }}" '''
            try:
                proc = subprocess.run(bashCmdChangeStatus, shell=True, capture_output=True, text=True, timeout=60)
                out = (proc.stdout or '') + (proc.stderr or '')
                return ('ok' if proc.returncode == 0 else 'error', out)
            except Exception as e:
                return ('error', str(e))

        def _post_json_payload(payload: dict):
            try:
                with tempfile.NamedTemporaryFile(delete=False, mode='w', suffix='.json', encoding='utf-8') as tmpf:
                    json.dump(payload, tmpf)
                    tmpf.flush()
                    json_path = tmpf.name
                bash = f'''curl -k -X POST "https://m2maio.gtm.securitasdirect.local:8243/protom/validationverification-service/sdvecu/v1.0/commands" -H "accept: */*" -H "Content-Type: application/json" -H "Authorization: Bearer {payload.get('_token','')}" -d @{json_path}'''
                proc = subprocess.run(bash, shell=True, capture_output=True, text=True, timeout=60)
                out = (proc.stdout or '') + (proc.stderr or '')
                try:
                    os.remove(json_path)
                except Exception:
                    pass
                return ('ok' if proc.returncode == 0 else 'error', out)
            except Exception as e:
                return ('error', str(e))

        def report_comm_module(inst_id, codPais='ESP', systemType='SDVECU', commandid='1142', userCode='victor.vega', userGroupCode='231', timeZone='Europe/Madrid', channel='2', orderid='ReportCommunicationModuleByChannel'):
            token = _get_token() or 'token-prueba-local'
            order_parameters = [
                {"key": "codPais", "value": codPais},
                {"key": "systemType", "value": systemType},
                {"key": "commandid", "value": commandid},
                {"key": "userCode", "value": userCode},
                {"key": "userGroupCode", "value": userGroupCode},
                {"key": "timeZone", "value": timeZone},
                {"key": "channel", "value": str(channel)},
            ]
            payload = {
                "_token": token,
                "answerInfo": {"answerType": "NONE", "answerURL": "NONE"},
                "device": {"country": codPais, "installationNum": str(inst_id)},
                "order": {"orderId": orderid, "parameters": order_parameters},
                "processId": "suki",
                "session": {"finalStep": False, "firstStep": True, "persistent": False}
            }
            return _post_json_payload(payload)

        def media_user_request(inst_id, codPais='ES', deviceType=106, deviceId='06', mediaType=1, resolutionFormat=0, numberOfPicture=1, orderid='MediaUserRequest'):
            token = _get_token() or 'token-prueba-local'
            order_parameters = [
                {"key": "deviceType", "value": str(deviceType)},
                {"key": "deviceId", "value": str(deviceId)},
                {"key": "mediaType", "value": str(mediaType)},
                {"key": "resolutionFormat", "value": str(resolutionFormat)},
                {"key": "numberOfPicture", "value": str(numberOfPicture)},
            ]
            payload = {
                "_token": token,
                "answerInfo": {"answerType": "NONE", "answerURL": "NONE"},
                "device": {"country": codPais, "installationNum": str(inst_id)},
                "order": {"orderId": orderid, "parameters": order_parameters},
                "processId": "suki",
                "session": {"finalStep": False, "firstStep": True, "persistent": False}
            }
            return _post_json_payload(payload)

        def door_lock(inst_id, pais='ES', deviceType='163', deviceId='01', lock='1', reserved='0000000000000000', orderid='DoorLock'):
            token = _get_token() or 'token-prueba-local'
            order_parameters = [
                {"key": "deviceType", "value": str(deviceType)},
                {"key": "deviceId", "value": str(deviceId)},
                {"key": "lock", "value": str(lock)},
                {"key": "reserved", "value": str(reserved)},
            ]
            payload = {
                "_token": token,
                "answerInfo": {"answerType": "NONE", "answerURL": "NONE"},
                "device": {"country": pais, "installationNum": str(inst_id)},
                "order": {"orderId": orderid, "parameters": order_parameters},
                "processId": "suki",
                "session": {"finalStep": False, "firstStep": True, "persistent": False}
            }
            return _post_json_payload(payload)

        def remote_arm(inst_id, codPais='ESP', armMode='23', userId='00', orderid='RemoteArm'):
            token = _get_token() or 'token-prueba-local'
            order_parameters = [{"key": "armMode", "value": str(armMode)}, {"key": "userId", "value": str(userId)}]
            payload = {
                "_token": token,
                "answerInfo": {"answerType": "NONE", "answerURL": "NONE"},
                "device": {"country": codPais, "installationNum": str(inst_id)},
                "order": {"orderId": orderid, "parameters": order_parameters},
                "processId": "suki",
                "session": {"finalStep": False, "firstStep": True, "persistent": False}
            }
            return _post_json_payload(payload)

        def remote_disarm(inst_id, codPais='ESP', armMode='00', userId='00', alarmPartition='01', orderid='RemoteDisarm'):
            token = _get_token() or 'token-prueba-local'
            order_parameters = [{"key": "armMode", "value": str(armMode)}, {"key": "userId", "value": str(userId)}, {"key": "alarmPartition", "value": str(alarmPartition)}]
            payload = {
                "_token": token,
                "answerInfo": {"answerType": "NONE", "answerURL": "NONE"},
                "device": {"country": codPais, "installationNum": str(inst_id)},
                "order": {"orderId": orderid, "parameters": order_parameters},
                "processId": "suki",
                "session": {"finalStep": False, "firstStep": True, "persistent": False}
            }
            return _post_json_payload(payload)

        def remote_reboot(inst_id, codPais='ESP', userId='00', deviceType='106', deviceId='04', orderid='ResetPanelOrDevice'):
            token = _get_token() or 'token-prueba-local'
            order_parameters = [{"key": "userId", "value": str(userId)}, {"key": "deviceType", "value": str(deviceType)}, {"key": "deviceId", "value": str(deviceId)}]
            payload = {
                "_token": token,
                "answerInfo": {"answerType": "NONE", "answerURL": "NONE"},
                "device": {"country": codPais, "installationNum": str(inst_id)},
                "order": {"orderId": orderid, "parameters": order_parameters},
                "processId": "suki",
                "session": {"finalStep": False, "firstStep": True, "persistent": False}
            }
            return _post_json_payload(payload)

        def remote_system_fault_status(inst_id, codPais='ESP', systemType='0', commandid='1300', userCode='', userGroupCode='', timeZone='Europe/Madrid', orderid='RemoteSystemFaultStatus'):
            """Invoke RemoteSystemFaultStatus for an installation.

            Defaults chosen so callers only need to pass installation id (behaves like RemoteReboot).
            The call posts to the same command endpoint using the generic payload builder.
            """
            try:
                token = _get_token() or 'token-prueba-local'
                order_parameters = [
                    {"key": "systemType", "value": str(systemType)},
                    {"key": "commandid", "value": str(commandid)},
                    {"key": "userCode", "value": str(userCode)},
                    {"key": "userGroupCode", "value": str(userGroupCode)},
                    {"key": "timeZone", "value": str(timeZone)},
                ]
                payload = {
                    "_token": token,
                    "answerInfo": {"answerType": "NONE", "answerURL": "NONE"},
                    "device": {"country": codPais, "installationNum": str(inst_id)},
                    "order": {"orderId": orderid, "parameters": order_parameters},
                    "processId": "suki",
                    "session": {"finalStep": False, "firstStep": True, "persistent": False}
                }
                return _post_json_payload(payload)
            except Exception as e:
                return ('error', str(e))
        # Normalize installation strings
        installs = [str(i).strip() for i in installations if str(i).strip()]
        total = len(installs)
        if total == 0:
            self.output.after(0, lambda: self._insert_output_line("[Error] No valid installations to process.\n"))
            return
        self.output.after(0, lambda: self._insert_output_line(f"Starting bulk {operation} for {total} installations (concurrency={concurrency})\n"))

        def task_for_install(inst_id: str):
            # Prepare a short prefix for UI lines
            prefix = f"[{inst_id}] "
            try:
                if dry_run:
                    return (inst_id, 'dry-run', f"{prefix}DRY RUN: would execute {operation}\n")
                # Build env and command per operation
                if operation == 'ChangeStatus':
                    # typeOfInformation may be like '4 = PTS' or '4'
                    tinfo = params.get('typeOfInformation', '3')
                    if isinstance(tinfo, str) and '=' in tinfo:
                        tinfo = tinfo.split('=')[0].strip()
                    status, out = change_status_of_transmissions(tinfo, inst_id, params.get('Country', 'ES'), 1)
                    return (inst_id, status, out)
                elif operation == 'ReportCommunicationModuleByChannel':
                    channel_value = params.get('channel', '2 - SMS')
                    channel_value = channel_value.split(' - ')[0].strip() if ' - ' in channel_value else channel_value
                    status, out = report_comm_module(inst_id,
                                                     codPais=params.get('codPais', 'ESP'),
                                                     channel=channel_value,
                                                     commandid=params.get('commandid', '1142'),
                                                     userCode=params.get('userCode', 'victor.vega'))
                    return (inst_id, status, out)
                elif operation == 'RemoteArm':
                    status, out = remote_arm(inst_id,
                                             codPais=params.get('codPais', params.get('codPais', 'ESP')),
                                             armMode=params.get('armMode', params.get('armMode', '23')),
                                             userId=params.get('userId', '00'),
                                             orderid=params.get('orderid', 'RemoteArm'))
                    return (inst_id, status, out)
                elif operation == 'RemoteDisarm':
                    status, out = remote_disarm(inst_id,
                                                codPais=params.get('codPais', 'ESP'),
                                                armMode=params.get('armMode', '00'),
                                                userId=params.get('userId', '00'),
                                                alarmPartition=params.get('alarmPartition', '01'),
                                                orderid=params.get('orderid', 'RemoteDisarm'))
                    return (inst_id, status, out)
                elif operation == 'RemoteReboot':
                    status, out = remote_reboot(inst_id,
                                                codPais=params.get('codPais', 'ESP'),
                                                userId=params.get('userId', '00'),
                                                deviceType=params.get('deviceType', '106'),
                                                deviceId=params.get('deviceId', '01'),
                                                orderid=params.get('orderid', 'ResetPanelOrDevice'))
                    return (inst_id, status, out)
                elif operation == 'RemoteSystemFaultStatus':
                    status, out = remote_system_fault_status(inst_id,
                                                            codPais=params.get('codPais', 'ESP'),
                                                            systemType=params.get('systemType', '0'),
                                                            commandid=params.get('commandid', '1300'),
                                                            userCode=params.get('userCode', ''),
                                                            userGroupCode=params.get('userGroupCode', ''),
                                                            timeZone=params.get('timeZone', 'Europe/Madrid'),
                                                            orderid=params.get('orderid', 'RemoteSystemFaultStatus'))
                    return (inst_id, status, out)
                elif operation == 'MediaUserRequest':
                    status, out = media_user_request(inst_id,
                                                      codPais=params.get('Country', 'ES'),
                                                      deviceType=params.get('deviceType', 106),
                                                      deviceId=params.get('deviceId', '06'),
                                                      mediaType=params.get('media_type', 1),
                                                      resolutionFormat=params.get('resolution', 0),
                                                      numberOfPicture=params.get('numberOfPicture', 1))
                    return (inst_id, status, out)
                elif operation == 'DoorLock':
                    status, out = door_lock(inst_id,
                                             pais=params.get('pais', 'ESP'),
                                             deviceType=params.get('deviceType', '163'),
                                             deviceId=params.get('deviceId', '01'),
                                             lock=params.get('lock', '1'),
                                             reserved=params.get('reserved', '0000000000000000'))
                    return (inst_id, status, out)
                else:
                    return (inst_id, 'unknown', f"{prefix}Operation not supported: {operation}\n")
            except Exception as e:
                return (inst_id, 'error', f"{prefix}Exception: {e}\n")

        # Run tasks with ThreadPoolExecutor and report results incrementally
        with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, int(concurrency))) as ex:
            futures = {ex.submit(task_for_install, inst): inst for inst in installs}
            completed = 0
            for fut in concurrent.futures.as_completed(futures):
                inst = futures[fut]
                try:
                    inst_id, status, out = fut.result()
                except Exception as e:
                    inst_id = inst
                    status = 'error'
                    out = f"[Exception retrieving result] {e}\n"
                completed += 1
                # Insert progress line and output snippet
                prefix_line = f"[{completed}/{total}] {inst_id} -> {status}\n"
                self.output.after(0, lambda l=prefix_line: self._insert_output_line(l))
                if out:
                    # Limit verbosity to first 2000 chars per installation
                    snippet = out if len(out) < 2000 else out[:2000] + '\n...[truncated]\n'
                    self.output.after(0, lambda s=snippet: self._insert_output_line(s))
        self.output.after(0, lambda: self._insert_output_line(f"Bulk {operation} complete for {total} installations.\n"))

    def on_close(self):
        # Intenta terminar todos los procesos hijos
        for proc in getattr(self, '_child_procs', []):
            try:
                if proc.poll() is None:
                    proc.terminate()
            except Exception:
                pass
        # Espera a que terminen los threads
        for t in getattr(self, '_child_threads', []):
            if t.is_alive():
                t.join(timeout=1)
        self.destroy()

    def _show_result(self, resumen):
        self.output.delete(1.0, tk.END)
        self.output.insert(tk.END, resumen)

    def clear_output(self):
        if hasattr(self, 'output'):
            self.output.delete('1.0', tk.END)

    def set_installation_fields(self, instalacion):
        """Rellena los campos del formulario MediaUserRequest con los valores de la instalación seleccionada."""
        if not hasattr(self, 'entries_media'):
            return
        for key, entry in self.entries_media.items():
            if key == 'CU_VERSION':
                continue
            if key in instalacion:
                # Support both Entry-like widgets and StringVars
                if hasattr(entry, 'delete') and hasattr(entry, 'insert'):
                    entry.delete(0, tk.END)
                    entry.insert(0, str(instalacion[key]))
                elif hasattr(entry, 'set'):
                    entry.set(str(instalacion[key]))


def check_single_instance():
    """Evita múltiples instancias usando un lockfile en %TEMP%.
    Si el lock existe pero el proceso no está activo, se elimina y continúa.
    """
    lockfile = os.path.join(tempfile.gettempdir(), 'modem_check_gui.lock')

    if os.path.exists(lockfile):
        try:
            with open(lockfile, 'r') as f:
                pid_str = f.read().strip()
            pid = int(pid_str) if pid_str.isdigit() else None
        except Exception:
            pid = None

        # Comprobar si el PID está activo mediante 'tasklist'
        if pid is not None:
            try:
                result = subprocess.run([
                    'tasklist', '/FI', f'PID eq {pid}'
                ], capture_output=True, text=True)
                running = str(pid) in result.stdout
            except Exception:
                running = True  # En caso de duda, asumir que está corriendo
        else:
            running = False

        if not running:
            # PID no activo: limpiar lockfile y continuar
            try:
                os.remove(lockfile)
            except Exception:
                pass
        else:
            messagebox.showerror('Error', 'Ya hay una instancia de la aplicación en ejecución.')
            sys.exit(1)

    # Crear lockfile
    try:
        with open(lockfile, 'w') as f:
            f.write(str(os.getpid()))
    except Exception:
        pass

    def remove_lock():
        try:
            if os.path.exists(lockfile):
                os.remove(lockfile)
        except Exception:
            pass
    atexit.register(remove_lock)
    signal.signal(signal.SIGINT, lambda sig, frame: sys.exit(0))
    signal.signal(signal.SIGTERM, lambda sig, frame: sys.exit(0))


if __name__ == '__main__':
    check_single_instance()
    app = App()
    app.mainloop()
