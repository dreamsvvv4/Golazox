import logging
import argparse
import datetime
import requests
from pathlib import Path
try:
    # Prefer relative import when running as package module
    from .Elastic import Elastic  # type: ignore
except ImportError:
    # Fallback if executed as a script without package context
    from UltraKibanaDownloader.Elastic import Elastic  # type: ignore
from ElasticSearch import ElasticSearch
from Installation import Installation

def getPath(pathPrefix, installation, date):
    return Path(pathPrefix, installation + "_" + date.strftime("%Y-%m-%dT%H_%M_%SZ"))

def getLogs(logger, env, country2Digits, nInst, path, reqServices, reqDate, reqStartMinutes, reqEndMinutes, cuSerial=None, levels=None):
    sn = None
    try:
        installation = Installation(env, country2Digits, nInst, Path(path,"config.log"))
        sn = installation.sn
    except Exception as e:
        logger.warning(f"No se pudo obtener la configuración de la instalación: {e}.")
        if cuSerial:
            logger.warning(f"Se usará el serial proporcionado: {cuSerial}")
            sn = cuSerial
        elif nInst:
            logger.warning(f"Se usará el número de instalación para buscar en Kibana: {nInst}")
            sn = None  # Forzar búsqueda por instalación
        else:
            logger.error("No se puede buscar logs: falta el número de serie (CU) o número de instalación.")
            return []

    if env == "vs":
        elastic = Elastic(env, sn, reqStartMinutes, reqEndMinutes)
        response = elastic.getHitsAround(reqDate, reqServices)
    elif env == "aws":
        if sn:
            elasticSearch = ElasticSearch(sn=sn, startMinutes=reqStartMinutes, endMinutes=reqEndMinutes, levels=levels)
        else:
            elasticSearch = ElasticSearch(installation_number=nInst, startMinutes=reqStartMinutes, endMinutes=reqEndMinutes, levels=levels)
        response = elasticSearch.getHitsAround(reqDate, reqServices)

    return response

# Format is
# installation date timestamp 
# 3756327	2021-08-16 17:50:21
def readIssuesInColumns(logger, filename):
    issues = []
    with open(filename) as f:
        lines=f.readlines()
        for l in lines:
            issue = []
            cols = l.replace('\t', ' ').replace('\n', '').split(' ')
            issue.append(cols[0])
            issue.append(datetime.datetime.strptime(cols[1]+" "+cols[2], '%Y-%m-%d %H:%M:%S'))
            issues.append(issue)
    return issues
    

def tsToString(ts):
    return ts.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]

