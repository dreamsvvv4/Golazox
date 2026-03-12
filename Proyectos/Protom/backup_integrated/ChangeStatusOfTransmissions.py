#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ChangeStatusOfTransmissions.py

Script para enviar comandos de cambio de estado a transmisiones.
Versión simplificada.
"""

from time import sleep
import subprocess
import sys
import random
import signal
import json
import os
from datetime import datetime

# Manejador de señal para interrupciones (Ctrl+C)
def signal_handler(sig, frame):
    print("\nInterrumpiendo ChangeStatusOfTransmissions...")
    sys.exit(0)

# Registrar el manejador de señal
signal.signal(signal.SIGINT, signal_handler)

# Función para depuración
def log_debug(message):
    print(f"[DEBUG] {message}")
    # Asegurarse de que la salida se imprime inmediatamente
    sys.stdout.flush()

# Lista de instalaciones integradas en el script
instalaciones = [
    {
        'Installation Number': 5499266,
        'Country': 'ES',
        'parametros': [
            {'key': 'typeOfInformation', 'value': '3'}
        ]
    }
]

"""CLI usage:

    python ChangeStatusOfTransmissions.py <op_status> [installation_num] [country] [n_iter]

Where:
  - op_status: 1..6 (NTS/ITS/CCS/PTS/UTS/LOS)
  - installation_num: optional, defaults to the embedded example
  - country: optional, defaults to the embedded example
  - n_iter: optional, defaults to 1
