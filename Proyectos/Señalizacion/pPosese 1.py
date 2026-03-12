import PySimpleGUI as sg
import datetime
import posesa
import poseses
import csv
import os
from os.path import exists
import operator
import pandas as pd
import posese_parser

def sort_table(table, cols, rev):
    for col in reversed(cols):
        try:
            table = sorted(table, key=operator.itemgetter(col), reverse=rev)
        except Exception as e:
            sg.popup_error('Error in sort table', 'Exception', e)
    return table

# Compatibility shim for PySimpleGUI builds that lack CalendarButton
# It creates a Button that opens a date picker and updates the target Input.
calendar_button_mappings = {}
if not hasattr(sg, 'CalendarButton'):
    def CalendarButton(button_text, target=None, begin_at_sunday_plus=1, format='%Y-%m-%d', **kwargs):
        key = f'-CAL-{target}-' if target else f'-CAL-{button_text}-'
        calendar_button_mappings[key] = (target, format)
        # Prefer a real Button if available, otherwise use a Text element with events enabled
        ButtonElem = getattr(sg, 'Button', None)
        if ButtonElem:
            return ButtonElem(button_text, key=key, **kwargs)
        TextElem = getattr(sg, 'Text', None)
        if TextElem:
            return TextElem(button_text, key=key, enable_events=True)
        # Last resort: return a simple Input that triggers events when clicked (less ideal)
        InputElem = getattr(sg, 'Input', None)
        if InputElem:
            return InputElem(default_text=button_text, key=key)
        raise RuntimeError('No suitable element type found for CalendarButton shim')
    sg.CalendarButton = CalendarButton

table_headings = ['Time', 'Cty', 'Inst', 'Comm', 'Scn', 'Dev', 'Event', 'Params', 'Raw']
table_csv_headings = ['Time', 'Cty', 'Inst', 'Comm', 'Scn', 'Dev', 'Event', 'Params', 'Raw1', 'Raw2']
table_col_widths = [20, 3, 8, 6, 5, 5, 30, 60, 10]
table_data = []
table_reversed = False
table_col_order = 0

idlist = []
fileLastName = 'psgt_last.txt'
if exists(fileLastName):
    with open(fileLastName, 'r') as filehandle:
        filecontents = filehandle.readlines()
        for line in filecontents:
            line = line.strip()
            if line:
                line = str(int(line))
                if line.isnumeric() and line not in idlist:
                    idlist.append(line)

today = datetime.datetime.now().strftime("%Y-%m-%d") 
yesterday = (datetime.datetime.now()-datetime.timedelta(1)).strftime("%Y-%m-%d")
tomorrow = (datetime.datetime.now()+datetime.timedelta(1)).strftime("%Y-%m-%d")

layout_col1 = [[sg.CalendarButton('From',  target='-DATE_INIT-',  begin_at_sunday_plus=1, format='%Y-%m-%d'), sg.Input(today, key='-DATE_INIT-', disabled=True, size=(10,1))],
        [sg.CalendarButton(' To ',  target='-DATE_END-',  begin_at_sunday_plus=1, format='%Y-%m-%d' ), sg.Input(tomorrow, key='-DATE_END-', disabled=True, size=(10,1))],
        [sg.Frame('Instal. ID:', [[sg.Button("Add", key="-BUTTON_ADD-"), sg.Input(key='-ID_ADD-', size=(12,1))],
        [sg.Button("Remove", key="-BUTTON_REMOVE-"), sg.Button(" Clear ", key="-BUTTON_CLEAR-")],
        [sg.Listbox(values=idlist, size=(15,6), key="-LIST_ID-", enable_events=True)],
        [sg.Combo(['ARG','BRA','CHI','ESP','FRA','GBR','IRL','ITA','PER', 'POR'],default_value='ESP',key='-COUNTRY-')],
        [sg.Input(key='-ID_SAVE_AS-', do_not_clear=False, enable_events=True, visible=False), sg.FileSaveAs('Save ID', target='-ID_SAVE_AS-', file_types=(('txt', '.txt'),)),
        sg.Input(key='-ID_LOAD-', do_not_clear=False, enable_events=True, visible=False), sg.FileBrowse(' Load ID ', target='-ID_LOAD-', file_types=(('txt', '.txt'),))
        ],
        ])
        ],
        #[sg.HorizontalSeparator()],
        #[sg.HorizontalSeparator()],
        [sg.Text('Filter:'), sg.Input(key='-FILTER-', size=(12,1))],
        [sg.Button('Read DB', key="-READ-"), sg.Input(key='-ID_EXPORT-', do_not_clear=False, enable_events=True, visible=False),
        sg.FileSaveAs('Export CSV', target='-ID_EXPORT-', file_types=(('csv', '.csv'),))
        ],
        [sg.Exit()]] 

layout_col2 = [[sg.Table(values=table_data, headings=table_headings, #max_col_width=250,
                    auto_size_columns=False,
                    # cols_justification=('center','center','center','center', 'center', 'left', 'left'),       # Added on GitHub only as of June 2022
                    display_row_numbers=False,
                    justification='left',
                    num_rows=40,
                    col_widths=table_col_widths,
                    alternating_row_color='steelblue',
                    key='-TABLE-',
                    #selected_row_colors='red on yellow',
                    enable_events=True,
                    expand_x=True,
                    expand_y=True,
                    vertical_scroll_only=False,
                    enable_click_events=True,           # Columnment out to not enable header and other clicks
                    # tooltip='This is a table'
                    )]]

