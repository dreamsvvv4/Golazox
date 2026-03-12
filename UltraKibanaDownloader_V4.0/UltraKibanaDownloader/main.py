import importlib
import logging
import sys
from pathlib import Path

# Permitir ejecución desde cualquier ruta añadiendo la carpeta del script al sys.path
pkg_root = Path(__file__).parent.resolve()
if str(pkg_root) not in sys.path:
    sys.path.insert(0, str(pkg_root))

# Detectar el nombre de la carpeta del paquete dinámicamente
import os
import importlib.util

def _find_package_dir():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    # Buscar subcarpeta válida
    for name in os.listdir(current_dir):
        path = os.path.join(current_dir, name)
        if os.path.isdir(path) and os.path.isfile(os.path.join(path, "main.py")) and os.path.isfile(os.path.join(path, "__init__.py")):
            return name
    # Si no hay subcarpeta, comprobar si los scripts están en el propio current_dir
    if os.path.isfile(os.path.join(current_dir, "main.py")) and os.path.isfile(os.path.join(current_dir, "__init__.py")):
        return None  # None indica scripts en el propio directorio
    return None

_PKG = _find_package_dir()
if _PKG:
    commonAna = importlib.import_module(f"{_PKG}.commonAna")
    zippedLogs = importlib.import_module(f"{_PKG}.zippedLogs")
    setupLogger = commonAna.setupLogger
    parseArguments = commonAna.parseArguments
    getLogs = commonAna.getLogs
    writeFiles = commonAna.writeFiles
    readIssuesInColumns = commonAna.readIssuesInColumns
    getInstFromCUSerial = commonAna.getInstFromCUSerial
    getPath = commonAna.getPath
    parseZipFilename = zippedLogs.parseZipFilename
    getLogsFromZip = zippedLogs.getLogsFromZip
else:
    from commonAna import setupLogger, parseArguments, getLogs, writeFiles, readIssuesInColumns, getInstFromCUSerial, getPath  # type: ignore
    from zippedLogs import parseZipFilename, getLogsFromZip  # type: ignore

# python photoAna.py -v -p tmp/test-zip -z /Users/amleivar/Downloads/cuxs_26GT63WB_2022_01_18-15_50_34.zip

def goGetIt(logger, args, services, listFiltered, listTagged, tags):
    # Create output path
    path = getPath(args.pathPrefix, args.installation, args.date)
    Path(path).mkdir(parents=True, exist_ok=True)

    # Parse log level filter (e.g. "INFO,DEBUG" → ["INFO","DEBUG"])
    levels = [l.strip() for l in args.levels.split(",") if l.strip()] if getattr(args, 'levels', '') else None

    if args.zipLogs is not None:
        logs = getLogsFromZip(logger, services, path, args.zipLogs)
    else:
        # Go to elastic and get what we need
        logs = getLogs(logger, args.env, args.country, args.installation, path, services, args.date, args.startMinutes, args.endMinutes, cuSerial=args.cuSerial, levels=levels)

    # Parse the exclude keywords (strip whitespace so 'photo, camera' works correctly)
    exclude_keywords = [kw.strip() for kw in args.exclude.split(",") if kw.strip()] if args.exclude else []

    # Parse the include keywords (strip whitespace so 'photo, camera' works correctly)
    include_keywords = [kw.strip() for kw in args.include.split(",") if kw.strip()] if args.include else []

    # Pass include_keywords to writeFiles
    writeFiles(logger, path, logs, listFiltered, listTagged, tags, exclude_keywords, include_keywords)

def main():
    args = parseArguments()

    # Setup logger
    logger = setupLogger(logging.INFO if args.verbose == 0 else logging.DEBUG)
    logger.debug("Parsing kibana log")

    # Setup configuration
    configModule = importlib.import_module(args.configFile)

    # If using the unified conf_all, select the right preset and wrap as a module-like object
    if hasattr(configModule, 'CONFIGS'):
        import types
        config_name = getattr(args, 'configName', 'All') or 'All'
        cfg = configModule.CONFIGS.get(config_name, configModule.CONFIGS['All'])
        configModule = types.SimpleNamespace(
            services=cfg.get('services', []),
            tags=cfg.get('tags', []),
            listTagged=cfg.get('listTagged', []),
            listFiltered=cfg.get('listFiltered', []),
        )
        print(f"Config preset loaded: {config_name} ({len(configModule.services)} services)")

    if args.zipLogs is not None:
        args.installation, args.date = parseZipFilename(logger, args.zipLogs)
        goGetIt(logger, args, configModule.services, configModule.listFiltered, configModule.listTagged, configModule.tags)
    elif args.bulkFile is not None:
        issues = readIssuesInColumns(logger, args.bulkFile)
        for issue in issues:
            logger.debug("-%s- -> -%s-" % (issue[0], issue[1]))
            args.installation = issue[0]
            args.date = issue[1]
            goGetIt(logger, args, configModule.services, configModule.listFiltered, configModule.listTagged, configModule.tags)
    else:
        if not args.installation:
            platform = getInstFromCUSerial(args.env, args.cuSerial)
            if platform is None:
                logger.warning("No se encontró configuración en DCR para el CU serial proporcionado. Se usarán valores por defecto.")
                args.country = args.country if hasattr(args, 'country') and args.country else "ES"
                args.installation = args.cuSerial  # o dejar vacío si prefieres
            else:
                args.country = platform["country"]
                args.installation = platform["installationNumber"]
        goGetIt(logger, args, configModule.services, configModule.listFiltered, configModule.listTagged, configModule.tags)
    
    logger.debug("Exiting app")
    return 0

#######################
# Main
#######################
if __name__ == '__main__':
    exit(main())