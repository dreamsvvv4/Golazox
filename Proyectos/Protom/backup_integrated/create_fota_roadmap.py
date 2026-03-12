#!/usr/bin/env python3
"""
create_fota_roadmap.py
----------------------
Crea (o actualiza) un roadmap FOTA para el CU de una instalación, apuntando a
una versión objetivo concreta y su paquete (.fota) en el repositorio.

Flujo:
  1) Obtiene token OAuth2 con client_credentials.
  2) POST al servicio de roadmap FOTA para crear un roadmap con fwTargetVersion
     y paso con package (url/chksum/filesize/targetVersion).

Variables de entorno requeridas:
  - TOKEN_URL: https://.../oauth2/token
  - AUTH_BASIC: "Basic <base64-clientid:secret>"
    - FOTA_ROADMAP_BASE: Base del servicio Roadmap FOTA.
            Recomendado (interno): https://mc-apim-cu.mnshtsd.com:443/fota/cu/v1.0/fota-roadmap-management
            Alternativa (externo): https://mc-apim-cu.verisure-iot.net:443/fota/cu/v1.0/fota-roadmap-management

Uso:
    python create_fota_roadmap.py --installation 5912095 --country 724 \
        --current 1.32.20 --target 1.32.21 \
        --auto-pkg

Salida: imprime el roadmapId creado y el resumen. No inicia la descarga; el CU
lo hará cuando reciba el roadmap.
"""

import os
import sys
import json
import argparse
import ssl
from urllib import request, parse, error
from urllib.parse import urljoin


