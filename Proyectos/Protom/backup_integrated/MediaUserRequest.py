#!/usr/bin/env python3
#########################################################################################################################################################################
# Excel should be like:
#   |Installation Number |Country  |Orion_dev_id| SSH_IP | CU_VERSION |
#   |3685457            | ES      |2           | 192.1..|      2     |           
#   |3755416            | ES      |2           | 192.1..|      1     |
#   |3748235            | IT      |2           | 192.1..|      2     |
# Get the token:
# curl -k -X POST https://m2maio.gtm.securitasdirect.local:9443/oauth2/token -d "grant_type=client_credentials" -H "Authorization: Basic U2ZIYm5MMEhNVmMxNmNuRms1OXV6Y3JhcHpvYTpabldySmlVVzhOY1QzUTRGVzFnUTdiYWxSUklh"
# Command to test manually:
# curl -k -X POST "https://m2maio.gtm.securitasdirect.local:8243/protom/validationverification-service/sdvecu/v1.0/commands" -H "accept: */*" -H "Content-Type: application/json" -H "Authorization: Bearer 66a9faa6-ae70-3873-926f-4a03c62f69f9" -d "{ \"answerInfo\": { \"answerType\": \"NONE\", \"answerURL\": \"NONE\" }, \"device\": { \"country\": \"ES\", \"installationNum\": \"5382108\" }, \"order\": { \"orderId\": \"MediaUserRequest\", \"parameters\": [ { \"key\": \"deviceType\", \"value\": \"106\" },{ \"key\": \"deviceId\", \"value\": \"04\" },{ \"key\": \"mediaType\", \"value\": \"1\" },{ \"key\": \"resolutionFormat\", \"value\": \"0\" },{ \"key\": \"numberOfPicture\", \"value\": \"1\" } ] }, \"processId\": \"suki\", \"session\": { \"finalStep\": false, \"firstStep\": true, \"persistent\": false }}"
# ...existing code...

from time import sleep
import subprocess
import sys
import random
import os
import tempfile
import json

# Lista de instalaciones integradas en el script
instalaciones = [
    {
        'Installation Number': 5499266,
        'Country': 'ES',
        'Orion_dev_id': 6,
        'CU_VERSION': 2,
        'mediaType': 1,
        'resolutionFormat': 0,
        'numberOfPicture': 1
    },
    {
        'Installation Number': 5499266,
        'Country': 'ES',
        'Orion_dev_id': 4,
        'CU_VERSION': 2,
        'mediaType': 1,
        'resolutionFormat': 6,
        'numberOfPicture': 1
    }
]

try:
    n_iter = int(sys.argv[1])
except (IndexError, ValueError):
    n_iter = 1

resolution_formats = [1, 2, 3, 4, 5, 6]
total_images_requested = 0  # Inicializar contador de imágenes solicitadas


# --- NUEVO BLOQUE: Leer parámetros desde variables de entorno (MUR_*) o usar valores por defecto ---
def get_param(name, default):
    val = os.environ.get(f"MUR_{name.upper()}")
    if val is None:
        return default
    if isinstance(val, str) and val.strip() == "":
        return default
    return val

params = {
    'Installation Number': int(get_param('INSTALLATION_NUMBER', 5499266)),
    'Country': get_param('COUNTRY', 'ES'),
    'deviceId': str(get_param('DEVICEID', '06')).zfill(2),
    'CU_VERSION': int(get_param('CU_VERSION', 2)),
    'mediaType': int(get_param('MEDIATYPE', 1)),
    'resolutionFormat': int(get_param('RESOLUTIONFORMAT', 0)),
    'numberOfPicture': int(get_param('NUMBEROFPICTURE', 1)),
    'deviceType': int(get_param('DEVICETYPE', 106)),
}

