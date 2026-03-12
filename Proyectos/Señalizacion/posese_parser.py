import devices

# -----------------------------------------------------------------------------------------------------------------
# ------------------------------------------------ PARSER METHODS -------------------------------------------------
# -----------------------------------------------------------------------------------------------------------------

def subfields_parser_MS2(subfields_arg, device_type_arg):
    rssi_value = int(subfields_arg["rssi_radio_level"]) * -1 + 100
    lqi_value = int(subfields_arg["lqi"])

    subfields_arg.update({'rssi_value': rssi_value, 'lqi_value': lqi_value})


def subfields_parser_DTS(subfields_arg, device_type_arg):
    tamper_number = int(subfields_arg["tamper_number"])
    tamper_description = ''
    if device_type_arg in tamperIdToDescription.keys() and tamper_number in tamperIdToDescription[device_type_arg].keys():
        tamper_description = tamperIdToDescription[device_type_arg][tamper_number]

    subfields_arg.update({'tamper_description': tamper_description})


def subfields_parser_DBR(subfields_arg, device_type_arg):
    reason_id = int(subfields_arg["reason"])
    reason_description = bootReasonIdToDescription[reason_id] if reason_id in bootReasonIdToDescription.keys() else ""

    subfields_arg.update({'reason_description': reason_description})


def subfields_parser_DVR(subfields_arg, device_type_arg):
    sw_version = f'{int(subfields_arg["sw_major"])}.{int(subfields_arg["sw_minor"])}'
    if device_type_arg != devices.DeviceType.DEVICE_TYPE_MAGNETIC.value:
        sw_version = f'{sw_version}.{int(subfields_arg["sw_patch"])}'
    hw_version = subfields_arg["hw_major"]
    if subfields_arg["hw_major"].isdigit():
        hw_version = f'{int(subfields_arg["hw_major"])}'

    subfields_arg.update({'sw_version': sw_version, 'hw_version': hw_version})


def subfields_parser_MLB(subfields_arg, device_type_arg):
    battery_mv = int(subfields_arg["battery"])

    subfields_arg.update({'battery_mv': battery_mv})


def subfields_parser_MVT(subfields_arg, device_type_arg):
    sw_version = f'{int(subfields_arg["sw_major_version"])}.{int(subfields_arg["sw_minor_version"])}'
    if device_type_arg != devices.DeviceType.DEVICE_TYPE_MAGNETIC.value:
        sw_version = f'{sw_version}.{int(subfields_arg["sw_patch_version"])}'
    hw_version = subfields_arg["major_hw_version"]
    if subfields_arg["major_hw_version"].isdigit():
        hw_version = f'{int(subfields_arg["major_hw_version"])}'

    subfields_arg.update({'sw_version': sw_version, 'hw_version': hw_version})

def subfields_parser_DDS(subfields_arg, device_type_arg):
    lock_status = int(subfields_arg["lock_state"])
    reason = int(subfields_arg["reason"])

    subfields_arg.update({'lock_status': lock_status, 'reason': reason})

def subfields_parser_DKS(subfields_arg, device_type_arg):
    calibration_status = int(subfields_arg["calibration_status"])

    subfields_arg.update({'calibration_status': calibration_status})

def subfields_parser_DBD(subfields_arg, device_type_arg):
    detection_type = int(subfields_arg["detection_type"])

    subfields_arg.update({'detection_type': detection_type})

def subfields_parser_SFG(subfields_arg, device_type_arg):
    result_id = int(subfields_arg["result"])
    if result_id in SFGResultIdToDescription.keys():
        result_description = SFGResultIdToDescription[result_id]
    else:
        result_description = "Unknown result"

    subfields_arg.update({'result_id': result_id})
    subfields_arg.update({'result_description': result_description})

def subfields_parser_CTS(subfields_arg, device_type_arg):
    result_id = int(subfields_arg["result"])
    if result_id in CSTResultIdToDescription.keys():
        result_description = CSTResultIdToDescription[result_id]
    else:
        result_description = "Unknown result"

    subfields_arg.update({'result_id': result_id})
    subfields_arg.update({'result_description': result_description})

def subfields_parser_TFG(subfields_arg, device_type_arg):
    key = subfields_arg["key"]

    subfields_arg.update({'key': key})

