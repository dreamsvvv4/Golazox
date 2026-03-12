@echo off
REM ==========================
REM ElasticLoganaGUI - Instalador de dependencias para Windows
REM Incluye instalacion especifica de elasticsearch==8.12.1
REM ==========================

setlocal enabledelayedexpansion

echo.
echo ==========================================
echo  ElasticLoganaGUI - Instalador Windows
echo ==========================================
echo.

echo [INFO] Verificando Python...
set PYTHON_CMD=
where python >nul 2>&1
if not errorlevel 1 (
    set PYTHON_CMD=python
    echo [OK] Python encontrado: python
) else (
    where python3 >nul 2>&1
    if not errorlevel 1 (
        set PYTHON_CMD=python3
        echo [OK] Python encontrado: python3
    ) else (
        echo [ERROR] Python no encontrado en PATH
        echo [INFO] Instala Python 3.x y agregalo al PATH
        pause
        goto :END
    )
)

echo.
echo [INFO] Instalando dependencias de Python...
set "PYERROR=0"

if exist "%~dp0requirements.txt" (
    echo [INFO] Actualizando pip...
    "%PYTHON_CMD%" -m pip install --upgrade pip || set "PYERROR=1"
    
    echo [CRITICO] Instalando elasticsearch==8.12.1...
    "%PYTHON_CMD%" -m pip install elasticsearch==8.12.1 || set "PYERROR=1"
    
    echo [INFO] Instalando resto de dependencias...
    "%PYTHON_CMD%" -m pip install -r "%~dp0requirements.txt" || set "PYERROR=1"
) else (
    echo [ERROR] No se encontro requirements.txt en: %~dp0
    set "PYERROR=1"
)

if "!PYERROR!"=="1" (
    echo.
    echo [ERROR] Fallo al instalar dependencias
    echo [SOLUCION] Ejecuta manualmente:
    echo    pip install elasticsearch==8.12.1
    echo    pip install -r requirements.txt
    echo.
    pause
    goto :END
)

echo.
echo [OK] Dependencias instaladas correctamente
echo [INFO] Instalacion completada
echo.

echo [INFO] Iniciando UltraKibanaDownloader...
set "JAR_PATH=%~dp0..\UltraKibanaDownloader.jar"
if exist "%JAR_PATH%" (
    start "" javaw -jar "%JAR_PATH%"
    echo [OK] Aplicacion iniciada
) else (
    echo [ERROR] No se encontro UltraKibanaDownloader.jar en: %JAR_PATH%
    echo [INFO] Asegurate de que el .jar esta en la carpeta UltraKibanaDownloader\
    pause
)

:END
endlocal
