$fn=32;
width = 20;
channel_width = 22.3;
latch_height = 2;
overhang = 0.66;
wall_thickness = 2.6;
thickness = 2;
screw_hole_radius = 2.3;
screw_hole_width = 0;
channel_depth = 16;
hook_length = 128;

outer_x = channel_width/2 + 1.2;

difference() {    
union() {
  rotate([90,0,0])
  translate([0, 0, -width/2])
  linear_extrude(width)
  polygon([
    [-outer_x, -thickness],
    [-outer_x, wall_thickness + latch_height],
    [-channel_width/2 + overhang, wall_thickness],
    [-channel_width/2, wall_thickness],
    [-channel_width/2, 0],
    [channel_width/2, 0],
    [channel_width/2, wall_thickness],
    [channel_width/2 - overhang, wall_thickness],
    [outer_x, wall_thickness + latch_height],
    [outer_x, -thickness],
  ]);
  
  translate([outer_x, -width/2, -thickness])
  cube([thickness, width, channel_depth/2 + thickness]);
    
  translate([outer_x, -width/2, channel_depth/2 - thickness/2])
  cube([hook_length, width, thickness]);
  
  translate([outer_x + hook_length-thickness, -width/2, channel_depth/2])
  cube([thickness, width, width]);
}
  translate([outer_x + hook_length-thickness, 0, (channel_depth+width)/2])
  rotate([0,90,0])
  translate([0, 0, -1])
  hull() {
    translate([screw_hole_width/2, 0, 0])
    cylinder(h=thickness+2, r=screw_hole_radius);
    translate([-screw_hole_width/2, 0, 0])
    cylinder(h=thickness+2, r=screw_hole_radius);
  }
}
