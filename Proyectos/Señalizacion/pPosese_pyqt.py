#!/usr/bin/env python3
"""PySide6 replacement for pPosese UI (cleaned)

Removed duplicated top toolbar and fixed focus/editing for ID entry.
"""
from __future__ import annotations
import sys
import csv
import os
import json
from datetime import datetime, timedelta
from typing import List

from PySide6 import QtCore, QtGui, QtWidgets
import re
import os
import json


class ColumnFilterProxy(QtCore.QSortFilterProxyModel):
    def __init__(self, parent=None):
        super().__init__(parent)
        # per-column filter descriptors: dict with keys 'mode' and 'text'
        # mode in ('contains','equals','startswith','regex')
        # each entry: {'mode':str, 'text':str, 'values': set()}
        self.col_filters = []
        self.global_filter = ''

    def setColumnCount(self, n: int):
        self.col_filters = [{'mode': 'contains', 'text': '', 'values': set()} for _ in range(n)]

    def setColumnFilter(self, col: int, mode: str, text: str):
        if col < 0 or col >= len(self.col_filters):
            return
        self.col_filters[col]['mode'] = mode or 'contains'
        self.col_filters[col]['text'] = text or ''
        # trigger re-evaluation using non-deprecated API when available
        self._invalidate_proxy()

    def setColumnAllowedValues(self, col: int, values):
        """Set an explicit allowed-values filter for a column (Excel-style checkbox filter).

        `values` is an iterable of strings. If empty or None, the allowed-values filter is cleared.
        """
        if col < 0 or col >= len(self.col_filters):
            return
        if values:
            self.col_filters[col]['mode'] = 'in'
            self.col_filters[col]['values'] = set([str(v) for v in values])
        else:
            # clear values filter, keep other mode/text untouched
            self.col_filters[col]['values'] = set()
            # if previously 'in', reset to contains with empty text
            if self.col_filters[col].get('mode') == 'in':
                self.col_filters[col]['mode'] = 'contains'
                self.col_filters[col]['text'] = ''
        self._invalidate_proxy()

    def setGlobalFilter(self, text: str):
        self.global_filter = text or ''
        self._invalidate_proxy()

    def _invalidate_proxy(self):
        """Invalidate the proxy model using the preferred API.

        Some Qt/PySide versions deprecate `invalidateFilter()` in favor of
        `invalidate()`. Prefer `invalidate()` when available; otherwise
        fall back and emit layoutChanged to force a refresh.
        """
        try:
            # prefer newer invalidate() when present
            if hasattr(self, 'invalidate') and callable(getattr(self, 'invalidate')):
                try:
                    self.invalidate()
                    return
                except Exception:
                    pass
            # fallback: try deprecated invalidateFilter()
            if hasattr(self, 'invalidateFilter') and callable(getattr(self, 'invalidateFilter')):
                try:
                    self.invalidateFilter()
                    return
                except Exception:
                    pass
        except Exception:
            pass
        # ultimate fallback: notify view via layout change
        try:
            if self.sourceModel() is not None:
                self.sourceModel().layoutChanged.emit()
        except Exception:
            pass

    def filterAcceptsRow(self, source_row: int, source_parent: QtCore.QModelIndex) -> bool:
        model = self.sourceModel()
        # Global filter: must match at least one column
        if self.global_filter:
            gf = self.global_filter.lower()
            matched = False
            for c in range(model.columnCount()):
                idx = model.index(source_row, c, source_parent)
                try:
                    val = (idx.data() or '')
                except Exception:
                    val = ''
                if gf in str(val).lower():
                    matched = True
                    break
            if not matched:
                return False
        # per-column filters
        for c, desc in enumerate(self.col_filters):
            pat = desc.get('text') or ''
            mode = desc.get('mode') or 'contains'
            values = desc.get('values') or set()
            if not pat:
                # if there is an explicit allowed-values filter, evaluate it
                if values:
                    idx = model.index(source_row, c, source_parent)
                    try:
                        val = (idx.data() or '')
                    except Exception:
                        val = ''
                    sval = str(val)
                    # case-insensitive match against the allowed set
                    lowered = {v.lower() for v in values}
                    if sval.lower() not in lowered:
                        return False
                    else:
                        continue
                else:
                    continue
            idx = model.index(source_row, c, source_parent)
            try:
                val = (idx.data() or '')
            except Exception:
                val = ''
            sval = str(val)
            if mode == 'contains':
                if pat.lower() not in sval.lower():
                    return False
            elif mode == 'equals':
                if pat.lower() != sval.lower():
                    return False
            elif mode == 'startswith':
                if not sval.lower().startswith(pat.lower()):
                    return False
            elif mode == 'regex':
                try:
                    if not re.search(pat, sval):
                        return False
                except Exception:
                    return False
        return True


# Ensure local module imports work (posesa shim lives in same folder)
sys.path.insert(0, os.path.dirname(__file__))
try:

    import posesa
except Exception:
    posesa = None
POSESA_AVAILABLE = posesa is not None


