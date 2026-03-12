
def deviceTypeIdStr(argm):
    devTypeIdStr = {
        '100':'CU', '101':'MAGNETIC', '102':'CAMPIR', '103':'CROPTEX', '104':'ZEROVISION', '106':'ORION', '120':'SPB', '121':'SMOKE',
        '140':'HOMEPANEL', '142':'SVK', '162':'KEYFOB' }
    dt = argm[0:3]
    if dt in devTypeIdStr:
        result = devTypeIdStr[dt]
    else:
        result = 'DT?' + dt + '?'
    return result

def poseseMCAstr(argm):
    alarmTypeStr = { '1':'Intrusion', '2':'Fire', '3':'Water', '4':'Tamper' }
    s = argm[0]
    if s in alarmTypeStr: result = alarmTypeStr[s]
    else: result = 'Alarm Type:' + s

    fromStr = { '0':' from Portal', '1':' from SD', '2':' from KFB', '3':' from SVK', '4':' from CU' }
    s = argm[1]
    if s in fromStr: result += fromStr[s]
    else: result += ' from:' + s

    result += '(' + argm[2:4] + ')'

    userStr = { '000':' CRA', '100':' User Master', '101':' User Guard', '103':' Alarm Logic (CU)' }
    s = argm[4:7]
    if s in userStr: result += userStr[s]
    else: result += ' User:' + s

    devStr = { '01':' Dev Remote', '02':' Dev Pin code', '03':' Dev Tag', '04':' Dev Button', '05':' Dev HFE', '06':' Dev CU' }
    s = argm[7:9]
    if s in devStr: result += devStr[s]
    else: result += ' Device:' + s

    return result

def poseseMCUstr(argm):
    armTypeStr = { '00':'Main Disarm', '01':'Main Arm Away', '02':'Main Arm Home', '20':'Perimeter Disarm', '21':'Perimeter Arm',
        '22':'Main+Perimeter Disarm', '23':'Main+Perimeter Arm Away', '24':'Main+Perimeter Arm Home', '30':'Annex Disarm',
        '31':'Annex Arm' }
    s = argm[0:2]
    if s in armTypeStr: result = armTypeStr[s]
    else: result = 'Arm:' + s

    fromStr = { '0':' from Portal', '1':' from SD', '2':' from KFB', '3':' from SVK', '4':' from CU' }
    s = argm[2]
    if s in fromStr: result += fromStr[s]
    else: result += ' from:' + s

    result += '(' + argm[3:5] + ')'

    userStr = { '000':' CRA', '100':' User Master', '101':' User Guard', '103':' Alarm Logic (CU)' }
    s = argm[5:8]
    if s in userStr: result += userStr[s]
    else: result += ' User:' + s

    devStr = { '01':' Dev Remote', '02':' Dev Pin code', '03':' Dev Tag', '04':' Dev Button', '05':' Dev HFE', '06':' Dev CU' }
    s = argm[8:10]
    if s in devStr: result += devStr[s]
    else: result += ' Device:' + s

    return result

def poseseMRAstr(argm):
    armTypeStr = { '01':'Main Arm Away', '02':'Main Arm Home', '21':'Perimeter Arm',
        '23':'Main + Perimeter Arm Away', '24':'Main + Perimeter Arm Home',
        '31':'Annex Arm', '32':'Annex + Arm Away' }
    s = argm[0:2]
    if s in armTypeStr: result = armTypeStr[s]
    else: result = 'Arm:' + s

    devStr = { '00':' SD CRA/ATC' }
    s = argm[2:4]
    if s in devStr: result += devStr[s]
    else: result += ' User:' + s

    return result

def poseseMRFstr(argm):
    result = '(' + argm[0:3] + ')'

    alarmTypeStr = { '0':' Smart Shock Gross', '1':' Smart Shock Repetitive', '2':' PIR' }
    s = argm[3]
    if s in alarmTypeStr: result += alarmTypeStr[s]
    else: result += 'Alarm Type:' + s

    typeStr = { 'I':' Immediate', 'E':' Entry/Exit' }
    s = argm[4]
    if s in typeStr: result += typeStr[s]
    else: result += ' Arming Type:' + s

    rssi = int(argm[5:8])
    if rssi > 100:
        rssi = -rssi + 100
    result += ' rssi:' + str(rssi) + 'dBm'
    result += ' lqi:' + argm[8:11]

    return result

def poseseMVTstr(argm):
    result = deviceTypeIdStr(argm) + '(' + argm[3:5] + ')'
    result += ' v'+argm[5:8]+'.'+argm[8:11]+'.'+argm[11:14]
    result += ' hw '+argm[14:17]
    return result

