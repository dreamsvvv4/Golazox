# Services to look for
#Crtl k + Crtl U
#Crtl k + Crtl C
services = [
    "cuxsdialerd",
]

# tagged file will have ALL logs that contain this tags + any log where log.original has any of the next word
tags = [
    #"Media",
    #"SAW"
]
listTagged = [
    "Event sent. DDS",
    "appViolationAge",
    "Send SmartLockRequestCompleted",
     #"Received a smart lock ",
     #"sendDoorlockStatus",
     #"Nodefault received from node through RF DOORLOCK",
    #"appPeriodicStatus",
     #"Logout event",
     #"ChangeLockStateRequest",
     #"Login event",
     "Notifying lock status changed",
    "seReportLockState"
    "Arm state change",
    # "seReportLockState",
    #"Abort current transfers",
    #"Logout event",
    #"Error received: ",
    #"AppViolationAge"
]

# filtered file will have all logs where log.original has any of the next word
listFiltered = [
    "Event sent",
        "appViolationAge",
     #"Received a smart lock ",
     #"sendDoorlockStatus",
     #"Nodefault received from node through RF DOORLOCK",
     #"Logout event",
     #"ChangeLockStateRequest",
     #"Login event",
     "Notifying lock status changed",
         "Send SmartLockRequestCompleted",
    "seReportLockState",
    "Arm state change",
    #"store:",
    #"onReadyForUpload",
    #"Violated node",
    #"Safety",
    #"Adding sent photo mrf entry",
    #"Error received: ",
    #"processMediaStatusViolation",
    "AppViolationAge",
    #"store/discard",
    #"VIOLATED",
    #"Login event",
    #"2KTWVAAV",
    #"appPeriodicStatus",
    #"Contact State"
]

listFiltered = [
    "cmdArmChangeNotification2",
    "Send SmartLockRequestCompleted",
    "seReportLockState",
    "Event sent",
        "appViolationAge",
    #"sawid",
    #"3225NF28",
    #"Starting process",     
    #"CUxS Core Daemon",
    #"Deinit stack reques",
    #"Stack not initialized",
    #"Siren",
     #"Received a smart lock ",
     "sendDoorlockStatus",
     #"Nodefault received from node through RF DOORLOCK",
     #"Logout event",
    #"2KTWVAAV",
    #"appPeriodicStatus",
     #"ChangeLockStateRequest",
     #"Login event",
     "Notifying lock status changed",
    #"Jamming status changed to: Active",
    #"AppViolationAge",
    #"Media ready",
    #"Power up"
]
