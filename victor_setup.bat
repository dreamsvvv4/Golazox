@echo off
echo ============================================
echo  Git Setup for Victor Vega (Verisure)
echo  ElasticLogAna Project
echo ============================================

echo [INFO] Checking Git installation...
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git no está instalado. Ejecuta setup_git.bat primero.
    pause
    exit
)

echo [OK] Git está instalado!
git --version

echo.
echo ============================================
echo  Configurando Git para Victor Vega
echo ============================================

echo [INFO] Configurando tu información de Git...
git config --global user.name "victor-vega_vsure"
git config --global user.email "victor.vega@verisure.com"

echo [INFO] Configuración aplicada:
git config --global user.name
git config --global user.email

echo.
echo [INFO] Inicializando repositorio Git...
git init

echo [INFO] Creando .gitignore personalizado...
(
echo # ElasticLogAna - Archivos compilados
echo *.class
echo *.pyc
echo __pycache__/
echo.
echo # Archivos JAR ^(excepto el principal^)
echo *.jar
echo !ElasticLoganaGUI.jar
echo.
echo # Logs y archivos temporales
echo logs/*.log
echo logs/*.txt
echo logs/*/
echo *.tmp
echo *.temp
echo.
echo # Archivos de configuración sensibles
echo config.ini
echo secrets.json
echo.
echo # Archivos ZIP/RAR
echo *.zip
echo *.rar
echo.
echo # IDEs
echo .vscode/
echo .idea/
echo *.iml
echo.
echo # Sistema operativo
echo Thumbs.db
echo .DS_Store
echo.
echo # Instaladores
echo *.exe
echo *.msi
) > .gitignore

echo [INFO] Agregando archivos al repositorio...
git add .

echo [INFO] Creando commit inicial...
git commit -m "Initial commit: ElasticLogAna v1.0 - Professional log analytics tool by Victor Vega"

echo.
echo ============================================
echo  ¡LISTO! Tu repositorio Git está configurado
echo ============================================
echo.
echo SIGUIENTE PASO - Crear repositorio remoto:
echo.
echo 1. Ve a GitHub: https://github.com/victor-vega-vsure
echo    (o crea tu cuenta si no la tienes)
echo.
echo 2. Crea un nuevo repositorio:
echo    Nombre: "elasticlogana-verisure"
echo    Descripción: "Professional log analytics tool for Verisure"
echo    Privado: SÍ (para código corporativo)
echo.
echo 3. Cuando tengas la URL del repositorio, ejecuta:
echo    git remote add origin [URL_DEL_REPOSITORIO]
echo    git branch -M main
echo    git push -u origin main
echo.
echo ============================================
echo  Comandos útiles para el futuro:
echo ============================================
echo.
echo git status                    # Ver estado de archivos
echo git add .                     # Agregar todos los cambios
echo git commit -m "Mensaje"       # Confirmar cambios
echo git push                      # Subir al repositorio
echo git pull                      # Descargar cambios
echo.
echo ¡Tu proyecto está listo para ser versionado!
echo.
pause
