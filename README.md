# ElasticLogana

Advanced Elasticsearch log analytics tool with modern GUI interface for efficient log downloading and analysis.

## Overview

ElasticLogana is a professional tool designed for downloading and analyzing logs from Elasticsearch clusters. It features a modern Java Swing interface with Python backend processing capabilities.

## Key Features

- **Modern GUI Interface**: Clean, professional Java Swing application
- **Elasticsearch Integration**: Direct connection to Elasticsearch clusters
- **Unlimited Downloads**: Uses Elasticsearch scroll API for large datasets
- **Real-time Progress**: Live feedback during download operations
- **Multi-format Support**: JSON, filtered, and compressed log outputs
- **Cross-platform**: Windows, Linux, and macOS support
- **Automated Processing**: Built-in filtering, ordering, and compression

## Quick Start

### Prerequisites
- Java 21 or higher
- Python 3.13 or higher
- Network access to Elasticsearch cluster

### Installation

#### Windows
```bash
# Navigate to project directory
cd ElasticLogana

# Run the application
java -jar ElasticLoganaGUI.jar
```

#### Linux/macOS
```bash
# Make scripts executable
chmod +x Requirements/install_and_start_elasticlogana_LINUX.sh

# Run installation
./Requirements/install_and_start_elasticlogana_LINUX.sh
```

### Python CLI Usage
```bash
# Direct Python execution
python main.py
## Project Structure

```
├── ElasticLoganaGUI.jar          # Main GUI application
├── main.py                       # Python CLI interface
├── ElasticSearch.py             # Elasticsearch client
├── Services.py                  # Service configuration
├── conf*.py                     # Log type configurations
├── model/                       # Java model classes
├── ui/                          # UI components
├── Requirements/                # Installation files
└── logs/                        # Output directory
```

## Configuration

The application supports multiple log analysis configurations:

- **confForensic.py** - Forensic log analysis
- **confPhoto.py** - Photo service logs
- **confAudio.py** - Audio service logs
- **confM2M.py** - Machine-to-machine communications
- **ConfDoorlock.py** - Door lock system logs
- **ConfFOTA.py** - Firmware over-the-air updates

## Usage

### GUI Mode
1. Launch: `java -jar ElasticLoganaGUI.jar`
2. Configure Elasticsearch connection
3. Set time range and filters
4. Start download and analysis

### CLI Mode
```bash
python main.py
```

## Requirements

- **Java**: OpenJDK 21 or higher
- **Python**: 3.13 or higher
- **Elasticsearch**: Compatible with v8.x
- **Network**: Access to Elasticsearch cluster

## Output

Generated files are saved to the `logs/` directory:
- **filtered.log** - Processed log entries
- **ordered.log** - Chronologically sorted logs
- **tagged.log** - Logs with additional metadata
- **config.log** - Configuration and summary

## Contributing

This project is developed for Verisure internal use. For questions or improvements, please contact the development team.

## License

Internal use only - Verisure Security Systems.

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
