#!/usr/bin/env python3
"""Parse saved Event/Details HTML and print key info: title, location, envio, lots/prices."""
import sys
from bs4 import BeautifulSoup
from pathlib import Path
import json


def extract(html):
    soup = BeautifulSoup(html, "html.parser")
    out = {}

    # title
    t = soup.find("h1")
    out["title"] = t.get_text(strip=True) if t else soup.title.string if soup.title else ""

    # text body
    body = soup.get_text("\n", strip=True)
    out["has_envio"] = "envio a domicilio" in body.lower() or "envío a domicilio" in body.lower()

    # location: try common patterns
    loc = ""
    # look for 'Ubicación' or 'Location' keywords
    for strong in soup.find_all(text=True):
        txt = strong.strip()
        if txt and ("ubicación" in txt.lower() or "location" in txt.lower() or "zona" in txt.lower()):
            loc = txt
            break
    # fallback: search in body for 'Zaragoza'
    out["location_found"] = "zaragoza" in body.lower()
    out["location_text"] = loc

    # Extract auction end time (several possible formats)
    import re

    end_time = None
    # pattern like 15/03/2026 19:00:00
    m = re.search(r"(\d{1,2}/\d{1,2}/\d{4}\s*\d{1,2}:\d{2}:\d{2})", body)
    if m:
        end_time = m.group(1)
    else:
        # pattern like 'Fin: Domingo 15 de Marzo, 20.00 h' or 'Fin:' followed by time
        m2 = re.search(r"Fin:.*?(\d{1,2}[\.:]\d{2}\s*h?)", body, re.IGNORECASE)
        if m2:
            end_time = m2.group(1)
        else:
            # try 'La subasta acaba en..' simple capture
            m3 = re.search(r"La subasta acaba en\W*(\d{1,2}/\d{1,2}/\d{4}\s*\d{1,2}:\d{2}:\d{2})", body)
            if m3:
                end_time = m3.group(1)

    out["end_time_raw"] = end_time

    # find lot cards: look for text elements that mention 'Lote' and contain a price
    lots = []
    price_re = re.compile(r"(\d{1,3}(?:[\.\s]\d{3})*(?:[\.,]\d{1,2})?)\s*€")

    for tag in soup.find_all():
        txt = tag.get_text(" ", strip=True)
        if not txt:
            continue
        if "lote" in txt.lower() or "lot" in txt.lower():
            # try to extract lot number
            lot_num = None
            mlot = re.search(r"Lote\s*(\d+)", txt, re.IGNORECASE)
            if mlot:
                try:
                    lot_num = int(mlot.group(1))
                except Exception:
                    lot_num = None
            # find first price occurrence
            mprice = price_re.search(txt)
            price_val = None
            if mprice:
                raw = mprice.group(1)
                # normalize european format: remove dots used as thousands, replace comma with dot
                norm = raw.replace('.', '').replace(' ', '').replace(',', '.')
                try:
                    price_val = float(norm)
                except Exception:
                    price_val = None

            lots.append({"lot_number": lot_num, "snippet": txt, "price": price_val})

    out["lots"] = lots[:200]
    return out


def main():
    if len(sys.argv) < 2:
        print("Usage: parse_event.py <file.html>")
        sys.exit(1)
    fp = Path(sys.argv[1])
    if not fp.exists():
        print("File not found:", fp)
        sys.exit(2)
    html = fp.read_text(encoding="utf-8")
    info = extract(html)
    print(json.dumps(info, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
