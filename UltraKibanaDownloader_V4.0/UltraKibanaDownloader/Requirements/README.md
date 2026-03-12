# Installation Requirements (UltraKibanaDownloader)

Este directorio contiene scripts y dependencias para ejecutar **UltraKibanaDownloader**.

La aplicación Java (GUI) lanza scripts Python (por ejemplo `python -m UltraKibanaDownloader.main`), así que necesitas **Java** y **Python** instalados.

## Requisitos

### Java

- Recomendado: **OpenJDK 17+** (en este repo se suele usar 21).
- Descarga (Windows/Linux/macOS): https://adoptium.net/temurin/releases/

### Python

- Recomendado: **Python 3.11+**.
- Descarga (Windows/macOS): https://www.python.org/downloads/
- En Linux, normalmente lo instalas con el gestor de paquetes (`python3`, `python3-venv`, `python3-pip`).

## Dependencias Python

- Archivo: `requirements.txt` (este directorio)
- Instalación:
	- Windows (PowerShell): `pip install -r .\Requirements\requirements.txt`
	- Linux (bash): `pip install -r ./Requirements/requirements.txt`

## Scripts de instalación (opcionales)

Estos scripts son interactivos y ayudan a verificar Java/Python y a instalar dependencias:

- `install_windows.ps1`
- `install_linux.sh`

## Ejecución

Desde `UltraKibanaDownloader/`:

- `java -jar UltraKibanaDownloader.jar`

Para más detalle (estructura, troubleshooting, ejecución desde fuentes), ver: `UltraKibanaDownloader/README.md`.
