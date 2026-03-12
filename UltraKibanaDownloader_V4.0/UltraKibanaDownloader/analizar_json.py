import requests
import json
import sys

# Mapeo de códigos de tipo de dispositivo a nombres
device_type_mapping = {
    "101": "MAGNETIC",
    "102": "CAMPIR",
    "104": "ZEROVISION",
    "120": "SPB",
    "121": "SMOKE",
    "122": "WATER",
    "130": "SMARTPLUG",
    "140": "HOMEPANEL",
    "141": "SMARTDOT",
    "142": "SVK",
    "162": "KEYFOB",
    "105": "IPCAMERA",
    "103": "CROPTEX",
    "106": "ORION",
    "107": "AQUILA",
    "109": "AQUILABUSINESS",
    "143": "MOK",
    "108": "NOX",
    "123": "SENTINEL1",
    "124": "SENTINEL2",
    "163": "LOCK",
    "131": "WRE",
    "110": "MC3"
}

def analizar_json(json_file):
    def sin_acentos(texto):
        import unicodedata
        if not isinstance(texto, str):
            return texto
        return unicodedata.normalize('NFKD', texto).encode('ASCII', 'ignore').decode('ASCII')
    try:
        # Cargar el archivo JSON
        print(sin_acentos(f"Intentando abrir el archivo {json_file}"))
        with open(json_file, 'r') as file:
            data = json.load(file)
        print(sin_acentos("Archivo JSON cargado correctamente."))

        # Fechas
        try:
            if 'createdAt' in data:
                print(sin_acentos(f"\nCreado: {data['createdAt']}"))
            if 'lastUpdatedDate' in data:
                print(sin_acentos(f"Ultima actualizacion: {data['lastUpdatedDate']}"))
        except Exception as e:
            print(sin_acentos(f"Error leyendo fechas: {e}"))
        # ...el resto del análisis...

        # Crear contadores y listas
        device_count = {}
        total_devices = 0
        user_count = 0
        global_tag_count = 0
        user_tag_count = 0
        cu_serial_number = "unknown"
        installation_number = "unknown"
        nodes_info = []

        # Extraer número de serie de la CU
        if 'cu' in data:
            cu_serial_number = data['cu'].get('serialNumber', 'unknown')

        # Extraer número de instalación desde platform
        if 'platform' in data:
            installation_number = data['platform'].get('installationNumber', 'unknown')

        # Contar dispositivos por tipo y total de dispositivos, y extraer información de los nodos
        if 'nodes' in data:
            for device in data['nodes']:
                total_devices += 1
                device_type_code = str(device['type'])
                device_type_name = device_type_mapping.get(device_type_code, "UNKNOWN")
                serial_number = device.get('serialNumber', 'unknown')
                zone_id = device.get('zoneId', 'unknown')
                mac = None
                if device_type_name in ["ORION", "AQUILA"]:
                    config = device.get('config', {})
                    mac = config.get('mac')
                node_str = f"{device_type_name}: {serial_number}, Zone ID: {zone_id}"
                if mac:
                    node_str += f", MAC: {mac}"
                nodes_info.append(node_str)
                if device_type_name in device_count:
                    device_count[device_type_name] += 1
                else:
                    device_count[device_type_name] = 1

        # Contar usuarios y etiquetas por usuario
        if 'users' in data:
            user_count = len(data['users'])
            for user in data['users']:
                if 'tags' in user:
                    user_tag_count += len(user['tags'])

        # Contar etiquetas globales
        if 'tags' in data:
            global_tag_count = len(data['tags'])


        print(sin_acentos("\n============================================"))
        print(sin_acentos("         RESUMEN DE LA INSTALACION           "))
        print(sin_acentos("============================================"))
        print(sin_acentos(f"\nNumero de instalacion : {installation_number}"))
        print(sin_acentos(f"Serial Number         : {cu_serial_number}"))
        print(sin_acentos(f"Creado                : {data.get('createdAt', 'N/A')}"))
        print(sin_acentos(f"Ultima actualizacion  : {data.get('lastUpdatedDate', 'N/A')}"))

        print(sin_acentos("\n--------------------------------------------"))
        print(sin_acentos(f"Dispositivos totales  : {total_devices}"))
        print(sin_acentos("Conteo por tipo:"))
        for device_type, count in device_count.items():
            print(sin_acentos(f"   - {device_type:12}: {count}"))

        print(sin_acentos("\nNodos:"))
        for node_info in nodes_info:
            print(sin_acentos(f"   • {node_info}"))

        print(sin_acentos(f"\nUsuarios totales      : {user_count}"))
        print(sin_acentos(f"Tags totales          : {global_tag_count}"))

        print(sin_acentos("\n============================================"))
        print(sin_acentos("         INFORMACION EXTENDIDA               "))
        print(sin_acentos("============================================"))

        # CU
        cu = data.get('cu', {})
        print(sin_acentos(f"\nCU:"))
        print(sin_acentos(f"   Label      : {cu.get('label', 'N/A')}"))
        print(sin_acentos(f"   Ubicacion  : {cu.get('location', 'N/A')}"))
        print(sin_acentos(f"   Alias      : {cu.get('alias', 'N/A')}"))
        print(sin_acentos(f"   SSID       : {cu.get('ssid', 'N/A')}"))
        feature_flags = cu.get('featureFlags', {})
        print(sin_acentos(f"   Feature Flags:"))
        for flag, value in feature_flags.items():
            print(sin_acentos(f"      - {flag:12}: {value}"))
        print(sin_acentos(f"   VoIP SIM   : {cu.get('voip', {}).get('simNumber', 'N/A')}"))

        # Usuarios
        try:
            if 'users' in data:
                for user in data['users']:
                    print(sin_acentos(f"   • ID: {user.get('id')} | Label: {user.get('label')} | Owner: {user.get('isOwner')} | Admin: {user.get('isAdmin')} | TagID: {user.get('tagId')}"))
        except Exception as e:
            print(sin_acentos(f"Error inesperado al procesar usuarios: {e}"))

        # Tags
        if 'tags' in data:
            print(sin_acentos("\nTags:"))
            for tag in data['tags']:
                print(sin_acentos(f"   • ID: {tag.get('id')} | Label: {tag.get('label')} | Color: {tag.get('color')} | Activo: {tag.get('isActive')}"))

        # Particiones de alarma
        if 'alarmPartitions' in data:
            print(sin_acentos("\nParticiones de alarma:"))
            for part in data['alarmPartitions']:
                print(sin_acentos(f"   • ID: {part.get('id')} | Nombre: {part.get('name')} | Nodos asociados: {part.get('associatedNodes')}"))
                if 'armModes' in part:
                    for mode in part['armModes']:
                        print(sin_acentos(f"      - Modo: {mode.get('label')} | Entrada: {mode.get('entryTime')}s | Salida: {mode.get('exitTime')}s"))

        # Proveedores
        if 'providers' in data:
            print(sin_acentos("\nProveedores de red:"))
            for prov in data['providers']:
                mcc = prov.get('mcc', 'N/A')
                if mcc != 'N/A':
                    print(sin_acentos(f"   • Nombre: {prov.get('name', 'N/A')} | Tipo: {prov.get('type', 'N/A')} | MCC: {mcc}"))

        print(sin_acentos("\n============================================"))
        print(sin_acentos("         ENDPOINTS RELEVANTES                "))
        print(sin_acentos("============================================"))
        if 'endpoints' in data:
            endpoints = data['endpoints']
            for key in [
                'dcr', 'keyMaster', 'elk', 'orquestadorInst', 'orquestadorServ',
                'fotaBackend', 'voipRegister', 'keyVault', 'debugFiles']:
                if key in endpoints:
                    url = endpoints[key].get('url') if isinstance(endpoints[key], dict) else endpoints[key]
                    print(sin_acentos(f"   • {key:16}: {url}"))
    except FileNotFoundError:
        print(f"Error: No se encontró el archivo {json_file}")
    except Exception as e:
        print(f"Error inesperado al procesar el archivo: {e}")