def subfields_parser_IFH(subfields_arg, device_type_arg):
    result_id = int(subfields_arg["result"])
    if result_id in IFGIdToDescription.keys():
        result_description = IFGIdToDescription[result_id]
    else:
        result_description = "Unknown result"

    subfields_arg.update({'result_id': result_id})
    subfields_arg.update({'result_description': result_description})

def subfields_parser_MTS(subfields_arg, device_type_arg):
    device_type_id = int(subfields_arg["device_type"])
    if device_type_id in posesaDeviceTypes.keys():
        device_type = posesaDeviceTypes[device_type_id]
    else:
        device_type = "Unknown device type"

    supervision_type_id = int(subfields_arg["supervision"])
    if supervision_type_id in MTSGenericStatusToDescription.keys():
        supervision_description = MTSGenericStatusToDescription[supervision_type_id]
    else:
        supervision_description = "Unknown status"

    battery_status_id = int(subfields_arg["battery_status"])
    if battery_status_id in MTSBatteryStatusToDescription.keys():
        battery_description = MTSBatteryStatusToDescription[battery_status_id]
    else:
        battery_description = "Unknown battery status"

    tamper_status_id = int(subfields_arg["tamper_status"])
    if tamper_status_id in MTSGenericStatusToDescription.keys():
        tamper_description = MTSGenericStatusToDescription[tamper_status_id]
    else:
        tamper_description = "Unknown tamper status"

    ac_status_id = int(subfields_arg["ac_status"])
    if ac_status_id in MTSGenericStatusToDescription.keys():
        ac_description = MTSGenericStatusToDescription[ac_status_id]
    else:
        ac_description = "Unknown ac status"

    radio_rssi_dbm = int(subfields_arg["rssi_radio"]) * -1 + 100
    
    battery_level_mv = int(subfields_arg["battery_level"])
    
    temperature_raw = int(subfields_arg["temperature"])
    if temperature_raw == 200:
        temperature = "n/a"
    elif str(temperature_raw)[0] == '1':
            temperature = -1 * (temperature_raw - 100)
    else:
        temperature = temperature_raw
    
    lqi_value = int(subfields_arg["lqi"])
    
    wifi_rssi_dbm = int(subfields_arg["wifi_rssi"]) * -1 + 100

    wifi_status_id = int(subfields_arg["wifi_status"])
    if wifi_status_id in MTSWifiStatusToDescription.keys():
        wifi_description = MTSWifiStatusToDescription[wifi_status_id]
    else:
        wifi_description = "Unknown wifi status"
    
    masking_status_id = int(subfields_arg["masking_status"])
    if masking_status_id in MTSGenericStatusToDescription.keys():
        masking_description = MTSGenericStatusToDescription[masking_status_id]
    else:
        masking_description = "Unknown masking status"
    
    subfields_arg.update({'device_type': device_type})
    subfields_arg.update({'supervision': supervision_description})
    subfields_arg.update({'battery_status': battery_description})
    subfields_arg.update({'tamper_status': tamper_description})
    subfields_arg.update({'ac_status': ac_description})
    subfields_arg.update({'rssi_radio': radio_rssi_dbm})
    subfields_arg.update({'battery_level': battery_level_mv})
    subfields_arg.update({'temperature': temperature})
    subfields_arg.update({'lqi_value': lqi_value})
    subfields_arg.update({'wifi_rssi': wifi_rssi_dbm})
    subfields_arg.update({'wifi_status': wifi_description})
    subfields_arg.update({'masking_status': masking_description})


# -----------------------------------------------------------------------------------------------------------------
# ----------------------------------------------------- DICT ------------------------------------------------------
# -----------------------------------------------------------------------------------------------------------------

