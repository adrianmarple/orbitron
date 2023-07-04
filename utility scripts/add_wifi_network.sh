read -p "Enter SSID: " ssid
read -p "Enter password: " password
if [[ -z "$password" ]]; then
data="network={
    ssid="$ssid"
    key_mgmt=NONE
    scan_ssid=1
    id_str="$ssid"
    priority=1
}"
else
data="network={
	ssid='$ssid'
	psk='$password'
	key_mgmt=WPA-PSK
	scan_ssid=1
	id_str='$ssid'
	priority=1
}"
fi

sudo mkdir -p /etc/wpa_supplicant
sudo sh -c "echo '$data' >> /etc/wpa_supplicant/wpa_supplicant.conf"
