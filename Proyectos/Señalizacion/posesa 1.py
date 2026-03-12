import pyodbc 
import poseses
from sys import platform

def deviceTypeStr(argm):
    devTypeStr = {
        'B3':'SPB', 'DR':'LOCK', 'CE':'CU', 'FG':'ZEROVISION', 'FR':'SMOKE', 'FX':'NOX', 'KF':'KEYFOB',
        'MG':'MAGNETIC', 'QP':'AQUILA', 'QR':'ORION', 'V7':'HOMEPANEL', 'VV':'SVK', 'VK':'MOK',
        'YP':'CROPTEX', 'YR':'CAMPIR'}
    if argm in devTypeStr:
        result = devTypeStr[argm]
    else:
        result = 'DEV??'
    return result

class PoseseEvent:
    def __init__(self, event):
        self.peEventData = event
        self.peStatus = event[1:12]
        self.peArm_type = self.peStatus[0]
        self.peForced = self.peStatus[1]
        self.peTime_status = self.peStatus[2:8]
        self.peOpenz = self.peStatus[8]
        self.peCancelz = self.peStatus[9]
        self.peFault = self.peStatus[10]
        self.peEvtype = event[12]
        self.peDevice = event[13:21]
        self.pe_status = event[21]
        self.peCode = event[22:25]
        self.peArgms = event[25:]

    def preStr(self):
        ret = self.peEventData[0] + ' ARM:' + self.peArm_type + ' F:' + self.peForced 
        ret += ' TS:' + self.peTime_status+'s' + ' OP:' + self.peOpenz + ' CANC:' + self.peCancelz
        ret += ' F:' + self.peFault + ' EVTYPE:' + self.peEvtype + ' DEV:' + self.peDevice[0:2]
        ret += '(' + deviceTypeStr(self.peDevice[0:2]) + ').' + self.peDevice[2:] + ' EVST:' + self.pe_status
        ret += ' '
        return ret       

    def poseseCodeStr(self):
        posCodeStr = {
            'CAT':'AC Fault Synthetic', 'DBR':'Boot Reason', 'DCS':'Device Claim Status', 'DDS':'Doorlock Device Status',
            'DTS':'Tamper Incident', 'DVR':'Device Version',
            'FK1':'DDI3 Battery Report', 'FK2':'DDI3 Sensor Out of Range', 'FK3':'DDI3 Sensor gradient', 'FK4':'DDI3 Tamper',
            'FK5':'DDI3 Jamming', 'FK7':'DDI3 Boot', 'FK8':'DDI3 Keep-Alive', 'DRC':'Device Renew Certificate Status', 'FKI':'DDI3 Radio Level',
            'INI':'GSM Coverage Information', 'MCA':'Alarm cancel',
            'MCU':'Arm/disarm action', 'MDE':'Exceptions', 'MEB':'Empty Battery', 'MEN':'Keep Alive for EN Missing Test',
            'MLB':'Low Battery', 'MMS':'Media Status', 'MPJ':'Rejected Response', 
            'MPR':'POSESO Ack', 'MRA':'Remote Arm', 'MRD':'Remote Disarm', 'MRF':'Alarm Detection wo Restore', 'MS2':'Supervision Fault 2h', 
            'MSR':'Soft Reset', 'MTS':'Devices Tech Info', 'MVT':'Release Info', 'RAD':'Arm/disarm fault from Scheduler',
            'RIE':'Remote Image Event Synthetic', 'RIH':'Remote Image Event High Quality', 'RIL':'Remote Image Event Low Quality',
            'RMQ':'MQTT subscription', 'RPH':'High Quality Image Event', 'RPL':'Low Quality Image Event',
            'TSS':'Supervision Fault 11h', 'TTS':'Tamper Fault' }
        if self.peCode in posCodeStr:
            result = self.peCode + ':' + posCodeStr[self.peCode]
        else:
            result = self.peCode
        return result

    def poseseArgs(self):
        return poseses.poseseArgStr(self.peCode, self.peEventData[25:])
