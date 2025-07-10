# Installation Requirements

This directory contains installation files for ElasticLogana.

## Required Files (Download Separately)

Due to file size limitations, please download these installers manually:

### Java Development Kit
- **File**: `OpenJDK21U-jdk_x64_windows_hotspot_21.0.7_6.msi`
- **Source**: https://adoptium.net/temurin/releases/
- **Version**: OpenJDK 21 or higher
- **Platform**: Windows x64

### Python
- **File**: `python-3.13.3-amd64.exe`
- **Source**: https://python.org/downloads/
- **Version**: Python 3.13 or higher
- **Platform**: Windows x64

## Installation Scripts

- `install_and_start_elasticlogana_WINDOWS.bat` - Windows installation
- `install_and_start_elasticlogana_LINUX.sh` - Linux/macOS installation
- `requirements.txt` - Python dependencies

## Manual Installation

1. Install Java 21+ from the link above
2. Install Python 3.13+ from the link above
3. Run: `pip install -r requirements.txt`
4. Execute: `java -jar ElasticLoganaGUI.jar`

## Quick Links

- [Java Downloads](https://adoptium.net/temurin/releases/)
- [Python Downloads](https://python.org/downloads/)
