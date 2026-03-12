###     checkPOSES.sh
###
### Notes:
###         To Execute the script in terminal and at the same time save the results in a txt: ./checkPOSES.sh | tee file.txt &
###

#!/usr/bin/env sh

generate_empty_line()
{
    while true; do
        echo
        sleep 1
    done
}

analise_posesa()
{
#Create substrings to see the parts of a POSESA message
    local msg=$1
    local comman_protocol=$2
    local comman_SUID=$3
    local is_comm=$4
    ###########
    local posesa=""
    local crc=""
    local protocol_type=""

    #New protocol
    if [[ $comman_protocol = 2 ]]; then
        posesa=${msg:0:52}
        crc=$(echo $msg | cut -d'!' -f2 )
        protocol_type=${posesa:51:1}
    #Old protocol
    elif [[ $comman_protocol = 1 ]]; then
        posesa="${msg:0:38}${comman_SUID}${msg:38:1}"
        protocol_type=${msg:38:1}
        crc=$(echo $msg | cut -d'!' -f2 )
        crc=${crc:0:4}
    fi

    local head=${posesa:0:4}
    local hex_pos_length=${posesa:4:3}
    local dec_pos_length=$((0x${hex_pos_length}))
    #Check message content
    if [[ $is_comm = yes ]]; then
        echo -e "COMMAND SIGNAL: \t$msg"
    elif [[ $is_comm = no ]]; then
        echo -e "\tMESSAGE: \t$msg"
    fi
    echo -e "\tLENGTH: \t${#msg}"
    echo -e "\n"
    echo -e "\e[4mPOSESA:\e[0m \t$posesa"
    echo -e "\tHEAD: \t\t\t$head"
    echo -e "\tLENGTH: \t\thex=$hex_pos_length --> dec=$dec_pos_length"
    echo -e "\tMF-MODEL-VERSION: \t${posesa:7:2}-${posesa:9:2}-${posesa:11:2} \t\t[hardcoded]"
    echo -e "\tCOUNTER: \t\t${posesa:13:3}"
    echo -e "\tACK: \t\t\t${posesa:16:1}"
    echo -e "\tINST_NUMBER: \t\t${posesa:17:8}"
    echo -e "\tDATE_TIME: \t\t${posesa:25:13}"
    echo -e "\tSUID: \t\t\t$comman_SUID"
    if [[ $is_comm = no ]]; then
        echo -e "\tGSM_BAND: \t\t${posesa:50:1}"
    fi
    echo -e "\tTYPE_PROTOCOL: \t\t$protocol_type"
    echo -e "\tCRC: \t\t\t$crc"
    is_command=""

}

