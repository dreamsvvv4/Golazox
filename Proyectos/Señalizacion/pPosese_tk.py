import tkinter as tk
from tkinter import ttk, messagebox, simpledialog, filedialog
try:
    from tkcalendar import DateEntry
except Exception:
    DateEntry = None
try:
    import sv_ttk
except Exception:
    sv_ttk = None


# Simple tooltip for tkinter widgets
class _ToolTip:
    def __init__(self, widget, text=''):
        self.widget = widget
        self.text = text
        self.tipwindow = None
        widget.bind('<Enter>', self.show)
        widget.bind('<Leave>', self.hide)

    def show(self, _e=None):
        if self.tipwindow or not self.text:
            return
        x, y, cx, cy = self.widget.bbox("insert") if hasattr(self.widget, 'bbox') else (0,0,0,0)
        x = self.widget.winfo_rootx() + 20
        y = self.widget.winfo_rooty() + 20
        self.tipwindow = tw = tk.Toplevel(self.widget)
        tw.wm_overrideredirect(True)
        tw.wm_geometry(f"+{x}+{y}")
        label = tk.Label(tw, text=self.text, justify='left', background='#ffffe0', relief='solid', borderwidth=1, font=('Segoe UI', 9))
        label.pack(ipadx=6, ipady=2)

    def hide(self, _e=None):
        tw = self.tipwindow
        self.tipwindow = None
        if tw:
            tw.destroy()
import datetime
import posesa
import poseses
import csv
import os
from os.path import exists
import operator
import pandas as pd
import posese_parser


table_headings = ['Time', 'Cty', 'Inst', 'Comm', 'Scn', 'Dev', 'Event', 'Params', 'Raw']


class PPoseseApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title('pPOSESE - tkinter')
        self.geometry('1100x640')

        # Apply modern theme if available
        if sv_ttk:
            try:
                sv_ttk.set_theme('light')
            except Exception:
                pass
        # ttk style improvements
        style = ttk.Style(self)
        try:
            default_font = ('Segoe UI', 10)
            style.configure('.', font=default_font)
        except Exception:
            pass

        self.idlist = []
        self.fileLastName = 'psgt_last.txt'
        if exists(self.fileLastName):
            with open(self.fileLastName, 'r') as f:
                for line in f:
                    v = line.strip()
                    if v and v not in self.idlist:
                        self.idlist.append(v)

        today = datetime.datetime.now().strftime("%Y-%m-%d")
        tomorrow = (datetime.datetime.now() + datetime.timedelta(1)).strftime("%Y-%m-%d")

        # (Buttons will be added after layout is created)

        # Paned layout: left controls, right table
        paned = ttk.Panedwindow(self, orient='horizontal')
        paned.pack(fill='both', expand=True)

        left = ttk.Frame(paned, width=260)
        right = ttk.Frame(paned)
        paned.add(left, weight=0)
        paned.add(right, weight=1)

        # Compact action buttons on the left (preferred layout)
        btn_frame = ttk.Frame(left)
        btn_frame.pack(fill='x', padx=6, pady=(6,4))
        b_read = ttk.Button(btn_frame, text='🔄', width=3, command=self.read_db)
        b_read.grid(row=0, column=0, padx=(0,6))
        _ToolTip(b_read, 'Read DB')
        b_export = ttk.Button(btn_frame, text='💾', width=3, command=self.export_csv)
        b_export.grid(row=0, column=1, padx=(0,6))
        _ToolTip(b_export, 'Export CSV')
        b_saveids = ttk.Button(btn_frame, text='💾S', width=3, command=self.save_ids)
        b_saveids.grid(row=0, column=2, padx=(0,6))
        _ToolTip(b_saveids, 'Save IDs')
        b_loadids = ttk.Button(btn_frame, text='📂', width=3, command=self.load_ids)
        b_loadids.grid(row=0, column=3, padx=(0,6))
        _ToolTip(b_loadids, 'Load IDs')

        # Date fields
        ttk.Label(left, text='From').pack(anchor='w', padx=6, pady=(6,0))
        if DateEntry:
            self.date_init = tk.StringVar(value=today)
            DateEntry(left, textvariable=self.date_init, width=14, date_pattern='y-mm-dd').pack(padx=6)
        else:
            self.date_init = tk.StringVar(value=today)
            ttk.Entry(left, textvariable=self.date_init, width=14).pack(padx=6)
        ttk.Label(left, text='To').pack(anchor='w', padx=6, pady=(8,0))
        if DateEntry:
            self.date_end = tk.StringVar(value=tomorrow)
            DateEntry(left, textvariable=self.date_end, width=14, date_pattern='y-mm-dd').pack(padx=6)
        else:
            self.date_end = tk.StringVar(value=tomorrow)
            ttk.Entry(left, textvariable=self.date_end, width=14).pack(padx=6)

        # ID frame
        id_frame = ttk.LabelFrame(left, text='Instal. ID:')
        id_frame.pack(fill='both', pady=8, padx=6, expand=False)
        add_frame = ttk.Frame(id_frame)
        add_frame.pack(fill='x', pady=4, padx=4)
        self.id_add = tk.StringVar()
        ttk.Entry(add_frame, textvariable=self.id_add, width=12).pack(side='left')
        ttk.Button(add_frame, text='Add', command=self.add_id).pack(side='left', padx=6)
        ttk.Button(id_frame, text='Remove', command=self.remove_id).pack(pady=6)
        ttk.Button(id_frame, text='Clear', command=self.clear_ids).pack(pady=2)

        self.listbox = tk.Listbox(id_frame, height=6)
        self.listbox.pack(fill='both', expand=True, padx=6, pady=4)
        for v in self.idlist:
            self.listbox.insert('end', v)

        ttk.Label(left, text='Country').pack(pady=(6,0), padx=6)
        self.country = tk.StringVar(value='ESP')
        ttk.Combobox(left, textvariable=self.country, values=['ARG','BRA','CHI','ESP','FRA','GBR','IRL','ITA','PER','POR'], state='readonly').pack(padx=6)

        ttk.Label(left, text='Filter').pack(pady=(8,0), padx=6)
        self.filter_var = tk.StringVar()
        entry_filter = ttk.Entry(left, textvariable=self.filter_var)
        entry_filter.pack(padx=6)
        entry_filter.bind('<KeyRelease>', lambda e: self.filter_table())

        # Treeview styling to achieve a more premium look
        try:
            style.configure('Treeview', rowheight=26, font=('Segoe UI', 10))
            style.configure('Treeview.Heading', font=('Segoe UI', 10, 'bold'))
        except Exception:
            pass

        # Right: table
        cols = table_headings
        self.tree = ttk.Treeview(right, columns=cols, show='headings')
        for c in cols:
            self.tree.heading(c, text=c, command=lambda _c=c: self.sort_column(_c, False))
            self.tree.column(c, width=120, anchor='w')
        vsb = ttk.Scrollbar(right, orient='vertical', command=self.tree.yview)
        hsb = ttk.Scrollbar(right, orient='horizontal', command=self.tree.xview)
        self.tree.configure(yscroll=vsb.set, xscroll=hsb.set)
        self.tree.grid(row=0, column=0, sticky='nsew')
        vsb.grid(row=0, column=1, sticky='ns')
        hsb.grid(row=1, column=0, sticky='ew')
        right.rowconfigure(0, weight=1)
        right.columnconfigure(0, weight=1)

        # Alternating row colors
        self.tree.tag_configure('odd', background='#ffffff')
        self.tree.tag_configure('even', background='#f3f4f6')
        self.tree.bind('<Double-1>', lambda e: self.on_row_double_click())

        # Status bar
        self.status = ttk.Label(self, text='Ready', anchor='w')
        self.status.pack(side='bottom', fill='x')

        # Internal storage of current rows for filtering/sorting
        self.current_rows = []

    def add_id(self):
        val = self.id_add.get().strip()
        if val.isnumeric() and val not in self.idlist:
            self.idlist.append(val)
            self.listbox.insert('end', val)
            self.id_add.set('')
            self._save_ids()
        else:
            messagebox.showerror('Error', f'ID <{val}> not valid')

    def remove_id(self):
        sel = self.listbox.curselection()
        if sel:
            idx = sel[0]
            val = self.listbox.get(idx)
            self.listbox.delete(idx)
            try:
                self.idlist.remove(val)
            except ValueError:
                pass
            self._save_ids()

    def clear_ids(self):
        self.listbox.delete(0, 'end')
        self.idlist.clear()
        self._save_ids()

    def _save_ids(self):
        with open(self.fileLastName, 'w') as f:
            f.writelines(line + '\n' for line in self.idlist)

    def read_db(self):
        if not self.idlist and not self.filter_var.get().strip():
            messagebox.showerror('Error', 'no installation IDs!')
            return
        try:
            posesalist = posesa.msgGet(self.date_init.get(), self.date_end.get(), self.idlist, self.country.get(), self.filter_var.get())
        except Exception as e:
            messagebox.showerror('Error', f'Error reading DB:\n{e}')
            return
        new_rows = []
        for p in posesalist:
            for ev in p.rPosesa.mpaPosese.eventsList:
                new_rows.append([p.rDate, p.rCountry, p.rInst, p.rComm, p.rType, ev.peDevice[0:2], ev.poseseCodeStr(), ev.poseseArgs(), ev.peEventData, p.rPosesa.mpaData])
        # Clear tree
        for i in self.tree.get_children():
            self.tree.delete(i)
        for row in new_rows:
            # Trim or pad to table headings
            display = row[:len(table_headings)]
            self.tree.insert('', 'end', values=display)
        # keep a copy for filtering/sorting
        self.current_rows = [r[:len(table_headings)] for r in new_rows]
        self.status.config(text=f'Num. POSESEs: {len(new_rows)}')

    # ----- New features: sorting, filtering, details, save/load ids -----
    def sort_column(self, col, reverse=False):
        # determine column index
        try:
            col_idx = list(self.tree['columns']).index(col)
        except ValueError:
            return
        data = [(self.tree.set(k, col), k) for k in self.tree.get_children('')]
        # try numeric sort
        try:
            data.sort(key=lambda t: float(t[0]) if t[0] not in (None, '') else float('-inf'), reverse=reverse)
        except Exception:
            data.sort(key=lambda t: t[0] or '', reverse=reverse)
        for index, (val, k) in enumerate(data):
            self.tree.move(k, '', index)
            self.tree.item(k, tags=('even' if index % 2 == 0 else 'odd',))
        # reverse next time
        self.tree.heading(col, command=lambda: self.sort_column(col, not reverse))

    def filter_table(self):
        filt = (self.filter_var.get() or '').strip().lower()
        self.tree.delete(*self.tree.get_children())
        for idx, row in enumerate(self.current_rows):
            if not filt or any(filt in str(cell).lower() for cell in row):
                tag = 'even' if idx % 2 == 0 else 'odd'
                self.tree.insert('', 'end', values=row, tags=(tag,))
        self.status.config(text=f'Showing {len(self.tree.get_children())} rows (filtered)')

    def on_row_double_click(self):
        sel = self.tree.focus()
        if not sel:
            return
        vals = self.tree.item(sel)['values']
        if not vals:
            return
        # show detail popup
        dlg = tk.Toplevel(self)
        dlg.title('Row details')
        dlg.geometry('700x400')
        txt = tk.Text(dlg, wrap='word')
        txt.pack(fill='both', expand=True)
        for h, v in zip(self.tree['columns'], vals):
            txt.insert('end', f'{h}: {v}\n')
        txt.config(state='disabled')

    def save_ids(self):
        fname = filedialog.asksaveasfilename(defaultextension='.txt', filetypes=[('Text','*.txt')])
        if not fname:
            return
        try:
            with open(fname, 'w') as f:
                f.writelines(i + '\n' for i in self.idlist)
            messagebox.showinfo('Save IDs', f'Saved {len(self.idlist)} IDs to {fname}')
        except Exception as e:
            messagebox.showerror('Error', f'Error saving IDs:\n{e}')

    def load_ids(self):
        fname = filedialog.askopenfilename(filetypes=[('Text','*.txt')])
        if not fname:
            return
        try:
            with open(fname, 'r') as f:
                lines = [l.strip() for l in f if l.strip()]
            self.idlist = lines
            self.listbox.delete(0, 'end')
            for v in self.idlist:
                self.listbox.insert('end', v)
            self._save_ids()
            messagebox.showinfo('Load IDs', f'Loaded {len(self.idlist)} IDs from {fname}')
        except Exception as e:
            messagebox.showerror('Error', f'Error loading IDs:\n{e}')

    def export_csv(self):
        fname = filedialog.asksaveasfilename(defaultextension='.csv', filetypes=[('CSV','*.csv')])
        if not fname:
            return
        rows = [self.tree.item(i)['values'] for i in self.tree.get_children()]
        try:
            with open(fname, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(table_headings)
                writer.writerows(rows)
            messagebox.showinfo('Export', f'Exported {len(rows)} rows to {fname}')
        except Exception as e:
            messagebox.showerror('Error', f'Error exporting CSV:\n{e}')


if __name__ == '__main__':
    app = PPoseseApp()
    app.mainloop()
