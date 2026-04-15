#!/usr/bin/env python3
import json, os, sys

BASE = os.path.expanduser('~/domains/golazox.com/nodejs/squads')
fixes = {
    'roter-stern-belgrad-u19.json': '\U0001f30d Otros',
    'fk-partizan.json': '\U0001f30d Otros',
}

for fn, correct_group in fixes.items():
    path = os.path.join(BASE, fn)
    if not os.path.exists(path):
        print(f'Not found: {fn}')
        continue
    with open(path, 'r', encoding='utf-8') as f:
        d = json.load(f)
    old = d.get('group', '')
    d['group'] = correct_group
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
    print(f'Fixed: {fn}  ({repr(old)} -> {repr(correct_group)})')
