# Ultra KibanaDownloader - Advanced Elasticsearch Log Analytics

A powerful, professional GUI application for downloading and analyzing logs from Elasticsearch with automated installation and modern interface.

## Features

- **Modern Java Swing GUI** with clean, professional design
- **Unlimited log downloads** using Elasticsearch scroll API
- **Real-time progress feedback** during download operations
- **Automated installation** with included installers for Java and Python
- **Cross-platform support** (Windows, Linux, macOS)
- **Default 30-minute time range** for optimal performance
- **Automatic log processing** with filtering, ordering, and compression

## Quick Start

### Windows (Recommended)
1. Extract the project folder
2. Run: `Requirements\install_and_start_elasticlogana_WINDOWS.bat`
3. Application will start automatically

### Linux/Mac
1. Extract the project folder
2. Run: `chmod +x Requirements/install_and_start_elasticlogana_LINUX.sh`
3. Run: `./Requirements/install_and_start_elasticlogana_LINUX.sh`

## What's Included

### Core Application
- `ElasticLoganaGUI.jar` - Main application (ready to run)
- `main.py` - Python backend for log processing
- `ElasticSearch.py` - Elasticsearch client with scroll API
- Configuration files for different log types

### Installers (Requirements folder)
- `python-3.13.3-amd64.exe` - Python installer
- `OpenJDK21U-jdk_x64_windows_hotspot_21.0.7_6 (1).msi` - Java installer
- `requirements.txt` - Python dependencies
- Installation scripts for Windows and Linux

### Documentation
- This README file
- Source code and configuration files

## Manual Installation

If automatic installation fails:

1. **Install Java 21** (included: `Requirements/OpenJDK21U-jdk_x64_windows_hotspot_21.0.7_6 (1).msi`)
2. **Install Python 3.13** (included: `Requirements/python-3.13.3-amd64.exe`)
3. **Install Python dependencies**:
   ```bash
   # CRITICAL: Install elasticsearch 8.12.1 first
   pip install elasticsearch==8.12.1
   pip install -r Requirements/requirements.txt
   ```
4. **Run application**:
   ```bash
   java -jar ElasticLoganaGUI.jar
   ```

## Usage

1. **Launch** the application
2. **Configure connection**:
   - Elasticsearch server URL
   - Installation ID
   - Date/time range (default: 30 minutes)
3. **Download logs** - click "Download" button
4. **View results** in the `logs/` folder

## Output Structure

```
logs/
├── {INSTALLATION_ID}_{TIMESTAMP}/
│   ├── config.log          # Applied configuration
│   ├── filtered.log        # Filtered logs
│   ├── ordered.log         # Time-ordered logs
│   ├── tagged.log          # Tagged logs
│   └── {ID}_{TIME}.zip     # Compressed archive
```

## System Requirements

- **Java**: 8 or higher (Java 21 recommended, installer included)
- **Python**: 3.8 or higher (Python 3.13 included)
- **Network**: Access to Elasticsearch server
- **Disk space**: Varies based on log volume

## Critical Dependencies

⚠️ **IMPORTANT**: Must use exactly `elasticsearch==8.12.1`. Other versions may cause compatibility issues.

## Troubleshooting

### "Java not found"
- Install Java using included MSI file
- Verify Java is in system PATH

### "Python not found"
- Install Python using included EXE file
- Check "Add Python to PATH" during installation

### "Elasticsearch version mismatch"
- Uninstall other versions: `pip uninstall elasticsearch`
- Install correct version: `pip install elasticsearch==8.12.1`

### "Connection refused"
- Verify Elasticsearch server URL
- Check network connectivity
- Verify access credentials

## Project Structure

```
ElasticLogana/
├── ElasticLoganaGUI.jar           # Main application
├── main.py                       # Python backend
├── ElasticSearch.py              # Elasticsearch client
├── model/Configuration.java      # Configuration model
├── ui/components/                # UI components
├── conf*.py                      # Configuration files
├── logs/                         # Output directory
└── Requirements/                 # Installers and dependencies
    ├── python-3.13.3-amd64.exe
    ├── OpenJDK21U-jdk_x64_windows_hotspot_21.0.7_6 (1).msi
    ├── requirements.txt
    ├── install_and_start_elasticlogana_WINDOWS.bat
    └── install_and_start_elasticlogana_LINUX.sh
```

## Technical Details

- **GUI Framework**: Java Swing with modern styling
- **Backend**: Python with Elasticsearch client
- **Log Processing**: Filtering, ordering, and compression
- **Memory Management**: Efficient handling of large log volumes
- **Error Handling**: Comprehensive error reporting and recovery

## Distribution

This project is ready for immediate distribution and use. All dependencies and installers are included for a complete, self-contained package.

## Support

For issues or questions:
1. Check this documentation
2. Verify network connectivity
3. Review error messages in the application
4. Contact the development team

---

**Ultra KibanaDownloader** - Advanced log analytics tool engineered for professional Elasticsearch environments.
