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

if exist requirements.txt (
    echo [INFO] Actualizando pip...
    "%PYTHON_CMD%" -m pip install --upgrade pip || set "PYERROR=1"
    
    echo [CRITICO] Instalando elasticsearch==8.12.1...
    "%PYTHON_CMD%" -m pip install elasticsearch==8.12.1 || set "PYERROR=1"
    
    echo [INFO] Instalando resto de dependencias...
    "%PYTHON_CMD%" -m pip install -r requirements.txt || set "PYERROR=1"
) else (
    echo [ADVERTENCIA] No se encontro requirements.txt
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

:END
endlocal
