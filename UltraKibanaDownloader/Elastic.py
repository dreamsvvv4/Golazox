import logging
import requests
from requests.auth import HTTPBasicAuth
import json
import urllib3
import datetime
import time
from elasticsearch import Elasticsearch

logger = logging.getLogger("kibanaParserLogger")
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class Elastic:
    def __init__(self, env, sn, startMinutes, endMinutes):
        self.sn = sn
        self.startMinutes = startMinutes
        self.endMinutes = endMinutes
        if env == "vs-epi":
            self.url = "http://elastic-epi.securitasdirect.local:5601/cuxs/_search"
        else:
            self.url = "https://elastic-pro.securitasdirect.local:9200/cuxs/_search"
        self.headers = { "Content-Type": "application/json" }
        self.user = "read-API"
        self.pwd = "7QAXhS5y@a"
        self.jsonSearchFile = "elastic-search.json"
    
    def getHitsAround(self, dateAround, services):
        # Date to search is in UTC, but our findings usually are set to spanish time (+1 / +2)
        ts = time.time()
        utc_offset = (datetime.datetime.fromtimestamp(ts) - datetime.datetime.utcfromtimestamp(ts)).total_seconds()
        dateAroundUtc = dateAround - datetime.timedelta(seconds=utc_offset)
        logger.debug(dateAroundUtc)

        jsData = self.getRequestParams(dateAroundUtc, services)
        with requests.post(self.url, headers=self.headers, json=jsData, verify=False, auth=(self.user, self.pwd)) as r:
            r.raise_for_status()
            jsResponse = r.json()
        logger.debug("Logs found %s" % (jsResponse['hits']['total']['value']))

        return self.parseHits(jsResponse)

    def getRequestParams(self, dateAround, services):
        with open(self.jsonSearchFile) as jsonFile:
            jsonObject = json.load(jsonFile)
            jsonFile.close()
        
        # Set SN
        for item in jsonObject["query"]["bool"]["filter"]:
            if "match_phrase" in item:
                item["match_phrase"]["sd.device.serial_number"] = self.sn

        # Set time limits
        for item in jsonObject["query"]["bool"]["filter"]:
            if "range" in item:
                deltaMinutesStart = datetime.timedelta(minutes=self.startMinutes)
                deltaMinutesEnd = datetime.timedelta(minutes=self.endMinutes)
                item["range"]["@timestamp"]["gte"] = (dateAround - deltaMinutesStart).strftime("%Y-%m-%dT%H:%M:%SZ")
                item["range"]["@timestamp"]["lte"] = (dateAround + deltaMinutesEnd).strftime("%Y-%m-%dT%H:%M:%SZ")

        for item in jsonObject["query"]["bool"]["filter"]:
            if "bool" in item:
                if services:
                    for service in services:
                        item["bool"]["should"].append({ "match_phrase": { "service.name": service } })
                else:
                    del item
        
        logger.debug(jsonObject)

        return jsonObject

    def getDate(self, hit):
        ts = time.time()
        utc_offset = (datetime.datetime.fromtimestamp(ts) - datetime.datetime.utcfromtimestamp(ts)).total_seconds()

        # Some traces won't have the sd.device.src_timestamp field
        if "sd.device.src_timestamp" in hit["fields"]:
            # bug ofono/gsmsrv wrong date starts with +
            if hit["fields"]["sd.device.src_timestamp"][0][0] == "+":
                d = datetime.datetime.strptime(hit["fields"]["@timestamp"][0], '%Y-%m-%dT%H:%M:%S.%fZ')
                logger.info("%s" % (hit))
            else:
                d = datetime.datetime.strptime(hit["fields"]["sd.device.src_timestamp"][0], '%Y-%m-%d %H:%M:%S.%f')
                # if "service.name" in hit["fields"]:
                #     # bug ofono/gsmsrv are on UTC
                #     if(hit["fields"]["service.name"][0] == "gsmsrv" or hit["fields"]["service.name"][0] == "ofonod"):
                #         # TODO - offset may vary depending on country
                #         d = d + datetime.timedelta(seconds=utc_offset)
        else:
            # logger.info("%s" % (hit))
            d = datetime.datetime.strptime(hit["fields"]["@timestamp"][0], '%Y-%m-%dT%H:%M:%S.%fZ')
        return d

    def iso8601Conversor(self, tsIso):
        d = datetime.datetime.strptime(tsIso, '%Y-%m-%dT%H:%M:%S.%fZ')
        return d.strftime('%Y-%m-%d %H:%M:%S.%f')

    def parseHits(self, jsResponse):
        logs = []
        for hit in jsResponse["hits"]["hits"]:
            #logger.debug(hit)
            if "log.original" in hit["fields"]:
                log = {
                    "ts": self.getDate(hit),
                    "level": hit["fields"]["log.level"][0],
                    "service": hit["fields"]["service.name"][0] if "service.name" in hit["fields"] else "",
                    "class": hit["fields"]["uidevices.classname"][0] if "uidevices.classname" in hit["fields"] else "",
                    "log": hit["fields"]["log.original"][0],
                    "tags": hit["fields"]["tags"],
                    "f1": hit["fields"]["uidevices.tag1"][0] if "uidevices.tag1" in hit["fields"] else "",
                    "f2": hit["fields"]["uidevices.tag2"][0] if "uidevices.tag2" in hit["fields"] else "",
                    "f3": hit["fields"]["uidevices.tag3"][0] if "uidevices.tag3" in hit["fields"] else "",
                    "f4": hit["fields"]["uidevices.tag4"][0] if "uidevices.tag4" in hit["fields"] else "",
                    "f5": hit["fields"]["uidevices.tag5"][0] if "uidevices.tag5" in hit["fields"] else ""
                }
                logs.append(log)
            else:
                logger.warning("log.original not found on hit: %s" % (hit))
            

        #return sorted(logs, key=lambda k:datetime.datetime.strptime(k['ts'], '%Y-%m-%d %H:%M:%S.%f'))
        return sorted(logs, key=lambda k:k['ts'])