analise_posese()
{
    local msg1=$1
    ######
    local type_msg=""
    local posese_description=""

    posese=${msg1:52}
    posese=$(echo $posese | cut -d'!' -f1 )
    event_code=${posese:30:3}
    event_args=${posese:33}
    #Check message content
    echo -e "\n"
    echo -e "\e[4mPOSESE:\e[0m \t$posese"
    echo -e "\tIDENTIFICATION: \t${posese:0:7}"
    echo -e "\tARM_TYPE: \t\t${posese:9:1}"
    echo -e "\tARM_FORCED: \t\t${posese:10:1} \t\t[N=Panel_is_not_forced_armed Y=Forced]"
    echo -e "\tRESERVED: \t\t${posese:11:6} \t\t[old TIME_STATUS]"
    echo -e "\tPANEL_ZONE_STATUS: \t${posese:17:1} \t\t[hardcoded]"
    echo -e "\tPANEL_PENDING_CANCEL: \t${posese:18:1} \t\t[hardcoded]"
    echo -e "\tPANEL_IN_FAULT: \t${posese:19:1} \t\t[hardcoded]"
    echo -e "\tEVENT_TYPE: \t\t${posese:20:1} \t\t[A=alert C=comfort S=security I=informative T=technical]"
    echo -e "\tDEVICE_ID: \t\t${posese:21:2}"
    echo -e "\tRESERVED: \t\t${posese:23:6} \t\t[hardcoded DEVICE MANUFACTURER]"
    echo -e "\tEVENT_STATUS: \t\t${posese:29:1} \t\t[A=activated; D=restored; O=opened; C=closed; X=n/a; N=n/a]"
    echo -e "\tEVENT_CODE: \t\t$event_code"
    echo -e "\tEVENT_ARGS: \t\t$event_args\n\n"

    if [ "$event_args" != " " ]; then
        echo -e "\tEVENT_ARGS IN DETAIL:"
    if [[ $event_code = MTS ]]; then
        type_msg="Devices technical information"
        dev_type="\t\t\tDEVICE_TYPE: \t\t${event_args:0:3}\n"
        dev_id="\t\t\tINTERFACE/DEVICE ID: \t${event_args:3:2} \t\t[00=CP 01-99=Device ID]\n"
        super_status="\t\t\tSUPERVISION STATUS: \t${event_args:5:1} \t\t[0=NA 1=OK 2=fault]\n"
        battery_status="\t\t\tBATTERY STATUS: \t${event_args:6:1} \t\t[0=NA 1=OK 2=fault low battery 4=fault(discnonnected or damage)]\n"
        tamper_status="\t\t\tTAMPER STATUS: \t\t${event_args:7:1} \t\t[0=NA 1=OK 2=fault]\n"
        ac_status="\t\t\tAC STATUS: \t\t${event_args:8:1} \t\t[0=NA 1=OK 2=fault]\n"
        rssi="\t\t\tRSSI RADIO LEVEL(dbm): \t${event_args:9:3} \t\t[101=-1dbm 255=-155dbm]\n"
        battery_level="\t\t\tBATTERY LEVEL(mV): \t${event_args:12:4}\n"
        temp="\t\t\tTEMPERATURE: \t\t${event_args:16:3} \t\t[200=NA 1st digit(1 negative 0 positive)]\n"
        lqi="\t\t\tLQI: \t${event_args:19:3}\n"
        posese_description="$dev_type $dev_id $super_status $battery_status $tamper_status $ac_status $rssi $battery_level $temp $lqi"
    elif [[ $event_code = ISC ]]; then
        type_msg="Communication status panel"
        posese_description="\t\t\tSTATUS: \t${event_args} \t\t[1=NTS 2=ITS 3=CCS 4=PTS 5=UTS]\n"
    elif [[ $event_code = INI ]]; then
        type_msg="Network connectivity information"
        gsm_coverage="\t\t\tGSM_COVERAGE: \t\t${event_args:0:2} \t\t[0-31 (31 strongest strenght) 32-99=N/A]\n"
        network="\t\t\tNETWORK: \t\t${event_args:2:1} \t\t[0=Not attached 1=2G 2=3G 3=4G 4-9=Future Use]\n"
        net_operator_code="\t\t\tNETWORK OPERATOR CODE: \t${event_args:3:5}\n"
        posese_description="$gsm_coverage $network $net_operator_code"
    elif [[ $event_code = MNI ]]; then
        type_msg="Mobile Network coverage Information"
        operator_code="\t\t\tOPERATOR CODE: \t${event_args:0:5} \t\t[Network Operator Code]\n"
        current_band="\t\t\tCURRENT BAND: \t${event_args:5:1} \t\t[0=Not attached 1=2G 2=3G 3=4G 4-9=Future use]\n"
        coverage_2G="\t\t\tCOVERAGE 2G: \t${event_args:6:2} \t\t[GSM coverage (RSSI) 0-31(31-strongest strength) 32-99=N/A]\n"
        coverage_3G="\t\t\tCOVERAGE 3G: \t${event_args:8:2} \t\t[GSM coverage (RSSI) 0-31(31-strongest strength) 32-99=N/A]\n"
        coverage_4G="\t\t\tCOVERAGE 4G: \t${event_args:10:2} \t\t[GSM coverage (RSSI) 0-31(31-strongest strength) 32-99=N/A]\n"
        request_id="\t\t\REQUEST ID: \t${event_args:12:10} \t\t[Request ID for matching with  Asynchronous Request]\n"
        placeholder="\t\t\tPLACEHOLDER: \t${event_args:12:32} \t\t[Reserved for future used]\n"
        posese_description="$operator_code $current_band $coverage_2G $coverage_3G $coverage_4G $request_id $placeholder"
    elif [[ $event_code = MPJ ]]; then
        type_msg="Poseso rejected order"
        reason="\t\t\tREASON: \t${event_args:0:3} \t\t[000=Invalid CRC 001=Unknown order 002=Wrong installation id 003=Panel in PTS 004=Wrong command code (More codes in docs)]\n"
        dev_excep="\t\t\tNUMBER OF DEVICE EXCEPTIONS: \t${event_args:3}\n"
        posese_description="$reason $dev_excep"
    elif [[ $event_code = ICM ]]; then
        type_msg="Communication module information"
        module_man="\t\t\tMODULE_MANUFACTURER: \t${event_args:0:2} \t\t[01=Samsung 02=Motorola/Telit(2G-G24L) 03-06=Telit(3G) 50=Gemalto 4G 51-99=Future use]\n"
        model_ver="\t\t\tMODEL & VERSION: \t${event_args:2:5}\n"
        imei="\t\t\tIMEI CODE: \t\t${event_args:7:15}\n"
        sim_code="\t\t\tSIM ICC CODE: \t\t${event_args:22:20}\n"
        net_operator_code="\t\t\tNETWORK OPERATOR CODE: \t${event_args:42:5}\n"
        rssi="\t\t\tRSSI: \t\t\t${event_args:47:2} \t\t[0-31 (31 strongest strenght) 32-99=N/A]\n"
        ber="\t\t\tBER: \t\t\t${event_args:49:2} \t\t[0-7 (0-no BER) 8-98=N/A 99=Unknown]\n"
        posese_description="$module_man $model_ver $imei $sim_code $net_operator_code $rssi $ber"
    elif [[ $event_code = MRA ]]; then
        type_msg="Remote Arm"
        arm_mode="\t\t\tARM_MODE: \t${event_args:0:2}\n"
        user="\t\t\tUSER: \t${event_args:2:2} \t\t[00=SD CRA/ATC 01-99=User ID]\n"
        posese_description="$arm_mode $user"
    elif [[ $event_code = MRD ]] || [[ $event_code = MAD ]] || [[ $event_code = MEC ]]; then
        type_msg="MRD (Remote Disarm) MAD (Automatic Disarmed) MEC (Automatic Disarm - Exit condition)"
        posese_description="\t\t\tALARM PARTITION: \t${event_args:0:2} \t\t[01=Main Area 02=2nd Area(Perimeter) 03=Main+Perimeter 04=Annex 05=Main+Annex 06=Perimeter+Annex 07=Main+Perimeter+Annex]\n"
        if [[ $event_code = MRD ]]; then
            user="\t\t\tUSER: \t${event_args:2:2} \t\t[00=SD CRA/ATC 01-99=User ID]\n"
            posese_description="$posese_description $user"
        elif [[ $event_code = MEC ]]; then
          dev_type="\t\t\tDEVICE_TYPE: \t${event_args:2:3} \t[000=None 103=Mom smartshock]\n"
          dev_id="\t\t\tDEVICE ID: \t${event_args:5:2}\n"
          posese_description="$posese_description $dev_type $dev_id"
        fi
    elif [[ $event_code = MAC ]]; then
        type_msg="AC Fault by device"
        dev_number="\t\t\tDEVICE_NUMBER: \t${event_args:0:3} \t\t[000=Central Unit 001-999=Device ID]\n"
        time_status="\t\t\tTIME_STATUS(s): ${event_args:3:3}\n"
        posese_description="$dev_number $time_status"
    elif [[ $event_code = MLB ]] || [[ $event_code = MEB ]] || [[ $event_code = MDB ]]; then
        type_msg="MLB (Low Battery) MEB (Empty Battery) MDB (Battery Fault)"
        dev_number="\t\t\tDEVICE_NUMBER: \t${event_args:0:3} \t\t[000=Central Unit 001-999=Device ID]\n"
        if [[ $event_code = MLB ]] || [[ $event_code = MEB ]]; then
            battery_level="\t\t\tBATTERY LEVEL(mV): \t${event_args:3:7}\n"
            posese_description="$dev_number $battery_level"
        fi
    elif [[ $event_code = MSA ]]; then
        type_msg="Smartplug Activation Reason"
        dev_number="\t\t\tDEVICE_NUMBER: \t${event_args:0:3}\n"
        reason="\t\t\tACTIVATION_REASON: \t${event_args:3:2}\n"
        posese_description="$dev_number $reason"
    elif [[ $event_code = SRT ]] || [[ $event_code = TTS ]] || [[ $event_code = URT ]]; then
        type_msg="SRT (Alarm Detection) TTS (Tamper Fault) URT (Alarm Detection on UTS)"
        if [[ $event_code = SRT ]] || [[ $event_code = URT ]]; then
            posese_description="\t\t\tARMING_TYPE: \t${event_args:0:1} \t\t[I=Immediate E=Entry/exit]\n"
        elif [[ $event_code = TTS ]]; then
            posese_description="\t\t\tTAMPER_TYPE: \t\t${event_args:0:1} \t\t[0=one-tamper devices  SVK,SPB,Croptex & Orion: 1=Battery 2=Wall ZV: 1=Canister 2=Wall/Battery]\n"
        fi
        dev_number="\t\t\tINTERFACE/DEVICE NUMBER: ${event_args:1:3}\n"
        rssi="\t\t\tRSSI RADIO LEVEL: \t${event_args:4:3}\n"
        lqi="\t\t\tLQI: \t\t\t${event_args:7:3}\n"
        posese_description="$posese_description $dev_number $rssi $lqi"
    elif [[ $event_code = UDS ]] || [[ $event_code = TSS ]] || [[ $event_code = MS2 ]]; then
        type_msg="UDS (Duress Code) MS2 (Supervision 2h) TSS (Supervision 11h)"
        dev_number="\t\t\tINTERFACE/DEVICE NUMBER: \t${event_args:0:3}\n"
        rssi="\t\t\tRSSI RADIO LEVEL: \t${event_args:3:3}\n"
        lqi="\t\t\tLQI: \t${event_args:6:3}\n"
        posese_description="$dev_number $rssi $lqi"
    elif [[ $event_code = MVT ]] || [[ $event_code = MSR ]] || [[ $event_code = MCR ]] || [[ $event_code = MDE ]] || [[ $event_code = MRE ]]; then
        type_msg="MVT (Realease Info) MSR (Soft reset report) MCR (Climate data report) MDE (Exceptions)  MRE (Exceptions for remote)\n"
        dev_type="\t\t\tDEVICE_TYPE: \t${event_args:0:3} \t[100=Central Unit 101=Smart Shock Sensor 102=Indoor Pir 103=Croptex 104=ZeroVision 106=Orion (More options in docs)]\n"
        dev_id="\t\t\tINTERFACE/DEVICE ID: \t${event_args:3:2} \t[00=Central_Unit/Control_Panel 01-99=ID 1]\n"
        if [[ $event_code = MSR ]]; then
            reason="\t\t\tREASON: \t${event_args:5:3} \t[001=POSESO order 004-999=Future Use]\n"
            posese_description="$dev_type $dev_id $reason"
        elif [[ $event_code = MVT ]]; then
            maj_ver="\t\t\tMAJOR SW VERSION: \t${event_args:5:3}\n"
            min_ver="\t\t\tMINOR SW VERSION: \t${event_args:8:3}\n"
            patch_ver="\t\t\tPATCH SW VERSION: \t${event_args:11:3}\n"
            majo_hw_ver="\t\t\tMAJOR HW VERSION: \t${event_args:14:3}\n"
            posese_description="$dev_type $dev_id $maj_ver $min_ver $patch_ver $majo_hw_ver"
        elif [[ $event_code = MCR ]]; then
            date="\t\t\tDATE: \t\t${event_args:5:8} \t[Date + Day + Hour + Minute]\n"
            temp="\t\t\tTEMPERATURE: \t${event_args:13:4} \t[(in Celsius) Sign (0:+ ; 1:-) + GG + dG, 9999=NA]\n"
            humidity="\t\t\tHUMIDITY(%): \t\t${event_args:17:3} \t[999=N/A]\n"
            air_quality="\t\t\tAIR QUALITY: \t\t${event_args:20:3} \t[999=N/A]\n"
            posese_description="$dev_type $dev_id $date $temp $humidity $air_quality"
        elif [[ $event_code = MDE ]]; then
            status="\t\t\tSTATUS: \t${event_args:5:1} \t[0=Open Zone 1=Tamper 2=Low Battery 3=AC Fault 4=Supervision 5-9=Future use]\n"
            posese_description="$dev_type $dev_id $status"
        elif [[ $event_code = MRE ]]; then
            status="\t\t\tSTATUS: \t${event_args:5:1} \t[0=Open Zone 1=Tamper 2=Low Battery 3=AC Fault 4=Supervision 5=Holdup 6-9=Future use]\n"
            posese_description="$dev_type $dev_id $status"
        fi
    elif [[ $event_code = SID ]] || [[ $event_code = URF ]] || [[ $event_code = IFH ]] || [[ $event_code = TFG ]] || [[ $event_code = CST ]] || [[ $event_code = SGF ]] || [[ $event_code = MWP ]]; then
        type_msg="SID (Inactivity Time) URF ( Alarm detection - devices without restoration on UTS) IFH (Fog generation enable/disable\n
        \t\t TFG (Fog Trigger Key) CST (FG test results) SGF (Succesfully fog generated) MWP (Wrong pin-lockout)"
        dev_number="\t\t\tDEVICE_NUMBER: \t${event_args:0:3} \t[000=Global inactive 001-999=Device number]\n"
        if [[ $event_code = URF ]]; then
            type="\t\t\tTYPE: \t${event_args:3:2} \t[0=smartshock-gross 1=smartshock-rep 2=PIR detection]\n"
            arming_type="\t\t\tARMING_TYPE: \t${event_args:5:1} \t\t[I=Immediate E=Entry/exit]\n"
            rssi="\t\t\tRSSI RADIO LEVEL: \t${event_args:6:3}\n"
            lqi="\t\t\tLQI: \t${event_args:9:3}\n"
            posese_description="$dev_number $type $arming_type $rssi $lqi"
        elif [[ $event_code = SID ]]; then
            inact_time="\t\t\tINACTIVITY_TIME(min): \t${event_args:3:5} \t[00000= <1min 99999= >1min]\n"
            posese_description="$dev_number $inact_time"
        elif [[ $event_code = IFH ]] || [[ $event_code = SFG ]]; then
            if [[ $event_code = SFG ]]; then
                result="\t\t\tRESULTS: \t${event_args:3:3} \t[000=Success 001=Failure(timeout) 002=Failure(FG in disable state) 003=Key not valid 004=Failure(canister not fired)]\n"
            else
                result="\t\t\tRESULTS: \t${event_args:3:3} \t[000=Success 001=Failure 002=Panel in ITS]\n"
            fi
            rssi="\t\t\tRSSI RADIO LEVEL: \t${event_args:6:3}\n"
            lqi="\t\t\tLQI: \t${event_args:9:3}\n"
            posese_description="$dev_number $result $rssi $lqi"
        elif [[ $event_code = TFG ]]; then
            trigger_key="\t\t\tTRIGGER KEY: \t${event_args:3:8}\n"
            rssi="\t\t\tRSSI RADIO LEVEL: \t${event_args:11:3}\n"
            lqi="\t\t\tLQI: \t${event_args:14:3}\n"
            posese_description="$dev_number $trigger_key $rssi $lqi"
        elif [[ $event_code = CST ]]; then
            result="\t\t\tRESULTS: \t${event_args:3:4} \t[000=Success (ZV,NOX) 001-FFF=Failure(More details in docs)]\n"
            rssi="\t\t\tRSSI RADIO LEVEL: \t${event_args:7:3}\n"
            lqi= "\t\t\tLQI: \t${event_args:10:3}\n"
            posese_description="$dev_number $result $rssi $lqi"
        fi
    elif [[ $event_code = MCU ]]; then
        type_msg="System arm and disarm actions"
        arm_mode="\t\t\tARM_MODE: \t${event_args:0:2}\n"
        interf_type="\t\t\tINTERFACE_TYPE: ${event_args:2:1} \t[0=Verisure portal 1=SmartDot 2=Keyfob 3=SVK siren voice 4=CU 5=MOK 6-9=Future use]\n"
        dev_id="\t\t\tDEVICE_ID: \t${event_args:3:2}\n"
        user_id="\t\t\tUSER ID: \t${event_args:5:3} \t[01-99=Number of user id 100=Master code 101=Guard code 102=Fast arming enabled 103=Alarm logic(CU)]\n"
        user_dev="\t\t\tUSER DEVICE: \t${event_args:8:2} \t[00=Unknown 01=Remote 02=Pin code 03=Tag 04=Button 05=HFE 06=CU]\n"
        posese_description="$arm_mode $interf_type $dev_id $user_id $user_dev"
    elif [[ $event_code = MCA ]]; then
        type_msg="Alarm cancellation"
        type_alarm="\t\t\tTYPE_OF_ALARM: \t${event_args:0:1} \t[1=Intrusion Alarm 2=Fire Alarm 3=Water Alarm 4=Tamper Alarm]\n"
        interf_type="\t\t\tINTERFACE_TYPE: ${event_args:1:1} \t[0=Verisure portal 1=SmartDot 2=Keyfob 3=SVK siren voice 4=Remote Request 5-9=Future use]\n"
        dev_id="\t\t\tDEVICE_ID: \t${event_args:2:2} \t[00=CU 01-99=Device number]\n"
        user_id="\t\t\tUSER ID: \t${event_args:4:3} \t[01-99=Customer ID 100=Master code 101=Guard code 103=Alarm Logic]\n"
        user_dev="\t\t\tUSER DEVICE: \t${event_args:7:2} \t[00=Unknown 01=Remote 02=Pin code 03=Tag 04=Button 05=HFE 06=CU]\n"
        posese_description="$type_alarm $interf_type $dev_id $user_id $user_dev"
    elif [[ $event_code = MGC ]]; then
        type_msg="Guard code"
        pin="\t\t\tPIN: \t${event_args:0:6} \t[Pin could be 4 or 6 digits. If configured to 4, it will be left-padded with 'NN']\n"
        sawid="\t\t\tSAW ID: \t${event_args:6:10} [0000000000=Normal Status]\n"
        placeholder="\t\t\tPLACEHOLDER: \t${event_args:16:32} \t\t[Reserved for future used]\n"
        posese_description="$pin $sawid $placeholder"
    elif [[ $event_code = MJS ]]; then
        type_msg="Jamming fault detected"
        posese_description="\t\t\tJAMMING TYPE: \t${event_args:0:1} \t[1=Radio 2=GSM]\n"
    elif [[ $event_code = MTC ]]; then
        type_msg="Installation Tags- tag reader"
        length="\t\t\tLENGTH: \t${event_args:0:2}\n"
        tag_code="\t\t\tTAGCODE: \t${event_args:2:32}\n"
        posese_description="$length $tag_code"
    elif [[ $event_code = MV2 ]]; then
        type_msg="Installation Tags- verification tag configured"
        tag_id="\t\t\tTAG ID: \t${event_args:0:2}\n"
        user_id="\t\t\tUSER ID: \t${event_args:2:2} \t[00=Any user is asigned]\n"
        active="\t\t\tACTIVE: \t${event_args:4:1} \t[1=True]\n"
        posese_description="$tag_id $user_id $active"
    elif [[ $event_code = MBD ]]; then
        type_msg="Bypass/Unbypass"
    elif [[ $event_code = MPR ]] || [[ $event_code = MRF ]]; then
        type_msg="MPR (Poseso received) MRF (Alarm detection-devices without restoration)"
        if [[ $event_code = MRF ]]; then
            dev_number="\t\t\tDEVICE NUMBER: \t${event_args:0:3}\n"
            type="\t\t\tTYPE: \t\t\t${event_args:3:1} \t[0=smartchock-gross 1=smartchock-repetitive 2=PIR detection]\n"
            arming_type="\t\t\tARMING_TYPE: \t\t${event_args:4:1} \t\t[I=Immediate E=Entry/exit]\n"
            rssi="\t\t\tRSSI RADIO LEVEL: \t${event_args:5:3}\n"
            lqi="\t\t\tLQI: \t\t\t${event_args:8:3}\n"
            posese_description="$dev_number $type $arming_type $rssi $lqi"
        fi
    elif [[ $event_code = MPS ]]; then
        type_msg="Panic/SOS"
        dev_number="\t\t\tINTERFACE/DEVICE NUMBER: ${event_args:0:3}\n"
        panic_type="\t\t\tPANIC TYPE: \t\t${event_args:3:1} \t[0=Silent Normal(Press) 1=Silent remot 2=Voice]\n"
        rssi="\t\t\tRSSI RADIO LEVEL: \t${event_args:4:3}\n"
        lqi="\t\t\tLQI: \t\t\t${event_args:7:3}\n"
        user_id="\t\t\tUSER ID: \t\t${event_args:10:2}\n"
        posese_description="$dev_number $panic_type $rssi $lqi $user_id"
    elif [[ $event_code = IWA ]]; then
        type_msg="Window voice activation"
        gsm_coverage="\t\t\tGSM COVERAGE(RSSI): \t${event_args:0:2} [0-31=GSM level 32-99=N/A]\n"
        gsm_band="\t\t\t\tGSM BAND: \t${event_args:2:1} [0=not attached 1=2G 2=3G 3=4G 4-9=Future use]\n"
        net_operator_code="\t\tNETWORK OPERATOR CODE: \t${event_args:3:5}\n"
        posese_description="$gsm_coverage $gsm_band $net_operator_code"
    elif [[ $event_code = ISD ]]; then
        type_msg="CU informs of the sirens remote disconnection"
        posese_description="\t\t\tPROCEDENCE: \t${event_args:0:1} [1=POSESO]\n"
    elif [[ $event_code = MSS ]]; then
        type_msg="System fault status"
        open_device="\t\t\tOPEN DEVICE: \t${event_args:0:1} [0=NO 1=YES]\n"
        tamper_device="\t\t\tTAMPER DEVICE: \t${event_args:1:1} [0=NO 1=YES]\n"
        supervision_dev="\t\t\tSUPERVISION DEVICE: \t${event_args:2:1} [0=NO 1=YES]\n"
        fault_battery_dev="\t\tFAULT BATTERY DEVICE: \t${event_args:3:1} [0=NO 1=YES]\n"
        empty_battery_dev="\t\tEMPTY BATTERY DEVICE: \t${event_args:4:1} [0=NO 1=YES]\n"
        low_battery_dev="\t\tLOW BATTERY DEVICE: \t${event_args:5:1} [0=NO 1=YES]\n"
        ac_dev="\t\t\tAC DEVICE: \t${event_args:6:1} [0=NO 1=YES]\n"
        posese_description="$open_device $tamper_device $supervision_dev $fault_battery_dev $empty_battery_dev $low_battery_dev $ac_dev"
    elif [[ $event_code = VSS ]]; then
        type_msg="Video Streaming Status"
        dev_id="\t\t\tDEVICE ID: \t${event_args:0:2} [00=CU 01-99=other]\n"
        event_id="\t\t\tEVENT ID: \t${event_args:2:32} [In UUID format]\n"
        status="\t\t\tSTATUS: \t${event_args:34:2} [00=Idle/Inactive 01=Info avalaible 02=Ingo retrieval 03=Info present 04=Registered with SIP server 05=Registered failed 06=Invite sent 07=Connect error 08=Connected 11=Stopped by alarm]\n"
        error_code="\t\t\tERROR CODE: \t${event_args:36:2} [00=Success]\n"
        user_id="\t\t\tUSER ID: \t${event_args:38:2} [00=SS CRA/ATC 01-99=UserID ( HARDCODED to 99)]\n"
        audio_enabled="\t\t\tAUDIO ENABLED: \t${event_args:40:1} [0=Audio disabled 1=Audio enabled]\n"
        record_enabled="\t\t\tRECORD ENABLED: \t${event_args:41:1} [0=Recording streaming disabled 1=Recording streaming enabled]\n"
        placeh="\t\t\tFUTURE USE: \t${event_args:42:16} [Reserved for further use]\n"
        posese_description="$dev_id $event_id $status $error_code $user_id $audio_enabled $record_enabled $placeh"
    elif [[ $event_code = DCS ]] || [[ $event_code = DBR ]] || [[ $event_code = DRC ]]; then
        type_msg="DCS (Device Claim Status) DBR (Boot Reason) DRC (Device Renew Certificate Status)"
        dev_id="\t\t\tDEVICE ID: \t${event_args:0:2} [00=CU 01-99=other]\n"
        if [[ $event_code = DCS ]]; then
          state="\t\t\tCLAIM STATUS: \t${event_args:2:1} [0=Unclaimed 1=Ready to be claimed 2=Claimed 3=Claimed timeout 4-9=Reserved]\n"
        elif [[ $event_code = DRC ]]; then
          state="\t\t\tSTATE: \t${event_args:2:2} [00=Success 01=Generic error]\n"
        else
          state="\t\tREASON: \t${event_args:2:3} [000=Unknown boot reason 001=FOTA 002=SW Fatal error (Unctrl) 003=SW System error (ctrl) 004=RR 005=FR 006=HW-Power on 007: Watchdog reset 008: Brown out 009: Lockup 010: Node Fault Exception reset 011: Clock lost 012: Node software reset 013: pressed  buttom]\n"
        fi
        posese_description="$dev_id $state"
    elif [[ $event_code = DVR ]]; then
        type_msg="Versions Report"
        dev_id="\t\t\tDEVICE ID: \t${event_args:0:2} [00=CU 01-99=other]\n"
        sw_major="\t\t\tMAJOR SW VERSION: \t${event_args:2:3}\n"
        sw_minor="\t\t\tMINOR SW VERSION: \t${event_args:5:3}\n"
        sw_patch="\t\t\tPATCH SW VERSION: \t${event_args:8:3}\n"
        sw_variant="\t\t\tSOFTWARE VARIANT \t${event_args:11:1} [0=debug/alpha/ds 1=release/production/ps 2=release_unsigned/beta]\n"
        hw_major="\t\t\tMAJOR HW VERSION: \t${event_args:12:3}\n"
        hw_minor="\t\t\tMINOR HW VERSION: \t${event_args:15:3}\n"
        audio_major="\t\t\tMAJOR AUDIO PACKAGE: \t${event_args:18:3} [000-998=major audio version 999=N/A]\n"
        audio_minor="\t\t\tMINOR AUDIO PACKAGE: \t${event_args:21:5} [00000-99998=minor audio version 99999=N/A]\n"
        lang_id="\t\t\tLANGUAGE & VARIATIONS: \t${event_args:26:3} [000=English from UK 001=Swedish 011=Spanish from Spain 999=N/A]\n"
        placeh="\t\t\tFUTURE USE: \t${event_args:29:16} [Reserved for further use]\n"
        posese_description="$dev_id $sw_major $sw_minor $sw_patch $sw_variant $hw_major $hw_minor $audio_major $audio_minor $lang_id $placeh"
    elif [[ $event_code = MZC ]]; then
        type_msg="Zerovision status"
        dev_number="\t\tDEVICE NUMBER: \t${event_args:0:3}\n"
        status="\t\t\tSTATUS: \t${event_args:3:1} [1=OOS(Out of Service) 2=BM(Boot Maintenance) 3=IS(In Service)]\n"
        posese_description="$dev_number $status"
    elif [[ $event_code = DZC ]]; then
        type_msg="Zerovision status"
        device_id="\t\tDEVICE ID: \t${event_args:0:3}\n"
        status="\t\t\tSTATUS: \t${event_args:3:1} [1=OOS(Out of Service) 2=BM(Boot Maintenance) 3=IS(In Service)]\n"
        rssi_radio_level="\t\t\tRSSI RADIO LEVEL: \t${event_args:4:3} [RSSI value]\n"
        reserved="\t\t\tRESERVED: \t${event_args:7:25} [Reserved for future use]\n"
        posese_description="$device_id $status $rssi_radio_level $reserved"
    elif [[ $event_code = MWB ]] || [[ $event_code = MDV ]] || [[ $event_code = UDV ]]; then
        type_msg="MWB (Wrong Battery position) MDV (Device Violation) UDV (Device Violation on user test)"
        dev_number="\t\tDEVICE NUMBER: \t${event_args:0:3}\n"
        posese_description="$dev_number"
        if [[ $event_code = MDV ]] || [[ $event_code = UDV ]]; then
          type="\t\t\tTYPE: \t${event_args:3:2} [00=Mg intrusion(open/close) 01=smartchock-gross 02=smartchock-rep 03=PIR detection 04=smoke 05=water]\n"
          arming_type="\t\tARMING_TYPE: \t${event_args:5:1} \t\t[I=Immediate E=Entry/exit H=24h]\n"
          rssi="\t\tRSSI RADIO LEVEL: \t${event_args:6:3}\n"
          lqi="\t\t\tLQI: \t\t\t${event_args:9:3} [HARDCODED]\n"
          saw_id="\t\tID ABNORMAL SITUATION: \t${event_args:12:10} [(YYMMDDHHmm) All zeros on normal situation]\n"
          age="\t\t\tAGE ID: \t${event_args:22:10}\n"
          reserved="\t\tFUTURE USE: \t${event_args:32:16} [HARDCODED]\n"
          posese_description="$dev_number $type $arming_type $rssi $lqi $saw_id $age $reserved"
        fi
    elif [[ $event_code = MMS ]]; then
        type_msg="Media Status"
        dev_id="\t\t\tDEVICE ID: \t${event_args:0:2} [00=CU 01-99=other]\n"
        status="\t\t\tSTATUS: \t${event_args:2:2} [00=REQ_OK 01=Avalaible 02-09=reserved to success status 10=DEV_ERROR 11-99=reserved for Errors]\n"
        gid="\t\t\tGROUP ID: \t${event_args:4:10}\n"
        idx="\t\tINDEX OF MEDIA IN SET: \t${event_args:14:2}\n"
        request="\t\tID ON MEDIA REQUEST: \t${event_args:16:10}\n"
        saw_id="\t\tID ABNORMAL SITUATION: \t${event_args:26:10} [(YYMMDDHHmm) All zeros on normal situation]\n"
        age="\t\t\tAGE ID: \t${event_args:36:10}\n"
        top="\t\tTOP (N_PICTURES): \t${event_args:46:2}\n"
        dhp="\t\tDARKNESS CONDITIONS: \t${event_args:48:1} [0=FALSE 1=TRUE]\n"
        reserved="\t\tFUTURE USE: \t${event_args:49:13} [HARDCODED]\n"
        posese_description="$dev_id $status $gid $idx $request $saw_id $age $top $dhp $reserved"
    elif [[ $event_code = DIS ]]; then
        type_msg="Installation Stages"
        dev_id="\t\t\tDEVICE ID: \t${event_args:0:2} [00=CU 01-99=other]\n"
        inst_stage="\t\tINSTALLATION STAGES: \t${event_args:2:3} [000=Provisioning 100=Securing comms 200=Finishing provision 300=Conf in-House Net 400=Securing node network comms 999=Device ready]\n"
        code="\t\t\tCODE: \t${event_args:5:3} [200=OK/Done/Success 400=Generic error]\n"
        posese_description="$dev_id $inst_stage $code"
    elif [[ $event_code = MAF ]]; then
        type_msg="Force Remote Arm"
        arm_mode="\t\tARM_MODE: \t${event_args:0:2}\n"
        user="\t\tUSER: \t${event_args:2:2} [00=SD CRA/ATC 01-99=User ID]\n"
        device_excep="\t\tNUMBER OF DEVICE EXCEPTIONS: \t${event_args:4:3}\n"
        posese_description="$arm_mode $user $device_excep"
    elif [[ $event_code = DSB ]]; then
        type_msg="Smoke Button Pressed For Silencing Alarm"
        dev_id="\t\t\tDEVICE ID: \t${event_args:0:2} [00=CU 01-99=other]\n"
        posese_description="$dev_id"
    elif [[ $event_code = DSF ]]; then
        type_msg="External Incident Response"
        dev_id="\t\t\tDEVICE ID: \t${event_args:0:2} [00=CU 01-99=other]\n"
        fault_type="\t\t\tFAULT TYPE: \t${event_args:2:2} [00=Unknown 01=End of life 02=Fault Smoke sensor 03=Smoke head supervision missing 04=Memory error 05=Dusty chamber]\n"
        posese_description="$dev_id $fault_type"
    elif [[ $event_code = MEI ]]; then
        type_msg="Device Faults Of Smoke"
        sawid="\t\t\tSAW ID: \t${event_args:0:10} [0000000000=Normal Status]\n"
        age="\t\t\tAGE ID: \t${event_args:10:10}\n"
        reserved="\t\t\tRESERVED: \t${event_args:20:16}\n"
        posese_description="$sawid $age $reserved"
    elif [[ $event_code = DWS ]]; then
        type_msg="Device WIFI Status"
        dev_id="\t\t\tDEVICE ID: \t${event_args:0:2} [00=CU 01-99=other]\n"
        current="\t\t\tCURRENT: \t${event_args:2:2} [Current message]\n"
        total="\t\t\tTOTAL: \t\t${event_args:4:2} [Total message]\n"
        rf_rssi="\t\t\tRF RSSI: \t${event_args:6:3} [000=CU Signal Strength level (dBm)]\n"
        wifi_rssi="\t\t\tWIFI RSSI: \t${event_args:9:3} [RSSI WiFi signal strength level (dBm)]\n"
        wifi_status="\t\t\tWIFI STATUS: \t${event_args:12:3} [000=Disconnected 001=Associated 004=PhoneHomeSucceded 900=Authenticated 902=Connected]\n"
        last_conn="\t\t\tLAST CONN: \t${event_args:15:10}\n"
        reserved="\t\t\tRESERVED: \t${event_args:25:32} [Reserved for future use]\n"
        posese_description="$dev_id $current $total $rf_rssi $wifi_rssi $wifi_status $last_conn $reserved"
    elif [[ $event_code = MAR ]]; then
        type_msg="Ack for Asynchronous Request (Order Acknowledge Poseso received)"
        request_id="\t\t\tREQUEST ID: \t${event_args:0:10} [request ID for matching with  Asynchronous Request]\n"
        placeholder="\t\t\tPLACEHOLDER: \t${event_args:10:32} [Reserved for future used]\n"
        posese_description="$request_id $placeholder"
    elif [[ $event_code = DKS ]]; then
        type_msg="Ack for Asynchronous Request (Order Acknowledge Poseso received)"
        device_id="\t\t\tDEVICE ID: \t${event_args:0:2} [00=CU 01-99=other]\n"
        calibration_status="\t\t\tCALIBRATION STATUS: \t${event_args:2:2} [00=OK 01=Error-Timeout 02=Error-Busy 03-99=More errors] \n"
        rssi_radio_level="\t\t\tRSSI RADIO LEVEL: \t${event_args:4:3} [Signal Strength level] \n"
        request_id="\t\t\tREQUEST ID: \t${event_args:7:10} [request ID for matching with  Asynchronous Request]\n"
        placeholder="\t\t\tPLACEHOLDER: \t${event_args:17:32} [Reserved for future used]\n"
        posese_description="$device_id $calibration_status $rssi_radio_level $request_id $placeholder"
    elif [[ $event_code = MDF ]]; then
        type_msg="Response of Devices faults status"
        number_of_device_faults="\t\t\tNUMBER OF DEVICE FAULT: \t${event_args:0:3} \n"
        posese_description="$number_of_device_faults"
    elif [[ $event_code = MFL ]]; then
        type_msg="List of Devices faults"
        device_type="\t\t\tDEVICE_TYPE: \t${event_args:0:3} [Posesa identifier for Device type]\n"
        device_id="\t\t\tDEVICE ID: \t${event_args:3:2} [00=CU 01-99=other]\n"
        status="\t\t\tSTATUS: \t${event_args:5:1} [0=Node opened 1=Tamper 2=Supervision 3=Fault battery 4=Empty battery 5=Low battery 6=AC]\n"
        posese_description="$device_type $device_id $status"
    elif [[ $event_code = DDS ]]; then
        type_msg="Doorlock Device Status"
        device_id="\t\t\tDEVICE ID: \t${event_args:0:2}\t\t[00=CU 01-99=other]\n"
        lock_status="\t\t\tLOCK STATUS: \t${event_args:2:1}\t\t[0=Unknown 1=unlocked 2=locked 3=Error blocked 4=Error busy 5=Error invalid connection 6=Error battery]\n"
        rssi_radio_level="\t\t\tRSSI RADIO LEVEL: \t${event_args:3:3}\t\t[Signal Strength level]\n"
        request_id="\t\t\tREQUEST ID: \t${event_args:6:10}\t\t[request ID for matching with Asynchronous Request - All 0 if this event isn't by request]\n"
        reason="\t\t\tREASON: \t${event_args:16:2}\t\t[00 = Unknown 01 = Thumb 02 = Autolock (03..09) reserved 10 = Local button : Arm 11 = Local button : Disarm 12 = Local button: Lock 13 = Local button : Unlock (15..19) reserved 20 = Get state (DS) (21..29) reserved 30 = Command (DL) :  Unknown 31 = Command (DL) :  OSB_EXAMP -> PROTOM_TEST 32 = Command (DL):  OSB_WEBWS -> CCDD 33 = Command(DL):  OSB_PROUI -> PROTOM-UI 34 = Command(DL):  OSB_TESTS  35 = Command(DL):  OSB_AWARE -> IT TELEFONÍA 36 = Command(DL) :  BLUE -> M2M (37..39) reserved 40 = CU-Scheduler (41-99) reserved ]\n"
        user_id="\t\t\tUSER ID: \t\t${event_args:18:3}\t\t[000= SD ARC / BE Scheduler (1- 99)= Customer user id. 100 = master ( only code ) 101 = guard (only code) 103 =  Alarm Logic (CU) 104 = CU-Scheduler 999= NA (Autolock / Quick arming...)]\n"
        tag_id="\t\t\tTAG ID: \t${event_args:21:2}\t\t[00:NA 01-99:tag ID]\n"
        reason_device_type="\t\t\tREASON DEVICE TYPE:\t\t${event_args:23:3}\t\t[000: Command 999: NA 10 = Local button : Arm 11 = Local button : Disarm 12 = Local button: Lock 13 = Local button : Unlock]\n" 
        reason_device_id="\t\t\tREASON DEVICE ID:\t\t${event_args:26:2}\t\t[00=Central Unit/NA 01-99=other 10 = Local button: Arm 11 = Local button : Disarm 12 = Local button: Lock 13 = Local button : Unlock]\n"
        placeholder="\t\t\tPLACEHOLDER: \t${event_args:28:20}\t\t[Reserved for future use]\n"
        posese_description="$device_id $lock_status $rssi_radio_level $request_id $reason $user_id $tag_id $reason_device_type $reason_device_id $placeholder"
    elif [[ $event_code = DTS ]]; then
        type_msg="Tamper with incident ID"
	    tamper_number="\t\t\tTAMPER NUMBER: \t\t${event_args:0:1} [0=1 tamper devices 1=VV/B3/YP/QR/QP→Battery Tamper/ZV/NOX→Canister CU→Battery/Wall tamper 2=VV/B3/YP/QR/QP→wall Tamper/ZV/NOX→Wall/Battery CU→Push button 3-9=Reserved]\n"
	    device_number="\t\t\tDEVICE NUMBER: \t\t${event_args:1:3} [Device number 000=CU]\n"
	    RSSI="\t\t\tRSSI: \t\t\t${event_args:4:3} [Signal Strength level (dBm)]\n"
	    wifi_rssi="\t\t\tWIFI RSSI: \t\t${event_args:7:3} [Signal Strength level (dBm)]\n"
	    wifi_status="\t\t\tWIFI STATUS: \t\t${event_args:10:3} [000=Disconnected 001=Associated 004=PhoneHomeSucceded 900=Authenticated 902=Connected]\n"
	    sawid="\t\t\tSAW ID: \t\t${event_args:13:10} [0000000000=Normal Status 9999999999=unknown]\n"
	    age="\t\t\tAGE: \t\t\t${event_args:23:10} [Age id (ts)]\n"
	    reserved="\t\t\tRESERVED: \t\t${event_args:33:32} [Reserved for future use]\n"
        posese_description="$tamper_number $device_number $RSSI $wifi_rssi $wifi_status $sawid $age $reserved"
    elif [[ $event_code = MID ]]; then
        type_msg="Inclusion Device on Arm mode"
        partition="\t\t\tPARTITION: \t\t${event_args:0:2} [01=Main area 02=Second area 03=Main +Permeter 04=Annex 05=Main+Annex 06=Per+Annex07=Mai+Per+Annex 07-99 Reserved]\n"
        device_type="\t\t\tDEVICE_TYPE: \t\t${event_args:2:3} [Posesa identifier for Device type]\n"
        device_id="\t\t\tDEVICE ID: \t\t${event_args:5:2} [00=CU 01-99=other]\n"
        placeholders="\t\t\tPLACEHOLDERS: \t\t${event_args:7:32} [Reserved for future use]\n"
        posese_description="$partition $device_type $device_id $placeholders"
    elif [[ $event_code = FEO ]]; then
        type_msg="Fatal Error Object"
        code="\t\t\tCODE: \t\t${event_args:0:4} [0000=No comms with any node, 0001=Connectivity token reach 20 points, 0002=Unable to set time]\n"
        placeholder="\t\t\tPLACEHOLDER: \t\t${event_args:4:32} [Reserved for future use]\n"
        posese_description="$code $placeholder"
    elif   [[ $event_code = WSR ]]; then
        type_msg="Wifi Sensing Result (Guard Sense)"
        device_type="\t\t\tDEVICE_TYPE: \t\t${event_args:0:3} [Posesa identifier for Device type 106/107/140 (QR/QP/V7)]\n"
        device_id="\t\t\tDEVICE ID: \t\t${event_args:3:2} [00=CU 01-99=other]\n"
        request_id="\t\t\tREQUEST ID: \t\t${event_args:5:10} [request ID for matching with Asynchronous Request]\n"
        sensing_result="\t\t\tSENSING RESULT: \t\t${event_args:15:10} [1st byte= 0(no presence detected)/1(presence detected) 2-10th byte - reserved]\n"
        placeholder="\t\t\tPLACEHOLDER: \t\t${event_args:25:12} [Reserved for future use]\n"
        posese_description="$device_type $device_id $request_id $sensing_result $placeholder"
    elif   [[ $event_code = MHS ]]; then
        type_msg="Holdup Status"
        interface_type="\t\t\tINTERFACE_TYPE: \t${event_args:0:1}\t\t[0-3 Future use 4=Remote Request 5=Future use 6=User device (SVK,SPB..) 6-9 Future use]\n"
        device_id="\t\t\tDEVICE ID: \t\t${event_args:1:2}\t\t[00=CU 01-99=Device Number]\n"
        placeholder="\t\t\tPLACEHOLDER: \t${event_args:3:32}\t\t[Reserved for future use]\n"
        posese_description="$interface_type $device_id $placeholder"
    elif   [[ $event_code = MGM ]]; then
        type_msg="God Mode"
        status="\t\t\tSTATUS: \t\t${event_args:0:1}\t\t[0: close 1: open 2: error ]\n"
        port="\t\t\tEXTERNAL PORT: \t\t${event_args:1:5}\t\t[00=CU 01-99=other]\n"
        reason="\t\t\tREASON: \t\t${event_args:6:2}\t\t[00: open/close ok 01: connection drops 02: unable to connect 03: authentication fail 04: Service disabled 05: Config error 06: Service not available 07-99 reserved to future\n"
        placeholder="\t\t\tPLACEHOLDER: \t${event_args:8:32}\t\t[Reserved for future use]\n"
        posese_description="$status $port $reason $placeholder"
    elif   [[ $event_code = MOR ]]; then
        type_msg="Moonshot Occupation RF"
        placeholder="\t\t\tPLACEHOLDER: \t${event_args:0:32}\t\t[Reserved for future use]\n"
        posese_description="$placeholder"
    elif   [[ $event_code = MJD ]]; then
        type_msg="Moonshot Jamming Detection"
        placeholder="\t\t\tPLACEHOLDER: \t${event_args:0:32}\t\t[Reserved for future use]\n"
        posese_description="$placeholder"
    elif   [[ $event_code = KRU ]]; then
        type_msg="Key Reading UID"
        length="\t\t\tLENGTH: \t${event_args:0:2} \t\t[Tag Code Length]\n"
        tag_uid="\t\t\tTAGUID: \t${event_args:2:32}\n"
        device_id="\t\t\tDEVICE ID: \t${event_args:34:2}\t\t[Device Id of reader]\n"
        placeholder="\t\t\tPLACEHOLDER: \t${event_args:36:20}\t\t[Reserved for future use]\n"
        posese_description="$length $tag_uid $device_id $placeholder"
     elif   [[ $event_code = KIS ]]; then
        type_msg="Key Installation Stages (NGS)"
        device_id="\t\t\tDEVICE ID: \t${event_args:0:2}\t\t[00=CU 01-99=other]\n"
        tag_id="\t\t\tTAGID: \t${event_args:2:2}\t\t[00=NA 01-99=tagId]\n"
        inst_stage="\t\t\tINSTALLATION STAGES: \t${event_args:4:1}\t\t[0:AES from BE 1:AES register on reader 2: Key burned]\n"
        code="\t\t\tCODE: \t${event_args:5:3}\t\t[000: OK - Success - No error, 001: Timeout, 002: UID != AES, 003: Reader out of memory, 500: Internal error ]\n"
        placeholder="\t\t\tPLACEHOLDER: \t${event_args:8:32}\t\t[Reserved for future use]\n"
        posese_description="$device_id $tag_id $inst_stage $code $placeholder"
    elif   [[ $event_code = KSR ]]; then
        type_msg="Key Status Response"
        tag_id="\t\t\tTAGID: \t${event_args:0:2}\n"
        status="\t\t\tSTATUS: \t${event_args:2:1}\t\t[0: Missing AES 1: AES ok 2: Tag registered on at least a device 3: Tag burned ]\n"
        placeholder="\t\t\tPLACEHOLDER: \t${event_args:3:32}\t\t[Reserved for future use]\n"
        posese_description="$tag_id $status $placeholder"
    elif   [[ $event_code = DMS ]]; then
        type_msg="Device Magnetometer Status"
        device_id="\t\t\tDEVICE ID: \t${event_args:0:2}\t\t[00=CU 01-99=other]\n"
        magnetometer_status="\t\t\tMAGNETOMETER STATUS: \t${event_args:2:1}\t\t[0 = Unknown 1 = OK]\n"
        value="\t\t\tVALUE: \t${event_args:3:5}\t\t[micro Teslas (uT)]\n"
        placeholder="\t\t\tPLACEHOLDER: \t${event_args:8:27}\t\t[Reserved for future use]\n"
        posese_description="$device_id $magnetometer_status $value $placeholder"
    elif   [[ $event_code = DDM ]]; then
        type_msg="Device Detector Masking"
        device_number="\t\t\tDEVICE NUMBER: \t${event_args:0:3}\t\t[000 = Central (NA) 001 to 999 = device ID]\n"
        type="\t\t\tTYPE: \t${event_args:3:2}\t\t[00: Magnetic 01: Smartshock - gross. (NA) 02: Smartshock - repetitive  (NA) 03: PIR detection  (NA) 04: Smoke  (NA) 05: Water  (NA)]\n"
        rssi="\t\t\tRSSI RADIO LEVEL: \t${event_args:5:3}\n"
        saw_id="\t\t\tSITUATION AWARENESS ID: \t${event_args:8:10}\t\t[0000000000 on no-incident 9999999999 unknown] \n"
        age="\t\t\tAGE ID: \t${event_args:18:10} \n"
        placeholder="\t\t\tPLACEHOLDER: \t${event_args:28:32}\t\t[Reserved for future use]\n"
        posese_description=" $device_number $type $rssi $saw_id $age $placeholder" 
    elif   [[ $event_code = DBS ]]; then
        type_msg="Device Battery Status Report"
        device_number="\t\t\tDEVICE NUMBER: \t${event_args:0:3}\t\t[000 = Central Unit]\n"
        battery_type="\t\t\tBATTERY TYPE: \t${event_args:3:1}\t\t[0: Unknown 1: alkaline 2: lithium 3: rechargeable 3-9: reserved]\n"
        battery_level="\t\t\tBATTERY LEVEL: \t${event_args:4:6}\n"
        unit="\t\t\tPHYSICAL UNIT: \t${event_args:10:1}\t\t[0: mV 1: mAh 2-9: reserved ]\n"
        state_of_charge="\t\t\tCHARGE STATE: \t${event_args:11:2}\t\t[00: NA (range 1-100%)] \n"
        state_of_health="\t\t\tHEALTH STATE: \t${event_args:13:2}\t\t[00: NA (range 1-100%)] \n"
        days_to_empty="\t\t\tDAYS TO EMPTY: \t${event_args:15:5}\t\t[99999: NA]\n"
        placeholder="\t\t\tPLACEHOLDER: \t${event_args:20:32}\t\t[Reserved for future use]\n"
        posese_description=" $device_number $battery_type $battery_level $unit $state_of_charge $state_of_health $days_to_empty $placeholder"
    elif   [[ $event_code = DCB ]]; then
        type_msg="Device Critical Battery"
        device_number="\t\t\tDEVICE NUMBER: \t${event_args:0:3}\t\t[000 = Central Unit]\n"
        battery_type="\t\t\tBATTERY TYPE: \t${event_args:3:1}\t\t[0: Unknown 1: alkaline 2: lithium 3: rechargeable 3-9: reserved]\n"
        battery_level="\t\t\tBATTERY LEVEL: \t${event_args:4:6}\n"
        unit="\t\t\tPHYSICAL UNIT: \t${event_args:10:1}\t\t[0: mV 1: mAh 2-9: reserved ]\n"
        state_of_charge="\t\t\tCHARGE STATE: \t${event_args:11:2}\t\t[00: NA (range 1-100%)] \n"
        state_of_health="\t\t\tHEALTH STATE: \t${event_args:13:2}\t\t[00: NA (range 1-100%)] \n"
        days_to_empty="\t\t\tDAYS TO EMPTY: \t${event_args:15:5}\t\t[99999: NA]\n"
        placeholder="\t\t\tPLACEHOLDER: \t${event_args:20:32}\t\t[Reserved for future use]\n"
        posese_description=" $device_number $battery_type $battery_level $unit $state_of_charge $state_of_health $days_to_empty $placeholder"
    fi
    fi

    echo -e "\t\tShort description: " $type_msg
    echo -e $posese_description
    posese_description=""

}

