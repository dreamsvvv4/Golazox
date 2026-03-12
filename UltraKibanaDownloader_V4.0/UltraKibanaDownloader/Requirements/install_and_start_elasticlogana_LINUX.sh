#!/bin/bash
# Script de instalacion y arranque para ElasticLoganaGUI (Linux/Mac)
# Instala dependencias de Python con version especifica de Elasticsearch y lanza la aplicacion

cd "$(dirname "$0")"

echo "========================================="
echo " ElasticLoganaGUI - Instalador (Linux/Mac)"
echo "========================================="

# 0. Comprobar Java
echo "Verificando Java..."
if ! command -v java &> /dev/null; then
  echo "ERROR: Java no esta instalado o no esta en el PATH."
  echo "Descarga Java desde: https://adoptium.net/es/ o https://www.java.com/"
  exit 1
fi
echo "Java encontrado: $(java -version 2>&1 | head -n 1)"

# 1. Instalar dependencias de Python
echo ""
echo "Verificando Python..."
PYTHON_CMD="python3"
if ! command -v python3 &> /dev/null; then
  if command -v python &> /dev/null; then
    PYTHON_CMD="python"
  else
    echo "ERROR: Python 3 no esta instalado o no esta en el PATH."
    echo "Descarga Python desde: https://www.python.org/downloads/"
    exit 1
  fi
fi

echo "Python encontrado: $($PYTHON_CMD --version)"
if [ -f requirements.txt ]; then
  echo ""
  echo "Instalando dependencias de Python..."
  $PYTHON_CMD -m pip install --upgrade pip
  
  # Instalar primero la version especifica de Elasticsearch para evitar problemas de compatibilidad
  echo "Instalando elasticsearch==8.12.1 (version especifica requerida)..."
  if ! $PYTHON_CMD -m pip install elasticsearch==8.12.1; then
    echo "ERROR: Fallo la instalacion de elasticsearch==8.12.1"
    echo "Intenta ejecutar manualmente: pip install elasticsearch==8.12.1"
    exit 1
  fi
  
  # Instalar el resto de dependencias
  echo "Instalando resto de dependencias..."
  if ! $PYTHON_CMD -m pip install -r requirements.txt; then
    echo "ERROR: Fallo la instalacion de dependencias adicionales"
    exit 1
  fi
  echo "Dependencias instaladas correctamente"
else
  echo "No se encontro requirements.txt"
fi

# 2. Navegar al directorio principal y lanzar la aplicacion
echo ""
echo "Iniciando ElasticLoganaGUI..."
cd ..
if [ -f ElasticLoganaGUI.jar ]; then
  echo "Encontrado ElasticLoganaGUI.jar"
  echo "Lanzando aplicacion..."
  java -jar ElasticLoganaGUI.jar
else
  echo "ERROR: No se encontro ElasticLoganaGUI.jar en el directorio principal"
  echo "Asegurate de que el archivo ElasticLoganaGUI.jar este en la carpeta raiz"
  exit 1
fi