class MainWindow(QtWidgets.QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle('POSESE — Redesigned (PySide6)')
        self.resize(1100, 700)
        font = QtGui.QFont('Segoe UI', 10)
        self.setFont(font)

        # Central widget: horizontal splitter
        splitter = QtWidgets.QSplitter()
        splitter.setOrientation(QtCore.Qt.Horizontal)
        self.setCentralWidget(splitter)

        left_w = QtWidgets.QWidget()
        left_layout = QtWidgets.QVBoxLayout(left_w)
        left_layout.setContentsMargins(8, 8, 8, 8)

        # Date range
        self.date_from = QtWidgets.QDateEdit(QtCore.QDate.currentDate())
        self.date_from.setCalendarPopup(True)
        self.date_from.setDisplayFormat('yyyy-MM-dd')

        cal1 = QtWidgets.QCalendarWidget()
        cal1.setGridVisible(True)
        self.date_from.setCalendarWidget(cal1)

        self.date_to = QtWidgets.QDateEdit(QtCore.QDate.currentDate())
        self.date_to.setCalendarPopup(True)
        self.date_to.setDisplayFormat('yyyy-MM-dd')
        cal2 = QtWidgets.QCalendarWidget()
        cal2.setGridVisible(True)

        self.date_to.setCalendarWidget(cal2)

        left_layout.addWidget(QtWidgets.QLabel('From'))
        left_layout.addWidget(self.date_from)
        left_layout.addWidget(QtWidgets.QLabel('To'))
        left_layout.addWidget(self.date_to)

        # ID entry and list
        id_row = QtWidgets.QHBoxLayout()
        self.id_edit = QtWidgets.QLineEdit()

        self.id_edit.setPlaceholderText('Installation ID')
        # ensure editable and focusable
        self.id_edit.setFocusPolicy(QtCore.Qt.StrongFocus)
        self.id_edit.setMinimumWidth(140)
        id_row.addWidget(self.id_edit)

        self.btn_add = QtWidgets.QPushButton('Add')
        self.btn_add.clicked.connect(self.add_id)
        id_row.addWidget(self.btn_add)
        left_layout.addLayout(id_row)


        self.btn_remove = QtWidgets.QPushButton('Remove')
        self.btn_remove.clicked.connect(self.remove_selected_id)
        self.btn_clear = QtWidgets.QPushButton('Clear')
        self.btn_clear.clicked.connect(self.clear_ids)
        left_layout.addWidget(self.btn_remove)
        left_layout.addWidget(self.btn_clear)

        self.ids_list = QtWidgets.QListWidget()

        self.ids_list.setMinimumHeight(200)
        left_layout.addWidget(self.ids_list, 1)

        left_layout.addWidget(QtWidgets.QLabel('Country'))
        self.country = QtWidgets.QComboBox()
        self.country.addItems(['ESP', 'ALL'])
        # Ensure visible text and border regardless of theme

        self.country.setStyleSheet('QComboBox { color: #222; background: #fff; padding: 4px; }')
        left_layout.addWidget(self.country)

        left_layout.addWidget(QtWidgets.QLabel('Filter'))
        self.filter_edit = QtWidgets.QLineEdit()
        self.filter_edit.textChanged.connect(self.apply_filter)
        self.filter_edit.setPlaceholderText('Search in table...')
        left_layout.addWidget(self.filter_edit)

        # Option: trust backend event string or prefer local parser
        self.trust_backend_cb = QtWidgets.QCheckBox('Trust backend event (poseseCodeStr)')
        self.trust_backend_cb.setChecked(True)
        left_layout.addWidget(self.trust_backend_cb)


        # Compact action buttons

        compact = QtWidgets.QHBoxLayout()
        self.btn_read = QtWidgets.QPushButton('Read')
        self.btn_read.clicked.connect(self.read_db)
        self.btn_export = QtWidgets.QPushButton('Export')
        self.btn_export.clicked.connect(self.export_csv)
        self.btn_saveids = QtWidgets.QPushButton('Save IDs')
        self.btn_saveids.clicked.connect(self.save_ids)
        self.btn_loadids = QtWidgets.QPushButton('Load IDs')

        self.btn_loadids.clicked.connect(self.load_ids)
        for b in (self.btn_read, self.btn_export, self.btn_saveids, self.btn_loadids):
            b.setMinimumHeight(28)
            b.setCursor(QtGui.QCursor(QtCore.Qt.PointingHandCursor))
            compact.addWidget(b)
        left_layout.addLayout(compact)

        # Status

        self.status = QtWidgets.QLabel('Ready')
        left_layout.addWidget(self.status)

        # Right: table view
        right_w = QtWidgets.QWidget()
        right_layout = QtWidgets.QVBoxLayout(right_w)
        right_layout.setContentsMargins(8, 8, 8, 8)

        # Columns: original 10 plus parsed fields: DevNum, Lock, rssi, temp_c, battery_mV
        self.model = QtGui.QStandardItemModel(0, 15)
        headers = ['Time', 'Cty', 'Inst', 'Comm', 'Scn', 'Dev', 'DevNum', 'Lock', 'rssi', 'temp_c', 'battery_mV', 'Event', 'Params', 'Raw1', 'Raw2']
        self.model.setHorizontalHeaderLabels(headers)

        self.view = QtWidgets.QTableView()
        # Use proxy to support per-column filters
        self.proxy = ColumnFilterProxy(self)
        self.proxy.setSourceModel(self.model)
        self.proxy.setColumnCount(self.model.columnCount())
        self.view.setModel(self.proxy)
        self.view.setSortingEnabled(True)
        # Visual and behavior tweaks for clarity
        self.view.setAlternatingRowColors(True)
        self.view.setSelectionBehavior(QtWidgets.QAbstractItemView.SelectRows)
        self.view.setSelectionMode(QtWidgets.QAbstractItemView.SingleSelection)
        self.view.setWordWrap(False)
        self.view.setTextElideMode(QtCore.Qt.ElideRight)
        self.view.verticalHeader().setVisible(False)
        self.view.setShowGrid(True)
        self.view.doubleClicked.connect(self.row_double_clicked)
        # Header styling (bold + background)
        hh = self.view.horizontalHeader()
        hh.setStyleSheet('QHeaderView::section {background-color: #333; color: #fff; padding: 6px;}')
        fnt = hh.font()
        fnt.setBold(True)
        hh.setFont(fnt)
        # Column resize policy: make Event/Params stretch, keep others compact
        hh.setSectionResizeMode(0, QtWidgets.QHeaderView.ResizeToContents)  # Time
        hh.setSectionResizeMode(1, QtWidgets.QHeaderView.ResizeToContents)  # Cty
        hh.setSectionResizeMode(2, QtWidgets.QHeaderView.ResizeToContents)  # Inst
        hh.setSectionResizeMode(3, QtWidgets.QHeaderView.ResizeToContents)  # Comm
        hh.setSectionResizeMode(4, QtWidgets.QHeaderView.ResizeToContents)  # Scn
        hh.setSectionResizeMode(5, QtWidgets.QHeaderView.ResizeToContents)  # Dev
        hh.setSectionResizeMode(6, QtWidgets.QHeaderView.ResizeToContents)  # DevNum
        hh.setSectionResizeMode(7, QtWidgets.QHeaderView.ResizeToContents)  # Lock
        hh.setSectionResizeMode(8, QtWidgets.QHeaderView.ResizeToContents)  # rssi
        hh.setSectionResizeMode(9, QtWidgets.QHeaderView.ResizeToContents)  # temp_c
        hh.setSectionResizeMode(10, QtWidgets.QHeaderView.ResizeToContents) # battery_mV
        hh.setSectionResizeMode(11, QtWidgets.QHeaderView.Stretch)         # Event
        hh.setSectionResizeMode(12, QtWidgets.QHeaderView.Stretch)         # Params
        hh.setSectionResizeMode(13, QtWidgets.QHeaderView.ResizeToContents) # Raw1
        hh.setSectionResizeMode(14, QtWidgets.QHeaderView.ResizeToContents) # Raw2
        # Slightly reduce row height for denser view
        self.view.verticalHeader().setDefaultSectionSize(24)
        # Selection color for better contrast and lighter alternate rows
        # Use a readable blue for selection and a very light alternate background
        self.view.setStyleSheet('''
            QTableView { background-color: #ffffff; alternate-background-color: #f5faff; }
            QTableView::item:selected { background-color: #1e88e5; color: #ffffff; }
            QTableView::item:focus { outline: none; }
        ''')

        right_layout.addWidget(self.view, 1)

        # Per-column compact filter buttons (Excel-style dropdown) placed above the table
        filter_widget = QtWidgets.QWidget()
        filter_layout = QtWidgets.QHBoxLayout(filter_widget)
        filter_layout.setContentsMargins(0, 0, 0, 0)
        filter_layout.setSpacing(6)
        self.col_filter_buttons = []
        for i in range(self.model.columnCount()):
            h = self.model.headerData(i, QtCore.Qt.Horizontal)
            # Button shows short header and a down chevron
            btn = QtWidgets.QPushButton(f"{h} ▾")
            btn.setToolTip(f'Filter column: {h}')
            btn.setCursor(QtGui.QCursor(QtCore.Qt.PointingHandCursor))
            btn.setMinimumHeight(28)
            btn.setMaximumWidth(160)
            btn.clicked.connect(lambda _, col=i: self.show_column_filter_dialog(col))
            filter_layout.addWidget(btn)
            self.col_filter_buttons.append(btn)
        filter_scroll = QtWidgets.QScrollArea()
        filter_scroll.setWidgetResizable(True)
        filter_scroll.setFixedHeight(40)
        filter_scroll.setWidget(filter_widget)
        # Insert filter bar before table
        right_layout.removeWidget(self.view)
        right_layout.addWidget(filter_scroll)
        right_layout.addWidget(self.view, 1)

        # Details panel: shows full row content for the selected row
        self.details = QtWidgets.QPlainTextEdit()
        self.details.setReadOnly(True)
        self.details.setMinimumHeight(140)
        self.details.setPlaceholderText('Select a row to see full details here')
        right_layout.addWidget(self.details)

        # Update details when selection changes
        sel_model = self.view.selectionModel()
        sel_model.selectionChanged.connect(self.update_details)

        splitter.addWidget(left_w)
        splitter.addWidget(right_w)
        splitter.setStretchFactor(0, 0)
        splitter.setStretchFactor(1, 1)

        # Set minimum width for left panel so controls don't compress
        left_w.setMinimumWidth(300)

        # Sample dataset for testing
        self._rows_cache = []

        # set initial focus to id entry for convenience
        self.id_edit.setFocus()
        # Show posesa availability in status
        try:
            if not POSESA_AVAILABLE:
                self.status.setText('Ready — posesa module not available')
            else:
                self.status.setText('Ready — posesa OK')
        except Exception:
            self.status.setText('Ready')

    def add_id(self):
        txt = self.id_edit.text().strip()
        if txt:
            self.ids_list.addItem(txt)
            self.id_edit.clear()

    def remove_selected_id(self):
        for it in self.ids_list.selectedItems():
            self.ids_list.takeItem(self.ids_list.row(it))

    def clear_ids(self):
        self.ids_list.clear()

    def apply_filter(self, _=None):
        # Global quick filter: delegate to proxy global filter
        pattern = self.filter_edit.text()
        try:
            self.proxy.setGlobalFilter(pattern)
        except Exception:
            pass

    def read_db(self):
        ids = [self.ids_list.item(i).text() for i in range(self.ids_list.count())]
        self.status.setText('Reading...')
        QtWidgets.QApplication.processEvents()
        rows = []
        # Preferred source: posesa (if available and returns data)
        if not POSESA_AVAILABLE:
            self.status.setText('posesa module not available — cannot read')
            print('posesa module not available')
            return
        if posesa:
            try:
                # original signature: msgGet(date_from_str, date_to_str, idlist, country, filter)
                from_str = self.date_from.date().toString('yyyy-MM-dd')
                to_str = self.date_to.date().toString('yyyy-MM-dd')
                filter_text = self.filter_edit.text() if self.filter_edit else ''
                # DEBUG: log the arguments passed to posesa.msgGet
                print('DEBUG posesa.msgGet args:', from_str, to_str, ids, self.country.currentText(), filter_text)
                posesalist = posesa.msgGet(from_str, to_str, ids, self.country.currentText(), filter_text)
                # Extra debug: inspect returned object
                try:
                    l = len(posesalist) if hasattr(posesalist, '__len__') else 'unknown'
                except Exception:
                    l = 'err'
                try:
                    print('DEBUG posesa.msgGet returned:', type(posesalist), 'len=', l)
                except Exception:
                    pass
                try:
                    if l and isinstance(l, int) and l > 0:
                        first = posesalist[0]
                        try:
                            print('DEBUG first item repr:', repr(first)[:400])
                        except Exception:
                            pass
                        try:
                            evs = getattr(first.rPosesa.mpaPosese, 'eventsList', None)
                            evs_len = len(evs) if evs is not None and hasattr(evs, '__len__') else 'N/A'
                            print('DEBUG first.eventsList len/type:', evs_len, type(evs))
                        except Exception as e:
                            print('DEBUG eventsList inspect error:', e)
                except Exception:
                    pass
                # Transform posesalist objects into table rows matching original script
                new_rows = []
                for p in posesalist:
                    try:
                        events = getattr(p.rPosesa.mpaPosese, 'eventsList', [])
                    except Exception:
                        events = []
                    for ev in events:
                        time = getattr(p, 'rDate', '')
                        cty = getattr(p, 'rCountry', '')
                        inst = getattr(p, 'rInst', '')
                        comm = getattr(p, 'rComm', '')
                        scn = getattr(p, 'rType', '')
                        dev = getattr(ev, 'peDevice', '')
                        dev = dev[0:2] if isinstance(dev, str) else ''
                        # raw values
                        raw1 = getattr(ev, 'peEventData', '')
                        raw2 = getattr(p.rPosesa, 'mpaData', '')
                        # Backend-provided event and params
                        server_event = ev.poseseCodeStr() if hasattr(ev, 'poseseCodeStr') else ''
                        params = ev.poseseArgs() if hasattr(ev, 'poseseArgs') else ''
                        # parse raw payload and params to extract common metrics
                        # combine Raw1 and Raw2 so the parser can inspect both sources
                        combined_raw = (raw1 or '') + ' ' + (raw2 or '')
                        parsed = self.parse_posese(combined_raw)
                        parsed_kv = self._parse_params_text(params)
                        # Decide which event string to show based on user preference.
                        try:
                            parsed_event = parsed.get('event_code') if isinstance(parsed, dict) else None
                            server_prefix = server_event.split(':', 1)[0] if server_event else ''
                            # Debug: if both exist but differ, log short samples to help tuning
                            if parsed_event and server_prefix and parsed_event != server_prefix:
                                print('DEBUG EVENT MISMATCH:', 'server=', server_prefix, 'parsed=', parsed_event,
                                      'raw1=', (raw1 or '')[:80], 'raw2=', (raw2 or '')[:80], 'params=', (params or '')[:80])
                            # If user prefers backend, use it when present; otherwise use parsed when available
                            if getattr(self, 'trust_backend_cb', None) and self.trust_backend_cb.isChecked():
                                event = server_event or (parsed_event or server_event)
                            else:
                                event = parsed_event or server_event
                            # keep suffix from server_event if present
                            if ':' in server_event and event == parsed_event:
                                suffix = (':' + server_event.split(':', 1)[1])
                                event = f"{event}{suffix}"
                            # ensure event is string
                            event = event or ''
                        except Exception:
                            event = server_event or ''
                        devnum = parsed.get('device_num') or parsed_kv.get('device_num') or ''
                        lock = parsed.get('lock_status') or parsed_kv.get('lock_status') or ''
                        rssi = parsed.get('rssi') if parsed.get('rssi') is not None else parsed_kv.get('rssi') or ''
                        temp_c = parsed.get('temp_c') if parsed.get('temp_c') is not None else parsed_kv.get('temp') or ''
                        battery_mV = parsed.get('battery_mV') or ''
                        # Append rows: include parsed columns before Event
                        new_rows.append([time, cty, inst, comm, scn, dev, devnum, lock, rssi, temp_c, battery_mV, event, params, raw1, raw2])
                rows = new_rows
                # Dump a sample of the raw returned object for inspection
                try:
                    sample = posesalist[0] if len(posesalist) else None
                except Exception:
                    sample = None
                if sample is not None:
                    try:
                        dump_path = os.path.join(os.path.dirname(__file__), 'posesa_sample_dump.json')
                        ser = self._safe_serialize(sample, max_depth=3)
                        # augment with explicit event inspection so we can see backend-provided Event strings
                        try:
                            events_inspect = []
                            rp = getattr(sample, 'rPosesa', None)
                            if rp is not None:
                                mpos = getattr(rp, 'mpaPosese', None) or getattr(rp, 'mpaPosese', None)
                                # The runtime object's nested structure may vary; try common paths
                                if hasattr(rp, 'mpaPosese') and getattr(rp, 'mpaPosese') is not None:
                                    mpos = getattr(rp, 'mpaPosese')
                                if mpos is None:
                                    mpos = getattr(rp, 'mpaPosese', None)
                                # eventsList may be inside mpePosese or similar
                                evlist = None
                                try:
                                    # try common attribute names
                                    evlist = getattr(mpos, 'eventsList', None) or getattr(mpos, 'mpePosese', None)
                                except Exception:
                                    evlist = None
                                # attempt to fall back to attributes inside mpos
                                if evlist is None:
                                    evlist = getattr(sample, 'eventsList', None)
                                if evlist is None:
                                    # try scanning for any attribute that looks like a list of events
                                    for name in dir(mpos or rp or sample):
                                        try:
                                            val = getattr(mpos or rp or sample, name)
                                            if isinstance(val, list) and val:
                                                evlist = val
                                                break
                                        except Exception:
                                            continue
                                if evlist:
                                    for ev in evlist:
                                        try:
                                            ce = ev.poseseCodeStr() if hasattr(ev, 'poseseCodeStr') else None
                                        except Exception:
                                            ce = None
                                        try:
                                            pa = ev.poseseArgs() if hasattr(ev, 'poseseArgs') else None
                                        except Exception:
                                            pa = None
                                        try:
                                            raw = getattr(ev, 'peEventData', None)
                                        except Exception:
                                            raw = None
                                        events_inspect.append({'code_str': ce, 'args': pa, 'peEventData': raw, '__repr__': repr(ev)})
                        except Exception:
                            events_inspect = None
                        if isinstance(ser, dict):
                            ser['events_inspect'] = events_inspect
                        else:
                            ser = {'sample': ser, 'events_inspect': events_inspect}
                        with open(dump_path, 'w', encoding='utf-8') as df:
                            json.dump(ser, df, indent=2, ensure_ascii=False)
                        print('WROTE POSESA SAMPLE DUMP TO:', dump_path)
                    except Exception as e:
                        print('Error writing sample dump:', e)
                # If posesa returned messages but we couldn't extract POSESE events
                if posesalist and not rows:
                    # write sample (already done above) and show informative status
                    try:
                        count = len(posesalist)
                        self.status.setText(f'No POSESE events found (received {count} messages)')
                    except Exception:
                        self.status.setText('No POSESE events found')
                    return
            except Exception as e:
                rows = []
                print('posesa read error:', e)

        # If no rows were returned from posesa, show an explicit 'No data' state.
        # Do NOT load historico_instalaciones.json as a fallback to avoid confusion.
        if not rows:
            # clear table
            self.model.removeRows(0, self.model.rowCount())
            self._rows_cache = []
            self.status.setText('No data found')
            return

        self.populate_table(rows)
        self.status.setText(f'Loaded {len(rows)} rows')

    def populate_table(self, rows: List[List[str]]):
        self.model.removeRows(0, self.model.rowCount())
        self._rows_cache = rows
        for r in rows:
            items = [QtGui.QStandardItem('' if x is None else str(x)) for x in r]
            for idx, it in enumerate(items):
                it.setEditable(False)
                it.setToolTip(it.text())
                # align numeric columns (rssi, temp_c, battery_mV) to right/center
                if idx in (8, 9, 10):
                    it.setTextAlignment(QtCore.Qt.AlignRight | QtCore.Qt.AlignVCenter)
                else:
                    it.setTextAlignment(QtCore.Qt.AlignLeft | QtCore.Qt.AlignVCenter)
            self.model.appendRow(items)
        # Set sensible minimum widths for key columns for a balanced layout
        try:
            self.view.setColumnWidth(0, 180)   # Time
            self.view.setColumnWidth(11, 360)  # Event (stretch will still apply)
            self.view.setColumnWidth(12, 360)  # Params
            self.view.setColumnWidth(13, 180)  # Raw1
            self.view.setColumnWidth(14, 180)  # Raw2
        except Exception:
            pass
        self.apply_filter()

    def update_details(self, selected: QtCore.QItemSelection, deselected: QtCore.QItemSelection):
        indexes = self.view.selectionModel().selectedRows()
        if not indexes:
            self.details.clear()
            return
        r = indexes[0].row()
        lines = []
        for c in range(self.model.columnCount()):
            h = self.model.headerData(c, QtCore.Qt.Horizontal)
            v = self.model.item(r, c).text()
            lines.append(f'{h}: {v}')
        # Append parsed posese info if available (prefer Raw1)
        # With added parsed columns, Raw1 is at index 13 and Params at 12
        raw1 = self.model.item(r, 13).text() if self.model.item(r, 13) else ''
        params_text = self.model.item(r, 12).text() if self.model.item(r, 12) else ''
        parsed = self.parse_posese(raw1)
        if parsed:
            lines.append('\n-- Parsed --')
            for k in ('event_code', 'dev_type', 'dev_id', 'supervision', 'battery_status', 'tamper_status', 'ac_status', 'rssi', 'battery_mV', 'temp_c', 'lqi', 'summary'):
                if k in parsed and parsed[k] is not None:
                    lines.append(f'{k}: {parsed[k]}')
        # Also try to parse human params text (key:value patterns)
        parsed_kv = self._parse_params_text(params_text)
        if parsed_kv:
            lines.append('\n-- Params --')
            for k, v in parsed_kv.items():
                lines.append(f'{k}: {v}')

        self.details.setPlainText('\n'.join(lines))

    def _safe_serialize(self, obj, max_depth=2, _depth=0):
        """Attempt to serialize arbitrary objects into JSON-serializable structures.

        - Limits recursion to `max_depth`.
        - For objects, lists available attributes (non-callable, non-private) and
          serializes their values recursively when possible; otherwise records type/name.
        """
        if _depth > max_depth:
            return f'<Max depth reached: {type(obj).__name__}>'
        # primitives
        if obj is None or isinstance(obj, (str, int, float, bool)):
            return obj
        if isinstance(obj, (list, tuple, set)):
            out = []
            for i, v in enumerate(list(obj)[:100]):
                out.append(self._safe_serialize(v, max_depth, _depth + 1))
            return out
        if isinstance(obj, dict):
            out = {}
            for k, v in list(obj.items())[:200]:
                try:
                    out[str(k)] = self._safe_serialize(v, max_depth, _depth + 1)
                except Exception:
                    out[str(k)] = f'<unserializable {type(v).__name__}>'
            return out
        # try __dict__
        try:
            data = {}
            if hasattr(obj, '__dict__'):
                for k, v in list(obj.__dict__.items())[:200]:
                    if k.startswith('_'):
                        continue
                    if callable(v):
                        continue
                    try:
                        data[k] = self._safe_serialize(v, max_depth, _depth + 1)
                    except Exception:
                        data[k] = f'<unserializable {type(v).__name__}>'
                return {'__class__': type(obj).__name__, '__module__': type(obj).__module__, 'attrs': data}
        except Exception:
            pass
        # fallback: list some attributes via dir()
        try:
            attrs = {}
            for name in [n for n in dir(obj) if not n.startswith('_')][:200]:
                try:
                    val = getattr(obj, name)
                    if callable(val):
                        continue
                    attrs[name] = self._safe_serialize(val, max_depth, _depth + 1)
                except Exception:
                    attrs[name] = f'<error getting {name}>'
            return {'__class__': type(obj).__name__, '__module__': type(obj).__module__, 'attrs': attrs}
        except Exception:
            return f'<unserializable {type(obj).__name__}>'

    def parse_posese(self, posese_text: str) -> dict:
        """Lightweight parser for a POSESE string based on checkPOSES.sh conventions.

        Returns a dict with keys: identification, arm_type, device_id, event_code, event_args,
        and a short human summary 'summary'. This is intentionally conservative — it
        extracts fixed-position fields and provides a short readable summary for the table.
        """
        if not posese_text:
            return {}
        # strip trailing CRC part if present
        p = str(posese_text).split('!')[0]
        # try to find a 3-letter event code inside the string (robust against offsets)
        # collect all matches and prefer those that appear after the framing (index >= 10)
        codes = ['MTS', 'ICM', 'MMS', 'MVT', 'MPR', 'MPS', 'MLB', 'MJS', 'MRD', 'MAD', 'MEC', 'MEN', 'DDS', 'ITU', 'FS2', 'MCM']
        found = None
        matches = []
        for code in codes:
            for m in re.finditer(re.escape(code), p, re.IGNORECASE):
                matches.append((code.upper(), m.start()))
        if matches:
            # prefer matches that appear after the framing/header area (index >= 10)
            later = [m for m in matches if m[1] >= 10]
            if later:
                # choose the earliest of the later matches
                found = min(later, key=lambda x: x[1])
            else:
                # fallback: choose the earliest overall
                found = min(matches, key=lambda x: x[1])
        # prefer explicit found codes; otherwise try to locate an alphabetic 3-letter token
        if found:
            event_code, idx = found
            event_args = p[idx + len(event_code):]
            identification = p[0:7] if len(p) >= 7 else ''
        else:
            # try a last-resort search for any 3-letter uppercase-ish token first
            # prefer tokens that appear later in the payload (skip framing tokens like XDN at the very start)
            header_ignore = {'XDN', 'SDES', 'SDE', 'NNN'}
            m2_all = list(re.finditer(r'([A-Z]{3})', p))
            sel = None
            for m in m2_all:
                tok = m.group(1)
                if tok in codes:
                    sel = m
                    break
                if m.start() > 10 and tok not in header_ignore:
                    sel = m
                    break
            if sel:
                event_code = sel.group(1)
                idx = sel.start()
                event_args = p[idx + len(event_code):]
                identification = p[0:7] if len(p) >= 7 else ''
            else:
                # fallback to fixed-offset extraction but only accept alphabetic codes
                if len(p) >= 34:
                    candidate = p[30:33]
                    if candidate.isalpha():
                        event_code = candidate
                        event_args = p[33:]
                        identification = p[0:7] if len(p) >= 7 else ''
                    else:
                        return {'summary': p}
                else:
                    return {'summary': p}

        # short summary and basic fields
        summary = event_code
        known = {
            'MJS': 'Jamming', 'MEN': 'Jamming/Noise', 'MPR': 'PosesoRec', 'MVT': 'DeviceInfo',
            'MPS': 'Panic/SOS', 'MLB': 'LowBattery', 'MTS': 'Devices Tech Info'
        }
        if event_code in known:
            summary = f"{event_code} ({known[event_code]})"
        arg_preview = event_args[:24].replace('\n', ' ')
        if arg_preview:
            summary = f"{summary} {arg_preview}..."

        parsed = {
            'identification': identification,
            'event_code': event_code,
            'event_args': event_args,
            'summary': summary,
        }

        # Detailed parsing for MTS (Devices technical information)
        if event_code == 'MTS' and event_args:
            try:
                a = event_args
                parsed['dev_type'] = a[0:3]
                parsed['dev_id'] = a[3:5]
                parsed['supervision'] = a[5:6]
                parsed['battery_status'] = a[6:7]
                parsed['tamper_status'] = a[7:8]
                parsed['ac_status'] = a[8:9]
                parsed['rssi_raw'] = a[9:12]
                parsed['battery_mV'] = a[12:16]
                parsed['temp_raw'] = a[16:19]
                parsed['lqi_raw'] = a[19:22]
                # normalize numeric fields where possible
                try:
                    rr = parsed.get('rssi_raw', '') or ''
                    rr = rr.strip()
                    # Heuristic: some devices encode sign as leading '1' + two digits meaning negative value
                    # e.g. '153' -> -53. If rr starts with '1' and has length>=3, interpret as -int(last2)
                    if rr and len(rr) >= 3 and rr[0] == '1' and rr[-2:].isdigit():
                        parsed['rssi'] = -int(rr[-2:])
                    elif rr and len(rr) >= 2 and rr[-2:].isdigit():
                        parsed['rssi'] = int(rr[-2:])
                    else:
                        parsed['rssi'] = int(rr) if rr else None
                except Exception:
                    # fallback: extract first signed number found
                    try:
                        parsed['rssi'] = int(re.findall(r'-?\d+', parsed.get('rssi_raw', '') or '')[0])
                    except Exception:
                        parsed['rssi'] = None
                try:
                    parsed['battery_mV'] = int(parsed['battery_mV'])
                except Exception:
                    parsed['battery_mV'] = None
                try:
                    parsed['temp_c'] = int(parsed['temp_raw']) / 10 if parsed['temp_raw'] and len(parsed['temp_raw']) >= 3 else int(parsed['temp_raw'])
                except Exception:
                    parsed['temp_c'] = None
                try:
                    parsed['lqi'] = int(parsed['lqi_raw'])
                except Exception:
                    parsed['lqi'] = None
            except Exception:
                pass
        # Detailed parsing for DDS (Doorlock Device Status)
        if event_code == 'DDS' and event_args:
            try:
                a = event_args
                parsed['raw_payload'] = a
                # offsets per checkPOSES: device_id 0:2, lock 2:1, rssi 3:3
                if len(a) >= 6:
                    parsed['device_id'] = a[0:2]
                    parsed['device_num'] = parsed['device_id']
                    lock_code = a[2:3]
                    lock_map = {'0': 'Unknown', '1': 'Unlocked', '2': 'Locked', '3': 'Error blocked', '4': 'Error busy', '5': 'Error invalid connection', '6': 'Error battery'}
                    parsed['lock_status'] = lock_map.get(lock_code, lock_code)
                    rraw = a[3:6]
                    # decode rssi similar heuristic as MTS
                    try:
                        if rraw and len(rraw) >= 3 and rraw[0] == '1' and rraw[-2:].isdigit():
                            parsed['rssi'] = -int(rraw[-2:])
                        elif rraw and rraw[-2:].isdigit():
                            parsed['rssi'] = int(rraw[-2:])
                        else:
                            parsed['rssi'] = int(rraw)
                    except Exception:
                        try:
                            parsed['rssi'] = int(re.findall(r'-?\d+', rraw)[0])
                        except Exception:
                            parsed['rssi'] = None
                else:
                    # fallback: search keywords in payload
                    lower = p.lower()
                    if 'locked' in lower or ' lock ' in lower:
                        parsed['lock_status'] = 'Locked'
                    elif 'unlock' in lower or 'unlocked' in lower:
                        parsed['lock_status'] = 'Unlocked'
                    m_rssi = re.search(r'(-?\d{1,3})dBm', p, re.IGNORECASE) or re.search(r'rssi[:=\s]*(-?\d{1,3})', p, re.IGNORECASE)
                    if m_rssi:
                        try:
                            parsed['rssi'] = int(m_rssi.group(1))
                        except Exception:
                            parsed['rssi'] = None
                hints = []
                if parsed.get('lock_status'):
                    hints.append(parsed['lock_status'])
                if parsed.get('rssi') is not None:
                    hints.append(f'rssi:{parsed["rssi"]}dBm')
                if hints:
                    parsed['summary'] = f"DDS ({', '.join(hints)})"
            except Exception:
                pass

        # Detailed parsing for MMS (Media Status) - generic payload extractor
        if event_code == 'MMS' and event_args:
            try:
                a = event_args
                parsed['media_payload'] = a
                # offsets per checkPOSES: dev_id 0:2, status 2:2, gid 4:10, idx 14:2, request 16:10, saw_id 26:10, age 36:10, top 46:2, dhp 48:1
                try:
                    parsed['dev_id'] = a[0:2]
                    parsed['mms_status'] = a[2:4]
                    parsed['group_id'] = a[4:14]
                    parsed['index_in_set'] = a[14:16]
                    parsed['request_id'] = a[16:26]
                    parsed['saw_id'] = a[26:36]
                    parsed['age'] = a[36:46]
                    parsed['top'] = a[46:48]
                    parsed['dhp'] = a[48:49]
                except Exception:
                    pass
                parsed['media_length'] = len(a)
                parsed['summary'] = f"MMS (len {len(a)}) gid:{parsed.get('group_id','')[:6]}..."
            except Exception:
                pass

        # Detailed parsing for ICM (Communication module information)
        if event_code == 'ICM' and event_args:
            try:
                a = event_args
                # offsets in checkPOSES: module_man 0:2, model_ver 2:5, imei 7:15, sim 22:20, net_op 42:5, rssi 47:2, ber 49:2
                parsed['module_man'] = a[0:2]
                parsed['model_ver'] = a[2:7]
                parsed['imei'] = a[7:22]
                parsed['sim_icc'] = a[22:42]
                parsed['net_operator_code'] = a[42:47]
                try:
                    parsed['rssi'] = int(a[47:49])
                except Exception:
                    parsed['rssi'] = None
                try:
                    parsed['ber'] = int(a[49:51])
                except Exception:
                    parsed['ber'] = None
                parsed['summary'] = f"ICM imei:{parsed.get('imei','')[:6]}..."
            except Exception:
                pass

        # Detailed parsing for MDV (Media/Device variant) - fallback generic extractor
        if event_code == 'MDV' and event_args:
            try:
                a = event_args
                parsed['mdv_payload'] = a
                parsed['mdv_length'] = len(a)
                parsed['summary'] = f"MDV ({len(a)} bytes) {a[:20]}..."
            except Exception:
                pass

        return parsed

    def _parse_params_text(self, text: str) -> dict:
        """Extract key:value pairs and common metrics from the human-readable Params column."""
        out = {}
        if not text:
            return out
        # Normalize missing separators: insert space before any uppercase KEY: pattern when glued
        # e.g. 'TP:OKAC:0' -> 'TP:OK AC:0'
        norm = re.sub(r'(?<=[^\s])(?=[A-Z]{2,}[:])', ' ', text)
        # capture parenthesized device index like '(02)'
        m_par = re.search(r'\((\d{1,3})\)', norm)
        if m_par:
            out['device_num'] = m_par.group(1)
        # extract explicit lock/unlock words
        m_lock = re.search(r'\b(locked|unlocked)\b', norm, re.IGNORECASE)
        if m_lock:
            out['lock_status'] = m_lock.group(1).capitalize()
        # common pattern key:val or KEY(val)
        # find KEY:VALUE pairs (capture multi-word values until whitespace)
        for m in re.finditer(r'([A-Za-z0-9_]+)[:\(]([^\)\s]+)', norm):
            k = m.group(1)
            v = m.group(2)
            out[k] = v
        # also capture standalone rssi numbers BUT avoid matching inside larger words like wifiRssi
        for m in re.finditer(r'(?<![A-Za-z0-9_])([rR]ssi)[:\s]*(-?\d+)', norm):
            # prefer numeric rssi under lowercase key
            try:
                out['rssi'] = int(m.group(2))
            except Exception:
                out['rssi'] = m.group(2)
        for m in re.finditer(r'(?<![A-Za-z0-9_])temp[:\s]*([0-9]{2,4})', norm, re.IGNORECASE):
            out['temp'] = m.group(1)
        # If a human-formatted Rssi:... exists (with unit), keep it as 'rssi_human' to avoid overwriting
        m_rssi_h = re.search(r'([Rr]ssi)[:\s]*(-?\d+)(dBm)?', norm)
        if m_rssi_h:
            out['rssi_human'] = m_rssi_h.group(2) + (m_rssi_h.group(3) or '')
        return out

    def row_double_clicked(self, index: QtCore.QModelIndex):
        r = index.row()
        details = []
        # Map through proxy to source row if necessary
        try:
            src_idx = self.proxy.mapToSource(self.proxy.index(r, 0))
            src_row = src_idx.row()
        except Exception:
            src_row = r
        for c in range(self.model.columnCount()):
            h = self.model.headerData(c, QtCore.Qt.Horizontal)
            v = self.model.item(src_row, c).text()
            details.append(f'{h}: {v}')
        QtWidgets.QMessageBox.information(self, 'Row details', '\n'.join(details))

    def export_csv(self):
        path, _ = QtWidgets.QFileDialog.getSaveFileName(self, 'Export CSV', 'pose_export.csv', 'CSV files (*.csv)')
        if not path:
            return
        with open(path, 'w', newline='', encoding='utf-8') as f:
            w = csv.writer(f)
            headers = [self.model.headerData(c, QtCore.Qt.Horizontal) for c in range(self.model.columnCount())]
            w.writerow(headers)
            # iterate visible rows using proxy so filtering is respected
            for r in range(self.proxy.rowCount()):
                src_idx = self.proxy.mapToSource(self.proxy.index(r, 0))
                src_row = src_idx.row()
                row = [self.model.item(src_row, c).text() for c in range(self.model.columnCount())]
                w.writerow(row)
        self.status.setText(f'Exported to {path}')

    def save_ids(self):
        path, _ = QtWidgets.QFileDialog.getSaveFileName(self, 'Save IDs', 'ids.txt', 'Text files (*.txt)')
        if not path:
            return
        with open(path, 'w', encoding='utf-8') as f:
            for i in range(self.ids_list.count()):
                f.write(self.ids_list.item(i).text() + '\n')
        self.status.setText(f'IDs saved to {path}')

    def load_ids(self):
        path, _ = QtWidgets.QFileDialog.getOpenFileName(self, 'Load IDs', '', 'Text files (*.txt)')
        if not path:
            return
        self.ids_list.clear()
        with open(path, 'r', encoding='utf-8') as f:
            for l in f:
                l = l.strip()
                if l:
                    self.ids_list.addItem(l)
        self.status.setText(f'Loaded IDs from {path}')

    def _on_column_filter_changed(self, col: int, text: str):
        try:
            # get current mode from combo
            cb, le = self.col_filter_widgets[col]
            modes = cb.property('mode_values') or ['contains', 'equals', 'startswith', 'regex']
            mode = modes[cb.currentIndex()]
            self.proxy.setColumnFilter(col, mode, text)
        except Exception:
            pass

    def _on_column_mode_changed(self, col: int, combobox: QtWidgets.QComboBox):
        try:
            # re-apply with same text
            _, le = self.col_filter_widgets[col]
            txt = le.text()
            modes = combobox.property('mode_values') or ['contains', 'equals', 'startswith', 'regex']
            mode = modes[combobox.currentIndex()]
            self.proxy.setColumnFilter(col, mode, txt)
        except Exception:
            pass

    def show_column_filter_dialog(self, col: int):
        """Show a compact Excel-style filter dialog for column `col`.

        Presents unique values found in the current cached rows with checkboxes
        and allows selecting which values to keep. Applies a set-based filter.
        """
        # Collect unique values from current rows cache
        vals = []
        try:
            for r in self._rows_cache:
                if col < len(r):
                    v = r[col]
                    vals.append('' if v is None else str(v))
        except Exception:
            vals = []
        uniq = sorted(set(vals), key=lambda s: (s.lower(), s))

        dlg = QtWidgets.QDialog(self)
        dlg.setWindowTitle(f'Filter: {self.model.headerData(col, QtCore.Qt.Horizontal)}')
        dlg.setModal(True)
        dlg.resize(420, 480)
        layout = QtWidgets.QVBoxLayout(dlg)

        search = QtWidgets.QLineEdit()
        search.setPlaceholderText('Search values...')
        layout.addWidget(search)

        listw = QtWidgets.QListWidget()
        listw.setSelectionMode(QtWidgets.QAbstractItemView.NoSelection)
        listw.setAlternatingRowColors(True)
        layout.addWidget(listw, 1)

        btns_h = QtWidgets.QHBoxLayout()
        select_all_btn = QtWidgets.QPushButton('Select All')
        clear_btn = QtWidgets.QPushButton('Clear')
        btns_h.addWidget(select_all_btn)
        btns_h.addWidget(clear_btn)
        layout.addLayout(btns_h)

        bottom = QtWidgets.QDialogButtonBox(QtWidgets.QDialogButtonBox.Apply | QtWidgets.QDialogButtonBox.Reset | QtWidgets.QDialogButtonBox.Cancel)
        layout.addWidget(bottom)

        # Populate list
        current_allowed = set()
        try:
            cf = self.proxy.col_filters[col]
            if cf.get('mode') == 'in' and cf.get('values'):
                current_allowed = set([str(v) for v in cf.get('values')])
        except Exception:
            current_allowed = set()

        for v in uniq:
            item = QtWidgets.QListWidgetItem(v)
            item.setFlags(item.flags() | QtCore.Qt.ItemIsUserCheckable)
            # Checked if currently allowed or if there is no current restriction
            if not current_allowed:
                item.setCheckState(QtCore.Qt.Checked)
            else:
                item.setCheckState(QtCore.Qt.Checked if v in current_allowed else QtCore.Qt.Unchecked)
            listw.addItem(item)

        def on_search(txt: str):
            txt = txt.strip().lower()
            for i in range(listw.count()):
                it = listw.item(i)
                it.setHidden(False if txt == '' or txt in it.text().lower() else True)

        search.textChanged.connect(on_search)

        def do_select_all():
            for i in range(listw.count()):
                it = listw.item(i)
                if not it.isHidden():
                    it.setCheckState(QtCore.Qt.Checked)

        def do_clear():
            for i in range(listw.count()):
                it = listw.item(i)
                if not it.isHidden():
                    it.setCheckState(QtCore.Qt.Unchecked)

        select_all_btn.clicked.connect(do_select_all)
        clear_btn.clicked.connect(do_clear)

        def apply_filters():
            selected = [listw.item(i).text() for i in range(listw.count()) if listw.item(i).checkState() == QtCore.Qt.Checked]
            # If all values selected or no values, clear restrictive filter
            if not selected or set(selected) == set(uniq):
                self.proxy.setColumnAllowedValues(col, None)
            else:
                self.proxy.setColumnAllowedValues(col, selected)
            dlg.accept()

        def reset_filters():
            self.proxy.setColumnAllowedValues(col, None)
            dlg.accept()

        bottom.button(QtWidgets.QDialogButtonBox.Apply).clicked.connect(apply_filters)
        bottom.button(QtWidgets.QDialogButtonBox.Reset).clicked.connect(reset_filters)
        bottom.button(QtWidgets.QDialogButtonBox.Cancel).clicked.connect(dlg.reject)

        dlg.exec()


def main():
    app = QtWidgets.QApplication(sys.argv)
    # basic styling
    app.setStyle('Fusion')
    palette = QtGui.QPalette()
    palette.setColor(QtGui.QPalette.Window, QtGui.QColor('#f7f7f7'))
    palette.setColor(QtGui.QPalette.Base, QtGui.QColor('#ffffff'))
    palette.setColor(QtGui.QPalette.Text, QtGui.QColor('#222'))
    palette.setColor(QtGui.QPalette.ButtonText, QtGui.QColor('#222'))
    app.setPalette(palette)
    # Global stylesheet tweaks for better contrast and spacing
    app.setStyleSheet('''
        QLabel { color: #222; }
        QLineEdit, QComboBox, QDateEdit { background: #fff; padding: 6px; }
        QPushButton { background: #333; color: #fff; border-radius: 4px; padding: 6px 10px; }
        QPushButton:disabled { background: #bbb; color: #666; }
    ''')

    w = MainWindow()
    w.show()
    sys.exit(app.exec())


if __name__ == '__main__':
    main()
