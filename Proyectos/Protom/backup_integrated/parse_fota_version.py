#!/usr/bin/env python3
"""
parse_fota_version.py
---------------------
Extrae del log `ordered.log` la información de FOTA que llega al CU:
- roadmapId, instalación, país (si aparece)
- versión actual (fwSourceVersion) y objetivo (fwTargetVersion)
- targetVersion del package y su URL, checksum y tamaño

Uso:
  python parse_fota_version.py "UltraKibanaDownloader/logs/<inst>_<date>/ordered.log"

Salida: resumen legible y JSON opcional.
"""

import re
import json
import sys
from typing import Optional, Dict, Any


def parse_ordered_log(path: str) -> Optional[Dict[str, Any]]:
    # Patrones que capturan el bloque JSON del roadmap y/o líneas informativas
    roadmap_json_re = re.compile(r'Response data doc: (\{.*\})')
    process_line_re = re.compile(r'Start Updating .* CU .* (\d+\.\d+\.\d+)->(\d+\.\d+\.\d+)')

    result: Dict[str, Any] = {}
    roadmap_found = False

    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            # Captura del JSON del roadmap (contiene controller + steps)
            m = roadmap_json_re.search(line)
            if m:
                try:
                    doc = json.loads(m.group(1))
                    result["roadmapId"] = doc.get("roadmapId")
                    result["country"] = doc.get("country")
                    result["installation"] = doc.get("installation")
                    updates = doc.get("updates", {})
                    controller = updates.get("controller", {})
                    result["fwSourceVersion"] = controller.get("fwSourceVersion")
                    result["fwTargetVersion"] = controller.get("fwTargetVersion")
                    # Primer step del package si existe
                    steps = controller.get("steps", [])
                    if steps:
                        pkg = steps[0].get("package", {})
                        result["package"] = {
                            "sourceVersion": pkg.get("sourceVersion"),
                            "targetVersion": pkg.get("targetVersion"),
                            "url": pkg.get("url"),
                            "chksum": pkg.get("chksum"),
                            "filesize": pkg.get("filesize"),
                        }
                    roadmap_found = True
                except Exception:
                    # Ignorar si no podemos parsear
                    pass

            # Línea de inicio de actualización con source->target
            m2 = process_line_re.search(line)
            if m2:
                result.setdefault("fwSourceVersion", m2.group(1))
                result.setdefault("fwTargetVersion", m2.group(2))

    return result if roadmap_found or result else None


def main(argv):
    if not argv:
        print("Usage: python parse_fota_version.py <path-to-ordered.log>")
        return 2
    path = argv[0]
    info = parse_ordered_log(path)
    if not info:
        print("No FOTA roadmap/info found in log.")
        return 1

    # Salida legible
    print("=== FOTA Summary ===")
    print(f"RoadmapId    : {info.get('roadmapId')}")
    print(f"Installation : {info.get('installation')} | Country: {info.get('country')}")
    print(f"FW Source    : {info.get('fwSourceVersion')} -> Target: {info.get('fwTargetVersion')}")
    pkg = info.get("package", {})
    if pkg:
        print(f"Package tgt  : {pkg.get('targetVersion')} | src: {pkg.get('sourceVersion')}")
        print(f"URL          : {pkg.get('url')}")
        print(f"Checksum     : {pkg.get('chksum')}")
        print(f"Filesize     : {pkg.get('filesize')}")

    # JSON opcional para automatización
    print("\nJSON:")
    print(json.dumps(info, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