# ----- Full layout -----
layout = [
    [sg.Column(layout_col1, vertical_alignment='top'),
     sg.VSeperator(),
     sg.Column(layout_col2, expand_x=True, expand_y=True)]
]

window = sg.Window('pPOSESE', layout, icon="verisure.ico", resizable=True)

while True:
    event, values = window.read()
    # Compatibility: handle CalendarButton shim events
    if isinstance(event, str) and event.startswith('-CAL-'):
        mapping = calendar_button_mappings.get(event)
        if mapping:
            target, fmt = mapping
            # popup_get_date returns (day, month, year) or None
            date_tuple = sg.popup_get_date(title='Choose Date', keep_on_top=True)
            if date_tuple:
                try:
                    d, m, y = date_tuple
                    date_str = f"{y:04d}-{m:02d}-{d:02d}"
                    if target and target in values:
                        window[target].update(date_str)
                except Exception:
                    pass
        continue
#    print(event, values)

    if event in (sg.WIN_CLOSED, 'Exit'):
        break

    elif event == "-BUTTON_ADD-":
        val = values['-ID_ADD-']
        if val.isnumeric() and val not in idlist:
            idlist.append(val)
            window["-ID_ADD-"].update('')
            window["-LIST_ID-"].update(idlist)
        else:
            sg.popup_error("ID <" + val + "> not valid")

    elif event == "-BUTTON_REMOVE-":
        if values['-LIST_ID-']: 
            idlist.remove(values['-LIST_ID-'][0])
            window["-LIST_ID-"].update(idlist)

    elif event == "-BUTTON_CLEAR-":
        idlist.clear()
        window["-LIST_ID-"].update(idlist)

    elif event == "-LIST_ID-":
        if values['-LIST_ID-']: 
        	window["-ID_ADD-"].update(values['-LIST_ID-'][0])

    elif event == "-READ-":
        val = values['-ID_ADD-']
        if val.isnumeric() and val not in idlist:
            idlist.append(val)
            window["-ID_ADD-"].update('')
        window["-LIST_ID-"].update(idlist)

        with open('psgt_last.txt', 'w') as filehandle:
            filehandle.writelines(line + '\n' for line in idlist)

        if idlist != [] or values['-FILTER-']:
            posesalist = posesa.msgGet(values['-DATE_INIT-'], values['-DATE_END-'], idlist, values['-COUNTRY-'], values['-FILTER-'])
            newTableValues = []
            print (f"Num. POSESA messages: {len(posesalist)}")
            for p in posesalist:
#                print(p.strFields())
                for ev in p.rPosesa.mpaPosese.eventsList:
                    newTableValues.append([p.rDate, p.rCountry, p.rInst, p.rComm, p.rType, ev.peDevice[0:2], ev.poseseCodeStr(), ev.poseseArgs(), ev.peEventData, p.rPosesa.mpaData])
            table_data = newTableValues
            window["-TABLE-"].update(newTableValues)
            print (f"Num. POSESEs: {len(newTableValues)}")
        else:
            sg.popup_error("no installation IDs!")

    elif event == "-ID_SAVE_AS-":
        with open(values['-ID_SAVE_AS-'], 'w') as filehandle:
            filehandle.writelines(line + '\n' for line in idlist)

    elif event == "-ID_LOAD-":
        idlist = []
        with open(values['-ID_LOAD-'], 'r') as filehandle:
            filecontents = filehandle.readlines()
            for line in filecontents:
                line = line.strip()
                if line:
                    idlist.append(line)
        window["-LIST_ID-"].update(idlist)

    elif event == "-ID_EXPORT-":
        with open(values['-ID_EXPORT-'], 'w', newline='') as filehandle:
            csv_writer = csv.writer(filehandle)
            csv_writer.writerows(table_data)

        #Covert to pandas
        df = pd.DataFrame(table_data, columns=table_csv_headings)
        # Go through all rows
        for index, row in df.iterrows():
            dict_parsed = posese_parser.posese_parser(row['Raw2'])
            if dict_parsed is not None and dict_parsed['posese_type'] == 'MTS':
                # set new columns in row from dict_parsed
                for key, value in dict_parsed.items():
                    df.at[index, key] = value
            else:
                df.drop(index, inplace=True)
        
        # Save df if not empty
        if df.empty == False:
            # Get filename from values['-ID_EXPORT-']
            filename = values['-ID_EXPORT-']
            # Remove extension
            filename = os.path.splitext(filename)[0]
            df.to_csv(filename + '_MTS' + '.csv', index=False)

    elif isinstance(event, tuple):
        if event[0] == '-TABLE-':
            if event[2][0] == -1 and event[2][1] >= 0:
                if event[2][1] == table_col_order:
                    table_reversed = not table_reversed
                else:
                    table_col_order = event[2][1]
                    table_reversed = False
                newTableValues = sort_table(table_data, (table_col_order, 0), table_reversed)
                window["-TABLE-"].update(newTableValues)
            elif isinstance(event[2][0], int) and isinstance(event[2][1], int):
                row = event[2][0]
                col = event[2][1]
#                sg.clipboard_set(table_data[row][col])
                s = ""
                for cell in table_data[row]:
                    s += str(cell) + ' ; '
                sg.clipboard_set(s)

window.close()
exit()

