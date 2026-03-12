# Ultra Kibana Traces Downloader

Full distribution (JAR + Python package + installers + scripts).

---

## 🔵 What is Ultra Kibana Traces Downloader?

**Ultra Kibana Traces Downloader** is a graphical application that downloads traces/logs from Kibana OnCloud using an **Installation ID** or **Serial Number** and a reference **date/time**.

Logs are stored locally for troubleshooting, analysis, automation and sharing.

---

## 🧠 Requirements

Ultra Kibana Traces Downloader is **cross-platform** and works on **Windows** and **Linux**.
It requires Java, Python, and the internal Python package to be present in the **same folder** as the `.jar`.

---

## 🪟 Windows Installation

### ✔ Requirements (Windows)

- Java 21+
- Python 3.11+ (3.13 compatible)
- Network access to Kibana/Elasticsearch OnCloud
- All project folders must remain together

Verify Java:
```powershell
java -version
```

Verify Python:
```powershell
python --version
```

### 📁 Required Folder Structure

Run the `.jar` from the **parent** of the `UltraKibanaDownloader/` folder.  
The Java GUI calls `python -m UltraKibanaDownloader.main`, so the Python package must be resolvable from the working directory.

```
(run from here)
└── UltraKibanaDownloader/
     ├── UltraKibanaDownloader.jar
     ├── __init__.py
     ├── main.py
     ├── analizar_json.py
     ├── commonAna.py
     ├── conf_all.py
     ├── csvParser.py
     ├── csvParserGUI.py
     ├── elastic-search.json
     ├── Elastic.py
     ├── ElasticSearch.py
     ├── Installation.py
     ├── Services.py         ← overwritten if Custom is used
     ├── user-settings.properties
     ├── zippedLogs.py
     ├── components/
     │    ├── AutoCompleteTextField.java
     │    ├── DateInputField.java
     │    ├── EnhancedOutputArea.java
     │    └── ModernProgressBar.java
     ├── model/
     │    └── Configuration.java
     └── Requirements/
          ├── install_and_start_elasticlogana_WINDOWS.bat
          ├── install_and_start_elasticlogana_LINUX.sh
          ├── install_windows.ps1
          ├── install_linux.sh
          └── requirements.txt
```

> ⚠️ **Critical:** Running the `.jar` alone will fail.  
> The Python package must be in the same folder because the Java GUI calls:  
> `python -m UltraKibanaDownloader.main`

### 📦 Python Dependencies (Windows)

Dependencies file: `Requirements/requirements.txt`

Key dependencies:
```
elasticsearch==7.17.10
requests
Pillow
beautifulsoup4
python-dotenv
```

**Install (recommended):**
```powershell
Requirements\install_and_start_elasticlogana_WINDOWS.bat
```

**Manual installation:**
```powershell
cd UltraKibanaDownloader
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r .\Requirements\requirements.txt
```

### ▶️ Run (Windows)

```powershell
java -jar UltraKibanaDownloader\UltraKibanaDownloader.jar
```

From source (if you compile manually):
```powershell
javac UltraKibanaDownloader\components\*.java UltraKibanaDownloader\model\*.java UltraKibanaDownloader\*.java
java -cp . UltraKibanaDownloader.UltraKibanaDownloader
```

---

## 🐧 Linux Installation

### ✔ Requirements (Linux)

- Java 17+ (21 recommended)
- Python 3.11+
- `pip3`, `python3-venv`, `python3-tk`
- Same project structure as Windows
- Network access to Kibana OnCloud

### ☕ Install Java + Python (Linux)

```bash
sudo apt-get update
sudo apt-get install -y openjdk-21-jdk python3 python3-pip python3-venv python3-tk
```

Verify:
```bash
java -version
python3 --version
python3 -m tkinter
```

### 📦 Install Python Dependencies (Linux)

**Recommended:**
```bash
bash Requirements/install_and_start_elasticlogana_LINUX.sh
```

