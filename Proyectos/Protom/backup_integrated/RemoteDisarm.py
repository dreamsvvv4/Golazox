#!/usr/bin/env python3
"""
RemoteDisarm.py
---------------
Script para enviar comando RemoteDisarm usando la API de Verisure.
Lee parámetros desde variables de entorno (REMOTEDISARM_*) o usa valores por defecto.
"""
import os
import sys
import json
import subprocess
from time import sleep
import tempfile

DISARM_MODE_DESCRIPTIONS = {
    "00": "Disarm All Areas",
    "10": "Disarm Main Area Only",
    "20": "Disarm Perimeter Only",
}

def get_param(name, default):
    return os.environ.get(f"REMOTEDISARM_{name.upper()}", default)

params = {
    'codInstalacion': get_param('CODINSTALACION', '5499266'),
    'codPais': get_param('CODPAIS', 'ESP'),
    'orderid': get_param('ORDERID', 'RemoteDisarm'),
    'armMode': get_param('ARMMODE', '00'),
    'userId': get_param('USERID', '00'),
    'alarmPartition': get_param('ALARMPARTITION', '01'),
}

selected_mode = str(params['armMode']).zfill(2)
mode_desc = DISARM_MODE_DESCRIPTIONS.get(selected_mode, "Desconocido")
print(f"ArmMode seleccionado: {selected_mode} - {mode_desc}")

print(f"###### Enviando comando RemoteDisarm a la instalación {params['codInstalacion']} país {params['codPais']}")

# Obtener token de autenticación
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
    {"key": "armMode", "value": params['armMode']},
    {"key": "userId", "value": params['userId']},
    {"key": "alarmPartition", "value": params['alarmPartition']},
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

bashCmdRemoteDisarm = f'''curl -k -X POST "https://m2maio.gtm.securitasdirect.local:8243/protom/validationverification-service/sdvecu/v1.0/commands" -H "accept: */*" -H "Content-Type: application/json" -H "Authorization: Bearer {token}" -d @{json_file_path}'''
print(bashCmdRemoteDisarm)
sleep(1)
results = subprocess.Popen(bashCmdRemoteDisarm, shell=True, stdout=subprocess.PIPE)
try:
    output = results.stdout.read() if results.stdout else b''
    print(f"Response: {output}")
except Exception as e:
    print(f"Error al leer la respuesta: {str(e)}")

print(f"Comando RemoteDisarm enviado.")

with open("remotedisarm_summary.json", "w") as f:
    json.dump({"operation": params['orderid'], "installation": params['codInstalacion']}, f)

# Limpieza del archivo temporal
try:
    os.remove(json_file_path)
except Exception:
    pass

sys.exit(0)