def descargar_instalacion(inst, country="ES"):
    """Descarga el JSON de la instalación y devuelve (data, filename)"""
    url = f"http://mc-dcr.gtm.securitasdirect.local:30150/device-support/device-config-repository/v2.0/installation/{country}{inst}"
    try:
        respuesta = requests.get(url)
        respuesta.raise_for_status()
        data = respuesta.json()
        filename = f"{inst}.json"
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)
        return data, filename
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Error al descargar instalación: {e}")


def generar_resumen(data):
    """Devuelve un resumen JSON indentado del objeto data"""
    return json.dumps(data, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    # Verificar si se proporcionó el número de instalación y opcionalmente el país como argumento
    if len(sys.argv) < 2 or len(sys.argv) > 3:
        print("Uso: python analizar_json.py <numero_instalacion> [codigo_pais]")
        sys.exit(1)

    INSTALLATION = sys.argv[1]
    COUNTRY = sys.argv[2] if len(sys.argv) == 3 else "ES"

    # Código adicional para realizar la solicitud y guardar el JSON
    url = f"http://mc-dcr.gtm.securitasdirect.local:30150/device-support/device-config-repository/v2.0/installation/{COUNTRY}{INSTALLATION}"  # Ahora la URL es dinámica según el país

    try:
        respuesta = requests.get(url)
        respuesta.raise_for_status()  
        datos = respuesta.json()  
        # para guardar en fichero:
        json_file = f"{INSTALLATION}.json"
        with open(json_file, "w") as f:
            json.dump(respuesta.json(), f, indent=4)
    except requests.exceptions.RequestException as e:
        print(f"Error al hacer la solicitud: {e}")
        sys.exit(1)

    # Analizar el archivo descargado
    analizar_json(json_file)