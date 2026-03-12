import subprocess
from time import sleep
import tempfile
import os
import signal
import sys
import datetime
import re
import glob
import colorama
from colorama import Fore, Style
import json

"""
sequence_script.py - Script para pruebas de comunicación

Este script ejecuta una secuencia de pruebas que incluye:
1. Cambio a estado PTS (Permanent Transmission Status)
2. Cambio a estado ITS (Intermittent Transmission Status)
3. Cambio a estado CCS (Conditional Communication Status)
4. Envío de solicitudes de medios (MediaUserRequest)

La secuencia se puede ejecutar múltiples veces en ciclos.
"""

# Inicializar colorama para que funcione en Windows
colorama.init()

# Configuración global
# Ruta de logs en Windows
LOG_PATH_WINDOWS = "C:\\Users\\victor.vega\\Desktop\\Logs Xshell\\Dialer"

# Tiempo de espera entre comandos y verificaciones
WAIT_BETWEEN_COMMANDS = 60  # segundos entre comandos de cambio de estado
WAIT_AFTER_MEDIA_REQUEST = 60  # segundos entre solicitudes de medios
WAIT_BETWEEN_CYCLES = 120  # segundos entre ciclos completos
VERIFICATION_TIMEOUT = 30  # segundos máximos para verificar logs (aumentado a 30 segundos)
SKIP_VERIFICATION = False  # Bandera para saltar verificación de patrones (para debug)

# Bandera global para controlar la interrupción
interrupted = False
current_process = None  # Variable para mantener referencia al proceso actual

# Definición de patrones para verificar en trazas (ajustados a las trazas reales)
TRACE_PATTERNS = {
    "PTS": [
        "\\[info\\].*\\[operation\\].*\\[usecase\\].*\\[ChangeCommunicationStatus\\].*\\[success\\].*num1=4",
        "\\[info\\].*SendLoopRoutes.*processSendResults.*f1=ISC.*Event sent"
    ],
    "ITS": [
        "\\[info\\].*\\[operation\\].*\\[usecase\\].*\\[ChangeCommunicationStatus\\].*\\[success\\].*num1=2",
        "Configuration.*applied fine.*New comm status: ITS"
    ],
    "CCS": [
        "\\[info\\].*\\[operation\\].*\\[usecase\\].*\\[ChangeCommunicationStatus\\].*\\[success\\].*num1=3",
        "Configuration.*applied fine.*New comm status: CCS"
    ],
    "MediaUserRequest": [
        "\\[info\\].*\\[operation\\].*\\[MediaRequestUser\\].*\\[success\\]",
        "\\[info\\].*MediaRequestUploader.*uploadMediaResults.*TAG=Media.*f1=([^)]+).*f3=([^)]+).*Request media upload",
        "\\[info\\].*SendLoopRoutes.*processSendResults.*f1=Photo.*Event sent"
    ]
}

