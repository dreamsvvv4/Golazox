import logging
import json
import datetime
import time
import os
import tempfile
from elasticsearch import Elasticsearch

MAX_SCROLL_RESULTS = 1_000_000  # Hard safety cap to avoid exhausting memory
# Cooperative cancellation: Java creates this file when the user clicks Stop
CANCEL_SIGNAL_FILE = os.path.join(tempfile.gettempdir(), "ukd_cancel.signal")

logger = logging.getLogger("kibanaParserLogger")

class ElasticSearch:
    def __init__(self, sn=None, startMinutes=10, endMinutes=10, installation_number=None):
        self.sn = sn
        self.installation_number = installation_number
        self.startMinutes = startMinutes
        self.endMinutes = endMinutes
        self.es = Elasticsearch(
            cloud_id="moonshot-cu-paris:ZXUtd2VzdC0zLmF3cy5lbGFzdGljLWNsb3VkLmNvbSRiZjA1NGEwZWJiOTk0OTMzYTY5Mzk5YjY5N2RjYzY0NCQ5OWE3MjZlMmNhMTA0YjY2OTQ1ZjI4ODE2ZDllZTJmNw==",
            api_key=("WVIvOIcB2rFKcJ2PoTHY", "hu5lM1ERQWSqQK6CUWSINg"),
            max_retries=3
        )
        self.jsonSearchFile = os.path.join(os.path.dirname(__file__), 'elastic-search.json')
    
    def getHitsAround(self, dateAround, services):
        # Date to search is in UTC, but our findings usually are set to spanish time (+1 / +2)
        ts = time.time()
        utc_offset = (datetime.datetime.fromtimestamp(ts) - datetime.datetime.utcfromtimestamp(ts)).total_seconds()
        dateAroundUtc = dateAround - datetime.timedelta(seconds=utc_offset)
        logger.debug(dateAroundUtc)

        print("PROGRESS: Initializing Elasticsearch query...")
        print("-" * 44)
        jsData = self.getRequestParams(dateAroundUtc, services)
        
        # Check if we need to use scroll API due to large result set
        requestedSize = int(jsData.get("size", "10000"))
        
        if requestedSize > 10000:
            # Use scroll API for large result sets
            print("PROGRESS: Preparing to fetch up to %s logs using scroll API..." % requestedSize)
            logger.debug("Using scroll API for large result set of %s" % requestedSize)
            logs = self.getHitsWithScroll(jsData, requestedSize)
            self._printCoverageSummary(dateAroundUtc, logs)
            return logs
        else:
            # Use regular search for smaller result sets
            print("PROGRESS: Searching for logs...")
            response = self.es.search(index="cuxs_src", body=jsData)
            totalFound = response['hits']['total']['value']
            print("PROGRESS: Found %s logs, retrieving them..." % totalFound)
            print("PROGRESS: Retrieved %s/%s logs (100.0%%)" % (totalFound, totalFound))
            print("PROGRESS: Completed! Final result: %s logs retrieved" % totalFound)
            print("-" * 44)
            logger.debug("Logs found %s" % totalFound)
            logs = self.parseHits(response)
            self._printCoverageSummary(dateAroundUtc, logs)
            return logs

    def getHitsWithScroll(self, jsData, maxResults):
        # Clear any stale cancel signal left from a previous session before starting
        try:
            if os.path.exists(CANCEL_SIGNAL_FILE):
                os.remove(CANCEL_SIGNAL_FILE)
        except:
            pass

        # Set scroll batch size to 10000 (maximum allowed)
        jsData["size"] = "10000"
        
        # Initial search with scroll
        response = self.es.search(
            index="cuxs_src", 
            body=jsData,
            scroll='5m'  # Keep scroll alive for 5 minutes
        )
        
        totalFound = response['hits']['total']['value']
        print("PROGRESS: Total logs found: %s" % totalFound)
        
        # Determine how many we'll actually retrieve
        originalRequested = maxResults
        if totalFound > maxResults:
            expandedTarget = min(totalFound, MAX_SCROLL_RESULTS)
            if expandedTarget > originalRequested:
                print(
                    "PROGRESS: Requested %s logs but %s are available. Expanding limit to %s (cap: %s)."
                    % (originalRequested, totalFound, expandedTarget, MAX_SCROLL_RESULTS)
                )
            if totalFound > MAX_SCROLL_RESULTS:
                print(
                    "WARNING: There are %s logs in the selected time range. To protect memory, only the most recent %s logs will be downloaded."
                    % (totalFound, MAX_SCROLL_RESULTS)
                )
            maxResults = expandedTarget
        else:
            maxResults = min(maxResults, MAX_SCROLL_RESULTS)

        actualLimit = maxResults
        print("PROGRESS: Will retrieve up to %s logs" % actualLimit)
        
        logger.debug("Total logs found: %s" % totalFound)
        
        # Parse initial batch
        all_logs = self.parseHits(response)
        
        # Avoid division by zero when no logs are found
        if actualLimit > 0:
            _pct = min((len(all_logs) / actualLimit) * 100, 99.0)
            print("PROGRESS: Retrieved %s/%s logs (%.1f%%)" % (min(len(all_logs), actualLimit), actualLimit, _pct))
        else:
            print("PROGRESS: Retrieved %s logs (no logs found in query)" % len(all_logs))
        
        # Get scroll ID for pagination
        scroll_id = response['_scroll_id']
        
        # Keep scrolling until we get all results or reach maxResults
        while len(response['hits']['hits']) > 0 and len(all_logs) < maxResults:
            # Cooperative cancellation: check for signal file before each network call
            if os.path.exists(CANCEL_SIGNAL_FILE):
                # Consume (delete) the signal so the next download starts clean
                try:
                    os.remove(CANCEL_SIGNAL_FILE)
                except:
                    pass
                print("PROGRESS: Download cancelled by user.")
                print("=" * 50)
                try:
                    self.es.clear_scroll(scroll_id=scroll_id)
                except:
                    pass
                return all_logs
            response = self.es.scroll(scroll_id=scroll_id, scroll='5m')
            batch_logs = self.parseHits(response)
            all_logs.extend(batch_logs)

            # Calculate percentage and show progress (capped at 99% until completion)
            if actualLimit > 0:
                percentage = min((len(all_logs) / actualLimit) * 100, 99.0)
                shown_logs = min(len(all_logs), actualLimit)
                print("PROGRESS: Retrieved %s/%s logs (%.1f%%)" % (shown_logs, actualLimit, percentage))
            else:
                print("PROGRESS: Retrieved %s logs" % len(all_logs))
            logger.debug("Retrieved %s logs so far..." % len(all_logs))
            
            # Break if no more results
            if len(response['hits']['hits']) == 0:
                break
                
            # Update scroll ID
            scroll_id = response['_scroll_id']
        
        # Sort once after all batches (far more efficient than sorting after each batch)
        all_logs.sort(key=lambda k: k['ts'])

        # Clear scroll to free resources
        try:
            self.es.clear_scroll(scroll_id=scroll_id)
        except:
            pass  # Ignore cleanup errors
        
        # Trim to maxResults if necessary
        if len(all_logs) > maxResults:
            all_logs = all_logs[:maxResults]
            print("PROGRESS: Trimmed results to maximum of %s logs" % maxResults)
            
        print("PROGRESS: Completed! Final result: %s logs retrieved" % len(all_logs))
        print("-" * 44)
        logger.debug("Final result: %s logs retrieved" % len(all_logs))
        return all_logs

    def _printCoverageSummary(self, centerDateUtc, logs):
        """Print expected vs actual time coverage summary for diagnostics."""
        try:
            expectedStart = centerDateUtc - datetime.timedelta(minutes=self.startMinutes)
            expectedEnd = centerDateUtc + datetime.timedelta(minutes=self.endMinutes)
            expectedSpanDays = (expectedEnd - expectedStart).total_seconds() / 86400.0
            print("PROGRESS: Expected window UTC: %s -> %s (%.2f days)" % (
                expectedStart.strftime('%Y-%m-%dT%H:%M:%SZ'),
                expectedEnd.strftime('%Y-%m-%dT%H:%M:%SZ'),
                expectedSpanDays
            ))
            if logs:
                actualStart = min(l['ts'] for l in logs)
                actualEnd = max(l['ts'] for l in logs)
                actualSpanDays = (actualEnd - actualStart).total_seconds() / 86400.0
                print("PROGRESS: Actual logs span local: %s -> %s (%.2f days, %d logs)" % (
                    actualStart.strftime('%Y-%m-%d %H:%M:%S'),
                    actualEnd.strftime('%Y-%m-%d %H:%M:%S'),
                    actualSpanDays,
                    len(logs)
                ))
                # Simple gap detection (allow 5 minute buffer)
                if actualStart > expectedStart + datetime.timedelta(minutes=5):
                    pass  # Gap at start (possible retention window)
                if actualEnd < expectedEnd - datetime.timedelta(minutes=5):
                    pass  # Gap at end (possible scroll cap)
            else:
                print("PROGRESS: No logs retrieved inside expected window.")
        except Exception as e:
            print("WARNING: Could not compute coverage summary: %s" % e)

    def getRequestParams(self, dateAround, services):
        with open(self.jsonSearchFile) as jsonFile:
            jsonObject = json.load(jsonFile)
            jsonFile.close()
        
        # Calculate dynamic size limit based on time range
        # Estimate: ~10 logs per minute on average, with a safety multiplier
        totalMinutes = self.startMinutes + self.endMinutes
        estimatedSize = max(10000, totalMinutes * 20)  # At least 10k, or 20 logs per minute
        # Cap at 500k to avoid memory issues and be more reasonable
        dynamicSize = min(estimatedSize, 500000)
        jsonObject["size"] = str(dynamicSize)
        
        # Set SN or installation number, pero nunca ambos
        for idx, item in enumerate(jsonObject["query"]["bool"]["filter"]):
            if "match_phrase" in item:
                if self.sn:
                    item["match_phrase"] = {"sd.device.serial_number": self.sn}
                elif self.installation_number:
                    item["match_phrase"] = {"sd.installation.number": self.installation_number}

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
        
        # logger.debug(jsonObject)

        return jsonObject

    def getDate(self, hit):
        ts = time.time()
        utc_offset = (datetime.datetime.fromtimestamp(ts) - datetime.datetime.utcfromtimestamp(ts)).total_seconds()

        # Some traces won't have the sd.device.src_timestamp field
        if "sd.device.src_timestamp" in hit["fields"]:
            d = datetime.datetime.strptime(hit["fields"]["sd.device.src_timestamp"][0], '%Y-%m-%dT%H:%M:%S.%fZ')
            d = d + datetime.timedelta(seconds=utc_offset)
        else:
            logger.info("%s" % (hit))
            d = datetime.datetime.strptime(hit["fields"]["@timestamp"][0], '%Y-%m-%dT%H:%M:%S.%fZ')
        return d

    def iso8601Conversor(self, tsIso):
        d = datetime.datetime.strptime(tsIso, '%Y-%m-%dT%H:%M:%S.%fZ')
        return d.strftime('%Y-%m-%d %H:%M:%S.%f')

    def parseHits(self, jsResponse):
        logs = []
        for hit in jsResponse["hits"]["hits"]:
            # logger.debug(hit)
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
