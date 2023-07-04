sudo apt install hostapd
sudo systemctl unmask hostapd
sudo systemctl enable hostapd
sudo apt install dnsmasq
sudo cp ./dhcpcd.conf /etc/dhcpcd.conf
sudo cp ./dnsmasq.conf /etc
sudo rfkill unblock wlan
sudo cp ./hostapd.conf /etc/hostapd/hostapd.conf
echo "ACCESS POINT SET UP - PLEASE REBOOT"