print(f"###### Solicitando {params['numberOfPicture']} imagen(es) a la instalación {params['Installation Number']} país {params['Country']} (resolutionFormat: {params['resolutionFormat']})")
bashCmdToken = ''' curl -k -X POST https://m2maio.gtm.securitasdirect.local:9443/oauth2/token -d "grant_type=client_credentials" -H "Authorization: Basic U2ZIYm5MMEhNVmMxNmNuRms1OXV6Y3JhcHpvYTpabldySmlVVzhOY1QzUTRGVzFnUTdiYWxSUklh" '''
print(f"First we need to get the auth token: {bashCmdToken}")
sleep(1)
results = subprocess.run(bashCmdToken, shell=True, stdout=subprocess.PIPE)
print(f"Response: {results.stdout}")

# Verificar si la respuesta está vacía
if not results.stdout:
    print("Error: No se pudo obtener respuesta del servidor. Usando token de prueba...")
    token = "token-de-prueba-local"  # Token ficticio para pruebas
else:
    try:
        response_data = json.loads(results.stdout)
        token = response_data.get("access_token", "")
        if not token:
            print("Error: No se encontró access_token en la respuesta. Usando token de prueba...")
            token = "token-de-prueba-local"  # Token ficticio para pruebas
    except Exception as e:
        print(f"Error al procesar la respuesta: {str(e)}. Usando token de prueba...")
        token = "token-de-prueba-local"  # Token ficticio para pruebas

bashCmdMedia = f''' curl -k -X POST "https://m2maio.gtm.securitasdirect.local:8243/protom/validationverification-service/sdvecu/v1.0/commands" -H "accept: */*" -H "Content-Type: application/json" -H "Authorization: Bearer {token}" -d "{{ \\\"answerInfo\\\": {{ \\\"answerType\\\": \\\"NONE\\\", \\\"answerURL\\\": \\\"NONE\\\" }}, \\\"device\\\": {{ \\\"country\\\": \\\"{params['Country']}\\\", \\\"installationNum\\\": \\\"{params['Installation Number']}\\\" }}, \\\"order\\\": {{ \\\"orderId\\\": \\\"MediaUserRequest\\\", \\\"parameters\\\": [ {{ \\\"key\\\": \\\"deviceType\\\", \\\"value\\\": \\\"{params['deviceType']}\\\" }},{{ \\\"key\\\": \\\"deviceId\\\", \\\"value\\\": \\\"{params['deviceId']}\\\" }},{{ \\\"key\\\": \\\"mediaType\\\", \\\"value\\\": \\\"{params['mediaType']}\\\" }},{{ \\\"key\\\": \\\"resolutionFormat\\\", \\\"value\\\": \\\"{params['resolutionFormat']}\\\" }},{{ \\\"key\\\": \\\"numberOfPicture\\\", \\\"value\\\": \\\"{params['numberOfPicture']}\\\" }} ] }}, \\\"processId\\\": \\\"suki\\\", \\\"session\\\": {{ \\\"finalStep\\\": false, \\\"firstStep\\\": true, \\\"persistent\\\": false }} }}" '''
print(bashCmdMedia)
sleep(1)
results = subprocess.Popen(bashCmdMedia, shell=True, stdout=subprocess.PIPE)
try:
    # Leer la salida de manera segura
    output = results.stdout.read() if results.stdout else b''
    print(f"Response: {output}")
except Exception as e:
    print(f"Error al leer la respuesta: {str(e)}")

print(f"Solicitud enviada: {params['numberOfPicture']} imagen(es) con resolutionFormat={params['resolutionFormat']}")
print("\n")

# Crear un archivo temporal para comunicar el número de imágenes solicitadas
with open("media_request_summary.json", "w") as f:
    json.dump({"total_images": params['numberOfPicture']}, f)

# El número de imágenes también se devuelve como código de salida (máx 127)
sys.exit(min(params['numberOfPicture'], 127))

# Al finalizar, mostramos el total de imágenes solicitadas
print(f"\n===== RESUMEN =====")
print(f"Total de imágenes solicitadas: {total_images_requested}")

# Crear un archivo temporal para comunicar el número de imágenes solicitadas
with open("media_request_summary.json", "w") as f:
    json.dump({"total_images": total_images_requested}, f)

# El número de imágenes también se devuelve como código de salida (máx 127)
sys.exit(min(total_images_requested, 127))
