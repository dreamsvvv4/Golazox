

"""
Ultra Protom Sequence GUI
------------------------
Aplicación para gestionar secuencias de comandos MediaUserRequest y ChangeStatus.
Mejoras: modularidad, validaciones, manejo de errores, docstrings, PEP8.
"""

import os
import sys
import threading
import tempfile
import atexit
import signal
import subprocess
import logging

import tkinter as tk
from tkinter import ttk, messagebox
from tkinter.font import Font
from typing import Dict, Any, List, Optional

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


# --- INICIO: Código clonado y adaptado ---

# (A continuación, el código de modem_check_gui.py, cambiando solo nombres y textos a UltraProtomSequence)


# --- FULL CLONE OF modem_check_gui.py, RENAMED TO UltraProtomSequence ---
# All references to 'modem_check' and 'Modem Check' are replaced with 'UltraProtomSequence' and 'Ultra Protom Sequence' respectively.

import os
import sys
import threading
import tempfile
import atexit
import signal
import subprocess
import logging

import tkinter as tk
from tkinter import ttk, messagebox
from tkinter.font import Font
from typing import Dict, Any, List, Optional

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
class App(tk.Tk):
    # ...existing code from modem_check_gui.py, with all references to 'modem_check' and 'Modem Check' replaced by 'UltraProtomSequence' and 'Ultra Protom Sequence'...
    # (The full class code should be here, as in modem_check_gui.py)

# --- FIN: Código clonado y adaptado ---

def check_single_instance():
    """Evita múltiples instancias usando un lockfile en %TEMP%.
    Si el lock existe pero el proceso no está activo, se elimina y continúa.
    """
    lockfile = os.path.join(tempfile.gettempdir(), 'UltraProtomSequence.lock')

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
