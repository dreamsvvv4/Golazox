from enum import Enum, auto


# -----------------------------------------------------------------------------------------------------------------
# ---------------------------------------------------- ENUMS ------------------------------------------------------
# -----------------------------------------------------------------------------------------------------------------

class DeviceType(Enum):
    DEVICE_TYPE_MOK = auto()
    DEVICE_TYPE_SVK = auto()
    DEVICE_TYPE_KEYFOB = auto()
    DEVICE_TYPE_ORION = auto()
    DEVICE_TYPE_MAGNETIC = auto()
    DEVICE_TYPE_AQUILA = auto()
    DEVICE_TYPE_CAMPIR = auto()
    DEVICE_TYPE_CROPTEX = auto()
    DEVICE_TYPE_DOORLOCK = auto()
    DEVICE_TYPE_HOMEPANEL = auto()
    DEVICE_TYPE_NOX = auto()
    DEVICE_TYPE_SPB = auto()
    DEVICE_TYPE_SMOKE4 = auto()
    DEVICE_TYPE_ZEROVISION = auto()
    DEVICE_TYPE_MAGNETIC3 = auto() 


# -----------------------------------------------------------------------------------------------------------------
# ----------------------------------------------------- DICT ------------------------------------------------------
# -----------------------------------------------------------------------------------------------------------------

DeviceTypeDict = {
    'MOK': DeviceType.DEVICE_TYPE_MOK.value,
    'SVK': DeviceType.DEVICE_TYPE_SVK.value,
    'KEYFOB': DeviceType.DEVICE_TYPE_KEYFOB.value,
    'ORION': DeviceType.DEVICE_TYPE_ORION.value,
    'MAGNETIC': DeviceType.DEVICE_TYPE_MAGNETIC.value,
    'AQUILA': DeviceType.DEVICE_TYPE_AQUILA.value,
    'CAMPIR': DeviceType.DEVICE_TYPE_CAMPIR.value,
    'CROPTEX': DeviceType.DEVICE_TYPE_CROPTEX.value,
    'DOORLOCK': DeviceType.DEVICE_TYPE_DOORLOCK.value,
    'HOMEPANEL': DeviceType.DEVICE_TYPE_HOMEPANEL.value,
    'NOX': DeviceType.DEVICE_TYPE_NOX.value,
    'SPB': DeviceType.DEVICE_TYPE_SPB.value,
    'SMOKE4': DeviceType.DEVICE_TYPE_SMOKE4.value,
    'ZEROVISION': DeviceType.DEVICE_TYPE_ZEROVISION.value,
    'MAGNETIC-3': DeviceType.DEVICE_TYPE_MAGNETIC3.value
}

ContactNbrToLabel = {
    DeviceType.DEVICE_TYPE_MOK.value: {
        1: 'wall tamper contact',
        2: 'low battery contact',
        3: 'battery magnetic contact',
    },
    DeviceType.DEVICE_TYPE_SVK.value: {
        1: 'wall tamper contact',
        2: 'low battery contact',
        3: 'sos contact',
        4: 'battery tamper contact',
    },
    DeviceType.DEVICE_TYPE_KEYFOB.value: {
        2: 'low battery contact',
        3: 'sos contact',
    },
    DeviceType.DEVICE_TYPE_ORION.value: {
        1: 'wall tamper contact',
        2: 'low battery contact',
        3: 'pir contact',
        4: 'battery tamper contact',
        5: 'reverse battery contact',
    },
    # Currently used for MC2.1 and MC3
    DeviceType.DEVICE_TYPE_MAGNETIC.value: {
        1: 'wall tamper contact',
        2: 'low battery contact',
        3: 'magnetic contact',
        4: 'shock repetitive contact',
        5: 'shock gross contact',
        6: 'lid tamper contact',
        7: 'magnet masking contact',
    },
    DeviceType.DEVICE_TYPE_AQUILA.value: {
        1: 'wall tamper contact',
        2: 'low battery contact',
        3: 'pir contact',
        4: 'battery tamper contact',
        5: 'reverse battery contact',
        6: 'ac power contact',
        7: 'charger contact',
    },
    DeviceType.DEVICE_TYPE_CAMPIR.value: {
        1: 'wall tamper contact',
        2: 'low battery contact',
        3: 'pir contact',
        4: 'acc contact',
        5: 'battery tamper contact',
    },
    DeviceType.DEVICE_TYPE_CROPTEX.value: {
        1: 'wall tamper contact',
        2: 'low battery contact',
        3: 'pir contact',
        4: 'acc contact',
        5: 'battery tamper contact',    
    },
    DeviceType.DEVICE_TYPE_DOORLOCK.value: {
        2: 'low battery contact',
        4: 'break-in contact',
    },
    DeviceType.DEVICE_TYPE_HOMEPANEL.value: {
        1: 'tamper contact',
        2: 'battery service needed contact',
        3: 'sos contact',
        4: 'ac power lost contact',
        5: 'low battery contact',
    },
    DeviceType.DEVICE_TYPE_NOX.value: {
        1: 'wall tamper contact',
        2: 'low battery contact',
        3: 'out of service contact',
        4: 'canister tamper contact',
    },
    DeviceType.DEVICE_TYPE_SPB.value: {
        1: 'wall tamper contact',
        2: 'low battery contact',
        3: 'battery tamper contact',
        4: 'sos contact',
    },
    DeviceType.DEVICE_TYPE_SMOKE4.value: {
        1: 'wall tamper contact',
        2: 'low battery',
        3: 'smoke',
        4: 'fault',
    },
    DeviceType.DEVICE_TYPE_ZEROVISION.value: {
        1: 'wall tamper contact',
        2: 'low battery contact',
        3: 'out of service contact',
        4: 'canister tamper contact',
    },
    DeviceType.DEVICE_TYPE_MAGNETIC3.value: {
        1: 'wall tamper contact',
        2: 'low battery contact',
        3: 'magnetic contact',
        4: 'shock repetitive contact',
        5: 'shock gross contact',
        6: 'lid tamper contact',
        7: 'magnet masking contact',
    },
}