#!/usr/bin/env python3
"""
send_command.py
----------------
Envía un comando directamente a la API (sin pasar por la plataforma UI),
obteniendo un token OAuth2 y publicando el `order` al endpoint de comandos.

No expone credenciales en el código: todo se toma de variables de entorno.

Variables de entorno requeridas:
  - TOKEN_URL: URL de token OAuth2 (p.ej. https://...:9443/oauth2/token)
  - AUTH_BASIC: Cabecera Authorization Basic para client_credentials ("Basic <base64>")
  - COMMANDS_URL: Endpoint de comandos (p.ej. https://...:8243/protom/.../commands)

Parámetros mínimos (CLI o env):
  - --installation / SENDCMD_INSTALLATION (int)
  - --country / SENDCMD_COUNTRY (str, p.ej. ESP)
  - --order-id / SENDCMD_ORDER_ID (str)
  - --param key=value (repetible) o JSON en --params-json

Ejemplos PowerShell:
  $env:TOKEN_URL = "https://m2maio.gtm.securitasdirect.local:9443/oauth2/token"
  $env:AUTH_BASIC = "Basic <base64>"
  $env:COMMANDS_URL = "https://m2maio.gtm.securitasdirect.local:8243/protom/validationverification-service/sdvecu/v1.0/commands"
  python send_command.py --installation 5499266 --country ESP --order-id RemoteArm --param armMode=23 --param userId=00

  # Con JSON para parámetros complejos
  python send_command.py --installation 5499266 --country ESP --order-id ReportCommunicationModuleByChannel --params-json '{"parameters":[{"key":"channel","value":"RC"}]}'

Nota: El dispositivo no suele ser accesible directamente desde la red local; el envío
se hace contra el backend expuesto (APIM). Para envío "directo al dispositivo" por
serie/USB o LAN haría falta el protocolo/documentación y acceso físico.
"""

import os
import sys
import json
import argparse
import base64
from typing import List, Dict
from urllib import request, parse, error


def _env(name: str, required: bool = True, default: str | None = None) -> str:
    val = os.environ.get(name, default)
    if required and not val:
        raise RuntimeError(f"Missing environment variable: {name}")
    return val or ""


def get_token(token_url: str, auth_basic: str) -> str:
    data = parse.urlencode({"grant_type": "client_credentials"}).encode("utf-8")
    req = request.Request(token_url, data=data, method="POST")
    req.add_header("Authorization", auth_basic)
    req.add_header("Accept", "application/json")
    try:
        with request.urlopen(req, timeout=20) as resp:
            body = resp.read().decode("utf-8", errors="ignore")
            js = json.loads(body)
            token = js.get("access_token")
            if not token:
                raise RuntimeError("Token response without access_token")
            return token
    except error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="ignore") if hasattr(e, "read") else str(e)
        raise RuntimeError(f"Token request failed: {e} | {detail}")
    except Exception as ex:
        raise RuntimeError(f"Token request error: {ex}")


def post_command(commands_url: str, bearer_token: str, payload: Dict) -> Dict:
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(commands_url, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {bearer_token}")
    req.add_header("Accept", "application/json")
    req.add_header("Content-Type", "application/json")
    try:
        with request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8", errors="ignore")
            try:
                return json.loads(body)
            except Exception:
                return {"raw": body}
    except error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="ignore") if hasattr(e, "read") else str(e)
        raise RuntimeError(f"Command request failed: {e} | {detail}")
    except Exception as ex:
        raise RuntimeError(f"Command request error: {ex}")


def parse_params_kv(param_list: List[str]) -> List[Dict[str, str]]:
    res: List[Dict[str, str]] = []
    for item in param_list:
        if "=" not in item:
            raise ValueError(f"Invalid --param '{item}', expected key=value")
        k, v = item.split("=", 1)
        res.append({"key": k, "value": v})
    return res


def build_payload(country: str, installation: int, order_id: str, parameters: List[Dict[str, str]]) -> Dict:
    return {
        "answerInfo": {"answerType": "NONE", "answerURL": "NONE"},
        "device": {"country": country, "installationNum": str(installation)},
        "order": {"orderId": order_id, "parameters": parameters},
        "processId": "suki",
        "session": {"finalStep": False, "firstStep": True, "persistent": False},
    }


def main(argv: List[str]) -> int:
    ap = argparse.ArgumentParser(description="Send command to API (client_credentials + command post)")
    ap.add_argument("--installation", type=int, default=os.environ.get("SENDCMD_INSTALLATION"), required=False)
    ap.add_argument("--country", type=str, default=os.environ.get("SENDCMD_COUNTRY", "ESP"))
    ap.add_argument("--order-id", type=str, default=os.environ.get("SENDCMD_ORDER_ID"))
    ap.add_argument("--param", action="append", default=[], help="key=value (repeatable)")
    ap.add_argument("--params-json", type=str, default=None, help="JSON with parameters array or full order block")
    args = ap.parse_args(argv)

    if not args.installation:
        print("--installation is required (or SENDCMD_INSTALLATION)", file=sys.stderr)
        return 2
    if not args.order_id:
        print("--order-id is required (or SENDCMD_ORDER_ID)", file=sys.stderr)
        return 2

    token_url = _env("TOKEN_URL")
    auth_basic = _env("AUTH_BASIC")
    commands_url = _env("COMMANDS_URL")

    # 1) Token
    print(f"[info] Getting token from {token_url} ...")
    token = get_token(token_url, auth_basic)
    print("[ok] Token acquired")

    # 2) Payload
    if args.params_json:
        try:
            js = json.loads(args.params_json)
            if "parameters" in js and "orderId" not in js:
                parameters = js["parameters"]
                payload = build_payload(args.country, int(args.installation), args.order_id, parameters)
            else:
                # Assume full payload or full order block provided
                if "device" in js and "order" in js:
                    payload = js
                elif "orderId" in js:
                    parameters = js.get("parameters", [])
                    payload = build_payload(args.country, int(args.installation), js["orderId"], parameters)
                else:
                    raise ValueError("Unsupported --params-json structure")
        except Exception as ex:
            print(f"[error] Invalid --params-json: {ex}", file=sys.stderr)
            return 2
    else:
        parameters = parse_params_kv(args.param)
        payload = build_payload(args.country, int(args.installation), args.order_id, parameters)

    # 3) POST command
    print(f"[info] Posting order '{args.order_id}' for installation {args.installation} ({args.country}) ...")
    try:
        resp = post_command(commands_url, token, payload)
        print("[ok] Command accepted:")
        print(json.dumps(resp, indent=2, ensure_ascii=False))
        return 0
    except Exception as ex:
        print(f"[error] Command failed: {ex}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