"""

if len(sys.argv) > 1:
    try:
        op_status = int(sys.argv[1])
        if op_status not in [1, 2, 3, 4, 5, 6]:
            print("Valor no válido. Debe ser un número entre 1 y 6.")
            sys.exit(1)
    except ValueError:
        print("Por favor, introduce un número válido para el status.")
        sys.exit(1)
else:
    # Si no se pasa argumento, pedirlo interactivo
    print("Selecciona el Operational status para typeOfInformation:")
    print("1 = NTS\n2 = ITS\n3 = CCS\n4 = PTS\n5 = UTS\n6 = LOS")
    while True:
        try:
            op_status = int(input("Introduce el número correspondiente (1-6): "))
            if op_status in [1, 2, 3, 4, 5, 6]:
                break
            else:
                print("Valor no válido. Debe ser un número entre 1 y 6.")
        except ValueError:
            print("Por favor, introduce un número válido.")

# Optional iteration count
try:
    n_iter = int(sys.argv[4]) if len(sys.argv) > 4 else 1
except ValueError:
    n_iter = 1

log_debug(f"Usando operational status: {op_status}")
log_debug(f"Iteraciones: {n_iter}")

# Actualizar valores de instalación con los parámetros recibidos
if len(sys.argv) > 2:
    try:
        installation_num = sys.argv[2]
        instalaciones[0]['Installation Number'] = int(installation_num)
    except:
        print(f"Error al procesar número de instalación: {sys.argv[2]}")

if len(sys.argv) > 3:
    country = sys.argv[3]
    instalaciones[0]['Country'] = country

# Variables de control
total_commands_sent = 0

# Solo ChangeStatusOfTransmissions para cada instalación
try:
    for _ in range(n_iter):
        for inst in instalaciones:
            print(f"###### Enviando ChangeStatusOfTransmissions a instalación {inst['Installation Number']} país {inst['Country']}")
            
            # Comando para obtener el token
            bashCmdToken = ''' curl -k -X POST https://m2maio.gtm.securitasdirect.local:9443/oauth2/token -d "grant_type=client_credentials" -H "Authorization: Basic U2ZIYm5MMEhNVmMxNmNuRms1OXV6Y3JhcHpvYTpabldySmlVVzhOY1QzUTRGVzFnUTdiYWxSUklh" '''
            log_debug(f"Obteniendo token con comando: {bashCmdToken}")
            sleep(1)
            
            log_debug("Ejecutando comando para obtener token...")
            results = subprocess.run(bashCmdToken, shell=True, stdout=subprocess.PIPE, text=True)
            log_debug(f"Código de salida: {results.returncode}")
            log_debug(f"Respuesta recibida: {results.stdout}")
            
            # Obtener token con manejo de errores
            try:
                token_data = eval(results.stdout)
                token = token_data["access_token"]
                log_debug(f"Token obtenido con eval: {token[:10]}...")
            except Exception as e:
                log_debug(f"Error al procesar token con eval: {str(e)}")
                try:
                    token_data = json.loads(results.stdout)
                    token = token_data.get("access_token", "")
                    if token:
                        log_debug(f"Token obtenido con json: {token[:10]}...")
                    else:
                        log_debug("Error: No se encontró access_token en la respuesta")
                        token = "token-prueba-local"
                except Exception as e2:
                    log_debug(f"Error al procesar token con json: {str(e2)}")
                    token = "token-prueba-local"
            
            log_debug(f"Longitud del token: {len(token)}")

            # Construir parámetros
            parametros = [{"key": "typeOfInformation", "value": str(op_status)}]
            order_parameters = ",".join([f'{{ \\\"key\\\": \\\"{p["key"]}\\\", \\\"value\\\": \\\"{p["value"]}\\\" }}' for p in parametros])
            
            # Comando para cambiar el estado
            bashCmdChangeStatus = f''' curl -k -X POST "https://m2maio.gtm.securitasdirect.local:8243/protom/validationverification-service/sdvecu/v1.0/commands" -H "accept: */*" -H "Content-Type: application/json" -H "Authorization: Bearer {token}" -d "{{ \\\"answerInfo\\\": {{ \\\"answerType\\\": \\\"NONE\\\", \\\"answerURL\\\": \\\"NONE\\\" }}, \\\"device\\\": {{ \\\"country\\\": \\\"{inst['Country']}\\\", \\\"installationNum\\\": \\\"{inst['Installation Number']}\\\" }}, \\\"order\\\": {{ \\\"orderId\\\": \\\"ChangeStatusOfTransmissions\\\", \\\"parameters\\\": [ {order_parameters} ] }}, \\\"processId\\\": \\\"suki\\\", \\\"session\\\": {{ \\\"finalStep\\\": false, \\\"firstStep\\\": true, \\\"persistent\\\": false }} }}" '''
            
            # Versión para mostrar que no incluye el token completo
            log_cmd = bashCmdChangeStatus.replace(token, token[:10] + "..." if len(token) > 10 else token)
            log_debug(f"Comando curl: {log_cmd}")
            
            sleep(1)
            
            # Ejecutar comando para cambiar estado con ambos métodos para comparar
            log_debug("Ejecutando con subprocess.run:")
            result_run = subprocess.run(bashCmdChangeStatus, shell=True, capture_output=True, text=True)
            log_debug(f"Código de salida run: {result_run.returncode}")
            log_debug(f"Salida estándar run: {result_run.stdout}")
            log_debug(f"Salida de error run: {result_run.stderr}")
            
            log_debug("Ejecutando con subprocess.Popen:")
            process = subprocess.Popen(bashCmdChangeStatus, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            stdout, stderr = process.communicate()
            log_debug(f"Código de salida Popen: {process.returncode}")
            log_debug(f"Salida estándar Popen: {stdout}")
            log_debug(f"Salida de error Popen: {stderr}")
            
            print("\nOK Solicitud enviada. Verifica en la plataforma M2M si ha llegado correctamente.\n")
            
            # Incrementar contador de comandos enviados
            total_commands_sent += 1
            
            sleep(2)
            
        if _ < n_iter - 1:
            print("Esperando 60 segundos para el siguiente ciclo...")
            for i in range(60):
                sleep(1)
                # Cada 5 segundos, mostrar tiempo restante
                if i % 5 == 0 and i > 0:
                    print(f"  Tiempo restante: {60-i} segundos...")

    # Al finalizar, mostramos el total de comandos enviados
    print(f"\n===== RESUMEN =====")
    print(f"Total de comandos enviados: {total_commands_sent}")

    # Crear un archivo con el resumen con timestamp
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        summary_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"change_status_summary_{timestamp}.json")
        with open(summary_file, "w", encoding="utf-8") as f:
            json.dump({"total_commands": total_commands_sent, "timestamp": timestamp}, f, ensure_ascii=False, indent=4)
        print(f"Resumen guardado en: {summary_file}")
        
        # También crear una copia con nombre fijo para compatibilidad
        compat_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "change_status_summary.json")
        with open(compat_file, "w", encoding="utf-8") as f:
            json.dump({"total_commands": total_commands_sent, "timestamp": timestamp}, f, ensure_ascii=False, indent=4)
    except Exception as e:
        print(f"Advertencia: No se pudo guardar el archivo de resumen: {str(e)}")

except KeyboardInterrupt:
    print("\nOperación interrumpida por el usuario.")
    sys.exit(0)
except Exception as e:
    print(f"\nError en la ejecución: {e}")
    import traceback
    print(traceback.format_exc())
    sys.exit(1)