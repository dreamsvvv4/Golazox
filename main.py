import importlib
import logging
from pathlib import Path
from commonAna import setupLogger, parseArguments, getLogs, writeFiles, readIssuesInColumns, getInstFromCUSerial, getPath
from zippedLogs import parseZipFilename, getLogsFromZip

# python photoAna.py -v -p tmp/test-zip -z /Users/amleivar/Downloads/cuxs_26GT63WB_2022_01_18-15_50_34.zip

def goGetIt(logger, args, services, listFiltered, listTagged, tags):
    # Create output path
    path = getPath(args.pathPrefix, args.installation, args.date)
    Path(path).mkdir(parents=True, exist_ok=True)

    if args.zipLogs is not None:
        logs = getLogsFromZip(logger, services, path, args.zipLogs)
    else:
        # Go to elastic and get what we need
        logs = getLogs(logger, args.env, args.country, args.installation, path, services, args.date, args.startMinutes, args.endMinutes, cuSerial=args.cuSerial)

    # Parse the exclude keywords
    exclude_keywords = args.exclude.split(",") if args.exclude else []

    # Parse the include keywords
    include_keywords = args.include.split(",") if args.include else []

    # Pass include_keywords to writeFiles
    writeFiles(logger, path, logs, listFiltered, listTagged, tags, exclude_keywords, include_keywords)

def main():
    args = parseArguments()

    # Setup logger
    logger = setupLogger(logging.INFO if args.verbose == 0 else logging.DEBUG)
    logger.debug("Parsing kibana log")

    # Setup configuration
    configModule = importlib.import_module(args.configFile)

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