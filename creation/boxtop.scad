$fn=32;
w = 72;
h = 108.2;
thickness1 = 2;
thickness2 = 3;

window_w = 51.8;
window_h = 22;
window_h_offset = 14.6;
magnet_r = 3.5;
magnet_offset = 1.5;

qr_base_w = 51.6;
qr_w = 48;
SCALE = 0.096 * 2.83464566929;

union() {
  difference() {
    cube([w, h, thickness1]);
      
    translate([(w - window_w)/2, h - window_h - window_h_offset, -1])
    cube([window_w, window_h, thickness1 + 2]);
      
    translate([0, 0, -1])
    union() {
      translate([magnet_r + magnet_offset, magnet_r + magnet_offset, 0])
      cylinder(h=thickness1, r=magnet_r);
        
      translate([w - magnet_r - magnet_offset, magnet_r + magnet_offset, 0])
      cylinder(h=thickness1, r=magnet_r);
        
      translate([w - magnet_r - magnet_offset, h - magnet_r - magnet_offset, 0])
      cylinder(h=thickness1, r=magnet_r);
        
      translate([magnet_r + magnet_offset, h - magnet_r - magnet_offset, 0])
      cylinder(h=thickness1, r=magnet_r);
    }
  }
  
  translate([(w - qr_base_w)/2, (w - qr_base_w)/2, thickness1])
  cube([qr_base_w, qr_base_w, thickness2]);


  translate([(w - qr_w)/2, (w - qr_w)/2, thickness1 + thickness2])
  scale([SCALE, SCALE, 1])
  linear_extrude(height = 0.2)
  import("/Users/adrianmarple/Dropbox/LumatronManufacturing/qr.svg");
}
