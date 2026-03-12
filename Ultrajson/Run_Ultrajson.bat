@echo off
setlocal
cd /d "%~dp0"

REM Optional local environment overrides (keep endpoints/tokens out of git)
if exist "ultrajson.env.bat" call "ultrajson.env.bat"

set "VENV_DIR=.venv"
set "PYEXE="
set "PYARGS="

REM Prefer Windows Python Launcher
where py >nul 2>nul
if not errorlevel 1 set "PYEXE=py"
if not errorlevel 1 set "PYARGS=-3"

REM Fallback to python.exe
if not defined PYEXE where python >nul 2>nul
if not defined PYEXE if not errorlevel 1 set "PYEXE=python"

if not defined PYEXE goto :no_python

if exist "%VENV_DIR%\Scripts\python.exe" goto :run

echo.
echo Creating local virtual environment: %VENV_DIR%
call %PYEXE% %PYARGS% -m venv "%VENV_DIR%"
if errorlevel 1 goto :venv_fail

echo.
echo Installing dependencies (first run)...
"%VENV_DIR%\Scripts\python.exe" -m ensurepip --upgrade >nul 2>nul
"%VENV_DIR%\Scripts\python.exe" -m pip install --upgrade pip
if exist requirements.txt "%VENV_DIR%\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto :deps_fail

:run
echo.
echo Starting Ultrajson...
"%VENV_DIR%\Scripts\python.exe" Ultrajson.py
if errorlevel 1 goto :app_fail
goto :eof

:no_python
echo.
echo ERROR: Python was not found.
echo Install Python 3 and ensure it is available in PATH.
pause
exit /b 1

:venv_fail
echo.
echo ERROR: Failed to create virtual environment.
pause
exit /b 1

:deps_fail
echo.
echo ERROR: Dependency installation failed.
echo You can retry by running this .bat again.
pause
exit /b 1

:app_fail
echo.
echo Ultrajson exited with an error.
pause
exit /b 1