def poseseMTSstr(argm):
    result = deviceTypeIdStr(argm) + '(' + argm[3:5] + ')'

    svStr = { '1':' SV:OK', '2':' SV:FAULT' }
    s = argm[5]
    if s in svStr: result += svStr[s]
    else: result += 'SV:' + s

    battStr = { '1':' BATT:OK', '2':' BATT:LOW', '3':' BATT:EMPTY', '4':' BATT:FAULT' }
    s = argm[6]
    if s in battStr: result += battStr[s]
    else: result += 'BATT:' + s

    tpStr = { '1':' TP:OK', '2':' TP:FAULT' }
    s = argm[7]
    if s in tpStr: result += tpStr[s]
    else: result += 'TP:' + s

    acStr = { '1':' AC:OK', '2':' AC:FAULT' }
    s = argm[8]
    if s in acStr: result += acStr[s]
    else: result += 'AC:' + s

    rssi = int(argm[9:12])
    if rssi > 100:
        rssi = -rssi + 100
    result += ' rssi:' + str(rssi) + 'dBm'
    result += ' batt:' + argm[12:16] + 'mV'
    result += ' temp:' + argm[16:19] + 'ºC'
    result += ' lqi:' + argm[19:22]

    rssi = int(argm[22:25])
    if rssi > 100:
        rssi = -rssi + 100
    result += ' wifiRssi:' + str(rssi) + 'dBm'
    result += ' wifiStatus:' + argm[25:28]

    return result

def poseseRIEstr(argm):
    result = '(' + argm[0:4] + ')'
    result += ' SID:' + argm[4:7]
    result += ' SEI:' + argm[7:31]
    result += ' TOP:' + argm[31]

    dhpStr = { '0':' No Dark', '1':' Yes Dark' }
    s = argm[32]
    if s in dhpStr: result += dhpStr[s]
    else: result += 'DHP:' + s

    result += ' Timestamp:' + argm[33:47]

    return result

def poseseRMQstr(argm):
    connStr = { '0':'BrokerConn:NO', '1':'BrokerConn:YES' }
    s = argm[0]
    if s in connStr: result = connStr[s]
    else: result = 'BrokerConn:' + s

    ackStr = { '0':' AckTopic:NO subscribed', '1':' AckTopic:YES subscribed' }
    s = argm[1]
    if s in ackStr: result += ackStr[s]
    else: result += ' AckTopic:' + s

    topicStr = { '0':' CmdTopic:NO subscribed', '1':' CmdTopic:YES subscribed' }
    s = argm[2]
    if s in topicStr: result += topicStr[s]
    else: result += ' CmdTopic:' + s

    return result

def poseseMSRstr(argm):
    result = deviceTypeIdStr(argm) + '(' + argm[3:5] + ')'

    val = argm[5:8]
    if val == '001':
        result += ' Reason:POSESO'
    else:
        result += ' Reason:' + val

    return result

def poseseDBRstr(argm):
    result = 'Device: ' + argm[0:2] + ' Reason: ' + argm[2:5]

    reasonStr = { '000':' (Unknown Reason)', '001':' (FOTA)', '002':' (M4 hardfault)', '003':' (Downlink Fault)',
        '004':' (Remote Reboot)', '005':' (Factory Reset)', '006':' (Power Up Reset)', '007':' (Watchdog Reset)', 
        '008':' (Borwn-Out)', '009':' (Lockout)', '010':' (Node Fault Exception Reset)', '011':' (Clock Lost)', 
        '012':' (Node Software Reset)' }
    s = argm[2:5]
    if s in reasonStr:
        result += reasonStr[s]

    return result

def poseseTTSstr(argm):
    numStr = { '1':'Batt', '2':'Wall' }
    s = argm[0]
    if s in numStr: result = numStr[s]
    else: result = 'Num:' + s

    result += ' (' + argm[1:4] + ')'
    rssi = int(argm[4:7])
    if rssi > 100:
        rssi = -rssi + 100
    result += ' rssi:' + str(rssi) + 'dBm'
    result += ' lqi:' + argm[7:10]

    return result

def poseseSRTstr(argm):
    result = 'Arm:' + argm[0]

    result += ' (' + argm[1:4] + ')'
    rssi = int(argm[4:7])
    if rssi > 100:
        rssi = -rssi + 100
    result += ' rssi:' + str(rssi) + 'dBm'
    result += ' lqi:' + argm[7:10]

    return result