rawToPoseseDict = {
    "MS2": {
        "device_id": {
            "pos": 0,
            "len": 3,
        },
        "others": {
            "rssi_radio_level": {
                "pos": 3,
                "len": 3,
            },
            "lqi": {
                "pos": 6,
                "len": 3,
            }
        },
        "subfields_parser": subfields_parser_MS2,
    },
    "DTS": {
        "device_id": {
            "pos": 0,
            "len": 3
        },
        "others": {
            "tamper_number": {
                "pos": 0,
                "len": 1
            },
        },
        "subfields_parser": subfields_parser_DTS,
    },
    "DBR": {
        "device_id": {
            "pos": 0,
            "len": 2
        },
        "others": {
            "reason": {
                "pos": 2,
                "len": 3
            }
        },
        "subfields_parser": subfields_parser_DBR,
    },
    "DVR": {
        "device_id": {
            "pos": 0,
            "len": 2
        },
        "others": {
            "sw_major": {
                "pos": 2,
                "len": 3
            },
            "sw_minor": {
                "pos": 5,
                "len": 3
            },
            "sw_patch": {
                "pos": 8,
                "len": 3
            },
            "sw_variant": {
                "pos": 11,
                "len": 1
            },
            "hw_major": {
                "pos": 12,
                "len": 3
            },
            "hw_minor": {
                "pos": 15,
                "len": 3
            }
        },
        "subfields_parser": subfields_parser_DVR,
    },
    "MLB": {
        "device_id": {
            "pos": 0,
            "len": 3
        },
        "others": {
            "battery": {
                "pos": 3,
                "len": 4
            }
        },
        "subfields_parser": subfields_parser_MLB,
    },
    "MVT": {
        "device_id": {
            "pos": 3,
            "len": 2
        },
        "others": {
            "sw_major_version": {
                "pos": 5,
                "len": 3
            },
            "sw_minor_version": {
                "pos": 8,
                "len": 3
            },
            "sw_patch_version": {
                "pos": 11,
                "len": 3
            },
            "major_hw_version": {
                "pos": 14,
                "len": 3
            }
        },
        "subfields_parser": subfields_parser_MVT,
    },
    "DDS": {
        "device_id": {
            "pos": 0,
            "len": 2
        },
        "others": {
            "lock_state": {
                "pos": 2,
                "len": 1
            },
            "reason": {
                "pos": 16,
                "len": 2
            },
        },
        "subfields_parser": subfields_parser_DDS,
    },
    "DKS": {
        "device_id": {
            "pos": 0,
            "len": 2
        },
        "others": {
            "calibration_status": {
                "pos": 2,
                "len": 2
            },
        },
        "subfields_parser": subfields_parser_DKS,
    },
    "DBD": {
        "device_id": {
            "pos": 0,
            "len": 2
        },
        "others": {
            "detection_type": {
                "pos": 2,
                "len": 2
            },
        },
        "subfields_parser": subfields_parser_DBD,
    },
    "SFG": {
        "device_id": {
            "pos": 0,
            "len": 3
        },
        "others": {
            "result": {
                "pos": 3,
                "len": 3
            }
        },
        "subfields_parser": subfields_parser_SFG,
    },
    "CTS": {
        "device_id": {
            "pos": 0,
            "len": 3
        },
        "others": {
            "result": {
                "pos": 3,
                "len": 4
            }
        },
        "subfields_parser": subfields_parser_CTS,
    },
    "TFG": {
        "device_id": {
            "pos": 0,
            "len": 3
        },
        "others": {
            "key": {
                "pos": 3,
                "len": 8
            },
        },
        "subfields_parser": subfields_parser_TFG,
    },
    "IFH": {
        "device_id": {
            "pos": 0,
            "len": 3
        },
        "others": {
            "result": {
                "pos": 3,
                "len": 3
            }
        },
        "subfields_parser": subfields_parser_IFH,
    },
    "MTS": {
        "device_id": {
            "pos": 3,
            "len": 2
        },
        "others": {
            "device_type": {
                "pos": 0,
                "len": 3
            },
            "supervision": {
                "pos": 5,
                "len": 1
            },
            "battery_status": {
                "pos": 6,
                "len": 1
            },
            "tamper_status": {
                "pos": 7,
                "len": 1
            },
            "ac_status": {
                "pos": 8,
                "len": 1
            },
            "rssi_radio": {
                "pos": 9,
                "len": 3
            },
            "battery_level": {
                "pos": 12,
                "len": 4
            },
            "temperature": {
                "pos": 16,
                "len": 3
            },
            "lqi": {
                "pos": 19,
                "len": 3
            },
            "wifi_rssi": {
                "pos": 22,
                "len": 3
            },
            "wifi_status": {
                "pos": 25,
                "len": 3
            },
            "masking_status": {
                "pos": 28,
                "len": 1
            }
        },
        "subfields_parser": subfields_parser_MTS,
    }
}

