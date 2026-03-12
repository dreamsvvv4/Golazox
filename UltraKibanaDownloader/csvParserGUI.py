#!/usr/bin/env python3
"""
Herramienta para parsear archivos CSV de logs y convertirlos a formato .log

Uso:
    python csvParserGUI.py

El programa abrirá una interfaz gráfica donde podrás:
1. Seleccionar un archivo CSV
2. Cargar y filtrar servicios específicos
3. Añadir palabras para incluir o excluir
4. Exportar el resultado a un archivo .log
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import os
import sys
import importlib.util
from tkinter.font import Font

# Importar csvParser dinámicamente
spec = importlib.util.spec_from_file_location("csvParser", os.path.join(os.path.dirname(__file__), "csvParser.py"))
csvParser = importlib.util.module_from_spec(spec)
sys.modules["csvParser"] = csvParser
spec.loader.exec_module(csvParser)

class LogParserGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("CSV Log Parser GUI")
        self.csv_file = None
        self.services = []
        self.selected_services = []
        self.include_words = tk.StringVar()
        self.exclude_words = tk.StringVar()

        # Fuente y colores modernos
        self.font_title = Font(family="Segoe UI", size=14, weight="bold")
        self.font_label = Font(family="Segoe UI", size=9)
        self.bg_color = "#f2f2f2"
        self.panel_color = "#fafafa"

        self.root.configure(bg=self.bg_color)

        # Panel principal
        main_frame = tk.Frame(root, bg=self.bg_color)
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Panel de controles (izquierda, compacto)
        control_panel = tk.Frame(main_frame, bg=self.panel_color, bd=1, relief=tk.GROOVE)
        control_panel.pack(side=tk.LEFT, fill=tk.Y, padx=8, pady=8)

        tk.Label(control_panel, text="CSV Log Parser", font=self.font_title, bg=self.panel_color).pack(pady=(6, 10))

        # Selección de archivo
        file_section = tk.LabelFrame(control_panel, text="Archivo CSV", font=self.font_label, bg=self.panel_color)
        file_section.pack(fill=tk.X, padx=6, pady=6)
        file_row = tk.Frame(file_section, bg=self.panel_color)
        file_row.pack(fill=tk.X, pady=2)
        self.file_entry = tk.Entry(file_row, width=28, font=self.font_label)
        self.file_entry.pack(side=tk.LEFT, padx=3)
        tk.Button(file_row, text="Examinar", command=self.browse_file, font=self.font_label, bg="#e0e0e0", width=8).pack(side=tk.LEFT, padx=3)

        # Selección de servicios (compacto)
        service_section = tk.LabelFrame(control_panel, text="Servicios", font=self.font_label, bg=self.panel_color)
        service_section.pack(fill=tk.X, padx=6, pady=6)
        search_frame = tk.Frame(service_section, bg=self.panel_color)
        search_frame.pack(fill=tk.X, padx=3, pady=(3,0))
        tk.Label(search_frame, text="Buscar:", font=self.font_label, bg=self.panel_color).pack(side=tk.LEFT)
        self.service_search_var = tk.StringVar()
        self.service_search_var.trace_add('write', self.filter_services)
        search_entry = tk.Entry(search_frame, textvariable=self.service_search_var, width=14, font=self.font_label)
        search_entry.pack(side=tk.LEFT, padx=3)

        self.service_listbox = tk.Listbox(service_section, selectmode=tk.MULTIPLE, width=24, height=6, font=self.font_label, bg="#f4f4f4")
        self.service_listbox.pack(side=tk.LEFT, padx=3, pady=3)
        self.elastic_services = [
            "cuxscored", "cuxsdialerd", "cuxs-situationd", "cuxs-rengined", "cuxsinstallerd",
            "cuxsupdaterd", "cuxszapatofonod", "gsmsrv", "cuxs-ired", "ofonod",
            "cuxspaparazzod", "cuxs-wired", "cuxs-wised", "cuxs-auditord", "cuxs-fenixd",
            "cuxs-powerd", "cuxs-timed", "xundertakerd", "cuxs-cm4-manager", "cuxscoprocessorloggerd",
            "cuxs-dect-setup", "cuxs-msp-manager", "xnotariod"
        ]
        self.all_services = list(self.elastic_services)
        for s in self.elastic_services:
            self.service_listbox.insert(tk.END, s)
        tk.Button(service_section, text="Cargar CSV", command=self.load_services, font=self.font_label, bg="#e0e0e0", width=10).pack(side=tk.LEFT, padx=3, pady=3)

        # Palabras incluir/excluir (compacto)
        filter_section = tk.LabelFrame(control_panel, text="Filtrado", font=self.font_label, bg=self.panel_color)
        filter_section.pack(fill=tk.X, padx=6, pady=6)
        tk.Label(filter_section, text="Incluir (espacio):", font=self.font_label, bg=self.panel_color).pack(anchor=tk.W, padx=3, pady=(3,0))
        tk.Entry(filter_section, textvariable=self.include_words, width=28, font=self.font_label).pack(padx=3, pady=1)
        tk.Label(filter_section, text="Excluir (espacio):", font=self.font_label, bg=self.panel_color).pack(anchor=tk.W, padx=3, pady=(5,0))
        tk.Entry(filter_section, textvariable=self.exclude_words, width=28, font=self.font_label).pack(padx=3, pady=1)

        # Botón de exportar y abrir archivo (compacto)
        export_frame = tk.Frame(control_panel, bg=self.panel_color)
        export_frame.pack(pady=10)
        tk.Button(export_frame, text="Exportar", command=self.run_parser, bg="#4CAF50", fg="white", font=self.font_label, width=10).pack(side=tk.LEFT, padx=3)
        self.open_button = tk.Button(export_frame, text="Abrir .log", command=self.open_log_file, bg="#2196F3", fg="white", font=self.font_label, state=tk.DISABLED, width=10)
        self.open_button.pack(side=tk.LEFT, padx=3)

        # Panel de salida (derecha, compacto)
        output_panel = tk.Frame(main_frame, bg=self.panel_color, bd=1, relief=tk.GROOVE)
        output_panel.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=8, pady=8)
        tk.Label(output_panel, text="Estado", font=self.font_title, bg=self.panel_color).pack(pady=(6, 10))
        self.status_label = tk.Label(output_panel, text="Listo", font=self.font_label, bg=self.panel_color, fg="#333")
        self.status_label.pack(pady=6)
        self.log_path_label = tk.Label(output_panel, text="", font=self.font_label, bg=self.panel_color, fg="#666", wraplength=320, justify=tk.LEFT)
        self.log_path_label.pack(pady=3)
        self.progress = ttk.Progressbar(output_panel, orient=tk.HORIZONTAL, length=320, mode="determinate")
        self.progress.pack(pady=6)

        # Mensaje de bienvenida (compacto)
        tk.Label(output_panel, text="Conversión de logs CSV a .log", font=self.font_label, bg=self.panel_color, wraplength=320, justify=tk.LEFT).pack(pady=6)

        # Ajustar tamaño mínimo de ventana (más pequeño)
        self.root.minsize(520, 340)

    def browse_file(self):
        file_path = filedialog.askopenfilename(filetypes=[("CSV files", "*.csv")])
        if file_path:
            self.file_entry.delete(0, tk.END)
            self.file_entry.insert(0, file_path)
            self.csv_file = file_path
            self.service_listbox.delete(0, tk.END)
            self.services = []

    def load_services(self):
        import csv as pycsv
        file_path = self.file_entry.get()
        if not file_path or not os.path.isfile(file_path):
            messagebox.showerror("Error", "Selecciona un archivo CSV válido.")
            return
        # Try utf-8 first, then fallback to latin1 if decoding fails
        try:
            parser = csvParser.CSVParser(file_path)
            services = set(row.get('service.name', '') for row in parser.rows if row.get('service.name', ''))
            self.services = sorted(services)
            self.all_services = list(self.elastic_services)
            for s in self.services:
                if s not in self.elastic_services:
                    self.all_services.append(s)
            self.filter_services()
        except Exception as e:
            # Try latin1 encoding if utf-8 fails
            try:
                with open(file_path, encoding='latin1') as f:
                    reader = pycsv.DictReader(f)
                    rows = [row for row in reader]
                # Create a dummy CSVParser-like object
                class DummyParser:
                    def __init__(self, rows):
                        self.rows = rows
                parser = DummyParser(rows)
                services = set(row.get('service.name', '') for row in parser.rows if row.get('service.name', ''))
                self.services = sorted(services)
                self.all_services = list(self.elastic_services)
                for s in self.services:
                    if s not in self.elastic_services:
                        self.all_services.append(s)
                self.filter_services()
                messagebox.showinfo("Aviso", "El archivo CSV se abrió con codificación latin1 por problemas de caracteres.")
            except Exception as e2:
                messagebox.showerror("Error", f"No se pudieron cargar los servicios: {e2}")
    def filter_services(self, *args):
        search = self.service_search_var.get().lower()
        self.service_listbox.delete(0, tk.END)
        for s in self.all_services:
            if search in s.lower():
                self.service_listbox.insert(tk.END, s)

    def run_parser(self):
        import csv as pycsv
        file_path = self.file_entry.get()
        if not file_path or not os.path.isfile(file_path):
            messagebox.showerror("Error", "Selecciona un archivo CSV válido.")
            return
        selected_indices = self.service_listbox.curselection()
        selected_services = [self.service_listbox.get(i) for i in selected_indices]
        include = self.include_words.get().split()
        exclude = self.exclude_words.get().split()
        encoding_used = "utf-8"
        try:
            parser = csvParser.CSVParser(file_path)
            rows = parser.rows
            with open(file_path, encoding="utf-8") as f:
                reader = pycsv.DictReader(f)
                all_headers = reader.fieldnames
        except Exception as e:
            # Fallback to latin1
            try:
                with open(file_path, encoding="latin1") as f:
                    reader = pycsv.DictReader(f)
                    all_headers = reader.fieldnames
                    rows = [row for row in reader]
                class DummyParser:
                    def __init__(self, rows):
                        self.rows = rows
                parser = DummyParser(rows)
                encoding_used = "latin1"
            except Exception as e2:
                messagebox.showerror("Error", f"Error al procesar el archivo: {e2}")
                return
        # ...existing code for processing rows and exporting...
        main_headers = []
        timestamp_candidates = ['sd.device.src_timestamp', '@timestamp', 'timestamp']
        timestamp_col = next((h for h in timestamp_candidates if h in all_headers), all_headers[0])
        main_headers.append(timestamp_col)
        if 'service.name' in all_headers:
            main_headers.append('service.name')
        if 'log.original' in all_headers:
            main_headers.append('log.original')
        rest_headers = [h for h in all_headers if h not in main_headers]
        export_headers = main_headers + rest_headers
        if selected_services:
            rows = [row for row in rows if row.get('service.name', '') in selected_services]
        include = [w.lower() for w in include if w.strip()]
        exclude = [w.lower() for w in exclude if w.strip()]
        def row_to_line(row):
            return "\t".join([str(row.get(h, '')).replace("\r\n", "\n").replace("\r", "\n") for h in export_headers]).lower()
        if include:
            rows = [row for row in rows if any(word in row_to_line(row) for word in include)]
        if exclude:
            rows = [row for row in rows if not any(word in row_to_line(row) for word in exclude)]
        log_filename = os.path.splitext(file_path)[0] + "_filtered.log"
        log_filename_abs = os.path.abspath(log_filename)
        with open(log_filename_abs, "w", encoding="utf-8") as fout:
            fout.write("\t".join(export_headers) + "\n")
            for row in rows:
                line = "\t".join([str(row.get(h, '')) for h in export_headers])
                fout.write(line + "\n")
        messagebox.showinfo("Éxito", f"Archivo .log generado: {log_filename_abs}\nFilas exportadas: {len(rows)}" + ("\n(CSV abierto con latin1)" if encoding_used == "latin1" else ""))
        self.last_log_file = log_filename_abs
        self.open_button.config(state=tk.NORMAL)
        self.log_path_label.config(text=f"Ruta del archivo generado:\n{log_filename_abs}")

    def open_log_file(self):
        import subprocess
        if hasattr(self, 'last_log_file') and os.path.isfile(self.last_log_file):
            try:
                if sys.platform.startswith('win'):
                    os.startfile(self.last_log_file)
                elif sys.platform.startswith('darwin'):
                    subprocess.call(['open', self.last_log_file])
                else:
                    subprocess.call(['xdg-open', self.last_log_file])
            except Exception as e:
                messagebox.showerror("Error", f"No se pudo abrir el archivo: {e}")
        else:
            messagebox.showerror("Error", "No hay archivo .log generado para abrir.")

if __name__ == "__main__":
    root = tk.Tk()
    app = LogParserGUI(root)
    root.mainloop()
