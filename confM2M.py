# Services to look for
services = [ 
    "cuxsdialerd",
    "cuxsinstallerd",
    "xnotariod",
    "cuxsupdaterd"
]

# tagged file will have ALL logs that contain this tags + any log where log.original has any of the next word
tags = [
    "comms"
]
listTagged = [
]

# filtered file will have all logs where log.original has any of the next word
listFiltered = [
    "onMessageReceived",
    "CMD received",
    "onIncomingMessage",
    "MqttConnection"
]