eventStatusDict = {
    'A': 'activated',
    'D': 'restored',
    'O': 'opened',
    'C': 'closed',
    'X': 'n/a',
    'N': 'not applicable',
}

poseseDevToDevType = {
    "VK": devices.DeviceType.DEVICE_TYPE_MOK.value,
    "VV": devices.DeviceType.DEVICE_TYPE_SVK.value,
    "KF": devices.DeviceType.DEVICE_TYPE_KEYFOB.value,
    "QR": devices.DeviceType.DEVICE_TYPE_ORION.value,
    "MG": devices.DeviceType.DEVICE_TYPE_MAGNETIC.value,
    "QP": devices.DeviceType.DEVICE_TYPE_AQUILA.value,
    "YR": devices.DeviceType.DEVICE_TYPE_CAMPIR.value,
    "YP": devices.DeviceType.DEVICE_TYPE_CROPTEX.value,
    "DR": devices.DeviceType.DEVICE_TYPE_DOORLOCK.value,
    "V7": devices.DeviceType.DEVICE_TYPE_HOMEPANEL.value,
    "FX": devices.DeviceType.DEVICE_TYPE_NOX.value,
    "B3": devices.DeviceType.DEVICE_TYPE_SPB.value,
    "FR": devices.DeviceType.DEVICE_TYPE_SMOKE4.value,
    "FG": devices.DeviceType.DEVICE_TYPE_ZEROVISION.value,
}

posesaDeviceTypes = {
    100: 'CU',
    101: 'MAGNETIC',
    102: 'CAMPIR',
    104: 'ZEROVISION',
    105: 'IPCAMERA',
    106: 'ORION',
    107: 'AQUILA',
    108: 'NOX',
    109: 'AQUILABUSINESS',
    110: 'MC3',
    111: 'VC4',
    120: 'SPB',
    121: 'SMOKE4',
    122: 'WATER',
    123: 'SENTINEL1',
    124: 'SENTINEL2',
    130: 'SMARTPLUG',
    131: 'WRE',
    132: 'SENSINGPLUG1',
    140: 'HOMEPANEL',
    141: 'SMARTDOT',
    142: 'SVK',
    143: 'MOK',
    162: 'KEYFOB',
    163: 'LOCK',
}

bootReasonIdToDescription = {
    0: 'Unknown boot reason',
    1: 'FOTA (CU)',
    2: 'Software - Fatal error (uncontrolled reboot)',
    3: 'Software - System error (controlled reboot)',
    4: 'Remote Reboot (CU)',
    5: 'Factory Reset  (CU)',
    6: 'Hardware - Power on -  Power up reset',
    7: 'Watchdog reset',
    8: 'Brown out',
    9: 'Lockup',
    10: 'Node Fault Exception reset',
    11: 'Clock lost',
    12: 'Node software reset: Reset triggered by the firmware',
    13: 'Pressed button',
}

tamperIdToDescription = {
    devices.DeviceType.DEVICE_TYPE_MOK.value: {
        0: "wall"
    },
    devices.DeviceType.DEVICE_TYPE_SVK.value: {
        1: "battery",
        2: "wall"
    },
    devices.DeviceType.DEVICE_TYPE_MAGNETIC.value: {
        0: "wall"
    },
    devices.DeviceType.DEVICE_TYPE_NOX.value: {
        1: "canister",
        2: "wall"
    },
    devices.DeviceType.DEVICE_TYPE_SPB.value: {
        1: "battery",
        2: "wall"
    },
    devices.DeviceType.DEVICE_TYPE_ZEROVISION.value: {
        1: "canister",
        2: "wall"
    }
}

SFGResultIdToDescription = {
    0: 'Success',
    1: 'Failure. Request timeout',
    2: 'Failure. FG in disabled state',
    3: 'Key not valid',
    4: 'Failure, canister not fired'
}

