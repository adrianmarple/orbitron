$fn=32;
width = 21;
thickness = 2;
wall_thickness = 2;
box_thickness = 10;
bottom_thickness = 3.3;
overhang = 6;
channel_width = 13;
screw_hole_radius = 2.3;

union() {
  difference() {
    cube([width, overhang + wall_thickness + channel_width, box_thickness]);
      
    translate([thickness, overhang + wall_thickness + thickness, thickness])
    cube([width - 2*thickness, channel_width - 2*thickness, box_thickness]);
      
    translate([width/2, overhang + wall_thickness + channel_width/2, -1])
    cylinder(h=thickness+2, r=screw_hole_radius);
  }
    
  translate([0, -thickness, 0])
  cube([width, thickness, box_thickness + bottom_thickness + thickness]);
   
  translate([0, 0, box_thickness + bottom_thickness])
  cube([width, overhang, thickness]);
   
}
