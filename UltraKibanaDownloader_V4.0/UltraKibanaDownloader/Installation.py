import logging
import requests
from requests.auth import HTTPBasicAuth
import json
import urllib3
import datetime

logger = logging.getLogger("kibanaParserLogger")
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class Installation:
    def __init__(self, env, country, inst, outputFile):
        self.country2Digits = country
        self.inst = inst
        self.outputFile = outputFile
        if env == "EPI":
            self.apimUrl = "http://mc-epi-apim-appservice.gtm.epi.securitasdirect.local:8243"
            self.headers = { "Accept": "application/json", "Authorization": "Bearer 77cf4ae7-bad0-343d-8cd3-33d9dcaaf175" }
        else:
            self.apimUrl = "http://es-apim-appservice.gtm.securitasdirect.local:8243"
            self.headers = { "Accept": "application/json", "Authorization": "Bearer 358e5970-63b1-3854-bd86-7a811bad051d" }

        self.jsConfig = self.getConfig()
        #logger.debug(self.jsConfig)
        self.sn = self.jsConfig["cu"]["serialNumber"]
        # Extract installation number from platform
        self.installation_number = self.jsConfig["platform"]["installationNumber"] if "platform" in self.jsConfig and "installationNumber" in self.jsConfig["platform"] else self.inst
        logger.debug("SN %s" % (self.sn))
        logger.debug("Installation Number %s" % (self.installation_number))

        if(self.outputFile):
            with open(self.outputFile, "w") as outF:
                outF.write("INST %s\n" % (self.installation_number))
                outF.write("%s %s\n" % (self.country2Digits, self.inst))
                outF.write("SN %s\n" % (self.sn))
                # Dispositivos y frames (emiten DEBUG para la GUI)
                self.printDevices(outF)
                self.printFramesConfig(outF)
                # Bloque único de configuracion (sin repetir listado de nodos)
                self.printConfiguration(outF)

    def printDevices(self, outF):
        def extraer_is_active(dev):
            rutas = [
                (('isActive',), 'node.isActive'),
                (('active',), 'node.active'),
                (('config','isActive'), 'config.isActive'),
                (('config','active'), 'config.active'),
                (('config','siren','isActive'), 'config.siren.isActive'),
            ]
            for path, label in rutas:
                cur = dev
                ok = True
                for p in path:
                    if isinstance(cur, dict) and p in cur:
                        cur = cur[p]
                    else:
                        ok = False
                        break
                if ok:
                    val = cur
                    if isinstance(val, str):
                        if val.lower() in ('false','0','no','none'):
                            return False
                        return True
                    return bool(val)
            return True

        for item in self.jsConfig.get("nodes", []):
            trace = ""
            tipo = item.get("type")
            zone = item.get("zoneId", "?")
            serial = item.get("serialNumber", "?")
            is_active = extraer_is_active(item)
            mac = None
            if isinstance(item.get("config"), dict):
                mac = item["config"].get("mac")

            if tipo == 102:
                trace = "PIR     %s -> %s" % (zone, serial)
            elif tipo == 103:
                trace = "CROPTEX %s -> %s" % (zone, serial)
            elif tipo == 106:
                trace = "ORION   %s -> %s" % (zone, serial)
                if mac:
                    trace += f" MAC:{mac}"
            elif tipo == 140:
                trace = "PORTAL  %s -> %s" % (zone, serial)
                if mac:
                    trace += f" MAC:{mac}"
            elif tipo == 101:
                trace = "MAG     %s -> %s" % (zone, serial)
            elif tipo == 142:
                trace = "SVK     %s -> %s" % (zone, serial)
            else:
                trace = "%s     %s -> %s" % (str(tipo), zone, serial)

            # Añadir estado isActive
            trace += f" isActive:{str(is_active).lower()}"

            outF.write(trace + "\n")
            logger.debug(trace)

    def printFramesConfig(self, outF):
        for item in self.jsConfig["confByDeviceType"]:
            trace = ""
            if item["type"] == 102:
                trace = "PIR frames:%d" % (item["config"]["framesNumber"])
            elif item["type"] == 103:
                trace = "CROPTEX frames:%d" % (item["config"]["framesNumber"])
          #   elif item["type"] == 106:
          #       trace = "ORION scenarios %s" % (json.dumps(item["config"]["scenarios"], indent=4))

            if trace:
                outF.write(trace + "\n")
                logger.debug(trace)

    def printExtendedInfo(self, outF):
        """DEPRECATED: mantenido por compatibilidad, usa printConfiguration."""
        self.printConfiguration(outF)

    def printConfiguration(self, outF):
        """Imprime un unico bloque de configuracion sin duplicados."""
        try:
            import unicodedata
            def sin_acentos(texto):
                if not isinstance(texto, str):
                    return texto
                return unicodedata.normalize('NFKD', texto).encode('ASCII', 'ignore').decode('ASCII')

            def w(line):
                line_clean = sin_acentos(line)
                outF.write(line_clean + "\n")
                logger.debug("CFG " + line_clean)

            data = self.jsConfig

            # Preparar mapeo de tipos
            device_type_mapping = {
                "101": "MAGNETIC", "102": "PIR", "104": "ZEROVISION", "120": "SPB", "121": "SMOKE", "122": "WATER",
                "130": "SMARTPLUG", "140": "HOMEPANEL", "141": "SMARTDOT", "142": "SVK", "162": "KEYFOB", "105": "IPCAMERA",
                "103": "CROPTEX", "106": "ORION", "107": "AQUILA", "109": "AQUILABUSINESS", "143": "MOK", "108": "NOX",
                "123": "SENTINEL1", "124": "SENTINEL2", "163": "LOCK", "131": "WRE", "110": "MC3"
            }

            # Contadores y datos base
            device_count = {}
            total_devices = 0
            user_count = 0
            global_tag_count = 0
            user_tag_count = 0
            cu_serial_number = data.get('cu', {}).get('serialNumber', 'unknown')
            installation_number = data.get('platform', {}).get('installationNumber', self.inst)

            # Funcion robusta para isActive
            def extraer_is_active(dev):
                rutas = [
                    (('isActive',), 'node.isActive'),
                    (('active',), 'node.active'),
                    (('config','isActive'), 'config.isActive'),
                    (('config','active'), 'config.active'),
                    (('config','siren','isActive'), 'config.siren.isActive'),
                ]
                for path, label in rutas:
                    cur = dev
                    ok = True
                    for p in path:
                        if isinstance(cur, dict) and p in cur:
                            cur = cur[p]
                        else:
                            ok = False
                            break
                    if ok:
                        val = cur
                        if isinstance(val, str):
                            if val.lower() in ('false','0','no','none'):
                                return False, label
                            return True, label
                        return bool(val), label
                return True, 'fallback'

            nodes_info = []
            for device in data.get('nodes', []):
                total_devices += 1
                device_type_code = str(device.get('type', 'UNKNOWN'))
                device_type_name = device_type_mapping.get(device_type_code, device_type_code)
                serial_number = device.get('serialNumber', 'unknown')
                zone_id = device.get('zoneId', 'unknown')
                is_active, _fuente = extraer_is_active(device)
                mac = None
                if device_type_name in ["ORION", "AQUILA"]:
                    mac = device.get('config', {}).get('mac') if isinstance(device.get('config'), dict) else None
                node_str = f"{device_type_name}: {serial_number}, Zone ID: {zone_id}"
                if mac:
                    node_str += f", MAC: {mac}"
                node_str += f", \"isActive\": {str(is_active).lower()}"
                nodes_info.append(node_str)
                device_count[device_type_name] = device_count.get(device_type_name, 0) + 1

            if 'users' in data:
                user_count = len(data['users'])
                for user in data['users']:
                    if 'tags' in user:
                        user_tag_count += len(user['tags'])
            if 'tags' in data:
                global_tag_count = len(data['tags'])

            w("============================================")
            w("CONFIGURACION DE LA INSTALACION")
            w("============================================")
            w(f"Numero de instalacion : {installation_number}")
            w(f"Serial Number         : {cu_serial_number}")
            w(f"Creado                : {data.get('createdAt', 'N/A')}")
            w(f"Ultima actualizacion  : {data.get('lastUpdatedDate', 'N/A')}")
            w(f"Dispositivos totales  : {total_devices}")
            w("Conteo por tipo:")
            for device_type, count in device_count.items():
                w(f"   - {device_type:12}: {count}")
            # Ya mostramos los nodos arriba como dispositivos; evitamos duplicarlos aquí.
            w(f"Usuarios totales      : {user_count}")
            w(f"Tags totales          : {global_tag_count}")

            cu = data.get('cu', {})
            w(f"\nCU:")
            w(f"   Label      : {cu.get('label', 'N/A')}")
            w(f"   Ubicacion  : {cu.get('location', 'N/A')}")
            w(f"   Alias      : {cu.get('alias', 'N/A')}")
            w(f"   SSID       : {cu.get('ssid', 'N/A')}")
            feature_flags = cu.get('featureFlags', {})
            w(f"   Feature Flags:")
            if isinstance(feature_flags, dict):
                for flag, value in feature_flags.items():
                    w(f"      - {flag:12}: {value}")
            w(f"   VoIP SIM   : {cu.get('voip', {}).get('simNumber', 'N/A')}")
            debugCfg = cu.get('debug', {})
            w(f"   LogLevel   : {debugCfg.get('logLevel','N/A')}")

            # Particiones de alarma
            if 'alarmPartitions' in data:
                w("\nParticiones de alarma:")
                for part in data['alarmPartitions']:
                    w(f"   • ID: {part.get('id')} | Nombre: {part.get('name')} | Nodos asociados: {part.get('associatedNodes')}")
                    if 'armModes' in part:
                        for mode in part['armModes']:
                            w(f"      - Modo: {mode.get('label')} | Entrada: {mode.get('entryTime')}s | Salida: {mode.get('exitTime')}s")

            # Proveedores
            if 'providers' in data:
                w("\nProveedores de red:")
                for prov in data['providers']:
                    mcc = prov.get('mcc', 'N/A')
                    if mcc != 'N/A':
                        w(f"   • Nombre: {prov.get('name', 'N/A')} | Tipo: {prov.get('type', 'N/A')} | MCC: {mcc}")

            w("FIN CONFIGURACION")
        except Exception as e:
            outF.write(f"[ERROR extended info] {e}\n")
            logger.error("Error writing extended info: %s" % e)



    # curl -s -k -X GET "https://es-apim-appservice.gtm.securitasdirect.local:8243/device-support/device-config-repository/v2.0/installation/ES3717707" 
    # -H "accept: application/json" -H "Authorization: Bearer 823742c2-ad17-3cca-bbfd-db0406da4568" |
    # jq '.confByDeviceType[] | select(.type == (102,103,106))' | grep -E 'type|framesNumber'
    def getConfig(self):
        url = self.apimUrl + "/device-support/device-config-repository/v2.0/installation/" + self.country2Digits + str(self.inst)
        with requests.get(url, headers=self.headers, verify=False) as r:
            r.raise_for_status()
            jsResponse = r.json()
        return jsResponse


