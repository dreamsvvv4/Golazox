# Services to look for
services = [ 
    "cuxscored", 
    "cuxszapatofonod",
    "gsmsrv",
    "ofonod",
    "cuxs-dect-manager",
    "dectcontrollertest",
    "cuxs-dect-setup",
    "cuxs-rengined",
    "cuxs-voip-uad"
]

# tagged file will have ALL logs that contain this tags + any log where log.original has any of the next word
tags = [
    "2WV"
]
listTagged = [
    "zapa",
    "ofono",
    "gsmsrv"
]

# filtered file will have all logs where log.original has any of the next word
listFiltered = [
    "incoming",
    "Incoming",
    "hangup",
    "Hangup"
]