#!/usr/bin/env python3
"""
ReportCommunicationModuleByChannel.py
-------------------------------------
Script para enviar el comando ReportCommunicationModuleByChannel a un módulo de comunicación usando la API de Verisure.
Lee parámetros desde variables de entorno (RCMC_*) o usa valores por defecto.
"""
import os
import sys
import json
import subprocess
from time import sleep
import tempfile

def get_param(name, default):
    return os.environ.get(f"RCMC_{name.upper()}", default)

params = {
    'codInstalacion': get_param('CODINSTALACION', '5912095'),
    'codPais': get_param('CODPAIS', 'ESP'),
    'systemType': get_param('SYSTEMTYPE', 'SDVECU'),
    'orderid': get_param('ORDERID', 'ReportCommunicationModuleByChannel'),
    'commandid': get_param('COMMANDID', '1142'),
    'userCode': get_param('USERCODE', 'victor.vega'),
    'userGroupCode': get_param('USERGROUPCODE', '231'),
    'timeZone': get_param('TIMEZONE', 'Europe/Madrid'),
    'channel': get_param('CHANNEL', '2'),  # 0-Ethernet, 1-GPRS, 2-SMS, 3-WiFi
}

print(f"###### Enviando comando ReportCommunicationModuleByChannel a la instalación {params['codInstalacion']} país {params['codPais']} canal {params['channel']}")
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
    {"key": "codPais", "value": params['codPais']},
    {"key": "systemType", "value": params['systemType']},
    {"key": "commandid", "value": params['commandid']},
    {"key": "userCode", "value": params['userCode']},
    {"key": "userGroupCode", "value": params['userGroupCode']},
    {"key": "timeZone", "value": params['timeZone']},
    {"key": "channel", "value": params['channel']},
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

bashCmd = f'''curl -k -X POST "https://m2maio.gtm.securitasdirect.local:8243/protom/validationverification-service/sdvecu/v1.0/commands" -H "accept: */*" -H "Content-Type: application/json" -H "Authorization: Bearer {token}" -d @{json_file_path}'''
print(bashCmd)
sleep(1)
results = subprocess.Popen(bashCmd, shell=True, stdout=subprocess.PIPE)
try:
    output = results.stdout.read() if results.stdout else b''
    print(f"Response: {output}")
except Exception as e:
    print(f"Error al leer la respuesta: {str(e)}")

print(f"Comando ReportCommunicationModuleByChannel enviado.")

with open("report_comm_module_summary.json", "w") as f:
    json.dump({"operation": params['orderid'], "installation": params['codInstalacion'], "channel": params['channel']}, f)

# Limpieza del archivo temporal
try:
    os.remove(json_file_path)
except Exception:
    pass

sys.exit(0)
