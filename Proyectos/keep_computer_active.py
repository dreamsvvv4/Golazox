import pyautogui
import time
import ctypes

def get_idle_duration():
    class LASTINPUTINFO(ctypes.Structure):
        _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]
    lii = LASTINPUTINFO()
    lii.cbSize = ctypes.sizeof(LASTINPUTINFO)
    if ctypes.windll.user32.GetLastInputInfo(ctypes.byref(lii)):
        millis = ctypes.windll.kernel32.GetTickCount() - lii.dwTime
        return millis / 1000.0
    else:
        return 0 

def keep_computer_active():
    print("Manteniendo el ordenador activo solo si llevas 3 minutos inactivo. Ctrl+C para detener.")
    try:
        while True:
            idle = get_idle_duration()
            if idle >= 180:  # 3 minutos
                pyautogui.moveRel(100, 0)
                pyautogui.moveRel(-100, 0)
                pyautogui.press('shift')
                pyautogui.press('shift')
                pyautogui.press('shift')
                print("Inactividad detectada. Simulando actividad.")
            time.sleep(10)
    except KeyboardInterrupt:
        print("Script detenido por el usuario.")

if __name__ == "__main__":
    keep_computer_active()