analise_poseso()
{
    local msg=$1
    local comman_protocol=$2
    ##########
    local poseso=""

    local type_msg=""
    local poseso_description=""
    #New protocol
    if [[ $comman_protocol = 2 ]]; then
        poseso=${msg:52}
        poseso=$(echo $poseso | cut -d'!' -f1 )
    #Old protocol
    elif [[ $comman_protocol = 1 ]]; then
        poseso=$(echo $msg | cut -d'*' -f2 | cut -d'!' -f1)
        poseso=*$poseso
    fi

    comman_code=${poseso:5:2}
    arg=${poseso:7}
    echo -e "\e[4mPOSESO:\e[0m \t$poseso"
    echo -e "\tACCESS_CODE: \t\t${poseso:1:4}"
    echo -e "\tCOMMAND_CODE: \t\t$comman_code"
    echo -e "\tARGUMENTS: \t\t$arg"

    echo -e "\n"
if [ "$arg" != " " ]; then
    echo -e "\tARGUMENTS IN DETAIL:"
fi
    if [[ $comman_code = PD ]]; then
        type_msg="Pending Changes"
        change_type="\t\t\tCHANGE TYPE: \t${arg:0:2} \t[00=Configuration 01=FOTA 02=Photo 04=Rules]\n"
        action_type="\t\t\tACTION TYPE: \t${arg:2:2} \t[00=Delete/Cancel roadmap 01=Download 02=Publish/upload 03=Refresh]\n"
        change_id="\t\t\tCHANGE ID: \t${arg:4:24}\n "
        inst_num="\t\t\tINSTALLATION NUMBER: \t${arg:28:8}\n"
        poseso_description="$change_type $action_type $change_id $inst_num"
    elif [[ $comman_code = E1 ]]; then
        type_msg="Change status of transmissions"
        poseso_description="\t\t\tTYPE OF INFORMATION:\t${arg:0:1}\t[0=Report Status 2=Change to ITS 3=Change to CCS 4=Change to PTS 5=Change to UTS 6=Change to LOS Status]\n"
    elif [[ $comman_code = AR ]] || [[ $comman_code = DR ]] || [[ $comman_code = AF ]]; then
        if [[ $comman_code = AR ]] || [[ $comman_code = AF ]]; then
            type_msg="AR (Remote Arm) or AF (Force Arming remote)"
            poseso_description="\t\t\tARM MODE: \t${arg:0:2}\n"
        elif [[ $comman_code = DR ]]; then
            type_msg="Remote Disarm"
            poseso_description="\t\t\tALARM PARTITION: \t${arg:0:2} \t\t[01=Main Area 02=2nd Area(Perimeter) 03=Main+Perimeter 04=Annex 05=Main+Annex 06=Perimeter+Annex 07=Main+Perimeter+Annex]\n"
        fi
        user_id="\t\t\tUSER ID: \t${arg:2:2} \t[00=SD CRA/ATC]\n"
        SUID_pre=""
        if [[ $comman_code = AF ]]; then
            SUID_pre="\t\t\tSUID of previously AR/AF: \t${arg:4:12}\n"
        fi
        poseso_description="$poseso_description $user_id $SUID_pre"
    elif [[ $comman_code = TE ]] || [[ $comman_code = RR ]]; then
        #type_msg="TE (Consult Technical Status)"
        if [ $comman_code == "TE" ]; then
            type_msg="Consult Technical Status"
        else
            type_msg="Reset Panel or device"
        fi
        dev_type="\t\t\tDEVICE_TYPE: \t${arg:0:3} \t[100=Central Unit 101=Smart Shock Sensor 102=Indoor Pir 103=Outdoor Pir (More options in docs)]\n"
        int_id="\t\t\tINTERFACE/DEVICE ID: \t${arg:3:2} \t[00=CP/All 01-99=device ID]\n"
        poseso_description="$dev_type $int_id"
    elif [[ $comman_code = M3 ]]; then
        type_msg="Report communication module Information thought specific channel"
        poseso_description="\t\t\tCHANNEL: \t${arg:0:1} \t[0=Eth 1=GPRS 2=SMS 3=Wifi]\n"
    elif [[ $comman_code = TP ]]; then
        type_msg="Send Technician PIN"
        pin= "\t\t\tPIN: \t${arg:0:6}\n"
        duration="\t\t\tDURATION(s): \t${arg:6:5} \t[4h=14400s]\n"
        poseso_description="$pin $duration"
    elif [[ $comman_code = M0 ]]; then
        type_msg="Request the CU to send stored files"
        media_type="\t\t\tMEDIA TYPE: \t${arg:0:1} \t[0=NA/Default 1=Photo 2=Video 3=Audio 4=Auditlog 5=Filesystem 6-9= Future use]\n"
        request_type="\t\t\tREQUEST TYPE: \t${arg:1:1} \t[0=Security 1=Comfort 2-9=Future use]\n"
        time_from="\t\t\tTIMESTAMP FROM: \t${arg:2:10} \t[0000000000 for View]\n"
        time_to="\t\t\tTIMESTAMP TO: \t${arg:12:10} \t[0000000000 for View]\n"
        poseso_description="$media_type $request_type $time_from $time_to"
    elif [[ $comman_code = M1 ]] || [[ $comman_code = M2 ]]; then
        type_msg="M1 (Photo/Video/Audio CRA request) M2(Photo/Video/Audio User request)"
        dev_type="\t\t\ttDEVICE_TYPE: \t${arg:0:3} \t\t[101=Smart Shock Sensor 102=Indoor Pir 103=Outdoor Pir 120=Smart Panic Button 140=VP 142=Siren Voice Keypad 999=All devices]\n"
        int_id="\t\t\tINTERFACE/DEVICE ID/DEVICE NUMBER \t${arg:3:2} \t[00=CU/All 01-99=device ID]\n"
        media_type="\t\t\tMEDIA TYPE: \t${arg:5:1} \t[0=NA/Default 1=Photo 2=Video 3=Audio 4=Auditlog 5-9=Future use]\n"
        poseso_description="$dev_type $int_id $media_type"
        if [[ $comman_code = M2 ]]; then
            res_format="\t\t\tRESOLUTION FORMAT: \t${arg:6:1} \t[0=WVGA 1=QVGA 2=VGA 3-9=Future use]\n"
            n_pictures="\t\t\tNUMBER OF PICTURE PER DEVICE: \t${arg:7:1}\n"
            poseso_description="$poseso_description $res_format $n_pictures"
        fi
    elif [[ $comman_code = SR ]]; then
        type_msg="Sigfox Communication Requirement"
        dev_type="\t\t\tDEVICE_TYPE: \t${arg:0:3} \t[100=Central Unit 120=Smart Panic Button 140=VP 999=All devices ]\n"
        int_id="\t\t\tINTERFACE/DEVICE ID: \t${arg:3:2} \t[00=CP/All 01-99=device ID]\n"
        poseso_description="$dev_type $int_id"
     elif [[ $comman_code = ZT ]] || [[ $comman_code = ZS ]] || [[ $comman_code = ZH ]] || [[ $comman_code = ZC ]] ; then
        type_msg="ZT (Fog Test) ZS (Fog Generation Start) ZH (Fog generator enable/disable) ZC(Zerovision status)"
        dev_type="\t\t\tDEVICE_TYPE: \t${arg:0:3} \t[104=Zero Vision  ]\n"
        int_id="\t\t\tINTERFACE/DEVICE ID: \t${arg:3:2} \t[00=CP/All 01-99=device ID]\n"
        poseso_description="$dev_type $int_id"
        if [[ $comman_code = ZS ]]; then
            trigger_key="\t\t\tTRIGGER KEY: \t${arg:5:8} \t[00=CP/All 01-99=device ID]\n"
            poseso_description="$poseso_description $trigger_key"
        elif [[ $comman_code = ZH ]]; then
            action="\t\t\tACTION: \t${arg:5:1} \t[0=Disable Fog 1=Enable Fog]\n"
            poseso_description="$poseso_description $action"
        fi
     elif [[ $comman_code = 91 ]]; then
        type_msg="Stop Siren"
     elif [[ $comman_code = I0 ]]; then
        type_msg="GSM network connectivity"
     elif [[ $comman_code = 41 ]]; then
        type_msg="Status Panel"
     elif [[ $comman_code = CC ]]; then
        type_msg="Climate Data"
     elif [[ $comman_code = TA ]] || [[ $comman_code = FA ]]; then
        type_msg="TA (Confirm Intrusion) FA (Confirm False Intrusion)"
     elif [[ $comman_code = FR ]]; then
        type_msg="Factory Reset"
     elif [[ $comman_code = SS ]]; then
        type_msg="System fault Status(Remote)"
     elif [[ $comman_code = VS ]]; then
        type_msg="Video Streaming with Arlo"
        dev_type="\t\t\tDEVICE TYPE: \t${arg:0:3} \t[106=Arlo Orion(indoor PIR) ]\n"
        dev_id="\t\t\tDEVICE ID: \t${arg:3:2} \t[00=CU 01-99=Other]\n"
        event_id="\t\t\tEVENT ID: \t${event_args:5:32} [In UUID format]\n"
        resol="\t\t\tRESOLUTION: \t${event_args:37:2} [0=Undefined 1=Minimum 2=Small 3=Low 4=Medium 5=High 6=FHD]\n"
        time_out="\t\t\tTIMEOUT: \t${event_args:39:6} [0=discnonnected automatically (In seconds)]\n"
        user_id="\t\t\tUSER ID: \t${event_args:45:2} [00=SD CRA/ATC 01-99=UserID]\n"
        audio_enabled="\t\t\tAUDIO ENABLED: \t${event_args:47:1} [0=Audio disabled 1=Audio enabled]\n"
        record_steam="\t\t\tRECORDING STREAMING: \t${event_args:48:1} [0=recording streaming disabled 1=recording streaming enabled]\n"
        placeh="\t\t\tFUTURE USE: \t${event_args:49:16} [Reserved for further use]\n"
        poseso_description="$dev_type $dev_id $event_id $resol $time_out $user_id $audio_enabled $record_steam $placeh"
     elif [[ $comman_code = DC ]] || [[ $comman_code = RC ]]; then
        type_msg="DC (Device Claim) RC (Device Renew certificate)"
        dev_type="\t\t\tDEVICE TYPE: \t${arg:0:3} \t[100=CU 101=Magnetic 102=Campir 104=ZV 120=SPB  121=Smoke 140=VP [More info in docs] ]\n"
        dev_id="\t\t\tDEVICE ID: \t${arg:3:2} \t[00=CU 01-99=Other]\n"
        poseso_description="$dev_type $dev_id"
    elif [[ $comman_code = EI ]]; then
        type_msg="External incident"
        dev_type="\t\t\tDEVICE_TYPE: \t${arg:0:3} \t[100=Central Unit 101=Smart Shock Sensor 102=Indoor Pir 103=Croptex 104=ZeroVision 106=Orion (More options in docs)]\n"
        dev_id="\t\t\tDEVICE ID: \t${arg:3:2}\n"
        inc_type="\t\t\tINCIDENT TYPE: \t${arg:5:2} \t[00=SOS 01=TAMPER 02=JAMMING]\n"
        poseso_description="$dev_type $dev_id $inc_type"
    elif [[ $comman_code = DF ]]; then
        type_msg="Remote request of System fault Status"
    elif [[ $comman_code = DL ]]; then
        type_msg="Door Lock request"
        device_type="\t\t\tDEVICE_TYPE: \t${arg:0:3} \t\t[Posesa identifier for Device type]\n"
        device_id="\t\t\tDEVICE ID: \t${arg:3:2} \t\t[00=CU 01-99=Other]\n"
        lock="\t\t\tLOCK: \t\t${arg:5:1} \t\t[0=UNLOCK 1=LOCK]\n"
        trigger="\t\t\tTRIGGER: \t${arg:6:2} \t\t[00 = Unknown 01 = Command:  OSB_EXAMP -> PROTOM_TEST 02 = Command:  OSB_WEBWS -> CCDD 03 = Command:  OSB_PROUI -> PROTOM-UI 04 = Command:  OSB_TESTS 05 = Command:  OSB_AWARE -> IT TELEFONÍA 06 = Command:  BLUE -> M2M]\n"
        user_id="\t\t\tUSER ID: \t${arg:8:3} \t\t[000 : SD ARC / Scheduler / NA (1- 99)= Customer user id. 100 = master ( only code )]\n"
        placeholder="\t\t\tPLACEHOLDER: \t${arg:11:11} [Reserved for further use]\n"
        poseso_description="$device_type $device_id $lock $trigger $user_id $placeholder"
    elif [[ $comman_code = DS ]]; then
        type_msg="Doorlock device Status request"
        device_type="\t\t\tDEVICE_TYPE: \t${arg:0:3} \t\t[Posesa identifier for Device type]\n"
        device_id="\t\t\tDEVICE ID: \t${arg:3:2} \t\t[00=CU 01-99=Other]\n"
        user_id="\t\t\tUSER ID: \t${arg:5:3} \t\t[000 : SD ARC / Scheduler / NA (1- 99)= Customer user id. 100 = master ( only code )]\n"
        placeholder="\t\t\tPLACEHOLDER: \t${arg:8:13} [Reserved for further use]\n"
        poseso_description="$device_type $device_id $user_id $placeholder"
    elif [[ $comman_code = AC ]]; then
        type_msg="Alarm cancellation"
        alarm_type="\t\t\tALARM_TYPE: \t${arg:0:1} \t\t[0=All active alarms 1=Intrusion alarm 2=Fire alarm 3=Water alarm 4=Tamper alarm]\n"
        user_id="\t\t\tUSER ID: \t${arg:1:2} \t\t[00=SD CRA / ATC. 01-99=User id]\n"
        placeholder="\t\t\tPLACEHOLDER: \t${arg:3:16} [Reserved for further use]\n"
        poseso_description="$alarm_type $user_id $placeholder"
    elif [[ $comman_code = MR ]] || [[ $comman_code = DW ]]; then
        type_msg="MR (Master Reset) DW (Device WIFI status request)"
        dev_type="\t\t\tDEVICE_TYPE: \t${arg:0:3} \t[100=Central Unit 106=Orion 140=Portal (More options in docs)]\n"
        dev_id="\t\t\tDEVICE ID: \t${arg:3:2} \t[00=CU 01-99=Other]\n"
        poseso_description="$dev_type $dev_id"
        if [[ $comman_code = MR ]]; then
            placeholder="\t\t\tPLACEHOLDER: \t${arg:5:16} [Reserved for further use]\n"
            poseso_description="$poseso_description $placeholder"
        fi
    elif [[ $comman_code = CR ]]; then
        type_msg="Components Reset"
        device_type="\t\t\tDEVICE_TYPE: \t${arg:0:3} \t\t[Posesa identifier for Device type]\n"
        device_id="\t\t\tDEVICE ID: \t${arg:3:2} \t\t[00=CU 01-99=Other]\n"
        component_id="\t\t\tCOMPONENT ID: \t${arg:5:3} \t\t[000=Dialer 001-999=Reserved for further use]\n"
        placeholder="\t\t\tPLACEHOLDER: \t${arg:8:16} [Reserved for further use]\n"
        poseso_description="$device_type $device_id $component_id $placeholder"
    elif [[ $comman_code = GC ]]; then
        type_msg="Guard code request (WIP)"
        time_min="\t\t\tTIME: \t${arg:0:4} \t\t[Time on minutes]\n"
        poseso_description="$time_min"
    elif [[ $comman_code = PV ]]; then
        type_msg="Publish version"
    elif [[ $comman_code = WS ]]; then
        type_msg="WiFi Sensing Session Request"
        time_sec="\t\t\tTIME: \t${arg:0:4} \t\t[Time on seconds for the sensing session]\n"
        poseso_description="$time_sec"
    elif [[ $comman_code = WC ]]; then
        type_msg="Node WiFi Connect"
        device_type="\t\t\tDEVICE_TYPE: \t${arg:0:3} \t\t[Posesa identifier for Device type 106/107 (QR/QP)]\n"
        device_id="\t\t\tDEVICE ID: \t${arg:3:2} \t\t[00=CU 01-99=Other]\n"
        time_sec="\t\t\tTIME: \t${arg:5:4} \t\t[Time on seconds for the sensing session]\n"
        poseso_description="$device_type $device_id $time_sec"
    elif [[ $comman_code = HR ]]; then
        type_msg="Holdup Restoration"
        user_id="\t\t\tUSER ID: \t${arg:0:2} \t\t[00=SD CRA/ATC 01-99=User id]\n"
        placeholder="\t\t\tPLACEHOLDER: \t${arg:2:16} [Reserved for further use]\n"
        poseso_description="$user_id $placeholder"
    elif [[ $comman_code = MI ]]; then
        type_msg="GSM coverage (Mobile Information)"
    elif [[ $comman_code = BS ]]; then
        type_msg="Device Battery Status request"
        device_type="\t\t\tDEVICE_TYPE: \t${arg:0:3} \t\t[Posesa identifier for Device type 107 Aquila]\n"
        device_id="\t\t\tDEVICE ID: \t${arg:3:2} \t\t[00 = NA-All 01-99=other]\n"
        placeholder="\t\t\tPLACEHOLDER: \t${arg:5:13} \t\t[Reserved for further use]\n"
        poseso_description="$device_type $device_id $placeholder"
    elif [[ $comman_code = MS ]]; then
        type_msg="Magnetometer device Status request"
        device_type="\t\t\tDEVICE_TYPE: \t${arg:0:3} \t\t[Posesa identifier for Device type 110: MC3]\n"
        device_id="\t\t\tDEVICE ID: \t${arg:3:2} \t\t[00 = NA-All 01-99=other]\n"
        placeholder="\t\t\tPLACEHOLDER: \t${arg:5:13} \t\t[Reserved for further use]\n"
        poseso_description="$device_type $device_id $placeholder"
    elif [[ $comman_code = KS ]]; then
        type_msg="Key status NGS"
        tag_id="\t\t\tTAG ID: \t${arg:0:2} \t\t[00=All tags configured 01-99]\n"
        placeholder="\t\t\tPLACEHOLDER: \t${arg:2:18} \t\t[Reserved for further use]\n"
        poseso_description="$tag_id $placeholder"
    elif [[ $comman_code = GM ]]; then
        type_msg="God Mode - Open sesion"
        time="\t\t\tTIME: \t${arg:0:3}\t\t[minutes If it is 0 Close sesion Note: If you had a window open, it is closed and CU open new.]\n"
        port="\t\t\tPORT: \t${arg:3:5}\n"
        placeholder="\t\t\tPLACEHOLDER: \t${arg:8:16} \t\t[Reserved for further use]\n"
        poseso_description="$time $port $placeholder"
    else
     type_msg="N/A"
    fi

      echo -e "\t\tShort description: " $type_msg
      echo -e $poseso_description
}