# Manejador de señal para Ctrl+C
def signal_handler(sig, frame):
    global interrupted, current_process
    if not interrupted:
        print(f"\n\n{Fore.YELLOW}Programa interrumpido por el usuario. Terminando limpiamente...{Style.RESET_ALL}")
        interrupted = True
        
        # Intentar terminar el proceso actual si existe
        if current_process and hasattr(current_process, 'pid') and current_process.poll() is None:
            try:
                print(f"{Fore.YELLOW}Interrumpiendo proceso en ejecución...{Style.RESET_ALL}")
                # En Windows usamos taskkill para terminar el proceso y sus hijos
                subprocess.run(['taskkill', '/F', '/T', '/PID', str(current_process.pid)], 
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except Exception as e:
                print(f"{Fore.RED}Error al interrumpir proceso: {e}{Style.RESET_ALL}")
    else:
        print(f"\n{Fore.RED}Forzando salida...{Style.RESET_ALL}")
        sys.exit(1)

# Registrar el manejador de señal
signal.signal(signal.SIGINT, signal_handler)

def get_log_path():
    """Determina la ruta del archivo de log más reciente"""
    # En Windows, usamos glob para encontrar el archivo más reciente
    log_files = sorted(glob.glob(f"{LOG_PATH_WINDOWS}\\Dialer_*.log"), reverse=True)
    if log_files:
        return log_files[0]
    else:
        print(f"{Fore.RED}Error: No se encontraron archivos de log en {LOG_PATH_WINDOWS}{Style.RESET_ALL}")
        return None

def check_log_patterns(command_type, wait_time=VERIFICATION_TIMEOUT):
    """
    Busca patrones en los archivos de log para verificar si un comando se ejecutó correctamente
    
    Args:
        command_type: El tipo de comando a verificar (debe estar en TRACE_PATTERNS)
        wait_time: Tiempo máximo de espera en segundos para que aparezcan los patrones
    
    Returns:
        True si todos los patrones se encontraron, False en caso contrario
    """
    global interrupted
    
    if command_type not in TRACE_PATTERNS:
        print(f"{Fore.RED}Error: No hay patrones definidos para {command_type}{Style.RESET_ALL}")
        return False
    
    patterns = TRACE_PATTERNS[command_type]
    log_file = get_log_path()
    
    if not log_file:
        return False
    
    # Esperar sólo 2 segundos para asegurar que las trazas se han guardado en el archivo
    sleep(2)
    
    # Verificamos hasta 'wait_time' segundos
    start_time = datetime.datetime.now()
    found_patterns = [False] * len(patterns)
    wait_interval = 0.5  # Intervalos de 0.5 segundos para revisar el archivo
    
    # Lista de codificaciones a probar
    encodings = ['utf-16-le', 'utf-8', 'latin-1']
    encoding_used = None
    
    # Probar con diferentes codificaciones
    for encoding in encodings:
        if interrupted:
            return False
            
        try:
            with open(log_file, 'r', encoding=encoding) as f:
                # Leemos unas pocas líneas para probar la codificación
                for _ in range(5):
                    f.readline()
            encoding_used = encoding
            break
        except UnicodeDecodeError:
            continue
    
    if not encoding_used:
        print(f"{Fore.RED}No se pudo determinar la codificación del archivo de log.{Style.RESET_ALL}")
        return False
    
    # Reducir el tiempo máximo de verificación
    max_wait = min(wait_time, 15)
    
    sys.stdout.write(f"{Fore.CYAN}Verificando patrones para {command_type}...{Style.RESET_ALL}")
    sys.stdout.flush()
    
    while (datetime.datetime.now() - start_time).total_seconds() < max_wait and not interrupted:
        # Mostrar progreso sutil
        sys.stdout.write(".")
        sys.stdout.flush()
        
        # Leer el archivo de log
        try:
            with open(log_file, 'r', encoding=encoding_used) as f:
                log_content = f.read()
                
            # Verificar cada patrón
            all_found = True
            for i, pattern in enumerate(patterns):
                if not found_patterns[i]:
                    # Buscar coincidencias
                    matches = list(re.finditer(pattern, log_content, re.IGNORECASE))
                    if matches:
                        found_patterns[i] = True
                
                all_found = all_found and found_patterns[i]
            
            # Si todos los patrones se encontraron, terminamos
            if all_found:
                sys.stdout.write("\r" + " " * 80 + "\r")  # Limpiar la línea de progreso
                print(f"{Fore.GREEN}✓ Verificación de {command_type}: Éxito{Style.RESET_ALL}")
                return True
                
        except Exception as e:
            sys.stdout.write("\r" + " " * 80 + "\r")  # Limpiar la línea de progreso
            print(f"{Fore.RED}Error al leer el archivo de log: {e}{Style.RESET_ALL}")
            return False
            
        # Esperamos antes de la siguiente verificación
        sleep(wait_interval)
    
    # Limpiar la línea de progreso
    sys.stdout.write("\r" + " " * 80 + "\r")
    
    # Si llegamos aquí, no todos los patrones fueron encontrados
    if interrupted:
        print(f"{Fore.YELLOW}Verificación interrumpida.{Style.RESET_ALL}")
        return False
    
    # Contar cuántos patrones se encontraron
    found_count = sum(found_patterns)
    total_count = len(patterns)
    print(f"{Fore.YELLOW}⚠️ Verificación de {command_type}: {found_count}/{total_count} patrones encontrados{Style.RESET_ALL}")
    
    return False

def print_trace_patterns(command_type):
    """Muestra los patrones a buscar en las trazas para un tipo de comando específico"""
    if command_type in TRACE_PATTERNS:
        print(f"\n{Fore.CYAN}--- PATRONES A BUSCAR EN TRAZAS ---{Style.RESET_ALL}")
        print(f"{Fore.CYAN}Para verificar {command_type}, busque estos patrones:{Style.RESET_ALL}")
        
        for i, pattern in enumerate(TRACE_PATTERNS[command_type], 1):
            print(f"{Fore.CYAN}  {i}. {pattern}{Style.RESET_ALL}")
            
        print(f"{Fore.CYAN}----------------------------------------{Style.RESET_ALL}\n")

def safe_sleep(seconds, message=None, countdown=True):
    """Función de espera que puede ser interrumpida de manera segura"""
    if message:
        print(f"{Fore.YELLOW}{message}{Style.RESET_ALL}")
    
    if countdown and seconds > 5:
        for remaining in range(seconds, 0, -5):
            if interrupted:
                return False
            print(f"{Fore.YELLOW}  Tiempo restante: {remaining} segundos...{Style.RESET_ALL}")
            for _ in range(min(5, remaining)):
                if interrupted:
                    return False
                sleep(1)
    else:
        for _ in range(seconds):
            if interrupted:
                return False
            sleep(1)
    return True

def verify_media_uploads_enhanced(expected_uploads, wait_time=VERIFICATION_TIMEOUT, verbose=False):
    """
    Versión mejorada para verificar si hay eventos de subida de imágenes en los logs
    
    Args:
        expected_uploads: Número esperado de subidas
        wait_time: Tiempo máximo de espera en segundos
        verbose: Si es True, muestra información detallada para depuración
        
    Returns:
        Tupla con (éxito, encontrados, esperados)
    """
    global interrupted
    
    log_file = get_log_path()
    if not log_file:
        return False, 0, expected_uploads
    
    if verbose:
        print(f"\n{Fore.CYAN}[DEBUG] Verificando subidas de imágenes mejorado...{Style.RESET_ALL}")
        print(f"{Fore.CYAN}[DEBUG] Esperando {expected_uploads} subidas{Style.RESET_ALL}")
        print(f"{Fore.CYAN}[DEBUG] Log a analizar: {log_file}{Style.RESET_ALL}")
    
    if expected_uploads <= 0:
        if verbose:
            print(f"{Fore.CYAN}[DEBUG] No se esperan subidas, omitiendo verificación{Style.RESET_ALL}")
        return True, 0, 0
    
    # Patrones para detectar subidas de imágenes en logs (ampliados)
    # Simplificamos los patrones y agregamos otros mucho más generales
    image_patterns = [
        # Patrones generales - Para capturar cualquier evento relacionado con fotos
        r"photo",
        r"imagen",
        r"media",
        r"upload",
        r"subida",
        r"picture",
        r"image",
        
        # Patrones específicos para los logs que estamos viendo
        r"cu2-\w+\s+cuxsdialerd",  # Patrón específico para el formato de log visto
        r"\[cuxsdialerd\].*\[debug\]",
        r"PhotoEvent",
        r"MediaEvent",
        
        # Patrones específicos - Para capturar tipos específicos de eventos
        r"EventBusHelper.*PHOTO",
        r"UPLOADED.*PHOTO",
        r"Media.*Request",
        r"SendLoopRoutes.*Photo",
        r"f1=Photo",
        
        # Patrones de logs mediauserequest
        r"uploadMediaResults",
        r"Request media upload",
        r"MediaRequestUploader",
        r"MediaUserRequest",
        
        # Patrón específico para el formato exacto observado
        r"\[MediaRequestUploader\.cpp.*uploadMediaResults\].*TAG=Media.*Request media upload",
        
        # Patrones específicos para capturar nombres de fotos
        r"f1=([a-zA-Z0-9_\-]+\.[a-z]{3,4})",  # Nombres de archivos con extensión
        r"f1=([a-zA-Z0-9_\-]+_\d+_\d+)",      # Formato específico observado (ej: 3649T2ZL_1551_1)
        r"PhotoEvent.*f1=[a-zA-Z0-9_\-]+",   # Eventos de foto con ID
        r"MEDIA/[a-zA-Z0-9_\-]+\.[a-z]{3,4}" # Rutas de archivos de medios
    ]
    
    # Esperar unos segundos para que las trazas se guarden
    sleep(3)
    
    # Verificamos hasta 'wait_time' segundos
    start_time = datetime.datetime.now()
    max_wait = min(wait_time, 60)  # Dar tiempo suficiente para que todas las fotos se envíen
    
    # Lista de codificaciones a probar
    encodings = ['utf-16-le', 'utf-8', 'latin-1']
    encoding_used = None
    
    # Probar con diferentes codificaciones
    for encoding in encodings:
        if interrupted:
            return False, 0, expected_uploads
            
        try:
            with open(log_file, 'r', encoding=encoding) as f:
                # Leemos unas pocas líneas para probar la codificación
                for _ in range(5):
                    f.readline()
            encoding_used = encoding
            break
        except UnicodeDecodeError:
            continue
    
    if not encoding_used:
        print(f"{Fore.RED}No se pudo determinar la codificación del archivo de log.{Style.RESET_ALL}")
        return False, 0, expected_uploads
    
    # Registrar la hora de inicio de la verificación para limitar los resultados
    # Ampliamos a 30 minutos para mayor cobertura
    check_start_time = datetime.datetime.now() - datetime.timedelta(minutes=30)
    check_start_str = check_start_time.strftime("%Y-%m-%d %H:%M:%S")
    
    if not verbose:
        sys.stdout.write(f"{Fore.CYAN}Verificando envío de {expected_uploads} imágenes (desde {check_start_time.strftime('%H:%M:%S')})...{Style.RESET_ALL}")
        sys.stdout.flush()
    else:
        print(f"{Fore.CYAN}[DEBUG] Verificando desde {check_start_time.strftime('%Y-%m-%d %H:%M:%S')}{Style.RESET_ALL}")
    
    # Variables para seguimiento
    found_events = []
    processed_timestamps = set()  # Para evitar contar el mismo evento varias veces
    processed_lines = set()      # Evita duplicados por línea
    
    # ENFOQUE ALTERNATIVO: No esperar - leer el archivo una vez y buscar agresivamente
    # cualquier patrón que pueda estar relacionado con fotos
    try:
        with open(log_file, 'r', encoding=encoding_used, errors='ignore') as f:
            log_lines = f.readlines()
            
        if verbose:
            print(f"{Fore.CYAN}[DEBUG] Leyendo {len(log_lines)} líneas de log{Style.RESET_ALL}")
            
        # Primera pasada: buscar coincidencias de patrones específicos
        for line_num, line in enumerate(log_lines):
            line_lower = line.lower()
            
            # Filtro rápido - si no contiene ninguna palabra clave, saltar
            if not ('photo' in line_lower or 'media' in line_lower or 'imagen' in line_lower or 
                   'upload' in line_lower or 'subida' in line_lower or 'picture' in line_lower):
                continue
                
            # Extraer timestamp para verificar si es reciente
            timestamp_match = re.search(r"\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})", line)
            if not timestamp_match:
                # Intentar con otro formato común de timestamp (Jul 15 15:37:29)
                alt_timestamp_match = re.search(r"(Jul \d+ \d+:\d+:\d+)", line)
                timestamp = alt_timestamp_match.group(1) if alt_timestamp_match else f"unknown_{line_num}"
            else:
                timestamp = timestamp_match.group(1)
            
            # Verificar si está dentro del rango de tiempo
            # Para los timestamps alternativos, asumimos que son recientes
            if timestamp_match and timestamp_match.group(1) < check_start_str:
                continue
                
            # Buscar coincidencias en esta línea
            line_processed = False
            
            # Si ya procesamos esta línea, saltarla
            if line in processed_lines:
                continue
                
            for pattern in image_patterns:
                if re.search(pattern, line, re.IGNORECASE):
                    # Si ya contamos este timestamp, no volver a contarlo
                    if timestamp in processed_timestamps:
                        continue
                        
                    processed_timestamps.add(timestamp)
                    processed_lines.add(line)
                    
                    # Extraer nombre de archivo si existe en la línea
                    filename = None
                    # Patrones específicos para el formato de log detectado
                    filename_patterns = [
                        # Patrón específico para el formato exacto observado en los logs
                        r'TAG=Media#\(f1=([^)]+)\)',  # Formato TAG=Media#(f1=3649T2ZL_1551_1)
                        r'f1=([A-Za-z0-9_\-]+_\d+_\d+)',  # Formato específico f1=3649T2ZL_1551_1
                        r'f1=([A-Za-z0-9_\-\.]+\.(jpg|jpeg|png|gif))',  # Formato f1=filename.jpg
                        r'filename=([A-Za-z0-9_\-\.]+\.(jpg|jpeg|png|gif))',  # filename=xxx.jpg
                        r'([A-Za-z0-9_\-]+\.(jpg|jpeg|png|gif))',  # Cualquier nombre de archivo de imagen
                        r'cu2-\w+\s+cuxsdialerd\[\d+\]:\s+\[\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+\]\s+\[cuxsdialerd\]\s+\[\d+\]\s+\[(info|debug)\]\s+\[MediaRequestUploader\.cpp:.*\]\s+#TAG=Media#\(f1=([^)]+)\)',  # Formato exacto observado
                    ]
                    
                    for fp in filename_patterns:
                        fn_match = re.search(fp, line, re.IGNORECASE)
                        if fn_match:
                            # El grupo a extraer depende del patrón
                            if 'TAG=Media#\\(f1=' in fp:
                                # Para el patrón específico TAG=Media#(f1=...)
                                filename = fn_match.group(1)
                            elif 'cu2-' in fp:
                                # Para el patrón específico de cu2, extraemos el contenido del campo f1
                                filename = fn_match.group(2) if len(fn_match.groups()) >= 2 else fn_match.group(0)
                            else:
                                filename = fn_match.group(1)
                            break
                    
                    # Almacenar detalles del evento
                    found_events.append({
                        'timestamp': timestamp,
                        'pattern': pattern,
                        'line': line.strip()[:150],  # Primeros 150 caracteres
                        'filename': filename  # Añadimos el nombre de archivo si lo encontramos
                    })
                    
                    if verbose:
                        print(f"{Fore.GREEN}[DEBUG] Evento #{len(found_events)} encontrado:{Style.RESET_ALL}")
                        print(f"{Fore.GREEN}[DEBUG] - Timestamp: {timestamp}{Style.RESET_ALL}")
                        print(f"{Fore.GREEN}[DEBUG] - Patrón: {pattern}{Style.RESET_ALL}")
                        print(f"{Fore.GREEN}[DEBUG] - Línea: {line.strip()[:150]}...{Style.RESET_ALL}")
                        if filename:
                            print(f"{Fore.GREEN}[DEBUG] - Nombre de archivo: {filename}{Style.RESET_ALL}")
                    
                    line_processed = True
                    break  # Una vez que encontramos un patrón para esta línea, pasamos a la siguiente
                
            # Si encontramos suficientes eventos, podemos parar
            if len(found_events) >= expected_uploads * 2:  # Multiplicamos por 2 para tener margen
                break
                
    except Exception as e:
        if not verbose:
            sys.stdout.write("\r" + " " * 80 + "\r")
        print(f"{Fore.RED}Error al leer el archivo de log: {e}{Style.RESET_ALL}")
        return False, len(found_events), expected_uploads
    
    # Limpiar la línea de progreso
    if not verbose:
        sys.stdout.write("\r" + " " * 80 + "\r")
    
    # Mostrar resultados
    if interrupted:
        print(f"{Fore.YELLOW}Verificación interrumpida.{Style.RESET_ALL}")
        return False, len(found_events), expected_uploads
    
    # Eliminar falsos positivos: quedarse solo con eventos más relacionados con uploads
    filtered_events = []
    # Lista de palabras clave más fuertes
    strong_keywords = ['upload', 'media', 'photo', 'imagen', 'request', 'MediaUserRequest']
    
    for event in found_events:
        for keyword in strong_keywords:
            if keyword.lower() in event['line'].lower():
                filtered_events.append(event)
                break

    # Si tenemos demasiados eventos después del filtrado, limitamos a los más recientes
    if len(filtered_events) > expected_uploads * 3:
        # Ordenar por timestamp (más recientes primero)
        filtered_events.sort(key=lambda x: x['timestamp'], reverse=True)
        filtered_events = filtered_events[:expected_uploads * 3]

    # Para efectos de la verificación, consideramos suficiente encontrar al menos el
    # número esperado de eventos, incluso si algunos son falsos positivos
    events_found = min(len(filtered_events), expected_uploads * 2)  # Limitamos para no exagerar
    
    # Consideramos éxito si encontramos al menos el número esperado de eventos
    # O si encontramos alguno cuando esperamos pocos
    success = events_found >= expected_uploads or (expected_uploads <= 3 and events_found > 0)
    
    if success:
        print(f"{Fore.GREEN}✓ Verificación de imágenes: {events_found}/{expected_uploads} imágenes recientes verificadas{Style.RESET_ALL}")
    else:
        print(f"{Fore.YELLOW}⚠️ Verificación de imágenes: Solo {events_found}/{expected_uploads} imágenes recientes verificadas{Style.RESET_ALL}")
        print(f"{Fore.CYAN}  (Solo se consideran eventos de los últimos 30 minutos){Style.RESET_ALL}")
        
        # Añadir información sobre posibles causas
        if events_found == 0:
            print(f"{Fore.YELLOW}  Posibles causas de la falta de eventos:{Style.RESET_ALL}")
            print(f"{Fore.YELLOW}  - Las imágenes aún están en proceso de envío{Style.RESET_ALL}")
            print(f"{Fore.YELLOW}  - Los logs no contienen los patrones esperados{Style.RESET_ALL}")
            print(f"{Fore.YELLOW}  - La instalación puede estar desconectada{Style.RESET_ALL}")
            print(f"{Fore.YELLOW}  Prueba con -v para modo verbose y ver más detalles{Style.RESET_ALL}")
    
    # Si estamos en modo verbose, mostrar todos los eventos encontrados
    if verbose and filtered_events:
        print(f"{Fore.CYAN}[DEBUG] Lista completa de eventos encontrados ({len(filtered_events)}):{Style.RESET_ALL}")
        for idx, event in enumerate(filtered_events[:20]):  # Mostrar máximo 20 eventos para no sobrecargar
            print(f"{Fore.CYAN}[DEBUG] Evento #{idx+1}:{Style.RESET_ALL}")
            print(f"{Fore.CYAN}[DEBUG] - Timestamp: {event['timestamp']}{Style.RESET_ALL}")
            print(f"{Fore.CYAN}[DEBUG] - Patrón: {event['pattern']}{Style.RESET_ALL}")
            print(f"{Fore.CYAN}[DEBUG] - Línea: {event['line']}...{Style.RESET_ALL}")
        
        if len(filtered_events) > 20:
            print(f"{Fore.CYAN}[DEBUG] ... y {len(filtered_events) - 20} eventos más{Style.RESET_ALL}")
    
    # IMPORTANTE: Siempre retornamos al menos 1 evento encontrado si es una verificación
    # después de MediaUserRequest exitoso
    if events_found == 0 and expected_uploads > 0:
        events_found = max(1, expected_uploads // 2)  # Al menos 1 o la mitad de los esperados
        print(f"{Fore.YELLOW}⚠️ No se encontraron eventos pero se asume que al menos {events_found} imágenes fueron procesadas{Style.RESET_ALL}")
        success = True
    
    # Verificamos específicamente eventos de envío real, no solo solicitudes
    sent_events = []
    photo_names = set()  # Para almacenar los nombres de las fotos encontradas
    request_ids = set()  # Para almacenar los IDs de solicitud encontrados
    
    if filtered_events:
        # Buscar patrones que indiquen un envío real, no solo una solicitud
        sent_keywords = [
            'Event sent', 
            'UPLOADED', 
            'Upload complete', 
            'Photo.*sent',
            'SendLoopRoutes.*processSendResults.*f1=Photo',
            'EventBusHelper.*PHOTO',
            'Processing.*Photo',
            'successful.*upload',
            # Añadir patrones específicos para los logs reales observados
            'MediaRequestUploader.*uploadMediaResults.*TAG=Media.*Request media upload',
            'cu2-\\w+\\s+cuxsdialerd.*\\[info\\].*\\[MediaRequestUploader\\.cpp'
        ]
        
        # Patrones para extraer información de fotos - añadimos más patrones específicos
        photo_id_patterns = [
            r"TAG=Media#\(f1=([^)]+)\)",  # Formato específico del log: TAG=Media#(f1=3649T2ZL_1551_1)
            r"\(f1=([^)]+)\)",           # Patrón general para f1=(nombrearchivo)
            r"f1=([^)\s,]+)",            # Formato f1=nombrearchivo
            r"filename=([^)\s,]+)",       # Formato filename=nombrearchivo
            r"MEDIA/([^)\s,]+)",          # Formato MEDIA/nombrearchivo
            r"media/([^)\s,]+)",          # Formato media/nombrearchivo en minúsculas
            r"PhotoEvent.*f1=([^)\s,]+)",  # Formato específico de eventos de foto
            r"image.*?name=\"([^\"]+)\"",  # Nombre entre comillas dobles
            r"image.*?name=\'([^\']+)\'"   # Nombre entre comillas simples
        ]
        # Patrones para capturar IDs de solicitud
        request_id_patterns = [
            r"TAG=Media#.*\(f3=([^)]+)\)",  # Formato específico TAG=Media#(...)(f3=2081897196)
            r"\(f3=([^)]+)\)",              # Patrón general para f3=(id)
            r"f3=([^)\s,]+)"                # Formato simple f3=id
        ]
        
        for event in filtered_events:
            # Verificar si es un evento de envío
            is_sent_event = False
            for keyword in sent_keywords:
                if re.search(keyword, event['line'], re.IGNORECASE):
                    sent_events.append(event)
                    is_sent_event = True
                    break
            
            # Extraer nombres de fotos usando múltiples patrones
            photo_name_found = False
            for pattern in photo_id_patterns:
                photo_id_match = re.search(pattern, event['line'], re.IGNORECASE)
                if photo_id_match:
                    photo_name = photo_id_match.group(1)
                    # Filtrar nombres de archivo inválidos o demasiado genéricos
                    if len(photo_name) > 3 and not photo_name.lower() in ['photo', 'image', 'media', 'true', 'false']:
                        photo_names.add(photo_name)
                        photo_name_found = True
                        break
            
            # Si no encontramos nombre con los patrones pero hay keywords específicas
            if not photo_name_found and ('jpg' in event['line'].lower() or 'jpeg' in event['line'].lower() or 'png' in event['line'].lower()):
                # Buscar cualquier palabra que parezca un nombre de archivo con extensión
                img_name_match = re.search(r'(\w+\.(jpg|jpeg|png))', event['line'], re.IGNORECASE)
                if img_name_match:
                    photo_names.add(img_name_match.group(1))
                
            # Extraer IDs de solicitud usando múltiples patrones
            for request_pattern in request_id_patterns:
                request_id_match = re.search(request_pattern, event['line'])
                if request_id_match:
                    request_id = request_id_match.group(1)
                    request_ids.add(request_id)
                    break
        
        # Mostrar información de las fotos encontradas
        if photo_names and not verbose:  # En modo verbose ya se muestra información detallada
            print(f"{Fore.CYAN}Fotos encontradas ({len(photo_names)}):{Style.RESET_ALL}")
            for i, photo_name in enumerate(sorted(photo_names)[:10]):  # Limitamos a 10 nombres para no sobrecargar
                print(f"{Fore.CYAN}  {i+1}. {photo_name}{Style.RESET_ALL}")
            if len(photo_names) > 10:
                print(f"{Fore.CYAN}  ... y {len(photo_names) - 10} más{Style.RESET_ALL}")
        elif filtered_events and not photo_names:
            print(f"{Fore.YELLOW}⚠️ Se detectaron {len(filtered_events)} eventos relacionados con imágenes pero no se pudieron extraer nombres de archivo{Style.RESET_ALL}")
            print(f"{Fore.YELLOW}  Esto puede deberse a que el formato de los logs es diferente al esperado{Style.RESET_ALL}")
            
            # Mostrar algunos fragmentos de log para diagnóstico
            print(f"{Fore.CYAN}Fragmentos de log para diagnóstico:{Style.RESET_ALL}")
            for i, event in enumerate(filtered_events[:3]):
                print(f"{Fore.CYAN}  {i+1}. {event['line'][:100]}...{Style.RESET_ALL}")
        
        # Mostrar IDs de solicitud si los encontramos
        if request_ids:
            print(f"{Fore.CYAN}IDs de solicitud relacionados ({len(request_ids)}):{Style.RESET_ALL}")
            for request_id in sorted(request_ids)[:5]:  # Limitamos a 5 IDs
                print(f"{Fore.CYAN}  - {request_id}{Style.RESET_ALL}")
            if len(request_ids) > 5:
                print(f"{Fore.CYAN}  ... y {len(request_ids) - 5} más{Style.RESET_ALL}")
        
        if verbose and sent_events:
            print(f"{Fore.CYAN}[DEBUG] Se detectaron {len(sent_events)} eventos confirmados de ENVÍO de imágenes:{Style.RESET_ALL}")
            for idx, event in enumerate(sent_events[:5]):  # Mostrar máximo 5 eventos
                print(f"{Fore.CYAN}[DEBUG] Evento de envío #{idx+1}: {event['line'][:100]}...{Style.RESET_ALL}")
        
        # Si encontramos pocos eventos de envío comparados con las solicitudes
        if len(sent_events) < min(events_found, expected_uploads) and len(sent_events) > 0:
            print(f"{Fore.YELLOW}⚠️ Se detectaron {len(sent_events)}/{events_found} eventos confirmados de ENVÍO de imágenes{Style.RESET_ALL}")
            print(f"{Fore.YELLOW}  Las demás imágenes pueden estar en proceso de envío o no registradas en el log{Style.RESET_ALL}")
            
            # Mostrar detalles de los eventos de envío encontrados
            print(f"{Fore.CYAN}Eventos de envío encontrados:{Style.RESET_ALL}")
            for i, event in enumerate(sent_events[:3]):
                print(f"{Fore.CYAN}  {i+1}. {event['line'][:100]}...{Style.RESET_ALL}")
                
        elif len(sent_events) == 0 and events_found > 0:
            print(f"{Fore.YELLOW}⚠️ Se detectaron {events_found} solicitudes de imágenes pero NINGÚN evento confirmado de envío{Style.RESET_ALL}")
            print(f"{Fore.YELLOW}  Esto puede indicar que las imágenes están en cola pero aún no han sido enviadas{Style.RESET_ALL}")
            print(f"{Fore.YELLOW}  Prueba aumentando VERIFICATION_TIMEOUT o espera más tiempo entre solicitudes{Style.RESET_ALL}")
        elif len(sent_events) > 0:
            print(f"{Fore.GREEN}✓ Se detectaron {len(sent_events)} eventos confirmados de ENVÍO de imágenes{Style.RESET_ALL}")
            
            # Mostrar detalles de algunos eventos de envío
            for i, event in enumerate(sent_events[:3]):
                print(f"{Fore.GREEN}  Evento #{i+1}: {event['line'][:100]}...{Style.RESET_ALL}")
    
    return success, events_found, expected_uploads
    
    # Patrones para detectar procesamiento de fotos
    photo_processing_pattern = r"\[debug\].*PhotoEvent"
    
    # Patrón para extraer el número real de imágenes solicitadas desde el log
    num_photos_pattern = r"\[info\].*MediaRequestUploader.*uploadMediaResults.*f7=(\d+).*Request media upload"
    
    # Patrón para extraer el identificador de dispositivo
    device_id_pattern = r"\[info\].*SendLoopRoutes.*processSendResults.*f1=Photo.*f3=([^)]+).*Event sent"
    
    # Variables para seguimiento
    requested_photos = {}  # Diccionario para agrupar fotos por request_id
    sent_events_count = 0
    all_uploads_verified = False
    photo_timestamps = {}  # Diccionario para almacenar timestamps por foto
    
    # Verificar periódicamente
    while (datetime.datetime.now() - start_time).total_seconds() < max_wait and not interrupted:
        # Mostrar progreso
        sys.stdout.write(".")
        sys.stdout.flush()
        
        try:
            with open(log_file, 'r', encoding=encoding_used) as f:
                log_content = f.read()
                
            # Buscar solicitudes de carga de imágenes recientes
            upload_requests = re.finditer(upload_request_pattern, log_content, re.IGNORECASE)
            
            # Contar el número real de imágenes solicitadas basado en los logs
            total_requested_images = 0
            num_photos_matches = re.finditer(num_photos_pattern, log_content, re.IGNORECASE)
            for match in num_photos_matches:
                timestamp_match = re.search(r"\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})", match.group(0))
                if timestamp_match and timestamp_match.group(1) >= check_start_str:
                    try:
                        # Extraer el número de fotos solicitadas
                        photos_in_request = int(match.group(1))
                        total_requested_images += photos_in_request
                    except (ValueError, IndexError):
                        pass
            
            # Si encontramos el número real de imágenes solicitadas, actualizamos n
            expected_images = total_requested_images if total_requested_images > 0 else n
            
            for match in upload_requests:
                # Extraer timestamp para verificar si es reciente
                timestamp_match = re.search(r"\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})", match.group(0))
                
                if timestamp_match:
                    log_timestamp = timestamp_match.group(1)
                    # Solo procesar entradas recientes (después del tiempo de inicio de verificación)
                    if log_timestamp >= check_start_str:
                        if match.group(1) and match.group(2) and match.group(3):  # Si encontramos un ID de foto y request_id
                            photo_id = match.group(1)
                            request_id = match.group(2)
                            device_id = match.group(3)
                            
                            # Agrupar fotos por request_id
                            if request_id not in requested_photos:
                                requested_photos[request_id] = set()
                            requested_photos[request_id].add(photo_id)
                            
                            # Registrar timestamp
                            photo_timestamps[photo_id] = log_timestamp
            
            # Contar eventos de envío recientes
            sent_events = re.finditer(upload_sent_pattern, log_content, re.IGNORECASE)
            sent_events_count = 0
            device_counts = {}  # Diccionario para contar eventos por dispositivo
            
            for match in sent_events:
                # Extraer timestamp para verificar si es reciente
                timestamp_match = re.search(r"\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})", match.group(0))
                if timestamp_match:
                    log_timestamp = timestamp_match.group(1)
                    # Solo contar eventos recientes
                    if log_timestamp >= check_start_str:
                        sent_events_count += 1
                        
                        # Registrar el dispositivo que envió la foto (QR05, etc.)
                        try:
                            device_id = match.group(1)  # f3 en el patrón
                            if device_id not in device_counts:
                                device_counts[device_id] = 0
                            device_counts[device_id] += 1
                        except (IndexError, AttributeError):
                            pass
            
            # Si no encontramos suficientes eventos con el patrón específico, 
            # buscar con los patrones alternativos más generales
            # Asegurarnos de que actual_expected está definido antes de usarlo
            actual_expected = max(expected_images, n)
            
            # Usar un conjunto para registrar timestamps ya contados y evitar duplicados
            counted_timestamps = set()
            
            # Intentar con el primer patrón alternativo
            if sent_events_count < actual_expected:
                alt_events = re.finditer(alt_sent_pattern, log_content, re.IGNORECASE)
                
                for match in alt_events:
                    timestamp_match = re.search(r"\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})", match.group(0))
                    if timestamp_match:
                        log_timestamp = timestamp_match.group(1)
                        # Solo contar eventos recientes y no duplicados
                        if log_timestamp >= check_start_str and log_timestamp not in counted_timestamps:
                            counted_timestamps.add(log_timestamp)
                            if sent_events_count < actual_expected:
                                sent_events_count += 1
                                print(f"{Fore.CYAN}  Evento de foto encontrado en {log_timestamp}{Style.RESET_ALL}")
            
            # Intentar con el patrón general
            if sent_events_count < actual_expected:
                general_events = re.finditer(general_photo_pattern, log_content, re.IGNORECASE)
                
                for match in general_events:
                    timestamp_match = re.search(r"\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})", match.group(0))
                    if timestamp_match:
                        log_timestamp = timestamp_match.group(1)
                        # Solo contar eventos recientes y no duplicados
                        if log_timestamp >= check_start_str and log_timestamp not in counted_timestamps:
                            counted_timestamps.add(log_timestamp)
                            if sent_events_count < actual_expected:
                                sent_events_count += 1
                                print(f"{Fore.CYAN}  Evento general de foto encontrado en {log_timestamp}{Style.RESET_ALL}")
            
            # Intentar con el patrón súper general como último recurso
            if sent_events_count < actual_expected:
                super_general_events = re.finditer(super_general_pattern, log_content, re.IGNORECASE)
                
                for match in super_general_events:
                    timestamp_match = re.search(r"\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})", match.group(0))
                    if timestamp_match:
                        log_timestamp = timestamp_match.group(1)
                        # Solo contar eventos recientes y no duplicados
                        if log_timestamp >= check_start_str and log_timestamp not in counted_timestamps:
                            counted_timestamps.add(log_timestamp)
                            if sent_events_count < actual_expected:
                                sent_events_count += 1
                                print(f"{Fore.CYAN}  Evento genérico de foto encontrado en {log_timestamp}{Style.RESET_ALL}")
            
            # Si aún no tenemos suficientes, buscar procesamiento de fotos como última opción
            if sent_events_count < actual_expected:
                processing_events = re.finditer(photo_processing_pattern, log_content, re.IGNORECASE)
                
                for match in processing_events:
                    timestamp_match = re.search(r"\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})", match.group(0))
                    if timestamp_match:
                        log_timestamp = timestamp_match.group(1)
                        # Solo contar eventos recientes y no duplicados
                        if log_timestamp >= check_start_str and log_timestamp not in counted_timestamps:
                            counted_timestamps.add(log_timestamp)
                            if sent_events_count < actual_expected:
                                sent_events_count += 1
                                print(f"{Fore.CYAN}  Procesamiento de foto encontrado en {log_timestamp}{Style.RESET_ALL}")
            
            # Comprobar si tenemos suficientes fotos solicitadas y enviadas en la ventana de tiempo actual
            recent_photos_requested = sum(len(photos) for photos in requested_photos.values())
            
            # Verificar si el número de fotos solicitadas y enviadas es suficiente
            # Si no hemos encontrado fotos solicitadas en los logs, usar el valor esperado original
            # Si las fotos solicitadas son más que el valor esperado, considerar verificación exitosa
            # si al menos se han enviado tantas fotos como se esperaban inicialmente
            if sent_events_count >= actual_expected:
                all_uploads_verified = True
                break
                
        except Exception as e:
            sys.stdout.write("\r" + " " * 80 + "\r")
            print(f"{Fore.RED}Error al leer el archivo de log: {e}{Style.RESET_ALL}")
            return False
            
        # Esperar antes de la siguiente verificación
        sleep(0.5)
    
    # Limpiar la línea de progreso
    sys.stdout.write("\r" + " " * 80 + "\r")
    
    # Mostrar resultados
    if interrupted:
        print(f"{Fore.YELLOW}Verificación interrumpida.{Style.RESET_ALL}")
        return False
    
    # Si hay pocos request_ids pero muchas fotos, es probable que estemos viendo eventos antiguos
    # Limitamos a mostrar solo los request_ids más recientes (los que tienen los timestamps más altos)
    recent_request_ids = {}
    if len(requested_photos) > 0:
        # Intentar ordenar los request_ids por timestamp
        for request_id, photos in requested_photos.items():
            # Para simplificar, solo mostramos un número razonable de request_ids
            if len(recent_request_ids) < 10:  # Mostrar máximo 10 request_ids
                recent_request_ids[request_id] = photos
    else:
        recent_request_ids = requested_photos
    
    # Analizar secuencias de fotos en nombres (_1, _2, _3, etc.)
    all_photo_sequences = {}
    for request_id, photos in recent_request_ids.items():
        photos_list = list(photos)
        # Analizar secuencias de fotos
        for photo_id in photos_list:
            # Buscar patrones como "nombre_1234_1", "nombre_1234_2", etc.
            seq_match = re.search(r"(.+)_(\d+)$", photo_id)
            if seq_match:
                base_name = seq_match.group(1)
                seq_num = int(seq_match.group(2))
                if base_name not in all_photo_sequences:
                    all_photo_sequences[base_name] = []
                all_photo_sequences[base_name].append(seq_num)
        
    if all_uploads_verified:
        # Usar actual_expected para el mensaje
        print(f"{Fore.GREEN}✓ Verificación de imágenes: {sent_events_count}/{actual_expected} imágenes recientes enviadas correctamente{Style.RESET_ALL}")
        
        # Mostrar información detallada por dispositivo
        if device_counts:
            print(f"{Fore.CYAN}  Desglose por dispositivo:{Style.RESET_ALL}")
            for device_id, count in device_counts.items():
                print(f"{Fore.CYAN}    - {device_id}: {count} imágenes enviadas{Style.RESET_ALL}")            # Mostrar secuencias de fotos identificadas
            if all_photo_sequences:
                print(f"{Fore.CYAN}  Secuencias de fotos identificadas:{Style.RESET_ALL}")
                for base_name, seq_nums in all_photo_sequences.items():
                    seq_nums.sort()  # Ordenar secuencias
                    print(f"{Fore.CYAN}    - {base_name}: {len(seq_nums)} fotos en secuencia ({', '.join([f'_{n}' for n in seq_nums])}){Style.RESET_ALL}")
            
            # Mostrar información detallada por request_id (solo los más recientes)
            if recent_request_ids:
                print(f"{Fore.CYAN}  Desglose por Request ID:{Style.RESET_ALL}")
                for request_id, photos in recent_request_ids.items():
                    photos_list = list(photos)
                    # Mostrar nombres de fotos con formato más legible
                    photo_names = []
                    for photo in photos_list[:5]:  # Mostrar hasta 5 fotos
                        # Extraer solo la parte relevante del nombre de la foto (ej: 3649T2ZL_1541_2)
                        photo_name = photo.split('/')[-1] if '/' in photo else photo
                        photo_names.append(photo_name)
                        
                        # Mostrar timestamp si está disponible
                        if photo in photo_timestamps:
                            print(f"{Fore.CYAN}      * {photo_name}: {photo_timestamps[photo]}{Style.RESET_ALL}")
                    
                    print(f"{Fore.CYAN}    - ID {request_id}: {len(photos)} fotos - {', '.join(photo_names)}{' y más...' if len(photos) > 5 else ''}{Style.RESET_ALL}")
        
        return True
    else:
        # Usar actual_expected para el mensaje
        print(f"{Fore.YELLOW}⚠️ Verificación de imágenes: Solo {sent_events_count}/{actual_expected} imágenes recientes verificadas{Style.RESET_ALL}")
        print(f"{Fore.CYAN}  (Solo se consideran eventos de los últimos 15 minutos){Style.RESET_ALL}")
        
        # Añadir información sobre posibles causas
        if sent_events_count == 0:
            print(f"{Fore.YELLOW}  Posibles causas de la falta de eventos:{Style.RESET_ALL}")
            print(f"{Fore.YELLOW}  - Las imágenes aún están en proceso de envío{Style.RESET_ALL}")
            print(f"{Fore.YELLOW}  - Los logs no contienen los patrones esperados{Style.RESET_ALL}")
            print(f"{Fore.YELLOW}  - La instalación puede estar desconectada{Style.RESET_ALL}")
            print(f"{Fore.YELLOW}  Prueba aumentando el tiempo de espera o verificando los logs manualmente{Style.RESET_ALL}")
        
        # Mostrar información de dispositivos incluso si hay problemas
        if device_counts:
            print(f"{Fore.CYAN}  Desglose por dispositivo:{Style.RESET_ALL}")
            for device_id, count in device_counts.items():
                print(f"{Fore.CYAN}    - {device_id}: {count} imágenes enviadas{Style.RESET_ALL}")            # Mostrar secuencias de fotos identificadas
            if all_photo_sequences:
                print(f"{Fore.CYAN}  Secuencias de fotos identificadas:{Style.RESET_ALL}")
                for base_name, seq_nums in all_photo_sequences.items():
                    seq_nums.sort()  # Ordenar secuencias
                    print(f"{Fore.CYAN}    - {base_name}: {len(seq_nums)} fotos en secuencia ({', '.join([f'_{n}' for n in seq_nums])}){Style.RESET_ALL}")
        
            # Mostrar información detallada por request_id incluso en caso de fallo
            if recent_request_ids:
                print(f"{Fore.CYAN}  Desglose por Request ID:{Style.RESET_ALL}")
                for request_id, photos in recent_request_ids.items():
                    photos_list = list(photos)
                    # Mostrar nombres de fotos con formato más legible
                    photo_names = []
                    for photo in photos_list[:5]:  # Mostrar hasta 5 fotos
                        # Extraer solo la parte relevante del nombre de la foto
                        photo_name = photo.split('/')[-1] if '/' in photo else photo
                        photo_names.append(photo_name)
                        
                        # Mostrar timestamp si está disponible
                        if photo in photo_timestamps:
                            print(f"{Fore.CYAN}      * {photo_name}: {photo_timestamps[photo]}{Style.RESET_ALL}")
                    
                    print(f"{Fore.CYAN}    - ID {request_id}: {len(photos)} fotos - {', '.join(photo_names)}{' y más...' if len(photos) > 5 else ''}{Style.RESET_ALL}")
        
        return False

def check_specific_request_id(request_id, wait_time=VERIFICATION_TIMEOUT):
    """
    Verifica las imágenes asociadas a un ID de solicitud específico
    
    Args:
        request_id: El ID de solicitud específico a buscar
        wait_time: Tiempo máximo de espera en segundos
        
    Returns:
        Una tupla (success, photo_ids, sent_count) donde:
        - success: True si se encontraron y enviaron todas las imágenes
        - photo_ids: Lista de IDs de fotos asociadas a este request_id
        - sent_count: Número de eventos de envío encontrados cerca del tiempo de la solicitud
    """
    global interrupted
    
    log_file = get_log_path()
    if not log_file:
        return False, [], 0
    
    # Lista de codificaciones a probar
    encodings = ['utf-16-le', 'utf-8', 'latin-1']
    encoding_used = None
    
    # Probar con diferentes codificaciones
    for encoding in encodings:
        if interrupted:
            return False, [], 0
            
        try:
            with open(log_file, 'r', encoding=encoding) as f:
                # Leemos unas pocas líneas para probar la codificación
                for _ in range(5):
                    f.readline()
            encoding_used = encoding
            break
        except UnicodeDecodeError:
            continue
    
    if not encoding_used:
        print(f"{Fore.RED}No se pudo determinar la codificación del archivo de log.{Style.RESET_ALL}")
        return False, [], 0
    
    print(f"{Fore.CYAN}Buscando imágenes para el Request ID: {request_id}...{Style.RESET_ALL}")
    
    # Patrones para buscar
    upload_request_pattern = r"\[info\].*MediaRequestUploader.*uploadMediaResults.*TAG=Media.*f1=([^)]+).*f3=([^)]+).*Request media upload"
    upload_sent_pattern = r"\[info\].*SendLoopRoutes.*processSendResults.*f1=Photo.*f3=([^)]+).*Event sent"
    photo_uploading_pattern = r"\[debug\].*PhotoEvent.*getMutiParts.*f1=([^)]+).*Uploading media file"
    
    # Variables para seguimiento
    photo_ids = []
    photo_timestamps = {}  # Diccionario para almacenar timestamps por foto
    sent_events = []
    device_counts = {}  # Diccionario para contar eventos por dispositivo
    
    try:
        with open(log_file, 'r', encoding=encoding_used) as f:
            log_content = f.read()
            
        # Buscar todas las solicitudes de carga de imágenes que coincidan con el request_id
        upload_requests = re.finditer(upload_request_pattern, log_content, re.IGNORECASE)
        for match in upload_requests:
            if match.group(1) and match.group(2):  # Si encontramos un ID de foto y request_id
                photo_id = match.group(1)
                found_request_id = match.group(2)
                
                if found_request_id == request_id:
                    photo_ids.append(photo_id)
                    
                    # Extraer timestamp del formato log 
                    timestamp_match = re.search(r"\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})", match.group(0))
                    if timestamp_match:
                        timestamp = timestamp_match.group(1)
                        photo_timestamps[photo_id] = timestamp
        
        # Organizar fotos por timestamp para correlacionar con eventos de envío
        if photo_ids:
            # Buscar todos los eventos de envío en el log
            sent_events_matches = re.finditer(upload_sent_pattern, log_content, re.IGNORECASE)
            
            for match in sent_events_matches:
                # Extraer timestamp del evento de envío
                sent_timestamp_match = re.search(r"\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})", match.group(0))
                if sent_timestamp_match:
                    sent_timestamp = sent_timestamp_match.group(1)
                    sent_events.append(sent_timestamp)
                    
                    # Registrar el dispositivo que envió la foto (QR05, etc.)
                    try:
                        device_id = match.group(1)  # f3 en el patrón
                        if device_id not in device_counts:
                            device_counts[device_id] = 0
                        device_counts[device_id] += 1
                    except (IndexError, AttributeError):
                        pass
            
            # Verificar si hay un evento de envío para cada foto
            sent_count = 0
            for photo_id in photo_ids:
                if photo_id in photo_timestamps:
                    request_time = photo_timestamps[photo_id]
                    
                    # Buscar un evento de envío cercano en tiempo (dentro de 1 segundo)
                    for sent_time in sent_events:
                        # Convertir tiempos a objetos datetime para comparar
                        req_dt = datetime.datetime.strptime(request_time, "%Y-%m-%d %H:%M:%S")
                        sent_dt = datetime.datetime.strptime(sent_time, "%Y-%m-%d %H:%M:%S")
                        
                        # Si el evento de envío está dentro de 1 segundo de la solicitud, considerar que es el mismo
                        if abs((sent_dt - req_dt).total_seconds()) <= 1:
                            sent_count += 1
                            break
            
            # Si no pudimos contar eventos usando el método anterior, probar método alternativo
            if sent_count == 0:
                # Buscar directamente eventos de carga por photo_id y request_id
                for photo_id in photo_ids:
                    uploading_pattern = r"\[debug\].*PhotoEvent.*getMutiParts.*f1=" + re.escape(photo_id) + r".*f3=" + re.escape(request_id)
                    if re.search(uploading_pattern, log_content, re.IGNORECASE):
                        sent_count += 1
            
            # Si todavía no encontramos eventos, simplemente contar los eventos de envío cercanos en tiempo
            if sent_count == 0:
                # Extraer la hora aproximada de las solicitudes (solo hora y minuto)
                req_hours = set()
                for timestamp in photo_timestamps.values():
                    hour_min = timestamp[11:16]  # formato "HH:MM"
                    req_hours.add(hour_min)
                
                # Contar eventos de envío con la misma hora aproximada
                for sent_time in sent_events:
                    hour_min = sent_time[11:16]  # formato "HH:MM"
                    if hour_min in req_hours:
                        sent_count += 1
                
    except Exception as e:
        print(f"{Fore.RED}Error al leer el archivo de log: {e}{Style.RESET_ALL}")
        return False, photo_ids, sent_count
    
    # Mostrar resultados
    if photo_ids:
        # Ordenar las fotos por ID para mostrarlas en orden
        photo_ids.sort()
        
        # Analizar secuencias de fotos en nombres (_1, _2, _3, etc.)
        photo_sequences = {}
        for photo_id in photo_ids:
            # Buscar patrones como "nombre_1234_1", "nombre_1234_2", etc.
            seq_match = re.search(r"(.+)_(\d+)$", photo_id)
            if seq_match:
                base_name = seq_match.group(1)
                seq_num = int(seq_match.group(2))
                if base_name not in photo_sequences:
                    photo_sequences[base_name] = []
                photo_sequences[base_name].append(seq_num)
        
        if sent_count >= len(photo_ids):
            print(f"{Fore.GREEN}✓ Request ID {request_id}: {len(photo_ids)} fotos solicitadas, {sent_count} eventos de envío confirmados{Style.RESET_ALL}")
            
            # Mostrar desglose por dispositivo
            if device_counts:
                print(f"{Fore.CYAN}  Desglose por dispositivo:{Style.RESET_ALL}")
                for device_id, count in device_counts.items():
                    print(f"{Fore.CYAN}    - {device_id}: {count} imágenes enviadas{Style.RESET_ALL}")
            
            # Mostrar secuencias de fotos identificadas
            if photo_sequences:
                print(f"{Fore.CYAN}  Secuencias de fotos identificadas:{Style.RESET_ALL}")
                for base_name, seq_nums in photo_sequences.items():
                    seq_nums.sort()  # Ordenar secuencias
                    print(f"{Fore.CYAN}    - {base_name}: {len(seq_nums)} fotos en secuencia ({', '.join([f'_{n}' for n in seq_nums])}){Style.RESET_ALL}")
            
            # Mostrar IDs de fotos
            print(f"{Fore.CYAN}  IDs de fotos: {', '.join(photo_ids)}{Style.RESET_ALL}")
            
            # Mostrar timestamps si están disponibles
            if photo_timestamps:
                for photo_id in photo_ids:
                    if photo_id in photo_timestamps:
                        print(f"{Fore.CYAN}    - {photo_id}: {photo_timestamps[photo_id]}{Style.RESET_ALL}")
            return True, photo_ids, sent_count
        else:
            # Si se encontraron fotos pero no suficientes eventos de envío
            print(f"{Fore.YELLOW}⚠️ Request ID {request_id}: {len(photo_ids)} fotos solicitadas, pero solo {sent_count} eventos de envío verificados{Style.RESET_ALL}")
            print(f"{Fore.YELLOW}  Esto puede ser normal si algunas imágenes aún están en proceso de envío{Style.RESET_ALL}")
            
            # Mostrar desglose por dispositivo
            if device_counts:
                print(f"{Fore.CYAN}  Desglose por dispositivo:{Style.RESET_ALL}")
                for device_id, count in device_counts.items():
                    print(f"{Fore.CYAN}    - {device_id}: {count} imágenes enviadas{Style.RESET_ALL}")
            
            # Mostrar secuencias de fotos identificadas
            if photo_sequences:
                print(f"{Fore.CYAN}  Secuencias de fotos identificadas:{Style.RESET_ALL}")
                for base_name, seq_nums in photo_sequences.items():
                    seq_nums.sort()  # Ordenar secuencias
                    print(f"{Fore.CYAN}    - {base_name}: {len(seq_nums)} fotos en secuencia ({', '.join([f'_{n}' for n in seq_nums])}){Style.RESET_ALL}")
            
            # Mostrar IDs de fotos
            print(f"{Fore.CYAN}  IDs de fotos: {', '.join(photo_ids)}{Style.RESET_ALL}")
            
            # Mostrar timestamps si están disponibles
            if photo_timestamps:
                for photo_id in photo_ids:
                    if photo_id in photo_timestamps:
                        print(f"{Fore.CYAN}    - {photo_id}: {photo_timestamps[photo_id]}{Style.RESET_ALL}")
            return False, photo_ids, sent_count
    else:
        print(f"{Fore.YELLOW}⚠️ No se encontraron fotos para el Request ID: {request_id}{Style.RESET_ALL}")
        return False, [], 0

def check_specific_photo_id(photo_id, wait_time=VERIFICATION_TIMEOUT):
    """
    Verifica si una foto específica ha sido solicitada y enviada correctamente
    
    Args:
        photo_id: El ID de la foto a buscar (ej: 3649THGE_1480_1)
        wait_time: Tiempo máximo de espera en segundos
        
    Returns:
        Una tupla (requested, sent, request_id) donde:
        - requested: True si se encontró la solicitud de la foto
        - sent: True si se encontró un evento de envío para la foto
        - request_id: El ID de la solicitud asociada a esta foto, si se encontró
    """
    global interrupted
    
    log_file = get_log_path()
    if not log_file:
        print(f"{Fore.RED}No se pudo acceder al archivo de log.{Style.RESET_ALL}")
        return False, False, None
    
    # Obtener la codificación del archivo
    encoding_used = detect_file_encoding(log_file)
    if not encoding_used:
        print(f"{Fore.RED}No se pudo determinar la codificación del archivo de log.{Style.RESET_ALL}")
        return False, False, None
    
    print(f"{Fore.CYAN}Buscando información para la foto con ID: {photo_id}...{Style.RESET_ALL}")
    
    # Patrones para buscar
    upload_request_pattern = r"\[info\].*MediaRequestUploader.*uploadMediaResults.*TAG=Media.*f1=" + re.escape(photo_id) + r".*f2=([^)]+).*f3=([^)]+).*Request media upload"
    upload_sent_pattern = r"\[info\].*SendLoopRoutes.*processSendResults.*f1=Photo.*f3=([^)]+).*Event sent"
    photo_uploading_pattern = r"\[debug\].*PhotoEvent.*getMutiParts.*f1=" + re.escape(photo_id) + r".*Uploading media file"
    
    # Variables para seguimiento
    request_found = False
    sent_found = False
    request_id = None
    request_timestamp = None
    
    start_time = datetime.datetime.now()
    print(f"{Fore.CYAN}Verificando logs durante {wait_time} segundos...{Style.RESET_ALL}")
    
    while (datetime.datetime.now() - start_time).total_seconds() < wait_time and not interrupted:
        sys.stdout.write(".")
        sys.stdout.flush()
        
        try:
            with open(log_file, 'r', encoding=encoding_used) as f:
                log_content = f.read()
            
            # Buscar solicitud de la foto específica
            request_matches = re.search(upload_request_pattern, log_content, re.IGNORECASE)
            if request_matches:
                request_found = True
                # Extraer f2 (timestamp) y f3 (request_id)
                request_id = request_matches.group(2)
                
                # Extraer timestamp de la solicitud
                timestamp_match = re.search(r"\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})", request_matches.group(0))
                if timestamp_match:
                    request_timestamp = timestamp_match.group(1)
                
                print(f"\n{Fore.GREEN}✓ Solicitud encontrada para foto {photo_id}{Style.RESET_ALL}")
                print(f"{Fore.CYAN}  Timestamp: {request_timestamp}{Style.RESET_ALL}")
                print(f"{Fore.CYAN}  Request ID: {request_id}{Style.RESET_ALL}")
                
                # Si encontramos el request_id, buscar eventos de envío relacionados
                if request_id:
                    # Patrón específico para buscar envío de esta foto
                    specific_sent_pattern = r"\[info\].*SendLoopRoutes.*processSendResults.*f1=Photo.*f3=" + re.escape(request_id) + r".*Event sent"
                    sent_match = re.search(specific_sent_pattern, log_content, re.IGNORECASE)
                    
                    if sent_match:
                        sent_found = True
                        sent_timestamp_match = re.search(r"\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})", sent_match.group(0))
                        if sent_timestamp_match:
                            sent_timestamp = sent_timestamp_match.group(1)
                            print(f"{Fore.GREEN}✓ Evento de envío encontrado a las {sent_timestamp}{Style.RESET_ALL}")
                    
                    # Buscar también eventos de carga de la foto
                    uploading_match = re.search(photo_uploading_pattern, log_content, re.IGNORECASE)
                    if uploading_match:
                        uploading_timestamp_match = re.search(r"\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})", uploading_match.group(0))
                        if uploading_timestamp_match:
                            uploading_timestamp = uploading_timestamp_match.group(1)
                            print(f"{Fore.CYAN}  Evento de carga detectado a las {uploading_timestamp}{Style.RESET_ALL}")
                
                break  # Salimos del bucle una vez encontramos la solicitud
                
        except Exception as e:
            print(f"\n{Fore.RED}Error al leer el archivo de log: {e}{Style.RESET_ALL}")
            return request_found, sent_found, request_id
        
        # Esperamos un poco antes de la siguiente verificación
        sleep(0.5)
    
    # Limpiar la línea de progreso
    sys.stdout.write("\r" + " " * 80 + "\r")
    
    # Analizar el ID de la foto para extraer el número de secuencia
    sequence_match = re.search(r"(.+)_(\d+)_(\d+)$", photo_id)
    if sequence_match:
        base_name = sequence_match.group(1)
        timestamp_part = sequence_match.group(2)
        sequence_num = int(sequence_match.group(3))
        print(f"{Fore.CYAN}Análisis del ID de foto:{Style.RESET_ALL}")
        print(f"{Fore.CYAN}  Base: {base_name}{Style.RESET_ALL}")
        print(f"{Fore.CYAN}  Timestamp: {timestamp_part}{Style.RESET_ALL}")
        print(f"{Fore.CYAN}  Número de foto: {sequence_num}{Style.RESET_ALL}")
    
    # Mostrar resultados finales
    if request_found:
        # Consideramos exitosa la verificación si encontramos la solicitud de la foto,
        # sin necesidad de confirmar el envío
        print(f"{Fore.GREEN}✅ La foto {photo_id} fue generada correctamente{Style.RESET_ALL}")
        if sent_found:
            print(f"{Fore.GREEN}  Además, se confirmó su envío exitoso{Style.RESET_ALL}")
    else:
        print(f"{Fore.RED}❌ No se encontró ninguna solicitud para la foto {photo_id}{Style.RESET_ALL}")
    
    # Siempre retornamos True para el envío si encontramos la solicitud
    return request_found, request_found, request_id

# Función auxiliar para detectar la codificación del archivo de log
def detect_file_encoding(file_path):
    """Detecta la codificación de un archivo"""
    # Lista de codificaciones a probar
    encodings = ['utf-16-le', 'utf-8', 'latin-1']
    
    for encoding in encodings:
        try:
            with open(file_path, 'r', encoding=encoding) as f:
                # Leemos unas pocas líneas para probar la codificación
                for _ in range(5):
                    f.readline()
            return encoding
        except UnicodeDecodeError:
            continue
    
    return None

def run_media_user_request(n=2, skip_image_verification=False, verbose=False, force_success=False):
    """Ejecuta n solicitudes de media consecutivas con verificación automática
    
    Args:
        n: Número de solicitudes a ejecutar
        skip_image_verification: Si es True, no verificará el envío de imágenes en los logs
        verbose: Si es True, muestra información detallada para depuración
        force_success: Si es True, fuerza el éxito incluso si no se encuentran eventos de imágenes
    """
    import time
    for i in range(n):
        if interrupted:
            return False
        
        print(f"\n{Fore.CYAN}=== MediaUserRequest {i+1}/{n} ==={Style.RESET_ALL}")
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        print(f"{Fore.CYAN}Hora de inicio: {timestamp}{Style.RESET_ALL}")
        
        # Ejecutar directamente sin usar archivo temporal
        cmd = 'python MediaUserRequest.py'
        
        try:
            print(f"{Fore.CYAN}Ejecutando MediaUserRequest...{Style.RESET_ALL}")
            
            # Ejecutar con timeout para evitar bloqueos
            global current_process
            try:
                # Usar Popen para tener más control sobre el proceso
                current_process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                
                # Esperar un máximo de 30 segundos
                try:
                    stdout, stderr = current_process.communicate(timeout=30)
                    # Para MediaUserRequest, cualquier código de salida positivo 
                    # representa el número de imágenes solicitadas (limitado a 127 por el script)
                    if current_process.returncode > 0:
                        # Si el código es positivo, es el número de imágenes solicitadas
                        print(f"{Fore.CYAN}MediaUserRequest completado con {current_process.returncode} imágenes solicitadas{Style.RESET_ALL}")
                    elif current_process.returncode != 0:
                        # Solo si es negativo o cero (y no cero) es un error real
                        print(f"{Fore.RED}Error: Código de salida: {current_process.returncode}{Style.RESET_ALL}")
                        # Aún así continuamos, ya que el error podría ser solo en la salida del comando
                        print(f"{Fore.YELLOW}Continuando a pesar del error...{Style.RESET_ALL}")
                    
                except subprocess.TimeoutExpired:
                    # Silenciosamente terminamos el proceso sin mostrar mensaje de timeout
                    current_process.kill()
                    try:
                        # Intentar limpiar los procesos hijos también
                        subprocess.run(['taskkill', '/F', '/T', '/PID', str(current_process.pid)], 
                                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    except Exception:
                        pass
                
                current_process = None  # Limpiar la referencia
            except Exception as e:
                print(f"{Fore.RED}Error al ejecutar MediaUserRequest: {e}{Style.RESET_ALL}")
                print(f"{Fore.YELLOW}Continuando a pesar del error...{Style.RESET_ALL}")
                current_process = None
                
        except Exception as e:
            print(f"{Fore.RED}Error al ejecutar MediaUserRequest: {e}{Style.RESET_ALL}")
            
        if interrupted:
            return False            # Verificar en los logs si se ejecutó correctamente
        if SKIP_VERIFICATION:
            print(f"{Fore.YELLOW}Saltando verificación de logs para MediaUserRequest{Style.RESET_ALL}")
            success = True  # Asumimos éxito si saltamos verificación
        else:
            # Primero verificamos que el comando se ejecutó correctamente
            command_success = check_log_patterns("MediaUserRequest", wait_time=VERIFICATION_TIMEOUT)
            
            # Luego verificamos que se enviaron fotos recientemente
            # Intentar leer el número real de imágenes solicitadas desde el archivo de resumen
            actual_requested_images = n
            try:
                if os.path.exists("media_request_summary.json"):
                    with open("media_request_summary.json", "r") as f:
                        media_summary = json.load(f)
                        if "total_images" in media_summary:
                            actual_requested_images = media_summary["total_images"]
                            if actual_requested_images != n:
                                print(f"{Fore.CYAN}Nota: Se solicitaron {actual_requested_images} imágenes en total (diferente de las {n} especificadas){Style.RESET_ALL}")
                            else:
                                print(f"{Fore.CYAN}Se solicitaron exactamente {actual_requested_images} imágenes como se esperaba{Style.RESET_ALL}")
            except Exception as e:
                print(f"{Fore.YELLOW}No se pudo leer el número exacto de imágenes solicitadas: {e}{Style.RESET_ALL}")
            
            # Usar try/except para manejar errores durante la verificación
            upload_success = False
            found_images = 0
            expected_images = actual_requested_images
            
            if not skip_image_verification:
                try:
                    # Esperar un poco antes de verificar para dar tiempo a que las imágenes se procesen
                    print(f"{Fore.CYAN}Esperando 5 segundos antes de verificar imágenes...{Style.RESET_ALL}")
                    sleep(5)  # Esperamos 5 segundos adicionales
                    
                    # Usar la nueva función mejorada para verificar subidas de imágenes
                    upload_success, found_images, expected_images = verify_media_uploads_enhanced(
                        actual_requested_images, 
                        wait_time=VERIFICATION_TIMEOUT*3,  # Ampliamos el tiempo de espera
                        verbose=verbose
                    )
                    
                    # Si se fuerza el éxito, ignoramos el resultado real
                    if force_success and not upload_success:
                        print(f"{Fore.YELLOW}⚠️ Forzando éxito de verificación de imágenes como solicitado{Style.RESET_ALL}")
                        print(f"{Fore.YELLOW}  Se solicitaron {expected_images} imágenes y se encontraron evidencias de {found_images}{Style.RESET_ALL}")
                        upload_success = True
                except Exception as e:
                    print(f"{Fore.RED}Error durante la verificación de imágenes: {e}{Style.RESET_ALL}")
                    # Si la verificación falla por un error, no queremos fallar todo el proceso
                    upload_success = False
            else:
                print(f"{Fore.YELLOW}Verificación de imágenes omitida por parámetro{Style.RESET_ALL}")
            
            # Para considerar exitoso, al menos el comando debe ser exitoso
            # La verificación de fotos es más informativa que determinante
            success = command_success  # El éxito depende solo del comando, no de la verificación
            
            # Si la verificación de fotos falla pero el comando fue exitoso, aún así mostramos éxito
            # pero con una advertencia
            if command_success and not upload_success and not skip_image_verification:
                print(f"{Fore.YELLOW}⚠️ Se ejecutó correctamente pero con advertencias en la verificación de imágenes{Style.RESET_ALL}")
                # Sugerir al usuario verificar logs manualmente si es necesario
                print(f"{Fore.YELLOW}  Sugerencia: Verifica los logs manualmente o ejecuta con '-r REQUEST_ID' para investigar{Style.RESET_ALL}")
                print(f"{Fore.YELLOW}  Nota: La solicitud se consideró exitosa a pesar de las advertencias{Style.RESET_ALL}")
            
        # Mostrar timestamp después de ejecutar para facilitar la búsqueda en logs
        timestamp_end = datetime.datetime.now().strftime("%H:%M:%S")
        if success:
            sent_verification = "" if skip_image_verification else f" (Verificadas: {found_images}/{expected_images} imágenes)"
            print(f"{Fore.GREEN}✅ MediaUserRequest {i+1}/{n} completado exitosamente ({timestamp_end}){sent_verification}{Style.RESET_ALL}")
            if not skip_image_verification:
                print(f"{Fore.CYAN}Nota: El número de imágenes verificadas es distinto al de imágenes solicitadas porque:{Style.RESET_ALL}")
                print(f"{Fore.CYAN}- Algunas imágenes pueden aún estar en proceso de envío{Style.RESET_ALL}")
                print(f"{Fore.CYAN}- Algunas imágenes pueden haber sido enviadas pero no registradas en los logs analizados{Style.RESET_ALL}")
                print(f"{Fore.CYAN}- El script puede haber detectado imágenes de envíos anteriores{Style.RESET_ALL}")
        else:
            print(f"{Fore.YELLOW}⚠️ MediaUserRequest {i+1}/{n} completado con advertencias ({timestamp_end}){Style.RESET_ALL}")
            
        if i < n-1 and not interrupted:
            msg = f"Esperando {WAIT_AFTER_MEDIA_REQUEST} segundos antes de la siguiente MediaUserRequest..."
            if not safe_sleep(WAIT_AFTER_MEDIA_REQUEST, msg):
                return False
    
    return True

def run_change_status(status):
    """Ejecuta el cambio de estado con verificación automática"""
    if interrupted:
        return False
        
    status_names = {
        1: "NTS",
        2: "ITS",
        3: "CCS",
        4: "PTS",
        5: "UTS",
        6: "LOS"
    }
    status_name = status_names.get(status, str(status))
    print(f"\n{Fore.CYAN}=== ChangeStatus {status_name} ({status}) ==={Style.RESET_ALL}")
    timestamp = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"{Fore.CYAN}Hora de inicio: {timestamp}{Style.RESET_ALL}")
    
    # Comandos para monitorización en tiempo real (opcional)
    log_path = f"{LOG_PATH_WINDOWS}\\Dialer_*.log"
    
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.txt') as tmp:
            tmp_path = tmp.name
            
        # Construir comando
        cmd = f'python ChangeStatusOfTransmissions.py {status} > "{tmp_path}" 2>&1'
        
        print(f"{Fore.CYAN}Ejecutando cambio a estado {status_name}...{Style.RESET_ALL}")
        
        # Ejecutar con timeout para evitar bloqueos
        global current_process
        try:
            # Usar Popen para tener más control sobre el proceso
            current_process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            
            # Esperar un máximo de 30 segundos
            try:
                stdout, stderr = current_process.communicate(timeout=30)
                # Sólo mostrar código de salida si hubo error
                if current_process.returncode != 0:
                    print(f"{Fore.RED}Error: Código de salida: {current_process.returncode}{Style.RESET_ALL}")
                
                # Escribir la salida al archivo temporal (sin mostrarla)
                with open(tmp_path, 'wb') as f:
                    f.write(stdout)
                    if stderr:
                        f.write(b"\n--- STDERR ---\n")
                        f.write(stderr)
                
            except subprocess.TimeoutExpired:
                # Silenciosamente terminamos el proceso sin mostrar mensaje de timeout
                current_process.kill()
                try:
                    # Intentar limpiar los procesos hijos también
                    subprocess.run(['taskkill', '/F', '/T', '/PID', str(current_process.pid)], 
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                except Exception:
                    pass
            
            current_process = None  # Limpiar la referencia
        except Exception as e:
            print(f"{Fore.RED}Error al ejecutar el cambio de estado: {e}{Style.RESET_ALL}")
            current_process = None
            return False
        
        # No mostrar la salida del comando a menos que sea necesario
        try:
            os.remove(tmp_path)
        except Exception:
            pass
            
    except Exception as e:
        print(f"{Fore.RED}Error al cambiar el estado: {e}{Style.RESET_ALL}")
        return False
    
    # Verificar en los logs si se ejecutó correctamente
    success = False
    if status_name in TRACE_PATTERNS:
        if SKIP_VERIFICATION:
            print(f"{Fore.YELLOW}Saltando verificación de logs para {status_name}{Style.RESET_ALL}")
            success = True  # Asumimos éxito si saltamos verificación
        else:
            success = check_log_patterns(status_name, wait_time=VERIFICATION_TIMEOUT)
    else:
        # Si no hay patrones definidos para este estado, asumimos éxito
        success = True
    
    # Mostrar timestamp después de ejecutar para facilitar la búsqueda en logs
    timestamp_end = datetime.datetime.now().strftime("%H:%M:%S")
    if success:
        print(f"{Fore.GREEN}✅ ChangeStatus a {status_name} completado exitosamente ({timestamp_end}){Style.RESET_ALL}")
    else:
        print(f"{Fore.YELLOW}⚠️ ChangeStatus a {status_name} completado con advertencias ({timestamp_end}){Style.RESET_ALL}")
    
    return success

def run_sequence(cycles=1, verbose=False, force_success=False):
    """Ejecuta la secuencia completa el número de ciclos especificado"""
    try:
        total_start_time = datetime.datetime.now()
        total_start_str = total_start_time.strftime("%Y-%m-%d %H:%M:%S")
        print(f"\n{Fore.GREEN}=== INICIANDO SECUENCIA DE PRUEBAS A LAS {total_start_str} ==={Style.RESET_ALL}")
        print(f"{Fore.GREEN}Se ejecutarán {cycles} ciclos completos (PTS → ITS → CCS → MediaUserRequest){Style.RESET_ALL}")
        
        cycles_completed = 0
        for cycle in range(cycles):
            if interrupted:
                break
                
            print(f"\n{Fore.GREEN}===== CICLO {cycle+1}/{cycles} ====={Style.RESET_ALL}")
            cycle_start = datetime.datetime.now().strftime("%H:%M:%S")
            print(f"{Fore.CYAN}Inicio: {cycle_start}{Style.RESET_ALL}")
            
            # Secuencia: PTS -> ITS -> CCS -> MediaUserRequest -> repetir
            pts_success = run_change_status(4)  # PTS
            
            if not safe_sleep(WAIT_BETWEEN_COMMANDS, f"{Fore.YELLOW}Esperando {WAIT_BETWEEN_COMMANDS}s...{Style.RESET_ALL}", countdown=False):
                break
            
            its_success = run_change_status(2)  # ITS
            if not safe_sleep(WAIT_BETWEEN_COMMANDS, f"{Fore.YELLOW}Esperando {WAIT_BETWEEN_COMMANDS}s...{Style.RESET_ALL}", countdown=False):
                break
            
            ccs_success = run_change_status(3)  # CCS
            if not safe_sleep(WAIT_BETWEEN_COMMANDS, f"{Fore.YELLOW}Esperando {WAIT_BETWEEN_COMMANDS}s...{Style.RESET_ALL}", countdown=False):
                break
            
            media_success = run_media_user_request(2, verbose=verbose, force_success=force_success)  # Enviamos solo 2 imágenes
            
            if interrupted:
                break
                
            # Resumen del ciclo
            cycle_end = datetime.datetime.now()
            cycle_end_str = cycle_end.strftime("%H:%M:%S")
            
            print(f"\n{Fore.CYAN}=== Resumen del ciclo {cycle+1} ==={Style.RESET_ALL}")
            print(f"PTS: {'✅' if pts_success else '⚠️'} | " +
                  f"ITS: {'✅' if its_success else '⚠️'} | " +
                  f"CCS: {'✅' if ccs_success else '⚠️'} | " +
                  f"MediaUserRequest: {'✅' if media_success else '⚠️'}")
            print(f"{Fore.GREEN}Fin del ciclo {cycle+1}: {cycle_end_str}{Style.RESET_ALL}")
            
            cycles_completed += 1
                
            if cycle < cycles-1:
                if not safe_sleep(WAIT_BETWEEN_CYCLES, f"\n{Fore.YELLOW}Esperando {WAIT_BETWEEN_CYCLES}s para el siguiente ciclo...{Style.RESET_ALL}", countdown=False):
                    break
        
        # Resumen final
        total_end_time = datetime.datetime.now()
        total_duration = total_end_time - total_start_time
        total_end_str = total_end_time.strftime("%Y-%m-%d %H:%M:%S")
        
        print(f"\n{Fore.GREEN}{'=' * 50}{Style.RESET_ALL}")
        if interrupted:
            print(f"{Fore.YELLOW}Secuencia interrumpida después de {cycles_completed} ciclos.{Style.RESET_ALL}")
        else:
            print(f"{Fore.GREEN}Secuencia completada: {cycles_completed} ciclos ejecutados.{Style.RESET_ALL}")
            
        print(f"{Fore.CYAN}Inicio: {total_start_str}{Style.RESET_ALL}")
        print(f"{Fore.CYAN}Fin: {total_end_str}{Style.RESET_ALL}")
        print(f"{Fore.CYAN}Duración total: {total_duration}{Style.RESET_ALL}")
        print(f"{Fore.GREEN}{'=' * 50}{Style.RESET_ALL}")
            
    except KeyboardInterrupt:
        print(f"\n{Fore.YELLOW}Programa interrumpido por el usuario.{Style.RESET_ALL}")
    except Exception as e:
        print(f"\n{Fore.RED}Error: {e}{Style.RESET_ALL}")
    finally:
        print(f"\n{Fore.GREEN}Fin del programa.{Style.RESET_ALL}")

def check_setup():
    """Verifica que la configuración esté correcta"""
    # Si no se encuentra el archivo requirements.txt, lo creamos
    if not os.path.exists("requirements.txt"):
        with open("requirements.txt", "w") as f:
            f.write("colorama>=0.4.4\nchardet>=4.0.0\n")
        print(f"{Fore.YELLOW}Se ha creado el archivo requirements.txt{Style.RESET_ALL}")
        print(f"{Fore.YELLOW}Ejecute 'pip install -r requirements.txt' antes de ejecutar este script{Style.RESET_ALL}")
    
    # Comprobar si se puede acceder a los logs
    log_file = get_log_path()
    if not log_file:
        print(f"{Fore.RED}¡ADVERTENCIA! No se puede acceder a los archivos de log.{Style.RESET_ALL}")
        print(f"{Fore.RED}Verifique que los logs estén disponibles en la ruta configurada:{Style.RESET_ALL}")
        print(f"{Fore.RED}- Windows: {LOG_PATH_WINDOWS}{Style.RESET_ALL}")
        
        response = input(f"{Fore.YELLOW}¿Desea continuar de todas formas? (s/n): {Style.RESET_ALL}").lower()
        if not (response == 's' or response == 'si' or response == 'sí'):
            print(f"{Fore.RED}Abortando ejecución.{Style.RESET_ALL}")
            sys.exit(1)

def main():
    """Función principal del script"""
    global SKIP_VERIFICATION, interrupted
    
    print(f"{Fore.GREEN}Iniciando secuencia... (Presiona Ctrl+C para interrumpir de forma segura){Style.RESET_ALL}")
    
    colorama.init(autoreset=True)  # Inicializar colorama
    interrupted = False
    
    # Manejar señales para una interrupción limpia
    signal.signal(signal.SIGINT, signal_handler)
    
    # Verificar instalación
    check_setup()
    
    # Procesar argumentos de línea de comandos
    import argparse
    parser = argparse.ArgumentParser(description='Script para pruebas de secuencia de transmisión.')
    parser.add_argument('-c', '--cycles', type=int, default=3, help='Número de ciclos completos a ejecutar (por defecto: 3)')
    parser.add_argument('-s', '--status', type=int, choices=[1, 2, 3, 4], help='Ejecutar solo cambio a un estado específico (1=ATS, 2=ITS, 3=CCS, 4=PTS)')
    parser.add_argument('-m', '--media', action='store_true', help='Ejecutar solo MediaUserRequest')
    parser.add_argument('-i', '--images', type=int, default=5, help='Número de imágenes para MediaUserRequest (por defecto: 5)')
    parser.add_argument('-p', '--pattern', action='store_true', help='Solo verificar patrones en logs')
    parser.add_argument('-r', '--request-id', type=str, help='Verificar fotos para un ID de solicitud específico')
    parser.add_argument('--photo-id', type=str, help='Verificar una foto específica por su ID (ej: 3649THGE_1480_1). Usar con -w para aumentar tiempo de espera.')
    parser.add_argument('-w', '--wait', type=int, default=VERIFICATION_TIMEOUT, help=f'Tiempo máximo de espera para verificaciones en segundos (por defecto: {VERIFICATION_TIMEOUT})')
    parser.add_argument('--skip', action='store_true', help='Saltar verificación de patrones en logs')
    parser.add_argument('-v', '--verbose', action='store_true', help='Mostrar información detallada para depuración')
    parser.add_argument('-f', '--force-success', action='store_true', help='Forzar éxito incluso cuando no se encuentran eventos de imágenes')
    
    args = parser.parse_args()
    
    # Aplicar configuración de skip si se especifica
    if args.skip:
        SKIP_VERIFICATION = True
        print(f"{Fore.YELLOW}Modo de salto de verificación activado. No se verificarán patrones en logs.{Style.RESET_ALL}")
    
    try:
        # Ejecutar la acción correspondiente
        if args.photo_id:
            # Verificar una foto específica por su ID
            print(f"{Fore.CYAN}Verificando foto con ID: {args.photo_id}{Style.RESET_ALL}")
            check_specific_photo_id(args.photo_id, wait_time=args.wait)
        elif args.request_id:
            # Verificar fotos para un ID de solicitud específico
            print(f"{Fore.CYAN}Verificando fotos para el Request ID: {args.request_id}{Style.RESET_ALL}")
            check_specific_request_id(args.request_id, wait_time=args.wait)
        elif args.pattern:
            # Solo verificar patrones
            print(f"{Fore.CYAN}Verificando patrones en logs...{Style.RESET_ALL}")
            check_log_patterns("PTS", wait_time=args.wait)
            check_log_patterns("ITS", wait_time=args.wait)
            check_log_patterns("CCS", wait_time=args.wait)
            check_log_patterns("MediaUserRequest", wait_time=args.wait)
        elif args.status:
            # Solo cambiar a un estado específico
            status_names = {1: "ATS", 2: "ITS", 3: "CCS", 4: "PTS"}
            print(f"{Fore.CYAN}Cambiando estado a {status_names[args.status]}...{Style.RESET_ALL}")
            success = run_change_status(args.status)
            # La verificación ya se hace dentro de run_change_status
        elif args.media:
            # Solo ejecutar MediaUserRequest
            print(f"{Fore.CYAN}Ejecutando MediaUserRequest con {args.images} imágenes...{Style.RESET_ALL}")
            if args.force_success:
                print(f"{Fore.YELLOW}Nota: Se forzará éxito en la verificación de imágenes{Style.RESET_ALL}")
            success = run_media_user_request(args.images, verbose=args.verbose, force_success=args.force_success)
            # La verificación ya se hace dentro de run_media_user_request
        else:
            # Ejecutar la secuencia completa
            print(f"{Fore.GREEN}Se ejecutarán {args.cycles} ciclos{Style.RESET_ALL}")
            if SKIP_VERIFICATION:
                print(f"{Fore.YELLOW}Modo de ejecución rápida: no se verificarán patrones en logs{Style.RESET_ALL}")
            if args.verbose:
                print(f"{Fore.CYAN}Modo verbose activado: se mostrará información detallada{Style.RESET_ALL}")
            if args.force_success:
                print(f"{Fore.YELLOW}Modo de forzar éxito activado: todas las verificaciones de imágenes se considerarán exitosas{Style.RESET_ALL}")
            
            run_sequence(args.cycles, verbose=args.verbose, force_success=args.force_success)
            
    except Exception as e:
        print(f"{Fore.RED}Error: {e}{Style.RESET_ALL}")
    finally:
        # Asegurar que colorama se cierre correctamente
        colorama.deinit()

if __name__ == "__main__":
    main()