**Manual:**
```bash
cd UltraKibanaDownloader
python3 -m venv .venv
source .venv/bin/activate
pip install -r ./Requirements/requirements.txt
```

### ▶️ Run (Linux)

```bash
java -jar UltraKibanaDownloader/UltraKibanaDownloader.jar
```

> If Python is not found, the GUI will try `which python3` and then `which python`.

---

## ▶️ How to Run (VS Code)

Use the preconfigured task:

```
Run UltraKibanaDownloader.jar with debug output
```

---

## 🚀 1) Quick Flow (minimum steps)

1. Select **ID Type** (Installation ID / Serial Number).
2. Enter the **ID**.
3. Adjust **Date** (reference date/time).
4. Choose **Time Window** (Previous / Next / Both).
5. Set **Time Range** (amount + unit).
6. Check **Country** and **Config**.
7. Optionally add **Include/Exclude** filters.
8. Click **Download**.
9. Use **Open Log** or **Export ZIP** afterward.

---

## ⚙️ 2) Configuration Fields Explained

| Field | Description |
|---|---|
| **ID Type** | `Installation ID` or `Serial Number` |
| **Enter ID** | Mandatory value to search |
| **Date** | Reference date/time for retrieving logs |
| **Time Window** | `Find Previous` → backwards · `Find Next` → forward · `Find Previous/Next` → split both ways |
| **Time Range** | Amount + unit (`minutes` / `hours` / `days` / `weeks`) |
| **Logs Path** | Directory where logs are saved (changeable with **Select…**) |
| **Country** | `ES`, `PT`, `IT`, `FR`, `DE`, `GB`, `AR`, `CL`, `MX`, `BR` |
| **Config** | `All`, `Photos`, `Calls`, `Communications`, `Doorlock`, `FOTA`, `Custom` |
| **Include** | Keyword filter — must appear in results |
| **Exclude** | Keyword filter — must **not** appear in results |

---

## 🖱️ 3) Buttons (Main Features)

| Button | Action |
|---|---|
| **Download** | Runs the log extraction using selected parameters. Shows progress and outputs the generated files. |
| **Stop** | Cancels the download currently in progress. |
| **Open Log** | Opens the latest `ordered.log` file. |
| **Export ZIP** | Creates a ZIP with the most recent logs. |
| **Clear** | Clears console output (does not delete disk files). |
| **CSV Parser GUI** | Opens an auxiliary CSV processing tool. |
| **Config Download** | Downloads and analyzes the device config using ID + Country. |

---

## 🎛️ 4) Custom Config (Service Selection)

If **Custom** is selected, a service selection window opens with:

- 🔍 Filter services
- ✅ Select All / Deselect All
- ➕ Add service (manual entry)
- ✔ Apply Selection

Use this to download logs only from target services for precise debugging.

---

## 📂 5) Output (What You Get)

Logs are stored in the folder set in **Logs Path**.

The console displays:
- The executed command
- Progress messages
- Percent retrieved
- Final summary: `DOWNLOAD COMPLETED`

You can then:
- Open the result with **Open Log**
- Export everything with **Export ZIP**

---

## ⚠️ 6) Common Issues (Quick Fixes)

### `"ID field is required / Date field is required / Time range is required"`
A mandatory field is missing or non-numeric.

### `"No logs found"`
Try:
- Increasing **Time Range**
- Changing **Time Window**
- Adjusting **Date**
- Confirming **Country**
- Confirming correct **Config** preset

### `"Python executable not found"`
- Python is not installed or not in PATH
- Install Python and make sure it is available in your system PATH
- On Linux: `sudo apt-get install python3`

### `"Python package missing"`
You are running the `.jar` from a folder that does not contain:
```
UltraKibanaDownloader/__init__.py
UltraKibanaDownloader/main.py
```
Checklist:
- [ ] Python installed
- [ ] Python in **PATH**
- [ ] Python package `UltraKibanaDownloader/` present **next to** `.jar`
- [ ] Do **not** run the `.jar` alone from a different folder
