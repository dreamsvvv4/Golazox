#!/usr/bin/env python3
import json
from pathlib import Path

p = Path('results.json')
if not p.exists():
    print('results.json not found; run crawl_events first')
    raise SystemExit(1)

data = json.loads(p.read_text(encoding='utf-8'))

filtered = []
for ev in data:
    title = (ev.get('title') or '').lower()
    body_has_zaragoza = 'zaragoza' in (ev.get('location_text') or '').lower() or 'zaragoza' in title
    body_has_espana = 'espa' in title.lower() or 'espa' in (ev.get('location_text') or '').lower()
    has_envio = bool(ev.get('has_envio'))
    if (body_has_zaragoza or body_has_espana) and has_envio:
        filtered.append(ev)

out = Path('filtered_results.json')
out.write_text(json.dumps(filtered, ensure_ascii=False, indent=2), encoding='utf-8')
print('Wrote', out)

try:
    import pandas as pd
    rows = []
    for ev in filtered:
        for lot in ev.get('lots', []):
            rows.append({
                'event_title': ev.get('title'),
                'end_time': ev.get('end_time_raw'),
                'has_envio': ev.get('has_envio'),
                'lot_number': lot.get('lot_number'),
                'lot_snippet': lot.get('snippet'),
                'pvp': lot.get('price'),
                'sold_price': lot.get('sold_price'),
                'resell_recommendation': lot.get('resell_recommendation')
            })
    df = pd.DataFrame(rows)
    df.to_excel('filtered_results.xlsx', index=False)
    print('Wrote filtered_results.xlsx')
except Exception:
    print('Pandas not available or error; skipping Excel output')
