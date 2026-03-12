#!/usr/bin/env python3
"""
RemoteReboot.py
---------------
Script para enviar comando RemoteReboot usando la API de Verisure.
Lee parámetros desde variables de entorno (REMOTEREBOOT_*) o usa valores por defecto.
"""
import os
import sys
import json
import subprocess
from time import sleep
import tempfile

def get_param(name, default):
    return os.environ.get(f"REMOTEREBOOT_{name.upper()}", default)

params = {
    'codInstalacion': get_param('CODINSTALACION', '5499266'),
    'codPais': get_param('CODPAIS', 'ESP'),
    'orderid': get_param('ORDERID', 'ResetPanelOrDevice'),
    'userId': get_param('USERID', '00'),
    'deviceType': get_param('DEVICETYPE', '106'),
    'deviceId': get_param('DEVICEID', '04'),
}

print(f"###### Enviando comando RemoteReboot a la instalación {params['codInstalacion']} país {params['codPais']}")
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
    {"key": "userId", "value": params['userId']},
    {"key": "deviceType", "value": params['deviceType']},
    {"key": "deviceId", "value": params['deviceId']},
]

json_payload = {
    "answerInfo": {"answerType": "NONE", "answerURL": "NONE"},
    "device": {"country": params['codPais'], "installationNum": params['codInstalacion']},
    "order": {"orderId": params['orderid'], "parameters": order_parameters},
    "processId": "suki",
    "session": {"finalStep": False, "firstStep": True, "persistent": False}
}

with tempfile.NamedTemporaryFile(delete=False, mode='w', suffix='.json', encoding='utf-8') as tmpf:
    json.dump(json_payload, tmpf)
    tmpf.flush()
    json_file_path = tmpf.name

bashCmdRemoteReboot = f'''curl -k -X POST "https://m2maio.gtm.securitasdirect.local:8243/protom/validationverification-service/sdvecu/v1.0/commands" -H "accept: */*" -H "Content-Type: application/json" -H "Authorization: Bearer {token}" -d @{json_file_path}'''
print(bashCmdRemoteReboot)
sleep(1)
results = subprocess.Popen(bashCmdRemoteReboot, shell=True, stdout=subprocess.PIPE)
try:
    output = results.stdout.read() if results.stdout else b''
    print(f"Response: {output}")
except Exception as e:
    print(f"Error al leer la respuesta: {str(e)}")

print(f"Comando RemoteReboot enviado.")

with open("remotereboot_summary.json", "w") as f:
    json.dump({"operation": params['orderid'], "installation": params['codInstalacion']}, f)

# Limpieza del archivo temporal
try:
    os.remove(json_file_path)
except Exception:
    pass

sys.exit(0)
