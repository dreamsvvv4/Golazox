@echo off
echo ========================================
echo  SOLUCION: PROBLEMA CON OWNER EN GITHUB
echo ========================================
echo.
echo PROBLEMA: Tienes el usuario "victor-vega_vsure" pero no te deja usarlo como owner
echo.
echo POSIBLES CAUSAS Y SOLUCIONES:
echo.
echo 1. ES UNA ORGANIZACION (NO USUARIO PERSONAL):
echo    - "victor-vega_vsure" puede ser una organizacion
echo    - No todos pueden crear repos en organizaciones
echo    - Necesitas permisos especiales
echo.
echo 2. SOLUCION RAPIDA - USA TU USUARIO PERSONAL:
echo    - Crea el repo en tu cuenta personal
echo    - Busca otro usuario que tengas (sin _vsure)
echo    - Ejemplo: victor-vega, victorvega, etc.
echo.
echo 3. ALTERNATIVA - CREAR REPO CON NOMBRE DIFERENTE:
echo    - En lugar de "ultra-kibana-downloader"
echo    - Usa: "elasticlogana" o "kibana-tools"
echo.
echo 4. VERIFICAR TU TIPO DE CUENTA:
echo    - Ve a: https://github.com/victor-vega_vsure
echo    - Si dice "Organization" = necesitas permisos
echo    - Si dice tu nombre = es tu cuenta personal
echo.
echo 5. COMANDOS PARA PROBAR DIFERENTES OPCIONES:
echo.
echo    OPCION A - Cuenta personal (busca tu otro usuario):
echo    git remote add origin https://github.com/TU-USUARIO-PERSONAL/elasticlogana.git
echo.
echo    OPCION B - Mismo usuario, nombre diferente:
echo    git remote add origin https://github.com/victor-vega_vsure/elasticlogana.git
echo.
echo    OPCION C - Verificar si ya existe el repo:
echo    Ve a: https://github.com/victor-vega_vsure/ultra-kibana-downloader
echo.
echo 6. PASOS PARA SOLUCIONARLO:
echo    1. Ve a https://github.com/victor-vega_vsure
echo    2. Mira si es "Organization" o cuenta personal
echo    3. Si es organizacion, busca tu cuenta personal
echo    4. Crea el repositorio en la cuenta que funcione
echo    5. Vuelve aqui y ejecuta los comandos
echo.
echo ESTADO ACTUAL:
echo - Repositorio local: LISTO
echo - Commits realizados: SI
echo - Solo falta: conectar con GitHub usando el usuario correcto
echo.
echo SIGUIENTE PASO:
echo 1. Ve a GitHub y confirma tu usuario exacto
echo 2. Vuelve aqui y ejecuta los comandos con el usuario correcto
echo.
pause
