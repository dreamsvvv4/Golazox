from ctypes import sizeof
import logging
import argparse
import datetime
import zipfile
import os
from pathlib import Path
import re

# cuxs_26GT63WB_2022_01_18-15_50_34.zip
def parseZipFilename(logger, path):
    filename = os.path.basename(path)
    snPart = filename[5:13]
    datePart = filename[14:33]
    logger.debug("filename -%s- snPart -%s- date -%s-" % (filename, snPart, datePart) )
    installation = snPart
    date = datetime.datetime.strptime(datePart, '%Y_%m_%d-%H_%M_%S')
    return installation, date

def getLogsFromZip(logger, reqServices, path, zipFile):
    unzippedPath = path / "unzipped"
    logger.debug("Extracting zip to -%s-" % (unzippedPath))
    with zipfile.ZipFile(zipFile, 'r') as zip_ref:
        zip_ref.extractall(unzippedPath)

    logs = []
    for file in unzippedPath.glob("**/*.log*"):
        strFile = str(file)
        if any(service in strFile for service in reqServices) or len(reqServices)==0:
            with open(file) as f:
                lines = f.read().splitlines()
                if len(lines) > 0:
                    # Detect if log file is from xloglib
                    if isLogXloglibLine(logger, lines[0]):
                        for line in lines:
                            log = parseLogXloglib(logger, line)
                            if log:
                                logs.append(log)

    return sorted(logs, key=lambda k:k['ts'])

def isLogXloglibLine(logger, line):
    openBrackets = line.count('[')
    closeBrackets = line.count(']')
    return openBrackets>4

def parseLogOriginal(logger, logOrig):
    tag = ""
    fVals = []
    logOrigCopy = logOrig

    if logOrig.startswith("#TAG="):
        splitted = logOrig.split("#TAG=")[1].split("#")
        tag = splitted[0]
        logOrig = splitted[1]

        # Found all (fN=XXXXX)
        while logOrig[0] == "(":
            closing = logOrig.find(")")
            param = logOrig[1:closing].split("=")[1]
            fVals.append(param)
            if(closing > 0):
                logOrig = logOrig[closing+1:]
            else:
                logOrig = logOrig[1:]
        
        logOrig = logOrig[1:]

    return logOrig, tag, fVals

# [2022-01-17 08:23:17.043] [cuxs-situationd] [1352] [info] [Logger.cpp:45_start] ******* Starting process *******
def parseLogXloglib(logger, line):
    log = None
    vals = re.findall(r"\[(.*?)\]", line)
    if len(vals) == 5:
        logOriginal = line.rsplit("] ", 1)[1]
        logOriginalParsed, tag, fVals = parseLogOriginal(logger, logOriginal)
        log = {
            "ts": datetime.datetime.strptime(vals[0], '%Y-%m-%d %H:%M:%S.%f'),
            "service": vals[1],
            "class": vals[4],
            "log": logOriginalParsed,
            "tags": tag,
            "f1": fVals[0] if len(fVals)>=1 else "",
            "f2": fVals[1] if len(fVals)>=2 else "",
            "f3": fVals[2] if len(fVals)>=3 else "",
            "f4": fVals[3] if len(fVals)>=4 else "",
            "f5": fVals[4] if len(fVals)>=5 else ""
        }
    return log