from colorama import init, Fore, Style
MAC_INFO = {
    # Añade aquí todas tus instalaciones:
    "00-23-c1-27-61-c9": {
        "Serial Number": "26MQ5LEG",
        "Numero de instalacion": 5912095
    },
    "00-23-c1-2d-d9-1c": {
        "Serial Number": "26QXL99B",
        "Numero de instalacion": 6727611
    },
        "00-23-c1-27-61-bc": {
        "Serial Number": "26MQ5H9V",
        "Numero de instalacion": 5499266
    },
    # ...puedes añadir/quitar más instalaciones copiando el formato...
}
def buscar_mis_instalaciones_por_mac():
    print("\n[SCAN] Buscando IPs de mis instalaciones guardadas por MAC (escaneando la red)...")
    if not MAC_INFO:
        print("\n  [ERROR] No hay instalaciones guardadas en MAC_INFO.")
        return

    # Detectar subred automáticamente
    subnet = detectar_subred_local()
    print(f"\n  Subred detectada automáticamente: {subnet}.0/24")
    # Escanear toda la red (como opción 1)
    devices = scan_network_devices(subnet)

    # Normalizar MACs de interés y evitar duplicados por Serial
    serial_to_mac = {}
    for mac, info in MAC_INFO.items():
        serial = info['Serial Number']
        if serial not in serial_to_mac:
            serial_to_mac[serial] = (mac, info)

    # Buscar IPs de las MACs de interés
    init(autoreset=True)
    print(f"\n  {'MAC':<20} {'IP':<16} {'Hostname':<25} {'Serial Number':<12} {'Nº Instalación':<15}")
    print("  " + "-"*90)
    def mac_key(mac):
        # Devuelve la MAC sin el primer byte (para comparar ignorando 00/01)
        mac_clean = mac.lower().replace(':', '-').replace(' ', '')
        partes = mac_clean.split('-')
        if len(partes) == 6:
            return '-'.join(partes[1:])
        return mac_clean

    for serial, (mac, info) in serial_to_mac.items():
        mac_norm = mac_key(mac)
        ip_found = "-"
        mac_real = mac  # Por defecto, la de MAC_INFO
        hostname = "-"
        for ip, dev_mac in devices:
            dev_mac_norm = mac_key(dev_mac)
            if dev_mac_norm == mac_norm:
                ip_found = ip
                mac_real = dev_mac  # Mostrar la MAC real detectada
                # Intentar resolver hostname
                try:
                    hostname = socket.gethostbyaddr(ip)[0]
                except Exception:
                    hostname = "-"
                break
        if ip_found != "-":
            color = Fore.GREEN
        else:
            color = Fore.RED
        print(color + f"  {mac_real:<20} {ip_found:<16} {hostname:<25} {serial:<12} {info['Numero de instalacion']:<15}" + Style.RESET_ALL)
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Network Scanner - Detección de dispositivos por IP y MAC
Autor: GitHub Copilot
Versión: 1.0
Descripción: Herramienta para escanear dispositivos en red local y buscar IPs por MAC
"""


import subprocess
import re
import time
import sys
import socket

def detectar_subred_local():
    """Detecta la subred local automáticamente (ej: 192.168.1)"""
    try:
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
        # Si la IP es 127.0.0.1, buscar otra interfaz
        if local_ip.startswith('127.'):
            import os
            import platform
            if platform.system() == 'Windows':
                result = subprocess.run(['ipconfig'], capture_output=True, text=True)
                for line in result.stdout.split('\n'):
                    if 'IPv4' in line:
                        ip = line.split(':')[-1].strip()
                        if ip and not ip.startswith('127.'):
                            local_ip = ip
                            break
            else:
                result = subprocess.run(['hostname', '-I'], capture_output=True, text=True)
                ips = result.stdout.strip().split()
                for ip in ips:
                    if not ip.startswith('127.'):
                        local_ip = ip
                        break
        partes = local_ip.split('.')
        if len(partes) == 4:
            return '.'.join(partes[:3])
    except Exception:
        pass
    return "192.168.1"


def validate_mac_format(mac):
    """Valida formato de dirección MAC"""
    # Aceptar formatos: AA:BB:CC:DD:EE:FF o AA-BB-CC-DD-EE-FF
    pattern = r'^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$'
    return re.match(pattern, mac) is not None


def normalize_mac(mac):
    """Normaliza MAC a formato con guiones en minúsculas"""
    return mac.replace(':', '-').lower()


def scan_network_devices(subnet="192.168.1"):
    """
    Escanea la red y devuelve lista de dispositivos encontrados con sus MACs
    
    Args:
        subnet (str): Primeros 3 octetos de la red a escanear (ej: "192.168.1")
    
    Returns:
        list: Lista de tuplas (IP, MAC) de dispositivos encontrados
    """
    print(f"\n[SCAN] Escaneando dispositivos en red {subnet}.0/24...")
    print("   Esto puede tardar 20-30 segundos\n")
    
    # Paso 1: Ping sweep para poblar tabla ARP
    print("  [1/2] Explorando red...", end='', flush=True)
    processes = []
    for i in range(1, 255):
        ip = f"{subnet}.{i}"
        proc = subprocess.Popen(
            ['ping', '-n', '1', '-w', '1000', ip],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, 'CREATE_NO_WINDOW') else 0
        )
        processes.append(proc)
        
        if i % 50 == 0:
            print(".", end='', flush=True)
    
    # Esperar a que terminen
    for proc in processes:
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
    
    print(" OK")
    
    # Paso 2: Leer tabla ARP
    print("  [2/2] Recopilando direcciones MAC...")
    time.sleep(2)  # Dar tiempo a que se actualice la tabla ARP
    
    devices = []
    try:
        result = subprocess.run(['arp', '-a'], capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            for line in result.stdout.split('\n'):
                # Buscar líneas con IP y MAC
                # Formato Windows: "  192.168.1.10  00-11-22-33-44-55  dynamic"
                ip_match = re.search(r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', line)
                mac_match = re.search(r'([0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2})', line)
                
                if ip_match and mac_match:
                    ip = ip_match.group(1)
                    mac = mac_match.group(1)
                    
                    # Filtrar solo IPs de la subnet solicitada
                    if ip.startswith(subnet):
                        # Evitar direcciones broadcast y multicast
                        if not mac.lower().startswith('ff-ff-ff') and not mac.lower().startswith('01-00-5e'):
                            devices.append((ip, mac))
    except Exception as e:
        print(f"  [ERROR] Error al leer tabla ARP: {e}")
    
    return devices


def find_ip_from_mac(mac_address, subnet="192.168.1"):
    """
    Busca la IP correspondiente a una MAC en la red
    
    Args:
        mac_address (str): Dirección MAC a buscar (formato AA:BB:CC:DD:EE:FF o AA-BB-CC-DD-EE-FF)
        subnet (str): Primeros 3 octetos de la red a buscar (ej: "192.168.1")
    
    Returns:
        str or None: IP encontrada o None si no se encuentra
    """
    print(f"\n[INFO] Buscando dispositivo con MAC {mac_address}...")
    mac_normalized = normalize_mac(mac_address)
    
    # Paso 1: Consultar tabla ARP existente
    print("  [1/2] Consultando tabla ARP...")
    try:
        result = subprocess.run(['arp', '-a'], capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            for line in result.stdout.split('\n'):
                line_lower = line.lower()
                if mac_normalized in line_lower or mac_normalized.replace('-', ':') in line_lower:
                    match = re.search(r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', line)
                    if match:
                        ip = match.group(1)
                        if ip.startswith(subnet):
                            print(f"  Dispositivo encontrado en tabla ARP: {ip}")
                            return ip
            print(f"  [INFO] MAC no encontrada en tabla ARP actual")
    except Exception as e:
        print(f"  [WARN] Error al consultar ARP: {e}")
    
    # Paso 2: Hacer ping sweep en la subnet
    print(f"  [2/2] Explorando red {subnet}.0/24 (esto puede tardar 20-30 segundos)...")
    print("  Escaneando IPs...", end='', flush=True)
    
    processes = []
    for i in range(1, 255):
        ip = f"{subnet}.{i}"
        proc = subprocess.Popen(
            ['ping', '-n', '1', '-w', '1000', ip],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, 'CREATE_NO_WINDOW') else 0
        )
        processes.append(proc)
        
        if i % 50 == 0:
            print(".", end='', flush=True)
    
    # Esperar a que terminen todos los pings
    for proc in processes:
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
    
    print(" OK")
    
    # Consultar ARP nuevamente
    print("  Consultando tabla ARP actualizada...")
    time.sleep(2)
    
    try:
        result = subprocess.run(['arp', '-a'], capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            for line in result.stdout.split('\n'):
                line_lower = line.lower()
                if mac_normalized in line_lower or mac_normalized.replace('-', ':') in line_lower:
                    match = re.search(r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', line)
                    if match:
                        ip = match.group(1)
                        if ip.startswith(subnet):
                            print(f"  Dispositivo encontrado: {ip}")
                            return ip
    except Exception as e:
        print(f"  [ERROR] Error al consultar ARP: {e}")
    
    return None


def print_banner():
    """Muestra banner de la herramienta"""
    print("\n" + "="*70)
    print("║" + " "*68 + "║")
    print("║" + "  NETWORK SCANNER - DETECCIÓN DE DISPOSITIVOS".center(68) + "║")
    print("║" + " "*68 + "║")
    print("="*70)


def main():
    """Función principal"""
    print_banner()
    
    print("\n[OPTIONS] OPCIONES DE ESCANEO")
    print("-" * 70)
    print("\n  [1] Escanear toda la red y listar dispositivos")
    print("  [2] Buscar IP de un dispositivo por su dirección MAC")
    print("  [3] Buscar mis instalaciones por MAC")
    print("  [4] Salir")

    while True:
        choice = input("\n  ¿Qué deseas hacer? [1/2/3/4]: ").strip()
        if choice in ['1', '2', '3', '4']:
            break
        print("  Por favor, introduce 1, 2, 3 o 4")

    if choice == '4':
        print("\n  ¡Hasta luego!\n")
        sys.exit(0)

    if choice == '3':
        buscar_mis_instalaciones_por_mac()
        return

    # Detectar subred automáticamente
    subred_detectada = detectar_subred_local()

    subnet = subred_detectada
    print(f"\n  Subred detectada automáticamente: {subred_detectada}.0/24")
    
    if choice == '1':
        # Opción 1: Escanear toda la red
        devices = scan_network_devices(subnet)
        
        print("\n  DISPOSITIVOS ENCONTRADOS:")
        print("  " + "="*110)
        
        if devices:
            print(f"\n  {'Nº':<5} {'Dirección IP':<18} {'Dirección MAC':<20} {'Info Extra':<60}")
            print("  " + "-"*110)
            for idx, (ip, mac) in enumerate(devices, 1):
                info_extra = ""
                mac_norm = mac.lower()
                if mac_norm in MAC_INFO:
                    info = MAC_INFO[mac_norm]
                    info_extra = f"Serial: {info['Serial Number']}, Inst: {info['Numero de instalacion']}"
                print(f"  {idx:<5} {ip:<18} {mac:<20} {info_extra:<60}")
            print(f"\n  Total de dispositivos: {len(devices)}")
        else:
            print(f"\n  No se encontraron dispositivos en la red {subnet}.0/24")
        
        print("  " + "="*110 + "\n")
    
    else:
        # Opción 2: Buscar por MAC
        print("\n  Introduce la dirección MAC del dispositivo")
        print("     Formatos aceptados: AA:BB:CC:DD:EE:FF o AA-BB-CC-DD-EE-FF")
        print("     Ejemplo: 00:23:c1:2f:1f:7c")
        
        while True:
            mac_input = input("\n  MAC: ").strip()
            if validate_mac_format(mac_input):
                break
            print("  Formato de MAC inválido. Usa formato: AA:BB:CC:DD:EE:FF")
        
        # Buscar IP usando la subred detectada automáticamente
        ip = find_ip_from_mac(mac_input, subnet)
        
        print("\n  " + "="*66)
        if ip:
            print(f"\n  DISPOSITIVO ENCONTRADO:")
            print(f"     MAC: {mac_input}")
            print(f"     IP:  {ip}")
        else:
            print(f"\n  NO SE ENCONTRÓ EL DISPOSITIVO")
            print(f"     MAC buscada: {mac_input}")
            print(f"     Red escaneada: {subnet}.0/24")
            print("\n  Sugerencias:")
            print("     - Verifica que la MAC sea correcta")
            print("     - Asegúrate de que el dispositivo esté encendido y conectado")
            print("     - Prueba escaneando toda la red (opción 1)")
        print("  " + "="*66 + "\n")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n  Proceso interrumpido por el usuario\n")
        sys.exit(0)
    except Exception as e:
        print(f"\n\n  ERROR: {e}\n")
        sys.exit(1)