def poseseDTSstr(argm):
    numStr = { '1':'Batt', '2':'Wall' }
    s = argm[0]
    if s in numStr: result = numStr[s]
    else: result = 'Num:' + s

    result += ' (' + argm[1:4] + ')'
    rssi = int(argm[4:7])
    if rssi > 100:
        rssi = -rssi + 100
    result += ' rssi:' + str(rssi) + 'dBm'

    rssi = int(argm[7:10])
    if rssi > 100:
        rssi = -rssi + 100
    result += ' wifiRssi:' + str(rssi) + 'dBm'
    result += ' wifiStatus:' + argm[10:13]
    result += ' sawid:' + argm[13:23]
    result += ' age:' + argm[23:33]

    return result

def poseseMDVstr(argm):
    numStr = { '1':'Batt', '2':'Wall' }
    s = argm[0]
    if s in numStr: result = numStr[s]
    else: result = 'Num:' + s

    result += ' (' + argm[0:3] + ')'

    numType = { '00':'Magnet', '01':'Shock Gross', '02':'Shock Repetitive', '03':'PIR', '04':'Smoke', '05':'Water' }
    s = argm[3:5]
    if s in numType: result += ' ' + numType[s]
    else: result += ' Type:' + s

    result += ' Arm:' + argm[5:6]

    rssi = int(argm[6:9])
    if rssi > 100:
        rssi = -rssi + 100
    result += ' rssi:' + str(rssi) + 'dBm'

    rssi = int(argm[9:12])
    if rssi > 100:
        rssi = -rssi + 100
    result += ' wifiRssi:' + str(rssi) + 'dBm'
    result += ' wifiStatus:' + argm[12:15]
    result += ' sawid:' + argm[15:25]
    result += ' age:' + argm[25:35]

    return result

def poseseDVRstr(argm):
    result = '(' + argm[0:2] + ')'
    result += ' sw:' + str(int(argm[2:5])) + '.' + str(int(argm[5:8])) + '.' + str(int(argm[8:11]))
    if argm[12:18].isnumeric():
        result += ' hw:' + str(int(argm[12:15])) + '('+ f'0x{int(argm[12:15]):X}' +').' + str(int(argm[15:18]))
    else:
        result += ' hw:' + argm[12:15] + '.' + argm[15:18]
    result += ' audio:' + str(int(argm[18:21])) + '.' + str(int(argm[21:26]))
    
    langStr = { '000':' en_GB', '001':' sv_SE', '011':' es_ES' , '999':''}
    s = argm[26:29]
    if s in langStr: result += langStr[s]
    else: result += ' Lang:' + s

    varStr = { '0':' debug/alpha/ds', '1':' release/production/ps', '2':' release_unsigned/beta' }
    s = argm[11]
    if s in varStr: result += varStr[s]
    else: result += ' VAR:' + s

    return result

def poseseDDSstr(argm):
    result = '(' + argm[0:2] + ')'

    varStr = { '0':' Unknown status', '1':' Unlocked', '2':' Locked' , '3':' Blocked', '4':' Busy', '5':' Invalid connection', '6':' Error Battery'}
    s = argm[2]
    if s in varStr: result += varStr[s]
    else: result += ' STATUS:' + s

    rssi = int(argm[2:5])
    if rssi > 100:
        rssi = -rssi + 100
    result += ' Rssi:' + str(rssi) + 'dBm '

    result += argm[5:]
    return result

def poseseINIstr(argm):
    result = 'Band: '
    varStr = { '0':'Not attached', '1':'2G', '2':'3G' , '3':'4G'}
    s = argm[2:3]
    if s in varStr: result += varStr[s]
    else: result += s

    result += ' Cov(rssi):' + argm[0:2]

    result += ' Operator: ' + argm[3:]
    return result

def poseseMPJstr(argm):
    result = 'Reason:'

    varStr = { '000':' Invalid CRC', '001':' Unknown order', '002':' Wrong Inst ID', '003':' Panel in PTS',
        '004':' Worng Command code', '005':' Wrong parameters', '006':' Not available data',
        '007':' No supported', '008':' User not found', '009':' Panel in ITS', '010':' Panel in UTS',
        '011':' Alarm is Armed', '012':' Invalid Rule', '013':'Request Timeout',
        '100':' Invalid User Privilege', '101':' Invalid Arm Mode', '102':' Force Arming Required' ,
        '105':' Alarm is Disarmed', '106':' Alarm is Armed', '107':' No Forced Arming conditions',
        '200':' Device Not Configured', '201':'Device not found (no RF)', '202':'Device not answering',
        '203':' Invalid Provilege', '500':' Internal Error'}
    s = argm[0:3]
    if s in varStr: result += varStr[s]
    else: result += s

    result += ', Number of Device Exceptions:'
    result += argm[3:]
    return result

def poseseArgStr(code, args):
    poseseFx = 'posese' + code + 'str'
    if poseseFx in globals():
        return globals()[poseseFx](args)
    else:
        return args