#        poseseFx = 'posese' + self.peCode + 'str'
#        if poseseFx in globals():
#            print(poseseFx, ' is in globals')
#            return globals()[poseseFx](self.peEventData[25:])
#        else:
#            print(poseseFx, ' is not in globals')
#            return self.peEventData[25:]

    def strFields(self):
        ret = self.preStr() + self.poseseCodeStr()
#        ret += ' | ' + poseses.poseseArgs(self.peCode,self.peEventData[25:])
        ret += ' | ' + self.poseseArgs()
        return ret

class msgPosese:
    
    def __init__(self, data):
        self.mpeData = data
        self.eventsList = []

        sep_pos = data.find("#X")
        event = data[sep_pos+1:]
        self.mpeID = data[0:sep_pos]
        while sep_pos != -1:
            next_pos = event.find("/X")
            if next_pos == -1:
                posese_event = PoseseEvent(event[:event.find("!")])
            else:
                posese_event = PoseseEvent(event[:next_pos])
            self.eventsList.append(posese_event)
            sep_pos = next_pos
            event = event[next_pos+1:]

    def len(self):
        return len(self.eventsList)

    def strFields(self, n):
        if n < self.len():
            return self.eventsList[n].strFields()
        else:
            return ''

class msgPosesa:

    def __init__(self, posesa):
        self.mpaData = posesa

        # Header of the protocol. In this case it always will be the ASCII string “SDES”
        self.mpaHead = posesa[0:4]
        
        # Length of the complete message (‘000’ – ‘FFF’) except Head field (4 bytes) and
        # this Length field (3 bytes). CRC is included in the calculation of the value. It will
        # be filled with zeros on the left. Example: If length = 16 bytes then Length Field
        # = ASCII string “016”.
        self.mpaLength = posesa[4:7]
        self.mpaLon = int('0x' + self.mpaLength, base=16) - 39
        
        # Manufacturer (2 bytes), Model (2 bytes), Version (2 bytes) ->
        self.mpaManufacturer = posesa[7:13]

        # Internal message counter filled with zeros on the left(‘000’-‘FFF’)
        # Randomly generated by SD when sending an order to the panel (000-FFE)
        # Fixed when the event is generated by the alarm system and does not answer an order → FFF
        self.mpaCounter = posesa[13:16]

        # If type of protocol = ‘E’ then ACK = ‘1’ (because of POSESA protocol always needs ACK 
        # confirmation for Iridium Verisure)
        self.mpaAck = posesa[16:17]
        
        self.mpaInst = posesa[17:25]
        self.mpaTime = posesa[25:38]

        # It shows the type of protocol for the next bytes. Possible values for Iridium Verisure are:
        # E -> POSESE OR Iridium protocol (sent by the panel to the receivers).
        # Z -> POSESE protocol (response message by the receivers to the panel).
        # P -> POSESO protocol (sent by the receivers to the panel).
        self.mpaTypeProtocol = posesa[38]

        self.mpaPosesesData = posesa[39:]
        self.mpaPosese = msgPosese(posesa[39:])

    def strFields(self):
        ret = ''
        for i in range(self.mpaPosese.len()):
            ret += '\n   - ID:' + self.mpaPosese.mpeID + ' ' + self.mpaPosese.strFields(i)
        return ret


class HistRegister:

    def __init__(self, date, country, inst, comm, stype, data):
        self.rDate = date
        self.rCountry = country
        self.rInst = inst
        self.rComm = comm
        self.rType = stype
        self.rPosesa = msgPosesa(data)

    def strFields(self):
        ret = self.rDate.strftime("%Y-%m-%d %H:%M:%S.%f") + ' ' + self.rCountry + ' ' + self.rInst + ' ' + self.rComm + ' ' + self.rType
        ret += ' : ' + self.rPosesa.mpaHead + ' L:0x' + self.rPosesa.mpaLength + ' MF:' + self.rPosesa.mpaManufacturer + ' CNT:' + self.rPosesa.mpaCounter + ' ACK:'
        ret += self.rPosesa.mpaAck + ' ID:' + self.rPosesa.mpaInst + ' Time:' + self.rPosesa.mpaTime + ' TYPE:' + self.rPosesa.mpaTypeProtocol
        ret += self.rPosesa.strFields()
        return ret

