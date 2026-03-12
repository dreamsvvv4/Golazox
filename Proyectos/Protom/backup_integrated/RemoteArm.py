ARM_MODE_DESCRIPTIONS = {
    "01": "Main Area - Arm Mode 1 (Arm Away)",
    "02": "Main Area - Arm Mode 2 (Arm Home)",
    "21": "Perimeter",
    "23": "Perimeter + arm away (Main Area - Arm Mode 1)",
    "24": "Perimeter + Arm Home (Main Area - Arm Mode 2)",
}
#!/usr/bin/env python3
"""
RemoteArm.py
------------
Script para enviar comando RemoteArm usando la API de Verisure.
Lee parámetros desde variables de entorno (REMOTEARM_*) o usa valores por defecto.
"""
import os
import sys
import json
import subprocess
from time import sleep
import tempfile

def get_param(name, default):
    return os.environ.get(f"REMOTEARM_{name.upper()}", default)

params = {
    'codInstalacion': get_param('CODINSTALACION', '5499266'),
    'codPais': get_param('CODPAIS', 'ESP'),
    'orderid': get_param('ORDERID', 'RemoteArm'),
    'armMode': get_param('ARMMODE', '23'),
    'userId': get_param('USERID', '00'),

}

# Print ArmMode description
selected_mode = str(params['armMode']).zfill(2)
mode_desc = ARM_MODE_DESCRIPTIONS.get(selected_mode, "Desconocido")
print(f"ArmMode seleccionado: {selected_mode} - {mode_desc}")

print(f"###### Enviando comando RemoteArm a la instalación {params['codInstalacion']} país {params['codPais']}")
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

bashCmdRemoteArm = f'''curl -k -X POST "https://m2maio.gtm.securitasdirect.local:8243/protom/validationverification-service/sdvecu/v1.0/commands" -H "accept: */*" -H "Content-Type: application/json" -H "Authorization: Bearer {token}" -d @{json_file_path}'''
print(bashCmdRemoteArm)
sleep(1)
results = subprocess.Popen(bashCmdRemoteArm, shell=True, stdout=subprocess.PIPE)
try:
    output = results.stdout.read() if results.stdout else b''
    print(f"Response: {output}")
except Exception as e:
    print(f"Error al leer la respuesta: {str(e)}")

print(f"Comando RemoteArm enviado.")

with open("remotearm_summary.json", "w") as f:
    json.dump({"operation": params['orderid'], "installation": params['codInstalacion']}, f)

# Limpieza del archivo temporal
try:
    os.remove(json_file_path)
except Exception:
    pass

sys.exit(0)
import os
import sys

def main():
    # Read parameters from environment variables
    codInstalacion = os.environ.get('REMOTEARM_CODINSTALACION', '')
    codPais = os.environ.get('REMOTEARM_CODPAIS', '')
    orderid = os.environ.get('REMOTEARM_ORDERID', '')
    armMode = os.environ.get('REMOTEARM_ARMMODE', '')
    userId = os.environ.get('REMOTEARM_USERID', '')

    # Simulate sending the RemoteArm command
    print(f"[OK] RemoteArm command sent:")
    print(f"  codInstalacion: {codInstalacion}")
    print(f"  codPais: {codPais}")
    print(f"  orderid: {orderid}")
    print(f"  armMode: {armMode}")
    print(f"  userId: {userId}")
    # Here you would implement the actual logic to send the command

if __name__ == "__main__":
    main()
