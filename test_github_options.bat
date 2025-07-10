@echo off
echo ==========================================
echo  INTENTAR DIFERENTES OPCIONES PARA VICTOR
echo ==========================================
echo.
echo Vamos a probar diferentes combinaciones para encontrar la que funcione:
echo.
echo OPCION 1: Probar con nombre de repo mas simple
echo Comando: git remote add origin https://github.com/victor-vega_vsure/elasticlogana.git
echo.
set /p respuesta1="¿Quieres probar esta opcion? (s/n): "
if /i "%respuesta1%"=="s" (
    echo.
    echo Intentando conectar con elasticlogana...
    git remote add origin https://github.com/victor-vega_vsure/elasticlogana.git
    if errorlevel 1 (
        echo ERROR: No se pudo agregar el repositorio remoto
        echo Posibles causas:
        echo - El repositorio no existe en GitHub
        echo - No tienes permisos en esa organizacion
        echo - Ya existe un remote con ese nombre
    ) else (
        echo ¡Repositorio remoto agregado exitosamente!
        echo.
        echo Ahora intentando subir los archivos...
        git push -u origin main
        if errorlevel 1 (
            echo ERROR al subir archivos. Necesitas crear el repositorio en GitHub primero.
            echo Ve a: https://github.com/victor-vega_vsure
            echo Crea un nuevo repositorio llamado "elasticlogana"
        ) else (
            echo ¡EXITO! Tu repositorio esta en GitHub
            echo URL: https://github.com/victor-vega_vsure/elasticlogana
            goto :success
        )
    )
)
echo.
echo OPCION 2: ¿Tienes otro usuario de GitHub personal?
set /p usuario_personal="Escribe tu usuario personal (o 'n' si no tienes): "
if /i not "%usuario_personal%"=="n" (
    echo.
    echo Intentando con tu usuario personal: %usuario_personal%
    git remote remove origin 2>nul
    git remote add origin https://github.com/%usuario_personal%/elasticlogana.git
    if errorlevel 1 (
        echo ERROR: No se pudo agregar el repositorio remoto
    ) else (
        echo ¡Repositorio remoto agregado exitosamente!
        echo Ahora crea el repositorio en GitHub y luego ejecuta: git push -u origin main
    )
)
echo.
echo OPCION 3: Verificar si ya existe el repositorio
echo Ve a: https://github.com/victor-vega_vsure
echo Busca si ya tienes repositorios ahi
echo.
:success
echo.
echo COMANDOS UTILES:
echo git remote -v                    # Ver repositorios remotos configurados
echo git remote remove origin        # Quitar repositorio remoto si hay error
echo git push -u origin main         # Subir archivos (despues de crear repo en GitHub)
echo.
pause
