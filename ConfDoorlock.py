# Services to look for
#Crtl k + Crtl U
#Crtl k + Crtl C
#Doorlock
services = [ 
    "cuxscored", 
    "cuxsdialerd", 
    "cuxs-rengined",
    "cuxsinstallerd",
]

# tagged file will have ALL logs that contain this tags + any log where log.original has any of the next word
tags = [
    #"Media",
    #"SAW"
]
listTagged = [
    "Event sent. DDS",
    "Send SmartLockRequestCompleted",
     "Notifying lock status changed",
    "seReportLockState"
    "Arm state change",
]

# filtered file will have all logs where log.original has any of the next word
listFiltered = [
    "Event sent",
    "Notifying lock status changed",
    "Send SmartLockRequestCompleted",
    "seReportLockState",
    "Arm state change",
    "AppViolationAge",
]

listFiltered = [
    "cmdArmChangeNotification2",
    "Send SmartLockRequestCompleted",
    "seReportLockState",
    "Event sent",
     "sendDoorlockStatus",
     "Notifying lock status changed",
]