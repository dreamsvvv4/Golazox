# Services to look for
services = [ 
    "cuxscored", 
    "cuxspaparazzod",
    "cuxs-situationd",
    "cuxsdialerd", 
    "cuxs-rengined"
]

# tagged file will have ALL logs that contain this tags + any log where log.original has any of the next word
tags = [
    "Media",
    "SAW"
]
listTagged = [
    "MRF",
    "Violated node",
    "Disconnecting node",
    "Storing event",
    "Abort current transfers",
    "Logout event",
    "Error received: ",
    "AppViolationAge"
]

# filtered file will have all logs where log.original has any of the next word
listFiltered = [
    "MRF",
    "Reply",
    "in path",
    "Metadata",
    "store:",
    "onReadyForUpload",
    "Violated node",
    "Safety",
    "Adding sent photo mrf entry",
    "Error received: ",
    "processMediaStatusViolation",
    "AppViolationAge",
    "store/discard",
    "VIOLATED",
    "Login event",
    "Contact State"
]

listFiltered = [
    "Reports new media ready",
    "AppViolationAge",
    "Media ready",
    "Power up"
]