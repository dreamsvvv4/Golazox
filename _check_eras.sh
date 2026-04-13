#!/bin/bash
python3 << 'EOF'
import json
for slug in ['fc-chelsea', 'manchester-city']:
    with open(f'/home/u990866731/domains/golazox.com/nodejs/squads/{slug}.json') as f:
        d = json.load(f)
    seasons = d.get('seasons', [])
    if isinstance(seasons, dict):
        print(f'{slug}: {list(seasons.keys())}')
    elif seasons and isinstance(seasons[0], str):
        print(f'{slug}: {seasons}')
    else:
        years = [s.get('year') if isinstance(s, dict) else s for s in seasons]
        print(f'{slug}: {years}')
EOF
