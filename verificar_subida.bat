@echo off
echo ==========================================
echo  VERIFICACION FINAL DEL REPOSITORIO
echo ==========================================
echo.
echo VERIFICANDO ESTADO...
echo.
echo 1. REPOSITORIO REMOTO CONFIGURADO:
git remote -v
echo.
echo 2. COMMITS LOCALES:
git log --oneline -5
echo.
echo 3. ESTADO ACTUAL:
git status
echo.
echo 4. INTENTANDO SUBIR A GITHUB...
echo (Si pide autenticacion, completala en el navegador)
echo.
git push --set-upstream origin main
echo.
if errorlevel 1 (
    echo.
    echo ========================================
    echo  ERROR AL SUBIR - POSIBLES SOLUCIONES:
    echo ========================================
    echo.
    echo 1. CREAR REPOSITORIO EN GITHUB:
    echo    - Ve a: https://github.com/VVV-Verisure
    echo    - Click "New repository"
    echo    - Nombre: ultra-kibana-downloader
    echo    - NO marques "Add README"
    echo    - Click "Create repository"
    echo.
    echo 2. VERIFICAR AUTENTICACION:
    echo    - Completa la autenticacion en el navegador
    echo    - Vuelve aqui y ejecuta: git push
    echo.
    echo 3. COMANDO MANUAL:
    echo    git push --set-upstream origin main
) else (
    echo.
    echo ========================================
    echo          ¡EXITO TOTAL!
    echo ========================================
    echo.
    echo ✅ Repositorio subido exitosamente
    echo ✅ URL: https://github.com/VVV-Verisure/ultra-kibana-downloader
    echo ✅ Todos los archivos sincronizados
    echo.
    echo TU PROYECTO YA ESTA EN GITHUB!
    echo Puedes compartir la URL con tu equipo:
    echo https://github.com/VVV-Verisure/ultra-kibana-downloader
)
echo.
pause
