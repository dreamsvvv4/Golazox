# UltraKibanaDownloader — Release Notes v4.0

**Date:** March 2026

---

### New Features

#### Stop Button
Added a **Stop** button that allows the user to cancel an ongoing download at any point. The process terminates cleanly and the partial results are discarded.

#### Now Button
Added a **Now** button next to the Date field. Clicking it fills in the current date and time automatically, avoiding manual input errors.

#### Trace Level Filter
New **Trace Level** selector in the form (between *Country* and *Config*). The filter is applied directly at the Elasticsearch query level, so only logs matching the selected level are downloaded — reducing transfer time and file size.

| Option | Levels downloaded        |
|--------|--------------------------|
| All    | DEBUG, INFO, WARN, ERROR |
| Debug  | DEBUG only               |
| Info   | INFO only                |
| Warn   | WARN / WARNING           |
| Error  | ERROR only               |

#### Exact Phrase Search in Include / Exclude
The *Include* and *Exclude* fields now support exact phrase matching in addition to single keywords. Wrap a phrase in double quotes to require an exact match:

| Input | Behaviour |
|-------|-----------|
| `camera` | Matches any line containing the word *camera* |
| `"svk init"` | Matches only lines containing that exact sequence |
| `camera, "svk init", photo` | Matches lines containing any of the three terms |

---

### UI Improvements

#### Colored Console Output
The output console now uses syntax coloring for faster visual scanning:

| Color  | Meaning                        |
|--------|--------------------------------|
| Blue   | Progress messages              |
| Green  | Success / download complete    |
| Red    | Errors and failures            |
| Amber  | Section headers and warnings   |
| Gray   | Standard output / separators   |

