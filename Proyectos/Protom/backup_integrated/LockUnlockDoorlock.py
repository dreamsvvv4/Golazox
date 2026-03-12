#!/usr/bin/env python3
"""
LockUnlockDoorlock.py
---------------------
Script para enviar comandos DoorLock (lock/unlock) a una cerradura remota usando la API de Verisure.
Lee parámetros desde variables de entorno (LUD_*) o usa valores por defecto.
"""
import os
import sys
import json
import subprocess
from time import sleep
import tempfile

def get_param(name, default):
    return os.environ.get(f"LUD_{name.upper()}", default)

params = {
    'pais': get_param('PAIS', 'ES'),
    'idInstalacion': get_param('IDINSTALACION', '5912095'),
    'deviceType': str(get_param('DEVICETYPE', '163')),
    'deviceId': str(get_param('DEVICEID', '01')).zfill(2),
    'lock': str(get_param('LOCK', '1')),  # '1' para lock, '0' para unlock
    'reserved': str(get_param('RESERVED', '0000000000000000')),
}

print(f"###### Enviando comando DoorLock a la instalación {params['idInstalacion']} país {params['pais']}")
bashCmdToken = ''' curl -k -X POST https://m2maio.gtm.securitasdirect.local:9443/oauth2/token -d "grant_type=client_credentials" -H "Authorization: Basic U2ZIYm5MMEhNVmMxNmNuRms1OXV6Y3JhcHpvYTpabldySmlVVzhOY1QzUTRGVzFnUTdiYWxSUklh" '''
print(f"First we need to get the auth token: {bashCmdToken}")
sleep(1)
results = subprocess.run(bashCmdToken, shell=True, stdout=subprocess.PIPE)
print(f"Response: {results.stdout}")

token = "token-de-prueba-local"
if results.stdout:
    try:
        response_data = json.loads(results.stdout)
        token = response_data.get("access_token", "") or token
    except Exception as e:
        print(f"Error al procesar la respuesta: {str(e)}. Usando token de prueba...")

order_parameters = [
    {"key": "deviceType", "value": params['deviceType']},
    {"key": "deviceId", "value": params['deviceId']},
    {"key": "lock", "value": params['lock']},
    {"key": "reserved", "value": params['reserved']},
]

json_payload = {
    "answerInfo": {"answerType": "NONE", "answerURL": "NONE"},
    "device": {"country": params['pais'], "installationNum": params['idInstalacion']},
    "order": {"orderId": "DoorLock", "parameters": order_parameters},
    "processId": "suki",
    "session": {"finalStep": False, "firstStep": True, "persistent": False}
}

with tempfile.NamedTemporaryFile(delete=False, mode='w', suffix='.json', encoding='utf-8') as tmpf:
    json.dump(json_payload, tmpf)
    tmpf.flush()
    json_file_path = tmpf.name

bashCmdLock = f'''curl -k -X POST "https://m2maio.gtm.securitasdirect.local:8243/protom/validationverification-service/sdvecu/v1.0/commands" -H "accept: */*" -H "Content-Type: application/json" -H "Authorization: Bearer {token}" -d @{json_file_path}'''
print(bashCmdLock)
sleep(1)
results = subprocess.Popen(bashCmdLock, shell=True, stdout=subprocess.PIPE)
try:
    output = results.stdout.read() if results.stdout else b''
    print(f"Response: {output}")
except Exception as e:
    print(f"Error al leer la respuesta: {str(e)}")

print(f"Comando DoorLock enviado a la cerradura.")

with open("lock_unlock_summary.json", "w") as f:
    json.dump({"operation": params['lock'], "installation": params['idInstalacion']}, f)

# Limpieza del archivo temporal
try:
    os.remove(json_file_path)
except Exception:
    pass

sys.exit(0)