CSTResultIdToDescription = {
    0x000: 'Success',
    0x001: 'loss of continuity in canister',
    0x002: 'config. data integrity failure',
    0x004: 'battery measurement circuit failure',
    0x008: 'triggering circuit failure',
    0x010: 'wired inputs circuit failure',
    0x020: 'over-temperature',
    0x040: 'canister test circuit failure',
    0x080: 'RAM failure',
    0x100: 'Steady state failure',
    0x200: 'Back to steady state failure',
    0x400: 'CRC code of memory failure',
    0x800: 'Canister power circuit failure',
    0x1000: 'CPU oscillator failure',
    0x2000: 'Canister relay failure',
    0x4000: 'Safe canister out failure',
    0xFF80: 'to be defined',
    0x5000: 'faultSerialFlash',
    0x5001: 'faultBatteryTooHigh',
    0x5002: 'faultBITFailADCCircuit',
    0x5003: 'faultTimer'
}

IFGIdToDescription = {
    0: 'Success',
    1: 'Failure',
    2: 'Panel in ITS',
}

MTSBatteryStatusToDescription = {
    0: 'NA',
    1: 'Ok',
    2: 'Fault Low Battery',
    3: 'Fault Empty Battery',
    4: 'Fault (Disconnected or damaged)'
}

MTSGenericStatusToDescription = {
    0: 'NA',
    1: 'Ok',
    2: 'Fault'
    # 3-9: Reserved
}

MTSWifiStatusToDescription = {
    0: 'Disconnected',
    1: 'Associated',
    2: 'IPAddressSet',
    3: 'NoSsidFound',
    4: 'PhoneHomeSucceded',
    5: 'BackendUnreachable',
    6: 'Disabled',
    7: 'AuthRejected',
    8: 'AssociationRejected',
    9: 'NetworkError',
    10: 'NoRootCa',
    11: 'CertificateNotFound',
    12: 'CertificateKeyNotFound',
    13: 'EapAuthFailed',
    14: 'InitFailed',
    15: 'Layer1Failure',
    16: 'Layer2Failure',
    17: 'IpAddressNotSet',
    18: 'MissingSsid',
    19: 'InvalidSsid',
    20: 'AttachTimeout',
    #21-255 Reserved for appWifiReport (RF protocol)
    501: 'Unsupported',
    900: 'Authenticated',
    901: 'DNSFailed',
    902: 'Connected',
    999: 'Unreceived'
}


# -----------------------------------------------------------------------------------------------------------------
# -------------------------------------------------- PUBLIC API ---------------------------------------------------
# -----------------------------------------------------------------------------------------------------------------

def posese_parser(raw_data_arg, device_type_arg=None):

    # Check if contains #X
    if '#X' not in raw_data_arg:
        return None
    else:
        raw_data_arg = raw_data_arg.split('#X', 1)[1]

    # Length check
    if len(raw_data_arg) < 25:
        return None

    # get zone (2 chars)
    zone = raw_data_arg[12:14]
    # get dev type
    dev_type = poseseDevToDevType[zone] if zone in poseseDevToDevType.keys() else None
    # get posese
    posese_event_status = eventStatusDict[raw_data_arg[20]]
    # get posese
    posese_type = raw_data_arg[21:24]
    # get payload
    payload = raw_data_arg[24:]

    # check if posese is into the list
    if posese_type not in rawToPoseseDict.keys():
        return None

    # getting posese_dict
    posese_dict = rawToPoseseDict[posese_type]
    # getting device id
    device_id = payload[posese_dict["device_id"]["pos"]:posese_dict["device_id"]["pos"] +
                                                        posese_dict["device_id"]["len"]]
    zone += device_id[-2:]

    # preparing result
    result_dict = {
        "posese_type": posese_type,
        "zone_id": zone,
        "event_status": posese_event_status,
    }

    # check if others field has to be obtained
    if "others" in posese_dict:
        for others_key in posese_dict["others"]:
            parsed_value = payload[posese_dict["others"][others_key]["pos"]:posese_dict["others"][others_key]["pos"] +
                                                                            posese_dict["others"][others_key]["len"]]
            result_dict.update({
                others_key: parsed_value
            })

    # subfields parser
    if "subfields_parser" in rawToPoseseDict[posese_type]:
        rawToPoseseDict[posese_type]["subfields_parser"](result_dict, dev_type)

    return result_dict