def msgGet(date_init, date_end, idlist, country, filter):
    # Some other example server values are
    # server = 'localhost\sqlexpress' # for a named instance
    # server = 'myserver,port' # to specify an alternate port
#    server = 'tcp:CLUSSQL02INST01\INSTANCE01,1433' 
#    database = 'ALARMHIST' 
#    username = 'sms' 
#    password = 'men$@k@$' 

    server = 'tcp:historificadordb.sp.securitasdirect.local\INSTANCE01,1433' 
    database = 'ALARMHIST' 
    username = 'sms' 
    password = 'men$@k@$' 

    if platform == "win32":
        cnxn = pyodbc.connect('DRIVER={SQL Server};SERVER='+server+';DATABASE='+database+';UID='+username+';PWD='+ password)
    elif platform == "linux" or platform == "linux2":
        cnxn = pyodbc.connect('DRIVER={/opt/microsoft/msodbcsql17/lib64/libmsodbcsql-17.10.so.6.1};SERVER='+server+';DATABASE='+database+';UID='+username+';PWD='+ password)
    else:
        raise Exception("Unsupported platform")
    cursor = cnxn.cursor()
    #cursor.execute("SELECT TOP 10000 DATE_IN, id_pais, id_cliente, id_medio, type_sevice, trama_rx "

    if idlist != []:
        strID = "and (id_cliente='" + idlist[0]
        i = 1;
        while i < len(idlist):  
            strID += "' or id_cliente='" + idlist[i]
            i = i + 1
        strID += "') "
#        print (strID)
    else:
        strID = ""

    strSQL = "SELECT TOP 200000 DATE_IN, id_pais, id_cliente, id_medio, type_sevice, trama_rx "
    strSQL += "FROM ALARMHIST..HISTORIFICADOR WHERE id_pais='" + country + "' "
#    strSQL += "and trama_rx_num_evs>1 "
    if strID:
        strSQL += strID
    if filter:
        filter = filter.strip()
        strSQL += "and (trama_rx like '%" + filter + "%') "
    #        "and (trama_rx like '%MVT121%')"
#    strSQL += "and (trama_rx like '%MPJ%')"
#    strSQL += "and (trama_rx like '%DTS%')"
    #        "and (trama_rx like '%FR000000_DBR%' or trama_rx like '%FR000000_TTS%' or trama_rx like '%MVT121%' or trama_rx like '%MSR121%' or trama_rx like '%FR000000_DTS%')"
    #        "and (trama_rx like '%MVT121%' or trama_rx like '%MSR121%' or trama_rx like '%TTS_121%')"
    #        "and (trama_rx like '%MEC%')"
    strSQL += "and date_in>'" + date_init + "' "
    strSQL += "and date_in<'" + date_end + "' "
    strSQL += "ORDER BY date_in ASC"
#    print (strSQL)

    cursor.execute(strSQL)
    row = cursor.fetchone() 
    msgnum = 0
    reglist = []
    while row: 
        msgnum = msgnum + 1
#        print(msgnum)

        hReg = HistRegister(row[0], row[1], row[2], row[3], row[4], row[5])
        reglist.append(hReg)
#        print(hReg.strFields())

        # Next database row
        countdown = 10
        while True:
            try:        
                row = cursor.fetchone()
                break
            except Exception as e:
                countdown -= 1
                if countdown == 0:
                    raise Exception("Error fetching row:", e)

    return reglist

