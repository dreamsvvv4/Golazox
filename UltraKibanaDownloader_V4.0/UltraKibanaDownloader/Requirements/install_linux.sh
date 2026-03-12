#!/bin/bash
# UltraKibanaDownloader - Instalador interactivo para Linux
# Ejecuta este script con: bash install_linux.sh

prompt_install() {
    read -p "$1 (s/n): " resp
    [[ "$resp" == "s" || "$resp" == "S" ]]
}

echo "==== UltraKibanaDownloader Instalador para Linux ===="

# 1. Verificar Java
echo -e "\nVerificando Java..."
if java -version &>/dev/null; then
    echo "Java ya está instalado."
else
    if prompt_install "Java no está instalado. ¿Deseas instalarlo?"; then
        sudo apt-get update
        sudo apt-get install -y default-jre default-jdk
        echo "Java instalado."
    else
        echo "Java es necesario para la aplicación. Abortando."
        exit 1
    fi
fi

# 2. Verificar Python
echo -e "\nVerificando Python..."
if python3 --version &>/dev/null; then
    echo "Python3 ya está instalado."
else
    if prompt_install "Python3 no está instalado. ¿Deseas instalarlo?"; then
        sudo apt-get update
        sudo apt-get install -y python3 python3-pip
        echo "Python3 instalado."
    else
        echo "Python3 es necesario para la aplicación. Abortando."
        exit 1
    fi
fi

# 3. Verificar tkinter
echo -e "\nVerificando tkinter..."
python3 -c "import tkinter" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "tkinter ya está disponible."
else
    if prompt_install "tkinter no está disponible. ¿Deseas instalarlo?"; then
        sudo apt-get install -y python3-tk
        echo "tkinter instalado."
    else
        echo "tkinter es necesario para la aplicación. Abortando."
        exit 1
    fi
fi

# 4. Instalar dependencias pip y requirements.txt
echo -e "\nInstalando dependencias pip (colorama, chardet y requirements.txt)..."
if prompt_install "¿Deseas instalar todas las dependencias pip ahora?"; then
    python3 -m pip install --upgrade pip
    # Instalar colorama, chardet y elasticsearch explícitamente
    python3 -m pip install colorama chardet elasticsearch==8.12.1 requests Pillow
    # Instalar dependencias de requirements.txt si existe
    if [ -f "requirements.txt" ]; then
        echo "Instalando dependencias de requirements.txt..."
        python3 -m pip install -r requirements.txt
    else
        echo "No se encontró requirements.txt, solo se instalarán colorama y chardet."
    fi
    echo "Dependencias pip instaladas."
else
    echo "Debes instalar las dependencias pip manualmente antes de usar la aplicación."
fi

echo -e "\nInstalación finalizada. Puedes ejecutar UltraKibanaDownloader."