def writeFiles(logger, path, logs, listFiltered, listTagged, tags, excludeFilter, includeFilter, installation_number=None):
    print("PROGRESS: Sorting and writing %d logs to file..." % len(logs), flush=True)
    # Strip surrounding quotes so users can write "photo error" as a phrase token
    includeFilter = [kw.strip('"').strip("'") for kw in includeFilter] if includeFilter else []
    excludeFilter = [kw.strip('"').strip("'") for kw in excludeFilter] if excludeFilter else []
    config_log_path = Path(path, "config.log")
    if installation_number and config_log_path.exists():
        # Añadir el número de instalación al principio si no está
        with open(config_log_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        if not any(line.startswith("INST ") for line in lines):
            lines.insert(0, f"INST {installation_number}\n")
            with open(config_log_path, "w", encoding="utf-8") as f:
                f.writelines(lines)

    with open(Path(path,"ordered.log"), "w", encoding="utf-8") as ordered, \
         open(Path(path,"filtered.log"), "w", encoding="utf-8") as filtered, \
         open(Path(path,"tagged.log"), "w", encoding="utf-8") as tagged:
        # Ordenar explícitamente por ts de menor a mayor (por si acaso)
        logs_sorted = sorted(logs, key=lambda l: l["ts"])
        total_logs = len(logs_sorted)
        skipped_include = 0
        skipped_exclude = 0
        written_logs = 0
        for log in logs_sorted:
            # Build a searchable string from the text fields, exactly as shown in ordered.log.
            # Using str(log) would split cross-field phrases (e.g. f1='LOCK X', f2='appStatus')
            # with dict syntax in between, breaking phrase matching.
            log_str = f"{log['service']} {log['log']} {log['f1']} {log['f2']} {log['f3']} {log['f4']} {log['f5']}".lower()

            # Incluir solo trazas que coincidan con el filtro de inclusión, si está definido
            if includeFilter and not any(word.lower() in log_str for word in includeFilter if word):
                skipped_include += 1
                continue

            # Excluir trazas que coincidan con el filtro de exclusión
            if any(word.lower() in log_str for word in excludeFilter if word):
                skipped_exclude += 1
                continue

            written_logs += 1
            service_fixed = "{0:<10}".format(log["service"][:10])
            tags_str = ""
            if any(tag in log["tags"] for tag in tags):
                tags_str = ','.join([str(elem) for elem in tags])
            tags_fixed = "{0:<6}".format(tags_str[:6])
            loglevel_fixed = log["level"][0]

            # Formato fijo para la fecha: [YYYY-MM-DD HH:MM:SS.mmm]
            ts_str = log["ts"].strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
            ordered.write(f"[{ts_str}][{service_fixed}][{tags_fixed}][{loglevel_fixed}] {log['log']} {log['f1']} {log['f2']} {log['f3']} {log['f4']} {log['f5']}\n")

            if any(tag in log["tags"] for tag in tags) or any(word in log["log"] for word in listTagged) or any(word in service_fixed for word in listTagged):
                tagged.write(f"[{ts_str}][{service_fixed}][{tags_fixed}] {log['log']} {log['f1']} {log['f2']} {log['f3']} {log['f4']} {log['f5']}\n")

            if any(word in log["log"] for word in listFiltered) or \
               any(word in log["f1"] for word in listFiltered) or \
               any(word in log["f2"] for word in listFiltered) or \
               any(word in log["f3"] for word in listFiltered) or \
               any(word in log["f4"] for word in listFiltered) or \
               any(word in log["f5"] for word in listFiltered):
                filtered.write("[%s][%s][%s] %s %s %s %s %s %s\n" %(
                    tsToString(log["ts"]), service_fixed, tags_fixed, log["log"], log["f1"], log["f2"], log["f3"], log["f4"], log["f5"]
                ))

    print("PROGRESS: File write complete. %d logs written." % written_logs, flush=True)
    if includeFilter or excludeFilter:
        print(f"\nFilter results : {total_logs} logs retrieved from Elastic")
        if includeFilter:
            kw = ', '.join(includeFilter)
            print(f"  Include [{kw}] : {total_logs - skipped_include} matched, {skipped_include} skipped")
        if excludeFilter:
            kw = ', '.join(excludeFilter)
            print(f"  Exclude [{kw}] : {skipped_exclude} removed")
        print(f"  Written to file : {written_logs} logs")

# curl -k -X GET "https://es-apim-appservice.gtm.securitasdirect.local:8243/device-support/device-config-repository/v2.0/installation/cu/26JRPEHD"
# -H "accept: application/json" -H "Authorization: Bearer 823742c2-ad17-3cca-bbfd-db0406da4568"
def getInstFromCUSerial(env, serial, country2Digits="ES"):
    if env == "EPI":
        url = f"http://mc-epi-apim-appservice.gtm.epi.securitasdirect.local:8243/device-support/device-config-repository/v2.0/installation/cu/{serial}"
        headers = { "Accept": "application/json", "Authorization": "Bearer 77cf4ae7-bad0-343d-8cd3-33d9dcaaf175" }
    else:
        url = f"http://es-apim-appservice.gtm.securitasdirect.local:8243/device-support/device-config-repository/v2.0/installation/cu/{serial}"
        headers = { "Accept": "application/json", "Authorization": "Bearer 358e5970-63b1-3854-bd86-7a811bad051d" }
    try:
        with requests.get(url, headers=headers, verify=False) as r:
            if r.status_code == 404:
                # No existe la instalación, continuar sin plataforma
                return None  # o 'unknown' si prefieres un string
            r.raise_for_status()
            jsResponse = r.json()
        return jsResponse["platform"]
    except requests.exceptions.HTTPError as e:
        if hasattr(e.response, 'status_code') and e.response.status_code == 404:
            # No existe la instalación, continuar sin plataforma
            return None  # o 'unknown' si prefieres un string
        else:
            raise
        
def setupLogger(loggingLevel):
    import sys
    formatter = logging.Formatter('%(levelname)-8s %(message)s')
    handler = logging.StreamHandler(sys.stdout)
    try:
        handler.setStream(open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1))
    except Exception:
        pass  # fallback para sistemas donde no se puede cambiar el stream
    handler.setFormatter(formatter)
    logger = logging.getLogger("kibanaParserLogger")
    logger.setLevel(loggingLevel)
    logger.handlers.clear()
    logger.addHandler(handler)
    return logger

def parseArguments():
    parser = argparse.ArgumentParser(description='kibana log parser')
    parser.add_argument('configFile')
    parser.add_argument('-v',
                    '--verbose',
                    action='count',
                    default=0)
    parser.add_argument('-b',
                    '--bulkFile',
                    help='File with many issues to download in bulk')
    parser.add_argument('-z',
                    '--zipLogs',
                    help='The zipped file from cu')
    parser.add_argument('-n',
                    '--env',
                    default="vs",
                    help='Sets the installation env to find')
    parser.add_argument('-c',
                    '--country',
                    default="ES",
                    help='Sets the installation country to find')
    parser.add_argument('-i',
                    '--installation',
                    help='Sets the installation to find')
    parser.add_argument('-u',
                    '--cuSerial',
                    help='Sets the sn to find')
    # '2021-06-14 18:18:40'
    parser.add_argument('-d',
                    '--date',
                    type=lambda s: datetime.datetime.strptime(s, '%Y-%m-%d %H:%M:%S'))
    parser.add_argument("-e",
                    "--endMinutes",
                    type=int,
                    default=10,
                    help="Default minutes to add to date when looking for logs")
    parser.add_argument("-s",
                    "--startMinutes",
                    type=int,
                    default=10,
                    help="Default minutes to remove from date when looking for logs")
    parser.add_argument("-p",
                    "--pathPrefix",
                    type=str,
                    default="audio",
                    help="Default minutes to remove from date when looking for logs")
    parser.add_argument("--exclude", type=str, default="", help="Keywords to exclude from logs (comma-separated)")
    parser.add_argument("--include", type=str, default="", help="Keywords to include in logs (comma-separated)")
    parser.add_argument("--configName", type=str, default="All", help="Config preset name when using conf_all (All, Photos, Calls, Communications, Doorlock, FOTA)")
    parser.add_argument("--levels", type=str, default="", help="Comma-separated log levels to filter at Elasticsearch level (e.g. INFO,DEBUG,WARN,ERROR). Empty means all levels.")
    
    
    args = parser.parse_args()
    return args