if __name__ == "__main__":
    import argparse, sys
    parser = argparse.ArgumentParser(description="Descarga y muestra configuración de una instalación")
    parser.add_argument("inst", help="Número de instalación sin prefijo de país (solo dígitos)")
    parser.add_argument("country", help="Código país (ej: ES, FR, IT)")
    parser.add_argument("env", nargs='?', default="ES", help="Entorno: ES (por defecto) o EPI")
    parser.add_argument("--out", dest="outfile", help="Ruta de fichero para volcar resumen (opcional)")
    args = parser.parse_args()
    try:
        salida = args.outfile if args.outfile else None
        inst_obj = Installation(args.env.upper(), args.country.upper(), args.inst, salida)
        # Si no se pidió fichero, imprimir algunos datos clave por stdout
        if not salida:
            data = inst_obj.jsConfig
            cu_sn = data.get('cu', {}).get('serialNumber', 'N/A')
            installation_number = data.get('platform', {}).get('installationNumber', args.inst)
            print(f"Installation: {installation_number}")
            print(f"CU Serial   : {cu_sn}")
            print(f"Nodes       : {len(data.get('nodes', []))}")
            behaviours = data.get('behaviours', [])
            print(f"Behaviours  : {len(behaviours)}")
            # Mostrar timeout autolock si existe
            try:
                for b in behaviours:
                    if isinstance(b, dict) and str(b.get('id','')).lower() == 'autolock':
                        cfg = b.get('config', {})
                        if 'timeout' in cfg:
                            print(f"Autolock timeout: {cfg.get('timeout')}")
                        break
            except Exception:
                pass
    except KeyboardInterrupt:
        print("Cancelado por usuario", file=sys.stderr)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)




