sudo apt install hostapd
sudo systemctl unmask hostapd
sudo apt install dnsmasq
sudo cp ~/orbitron/utility_scripts/dhcpcd.conf /etc/dhcpcd.conf
sudo cp ~/orbitron/utility_scripts/dnsmasq.conf /etc
sudo rfkill unblock wlan
sudo cp ~/orbitron/utility_scripts/hostapd.conf /etc/hostapd/hostapd.conf
echo "ACCESS POINT SET UP - PLEASE REBOOT"