def _env(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        raise RuntimeError(f"Missing environment variable: {name}")
    return val


def get_token(token_url: str, auth_basic: str, context: ssl.SSLContext | None = None) -> str:
    data = parse.urlencode({"grant_type": "client_credentials"}).encode("utf-8")
    req = request.Request(token_url, data=data, method="POST")
    req.add_header("Authorization", auth_basic)
    req.add_header("Accept", "application/json")
    with request.urlopen(req, timeout=20, context=context) as resp:
        body = resp.read().decode("utf-8", errors="ignore")
        js = json.loads(body)
        token = js.get("access_token")
        if not token:
            raise RuntimeError("Token response without access_token")
        return token


def create_roadmap(base_url: str, bearer: str, installation: str, country: str, current: str, target: str, pkg: dict, context: ssl.SSLContext | None = None) -> dict:
    url = f"{base_url}/roadmaps"
    payload = {
        "country": country,
        "installation": installation,
        "updates": {
            "controller": {
                "deviceType": "CU",
                "sn": None,
                "hwVersion": None,
                "fwSourceVersion": current,
                "fwTargetVersion": target,
                "isRollback": False,
                "priority": 10,
                "steps": [
                    {
                        "sequence": 1,
                        "package": {
                            "sourceVersion": "0.0.0",
                            "targetVersion": target,
                            "url": pkg["url"],
                            "chksum": pkg.get("chksum"),
                            "filesize": pkg.get("filesize"),
                        }
                    }
                ]
            },
            "devices": []
        }
    }
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(url, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {bearer}")
    req.add_header("Accept", "application/json")
    req.add_header("Content-Type", "application/json")
    try:
        with request.urlopen(req, timeout=30, context=context) as resp:
            body = resp.read().decode("utf-8", errors="ignore")
            return json.loads(body)
    except error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="ignore") if hasattr(e, "read") else str(e)
        raise RuntimeError(f"Roadmap POST failed: {e} | {detail}")


def _auto_package_for_target(target: str, context: ssl.SSLContext | None = None) -> dict:
    """Build package metadata for a given target version.

    Tries to construct the expected repo URL pattern and retrieve filesize via HEAD.
    Also attempts to fetch a checksum from a peer `.sha256` file; if unavailable,
    leaves checksum as None.

    Returns dict with keys: url, filesize (optional), chksum (optional).
    """
    base_repo = os.environ.get("FOTA_REPO_BASE", "https://mc-fotarepo-cu.mnshtsd.com/cuxs/")
    # Expected path: cuxs/<ver>/cuxs_<ver>_release.fota
    folder = f"{target.strip()}".replace(" ", "")
    filename = f"cuxs_{target.strip()}_release.fota"
    pkg_url = urljoin(base_repo, f"{folder}/{filename}")

    result = {"url": pkg_url}

    # Try HEAD to get Content-Length
    try:
        req = request.Request(pkg_url, method="HEAD")
        with request.urlopen(req, timeout=15, context=context) as resp:
            cl = resp.headers.get("Content-Length")
            if cl:
                try:
                    result["filesize"] = int(cl)
                except ValueError:
                    pass
    except Exception:
        pass

    # Try checksum from sibling .sha256 (plain text hex or "<hex>  <filename>")
    chksum_url = pkg_url + ".sha256"
    try:
        with request.urlopen(chksum_url, timeout=10, context=context) as resp:
            body = resp.read().decode("utf-8", errors="ignore").strip()
            # Extract first hex token
            token = body.split()[0] if body else None
            if token and all(c in "0123456789abcdefABCDEF" for c in token):
                result["chksum"] = token.lower()
    except Exception:
        pass

    return result


def main(argv):
    ap = argparse.ArgumentParser(description="Create FOTA roadmap for CU")
    ap.add_argument("--installation", required=True, help="Installation number (string or int)")
    ap.add_argument("--country", required=True, help="Country code (e.g., 724)")
    ap.add_argument("--current", required=True, help="Current firmware version (e.g., 1.32.19)")
    ap.add_argument("--target", required=True, help="Target firmware version (e.g., 1.32.21)")
    ap.add_argument("--pkg-url", required=False, help="FOTA package URL")
    ap.add_argument("--pkg-size", type=int, required=False, default=None, help="Filesize in bytes")
    ap.add_argument("--pkg-chksum", required=False, default=None, help="Checksum (hex)")
    ap.add_argument("--auto-pkg", action="store_true", help="Auto-detect package URL/size/checksum for target version")
    # Optional overrides for environment variables
    ap.add_argument("--token-url", required=False, help="Override TOKEN_URL env")
    ap.add_argument("--auth-basic", required=False, help="Override AUTH_BASIC env (e.g., 'Basic <base64>')")
    ap.add_argument("--base", required=False, help="Override FOTA_ROADMAP_BASE env")
    ap.add_argument("--bearer", required=False, help="Use an existing Bearer token (skip token request)")
    ap.add_argument("--insecure", action="store_true", help="Disable TLS certificate verification (like curl -k)")
    ap.add_argument("--tls12", action="store_true", help="Force TLS 1.2 on HTTPS connections (workaround for handshake issues)")
    ap.add_argument("--cafile", required=False, help="Path to a PEM CA bundle to verify TLS (use instead of --insecure)")
    args = ap.parse_args(argv)

    token_url = args.token_url or os.environ.get("TOKEN_URL")
    auth_basic = args.auth_basic or os.environ.get("AUTH_BASIC")
    base = args.base or os.environ.get("FOTA_ROADMAP_BASE")
    if not token_url:
        raise RuntimeError("Missing TOKEN_URL (set env or use --token-url)")
    if not auth_basic:
        raise RuntimeError("Missing AUTH_BASIC (set env or use --auth-basic)")
    if not base:
        raise RuntimeError("Missing FOTA_ROADMAP_BASE (set env or use --base)")

    # Build SSL context according to flags
    def _build_ssl_context(insecure: bool, force_tls12: bool, cafile: str | None) -> ssl.SSLContext | None:
        ctx_local: ssl.SSLContext | None
        if insecure:
            ctx_local = ssl._create_unverified_context()
        else:
            # Use default verification when not insecure; allow system trust store
            try:
                if cafile:
                    ctx_local = ssl.create_default_context(cafile=cafile)
                else:
                    ctx_local = ssl.create_default_context()
            except Exception:
                ctx_local = None
        if ctx_local and force_tls12:
            try:
                # Constrain to TLS 1.2 when required
                ctx_local.minimum_version = ssl.TLSVersion.TLSv1_2
                ctx_local.maximum_version = ssl.TLSVersion.TLSv1_2
            except Exception:
                # Older Python/OpenSSL may not support these attributes
                pass
        return ctx_local

    ctx = _build_ssl_context(args.insecure, args.tls12, args.cafile)

    if args.bearer:
        token = args.bearer
        print("[ok] Using provided Bearer token (skipping token request)")
    else:
        print(f"[info] Getting token from {token_url} ...")
        token = get_token(token_url, auth_basic, context=ctx)
        print("[ok] Token acquired")

    if args.auto_pkg and not args.pkg_url:
        print(f"[info] Auto-detecting package for target {args.target} ...")
        pkg = _auto_package_for_target(args.target, context=ctx)
        print(f"[info] Package URL: {pkg.get('url')}")
        if pkg.get("filesize"):
            print(f"[info] Package size: {pkg['filesize']} bytes")
        else:
            print("[warn] Filesize not detected; you may provide --pkg-size")
        if pkg.get("chksum"):
            print(f"[info] Package checksum: {pkg['chksum']}")
        else:
            print("[warn] Checksum not detected; you may provide --pkg-chksum")
    else:
        if not args.pkg_url:
            raise RuntimeError("--pkg-url is required unless --auto-pkg is used")
        pkg = {"url": args.pkg_url}
        if args.pkg_size:
            pkg["filesize"] = args.pkg_size
        if args.pkg_chksum:
            pkg["chksum"] = args.pkg_chksum

    print(f"[info] Creating roadmap for inst {args.installation} country {args.country} target {args.target} ...")
    resp = create_roadmap(base, token, str(args.installation), str(args.country), args.current, args.target, pkg, context=ctx)
    print("[ok] Roadmap created/returned:")
    print(json.dumps(resp, indent=2))
    rid = resp.get("roadmapId") or resp.get("id")
    if rid:
        print(f"RoadmapId: {rid}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