check_busctl()
{
    local info=$1
    # initialize variables
    local interface=""
    local member=""
    local number=0
    # define required variables
    local interf_dial=com.verisure.cuxsdialerd.view.backend
    local member_ack_rec=ack_received
    local member_trans=transmission
    local member_poseso=command_received
    local member_discarded=event_discarded
    local member_timeout=ack_timeout
    local list_posese='CST DBR DCS DDS DIS DRC DSB DSF DTS DVR DWS DZC FEO ICM IFH INI ISC ISD IWA MAC MAD MAF
    MAR MBD MCA MCR MCU MDB MDE MDV MEB MEC MEI MEN MDF MFA MFL MGC MHS MID MJS MLB MNI MMS MPJ MPR MPS MRA MRD MRE 
    MRF MS2 MSA MSR MSS MTA MTC MTS MV2 MVT MWB MWP MZC SFG SID SRT TFG TSS TTS UDS UDV URF URT VSS WSR MGM MHS MOR MJD KRU KIS KSR DMS DDM DBS DCB'
    #echo $info
    # check info content
    if [[ -n "$info" ]]; then
        if [[ -z "$(echo $info | grep Interface)" ]]; then
            continue
        fi
        number=1
        if [[ -n "$(echo $info | grep "$interf_dial")" ]] || [[ -n "$(echo $info | grep "$interf_mess")" ]]; then
            for word in $info; do
                number=$(expr $number + 1)
                if [[ $word = Interface ]]; then
                    interface=$(echo $info | awk '{print $var}' var="${number}")
                    #echo interfaz $interface
                elif [[ $word = Member ]]; then
                    member=$(echo $info | awk '{print $var}' var="${number}")
                    #echo member $member
                fi
            done
            if [[ $member = $member_poseso ]]; then
                is_command=yes
                # Extract command using grep
                command_d=$(echo "$info" | grep -o 'STRING "[^"]*"' | head -n 1 | cut -d'"' -f2)
                
                if [[ -n "$( echo $command_d | grep "SDES" )" ]]; then
                  echo ""
                  printf %60s\\n | tr ' ' '#'
                  scenario_time_start=$(date +%T)
                  echo "##" $scenario_time_start
                  if [[ -n "$( echo $command_d | grep " ")" ]]; then
                    command_d="$(echo $command_d | grep ' ' | sed s/' '/\=\=/g)"
                    protocol=2
                    echo "NEW protocol version"
                    command="${command_d:57:2}"
                    SUID_comman="${command_d:38:12}"
                  else
                    echo "OLD protocol version"
                    command_d="$(echo $command_d | tr -d '[:space:]')"
                    command_d="${command_d}=="
                    protocol=1
                    SUID_comman="${command_d:$((${#command_d}-12)):12}"
                    command="${command_d:44:2}"
                  fi
                  analise_posesa $command_d $protocol $SUID_comman $is_command
                  analise_poseso $command_d $protocol
                fi

            elif [[ $member = $member_trans ]]; then
              echo ""
              scenario_time_start=$(date +%T)
              echo "##" $scenario_time_start
              
              # Extract fields using grep
              tipo_posese=$(echo "$info" | grep -o 'STRING "[^"]*"' | head -n 1 | cut -d'"' -f2)
              tipo_com=$(echo "$info" | grep -o 'STRING "[^"]*"' | head -n 3 | tail -n 1 | cut -d'"' -f2)
              posese=$(echo "$info" | grep -o 'STRING "[^"]*"' | head -n 4 | tail -n 1 | cut -d'"' -f2)
              
              posese="$(echo $posese | grep ' ' | sed s/' '/\=\=/g)"
              if [[ $tipo_com = "dial_target" ]]; then
                dial_target_msg=yes
              fi
              echo -e "\e[1m###A" $tipo_posese "event has been detected sent by" $tipo_com "###\e[0m"
              if [[ -n "$( echo $posese | grep "MESSAGE")" ]]; then
                no_msg=yes
                echo -e "\e[1m###A the event has not any message. A problem might be happening in some communication interface. ###\e[0m"
                continue
              fi
              if [[ $tipo_com = "photos_ethernet" ]] || [[ $tipo_com = "photos_gprs" ]]; then
                photo=yes
                continue
              fi
              if [[ $tipo_com = "sigfox" ]]; then
                sigfox_msg=yes
                continue
              fi
              is_command=no
              #ISC, MEN, ICM...
              msg_type="${posese:82:3}"
              for i in $list_posese; do
                if [[ -n "$( echo $msg_type | grep "$i")" ]]; then
                  find=yes
                fi
              done
              if [[ $find != yes || ($find == yes && $msg_type == "DTS")]]; then
                posese="$(echo $posese | grep \=\= | sed s/\=\=/\=/g)"
                msg_type="${posese:82:3}"
              fi
              SUID_msg="${posese:38:12}"
              if [[ $photo = yes ]] || [[ $sigfox_msg = yes ]] || [[ $no_msg = yes ]]; then
                SUID_comman=""
                SUID_msg=""
              else
                analise_posesa $posese 2 $SUID_msg $is_command
                analise_posese $posese
              fi
              find=no
              echo ""
              echo -e "\e[1m### CHECKING THE RESULTS ###\e[0m"
              if [ "$msg_type" != " " ] && [ -z "$command_d" ] && [ "$timeout" != "yes" ] ; then
                  command=NO
                  echo ""
                  echo -e "\tThe event has not a POSESO command"
                  found_SUID=yes
                  found_comman=OK
              fi

              if [ ! -z "$SUID_comman" -a "$SUID_comman" != " " ] && [ ! -z "$SUID_msg" -a "$SUID_msg" != " " ] ; then
                  #eval SUID
                  eval " if [ \$SUID_comman == \$SUID_msg ]; then
                              found_SUID=yes
                              echo -e \"\tThe SUID is the same:  \$SUID_comman  \$add\"
                          else
                              found_SUID=no
                              echo -e \"\tThe SUID is DIFFERENT or THERE ISN'T A POSESO COMMAND\"
                          fi"
                  #Eval type of message
                  eval "if [ \$command == \"E1\" ]; then
                          if [ \$msg_type == 'ISC' ]; then
                              echo -e \"\tE1 --> ISC      OK\"
                              found_comman=OK
                          else
                              echo -e \"\tERROR. The correct POSESE: E1 --> ISC\"
                              found_comman=KO
                          fi
                    elif [ \$command == 41 ]; then
                          if [ \$msg_type == 'MEN' ]; then
                              echo -e \"\t41 --> MEN      OK\"
                              found_comman=OK
                          else
                              echo -e \"\tERROR. The correct POSESE: 41 --> MEN\"
                              found_comman=KO
                          fi
                    elif [ \$command == 'E3' ] || [ \$command == 'M3' ]; then
                          if [ \$msg_type == 'ICM' ]; then
                              echo -e \"\tE3/M3 --> ICM      OK\"
                              found_comman=OK
                          else
                              echo -e \"\tERROR. The correct POSESE: E3/M3 --> ICM\"
                              found_comman=KO
                          fi
                    elif [ \$command == 'AR' ] ; then
                          if [ \$msg_type == 'MRA' ] || [ \$msg_type == 'MRE' ]; then
                              echo -e \"\tAR --> MRA/MRE      OK\"
                              found_comman=OK
                          else
                              echo -e \"\tERROR. The correct POSESE: AR --> MRA\"
                              double_event=YES
                              found_comman=KO
                          fi
                    elif [ \$command == 'DR' ]; then
                          if [ \$msg_type == 'MRD' ]; then
                              echo -e \"\tDR --> MRD      OK\"
                              found_comman=OK
                          else
                              echo -e \"\tERROR. The correct POSESE: DR --> MRD\"
                              found_comman=KO
                          fi
                    elif [ \$command == 'TE' ]; then
                          if [ \$msg_type == 'MTS' ]; then
                              echo -e \"\tTE --> MTS      OK\"
                              found_comman=OK
                          else
                              echo -e \"\tERROR. The correct POSESE: TE --> MTS\"
                              found_comman=KO
                          fi
                    elif [ \$command == '91' ]; then
                          if [ \$msg_type == 'ISD' ]; then
                              echo -e \"\t91 --> ISD      OK\"
                              found_comman=OK
                          else
                              echo -e \"\tERROR. The correct POSESE: 91 --> ISD\"
                              found_comman=KO
                          fi
                    elif [ \$command == 'I0' ]; then
                          if [ \$msg_type == 'MNI' ] || [ \$msg_type == 'INI' ]; then
                              echo -e \"\tFor CU Version <= 1.7.x --> INI      OK\"
                              echo -e \"\tFor CU Version >= 1.9.x --> MNI      OK\"
                              found_comman=OK
                          else
                              echo -e \"\tERROR. The correct POSESE: MNI or INI according to CU version. See docs for more info.\"
                              found_comman=KO
                          fi
                    elif [ \$command == 'RR' ]; then
                          if [ \$msg_type == 'MSR' ]; then
                              echo -e \"\tRR --> MSR      OK\"
                              found_comman=OK
                          else
                              echo -e \"\tERROR. The correct POSESE: RR --> MSR\"
                              found_comman=KO
                          fi
                    elif [ \$command == 'CC' ]; then
                          if [ \$msg_type == 'MCR' ]; then
                              echo -e \"\tCC --> MCR      OK\"
                              found_comman=OK
                          else
                              echo -e \"\tERROR. The correct POSESE: CC --> MCR\"
                              found_comman=KO
                          fi
                    elif [ \$command == 'TA' ]; then
                          if [ \$msg_type == 'MTA' ]; then
                              echo -e \"\tTA --> MTA      OK\"
                              found_comman=OK
                          else
                              echo -e \"\tERROR. The correct POSESE: TA --> MTA\"
                              found_comman=KO
                          fi
                    elif [ \$command == 'FA' ]; then
                          if [ \$msg_type == 'MFA' ]; then
                              echo -e \"\tFA --> MFA      OK\"
                              found_comman=OK
                          else
                              echo -e \"\tERROR. The correct POSESE: FA --> MFA\"
                              found_comman=KO
                          fi
                    elif [ \$command == 'AF' ]; then
                          if [ \$msg_type == 'MAF' ]; then
                              echo -e \"\tAF --> MAF      OK\"
                              found_comman=OK
                              double_event=YES
                          else
                              echo -e \"\tERROR. The correct POSESE: AF --> MAF\"
                              double_event=YES
                              found_comman=KO
                          fi
                    elif [ \$command == 'M1' ] || [ \$command == 'M2' ]; then
                          if [ \$msg_type == 'MPR' ] || [ \$msg_type == 'MMS' ]; then
                                  echo -e \"\tFor CU Version <= 1.5.x --> MPR      OK\"
                                  echo -e \"\tFor CU Version >= 1.6.x --> MMS      OK\"
                                  found_comman=OK
                              else
                                  echo -e \"\tERROR. The correct POSESE: MPR or MMS according to CU version. See docs for more info.\"
                                  found_comman=KO
                              fi
                    elif [ \$command == 'TP' ] || [ \$command == 'FR' ] || [ \$command == 'M0' ] || [ \$command == 'PD' ] || [ \$command == 'DC' ] || [ \$command == 'RC' ] || [ \$command == 'MR' ] || [ \$command == 'PV' ] || [ \$command == 'CR' ]; then
                          if [ \$msg_type == 'MPR' ]; then
                              echo -e \"\tMPR      OK\"
                              echo -e \"\t(Note: Some posese might need a second posese appart from MPR event)\"
                              found_comman=OK
                          else
                              echo -e \"\tERROR. The correct POSESE: MPR\"
                              found_comman=KO
                          fi

                    elif [ \$command == 'ZT' ]; then
                          if [ \$msg_type == 'CST' ]; then
                              echo -e \"\tZT --> CST      OK\"
                              found_comman=OK
                          else
                              echo -e \"\tERROR. The correct POSESE: ZT --> CST\"
                              found_comman=KO
                          fi
                    elif [ \$command == 'ZT' ]; then
                          if [ \$msg_type == 'CST' ]; then
                              echo -e \"\tZT --> CST      OK\"
                              found_comman=OK
                          else
                              echo -e \"\tERROR. The correct POSESE: ZT --> CST\"
                              found_comman=KO
                          fi
                    elif [ \$command == 'ZS' ]; then
                          if [ \$msg_type == 'SFG' ]; then
                              echo -e \"\tZS --> SFG      OK\"
                              found_comman=OK
                          else
                              echo -e \"\tERROR. The correct POSESE: ZS --> SFG\"
                              found_comman=KO
                          fi
                    elif [ \$command == 'ZH' ]; then
                          if [ \$msg_type == 'IFH' ]; then
                              echo -e \"\tZH --> IFH      OK\"
                              found_comman=OK
                          else
                              echo -e \"\tERROR. The correct POSESE: ZH --> IFH\"
                              found_comman=KO
                          fi
                    elif [ \$command == 'ZC' ]; then
                          if [ \$msg_type == 'DZC' ] || [ \$msg_type == 'MZC' ]; then
                              echo -e \"\tZC --> DZC/MZC      OK\"
                              found_comman=OK
                          else
                              echo -e \"\tERROR. The correct POSESE: ZC --> DZC/MZC\"
                              found_comman=KO
                          fi
                    elif [ \$command == 'SS' ]; then
                          if [ \$msg_type == 'MSS' ]; then
                              echo -e \"\tSS --> MSS      OK\"
                              found_comman=OK
                          else
                              echo -e \"\tERROR. The correct POSESE: SS --> MSS\"
                              found_comman=KO
                          fi
                    elif [ \$command == 'SR' ]; then
                          if [ \$msg_type == 'MPR' ] || [ \$msg_type == 'MPJ' ]; then
                              echo -e \"\tSR --> MPR or MPJ      OK\"
                              found_comman=OK
                          else
                              echo -e \"\tERROR. The correct POSESE: MPR or MPJ\"
                              found_comman=KO
                          fi
                    elif [ \$command == 'VS' ]; then
                          if [ \$msg_type == 'VSS' ] ; then
                              echo -e \"\tVS --> VSS      OK\"
                              found_comman=OK
                          else
                              echo -e \"\tERROR. The correct POSESE: VSS\"
                              found_comman=KO
                          fi
                    elif [ \$command == 'EI' ]; then
                            if [ \$msg_type == 'MEI' ] || [ \$msg_type == 'MPR' ]; then
                                echo -e \"\tEI --> MEI/MPR OK\"
                                found_comman=OK
                                double_event=YES
                            else
                                echo -e \"\tERROR. The correct POSESEs: MEI/MPR\"
                                found_comman=KO
                            fi
                    elif [ \$command == 'DW' ]; then
                        if [ \$msg_type == 'DWS' ] ; then
                            echo -e \"\tDW --> DWS OK\"
                            found_comman=OK
                        else
                            echo -e \"\tERROR. The correct POSESE: DWS\"
                            found_comman=KO
                        fi
                    elif [ \$command == 'DK' ]; then
                        if [ \$msg_type == 'MAR' ] || [ \$msg_type == 'DKS' ]; then
                            echo -e \"\tDK --> MAR/DKS OK\"
                            found_comman=OK
                        else
                            echo -e \"\tERROR. The correct POSESE: MAR/DKS\"
                            found_comman=KO
                        fi
                    elif [ \$command == 'DF' ]; then
                        if [ \$msg_type == 'MDF' ] || [ \$msg_type == 'MFL' ]; then
                            echo -e \"\tDF --> MDF/MFL OK\"
                            found_comman=OK
                        else
                            echo -e \"\tERROR. The correct POSESE: MDF/MFL\"
                            found_comman=KO
                        fi
                    elif [ \$command == 'DL' ]; then
                        if [ \$msg_type == 'MAR' ] || [ \$msg_type == 'DDS' ]; then
                            echo -e \"\tDL --> MAR/DDS OK\"
                            found_comman=OK
                        else
                            echo -e \"\tERROR. The correct POSESE: MAR/DDS\"
                            found_comman=KO
                        fi
                    elif [ \$command == 'DS' ]; then
                        if [ \$msg_type == 'DDS' ]; then
                            echo -e \"\tDS --> DDS OK\"
                            found_comman=OK
                        else
                            echo -e \"\tERROR. The correct POSESE: DDS\"
                            found_comman=KO
                        fi
                    elif [ \$command == 'AC' ]; then
                        if [ \$msg_type == 'MCA' ] || [ \$msg_type == 'MPR' ]; then
                            echo -e \"\tAC --> MCA/MPR OK\"
                            found_comman=OK
                        else
                            echo -e \"\tERROR. The correct POSESE: MCA/MPR\"
                            found_comman=KO
                        fi
                    elif [ \$command == 'GC' ]; then
                        if [ \$msg_type == 'MGC' ]; then
                            echo -e \"\tGC --> MGC OK\"
                            found_comman=OK
                        else
                            echo -e \"\tERROR. The correct POSESE: MGC\"
                            found_comman=KO
                        fi
                    elif [ \$command == 'WS' ]; then
                        if [ \$msg_type == 'MAR' ] || [ \$msg_type == 'WSR' ]; then
                            echo -e \"\tWS --> MAR/WSR OK\"
                            found_comman=OK
                        else
                            echo -e \"\tERROR. The correct POSESE: MAR/WSR\"
                            found_comman=KO
                        fi
                    elif [ \$command == 'WC' ]; then
                        if [ \$msg_type == 'MPR' ] ; then
                            echo -e \"\tDW --> MPR OK\"
                            found_comman=OK
                        else
                            echo -e \"\tERROR. The correct POSESE: MPR\"
                            found_comman=KO
                        fi
                    elif [ \$command == 'HR' ]; then
                        if [ \$msg_type == 'MHS' ] ; then
                            echo -e \"\tHR --> MHS OK\"
                            found_comman=OK
                        else
                            echo -e \"\tERROR. The correct POSESE: MHS\"
                            found_comman=KO
                        fi
                    else
                        echo -e \"\tWARNING: Command is not included or the message has not a command code\"
                        found_comman=KO
                    fi
                    "
                  #Eval MPJ event
                  eval "if [ \$msg_type == 'MPJ' ]; then
                            echo -e \"\tPoseso rejected order\"
                            found_comman=OK
                        elif [ \$msg_type == 'MRE' ] || [ \$msg_type == 'MEI' ] || [ \$msg_type == 'MDE' ]; then
                            if [ \$double_event == YES ]; then
                                found_comman=OK
                                double_event=NO
                            fi
                        fi
                    "
                    #General Check
                    if [[ $found_SUID = yes ]] && [[ $found_comman = OK ]]; then
                        echo -e "RESUME:  TEST OK. "
                    elif [[ $found_SUID = yes ]] && [[ $found_comman = KO ]]; then
                        echo -e "\tRESUME:  ERROR. SUID must be different."
                    elif [[ $found_SUID = no ]] && [[ $found_comman = OK ]]; then
                        echo -e "\tRESUME:  ERROR. SUID must be the same."
                    elif [[ $found_SUID = no ]] && [[ $found_comman = KO ]]; then
                        echo -e "\tRESUME:  TEST OK."
                    fi
                   fi

            elif [[ $member = $member_ack_rec ]]; then
                if [[ $photo = yes ]]; then
                  echo -e "\e[1m###A" PHOTO DETECTED "###\e[0m"
                  photo=no
                  continue
                fi
                if [[ $sigfox_msg = yes ]]; then
                  echo -e "\e[1m###" A SIGFOX MESSAGE HAS BEEN SENT SUCCESFULLY "###\e[0m"
                  sigfox_msg=no
                fi
                if [[ $dial_target_msg = yes ]] || [[ $no_msg = yes ]]; then
                  continue
                fi
                
                # Extract ACK using grep
                ack_rec=$(echo "$info" | grep -o 'STRING "[^"]*"' | head -n 4 | tail -n 1 | cut -d'"' -f2)
                ack_rec="$(echo $ack_rec | grep ' ' | sed s/' '/\=\=/g)"
                SUID_ack="${ack_rec:38:12}"
                echo -e ""
                eval " if [ \"\$dial_target_msg\" == 'yes' ]; then
                        continue
                      else
                        echo -e \"MORE:\"
                        if [ \"\$SUID_msg\" == \"\$SUID_ack\" ]; then
                            echo -e \"\tEvent and ACK have the same SUID: \$SUID_ack\"
                        else
                            echo -e \"\tERROR. Event and ACK have a different SUID: \$SUID_msg | \$SUID_ack\"
                          fi
                        fi
                        SUID_msg=""
                        SUID_ack=""
                        timeout=no
                        "
                  if [[ $found_SUID = yes ]] && [[ $found_comman = OK ]]; then
                      command=NO
                  fi
                  echo ""
                  dial_target_msg=no
                  no_msg=no
              elif [[ $member = $member_timeout ]]; then
                  echo -e "\t****ACK TIMEOUT***"
              elif [[ $member = $member_discarded ]]; then
                  echo -e "\t****Event discarded***"
            fi

        fi
    fi
}


launch()
{
    local pro_bus=no
    local runtime=0
    local started=no
    local time_start=0
    local total=0
    #local provider=""
    local protocol=0
    #local SUID_catch=""
    local SUID_msg=""
    #local SUID_resp=""
    local msg_type=""
    local SUID_ack1=""
    local msg_ack1=""
    local n_events=0
    local sigfox_msg=no
    local photo=no
    local command=NO
    local is_command=no
    local find=no
    local timeout=no
    local no_msg=no
    local dial_target_msg=no
    
    # Detect D-Bus service name
    local service_name=""
    local interface_name=""
    
    if busctl list 2>/dev/null | grep -q "com.verisure.cuxsdialerd"; then
        service_name="com.verisure.cuxsdialerd"
        interface_name="com.verisure.cuxsdialerd.view.backend"
    elif busctl list 2>/dev/null | grep -q "com.verisure.cuxs-dialer"; then
        service_name="com.verisure.cuxs-dialer"
        interface_name="com.verisure.View.Backend"
    else
        echo "[ERROR] No cuxs-dialer service found in D-Bus"
        exit 1
    fi
    
    echo "[DEBUG] Detected D-Bus service: $service_name"
    echo "[DEBUG] Using interface: $interface_name"

    # get d-bus bus info with busctl and journalctl
    { busctl monitor --match="type='signal',interface='${interface_name}'" ${service_name} 2> /dev/null & generate_empty_line; } |
    while read -r line; do
      if [[ $started != yes ]]; then
          started=yes
          continue
      fi
      pro_bus=no
      pro_jou=no
      if [[ -n "$line" ]]; then
          if [[ -z "$(echo $line | grep $(hostname))" ]]; then
              pro_bus=yes
          else
              if [[ -z "$(echo $line | grep "$(hostname) cuxsdialerd")" ]]; then
                  #check_installer
                  continue
              fi
              #pro_jou=yes
          fi
      fi
      if [[ $pro_jou = yes ]]; then
          #check_installer "$line"
          continue
      elif [[ $pro_bus = yes ]]; then
          line_bus=$line_bus' '$line
          # to get all the line information
          if [[ "$line" != "};" ]]; then
            continue
          fi
          check_busctl "$(echo $line_bus | grep \= | sed s/\=/' '/g)"
          line_bus=""
      fi

    done
}

printf %60s\\n
printf %60s\\n | tr ' ' '#'
echo -e "##             Check POSESA script v 1.35.0            ##"
printf %60s\\n\\n | tr ' ' '#'

launch
