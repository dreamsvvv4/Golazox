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
                self.printDevices(outF)
                self.printFramesConfig(outF)

    def printDevices(self, outF):
        for item in self.jsConfig["nodes"]:
            trace = ""
            if "type" in item:
                if item["type"] == 102:
                    trace = "PIR     %s -> %s" % (item["zoneId"], item["serialNumber"])
                elif item["type"] == 103:
                    trace = "CROPTEX %s -> %s" % (item["zoneId"], item["serialNumber"])
                elif item["type"] == 106:
                    trace = "ORION   %s -> %s MAC:%s" % (item["zoneId"], item["serialNumber"], item["config"]["mac"])
                elif item["type"] == 140:
                    trace = "PORTAL   %s -> %s MAC:%s" % (item["zoneId"], item["serialNumber"], item["config"]["mac"])
                elif item["type"] == 101:
                    trace = "MAG     %s -> %s" % (item["zoneId"], item["serialNumber"])
                elif item["type"] == 142:
                    trace = "SVK     %s -> %s" % (item["zoneId"], item["serialNumber"])
                else:
                    trace = "%s     %s -> %s" % (item["type"], item["zoneId"], item["serialNumber"])

            if trace:
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



    # curl -s -k -X GET "https://es-apim-appservice.gtm.securitasdirect.local:8243/device-support/device-config-repository/v2.0/installation/ES3717707" 
    # -H "accept: application/json" -H "Authorization: Bearer 823742c2-ad17-3cca-bbfd-db0406da4568" |
    # jq '.confByDeviceType[] | select(.type == (102,103,106))' | grep -E 'type|framesNumber'
    def getConfig(self):
        url = self.apimUrl + "/device-support/device-config-repository/v2.0/installation/" + self.country2Digits + str(self.inst)
        with requests.get(url, headers=self.headers, verify=False) as r:
            r.raise_for_status()
            jsResponse = r.json()
        return jsResponse




