# ============================================================
#  Unified configuration file — all presets in one place
#  Each key matches the name shown in the UI dropdown.
#  To add a new preset, add a new entry to CONFIGS.
# ============================================================

CONFIGS = {

    # ----------------------------------------------------------
    # All — no service/keyword filter, download everything
    # ----------------------------------------------------------
    "All": {
        "services": [],
        "tags": [],
        "listTagged": [],
        "listFiltered": [],
    },

    # ----------------------------------------------------------
    # Photos
    # ----------------------------------------------------------
    "Photos": {
        "services": [
            "cuxscored",
            "cuxspaparazzod",
            "cuxs-situationd",
            "cuxsdialerd",
            "cuxs-rengined",
        ],
        "tags": ["Media", "SAW"],
        "listTagged": [
            "MRF",
            "Violated node",
            "Disconnecting node",
            "Storing event",
            "Abort current transfers",
            "Logout event",
            "Error received: ",
            "AppViolationAge",
        ],
        "listFiltered": [
            "Reports new media ready",
            "AppViolationAge",
            "Media ready",
            "Power up",
        ],
    },

    # ----------------------------------------------------------
    # Calls (Audio)
    # ----------------------------------------------------------
    "Calls": {
        "services": [
            "cuxscored",
            "cuxszapatofonod",
            "gsmsrv",
            "ofonod",
            "cuxs-dect-manager",
            "dectcontrollertest",
            "cuxs-dect-setup",
            "cuxs-rengined",
            "cuxs-voip-uad",
        ],
        "tags": ["2WV"],
        "listTagged": [
            "zapa",
            "ofono",
            "gsmsrv",
        ],
        "listFiltered": [
            "incoming",
            "Incoming",
            "hangup",
            "Hangup",
        ],
    },

    # ----------------------------------------------------------
    # Communications (M2M)
    # ----------------------------------------------------------
    "Communications": {
        "services": [
            "cuxsdialerd",
            "cuxsinstallerd",
            "xnotariod",
            "cuxsupdaterd",
        ],
        "tags": ["comms"],
        "listTagged": [],
        "listFiltered": [
            "onMessageReceived",
            "CMD received",
            "onIncomingMessage",
            "MqttConnection",
        ],
    },

    # ----------------------------------------------------------
    # Doorlock
    # ----------------------------------------------------------
    "Doorlock": {
        "services": [
            "cuxscored",
            "cuxsdialerd",
            "cuxs-rengined",
            "cuxsinstallerd",
        ],
        "tags": [],
        "listTagged": [
            "Event sent. DDS",
            "Send SmartLockRequestCompleted",
            "Notifying lock status changed",
            "seReportLockState",
            "Arm state change",
        ],
        "listFiltered": [
            "cmdArmChangeNotification2",
            "Send SmartLockRequestCompleted",
            "seReportLockState",
            "Event sent",
            "sendDoorlockStatus",
            "Notifying lock status changed",
        ],
    },

    # ----------------------------------------------------------
    # FOTA (Firmware Over The Air)
    # ----------------------------------------------------------
    "FOTA": {
        "services": [
            "cuxscored",
            "cuxsupdaterd",
        ],
        "tags": [],
        "listTagged": [],
        "listFiltered": [],
    },

}
