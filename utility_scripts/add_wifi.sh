#!/bin/bash

nmcli connection add con-name "$1" type wifi ssid "$1" 802-11-wireless-security.key-mgmt WPA-PSK 802-11-wireless-security.psk $2 autoconnect yes save yes
nmcli c up "$1"
