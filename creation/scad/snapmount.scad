$fn=32;
width = 20;
channel_width = 22.3;
latch_height = 2;
overhang = 0.66;
wall_thickness = 2.8;
box_thickness = 6;
bottom_thickness = 2;
screw_hole_radius = 2.3;
screw_hole_width = 12;

outer_x = channel_width/2 + 1.2;

difference() {
  rotate([90,0,0])
  translate([0, 0, -width/2])
  linear_extrude(width)
  polygon([
    [-outer_x, -box_thickness],
    [-outer_x, wall_thickness + latch_height],
    [-channel_width/2 + overhang, wall_thickness],
    [-channel_width/2, wall_thickness],
    [-channel_width/2, 0],
    [channel_width/2, 0],
    [channel_width/2, wall_thickness],
    [channel_width/2 - overhang, wall_thickness],
    [outer_x, wall_thickness + latch_height],
    [outer_x, -box_thickness],
  ]);
    
  translate([0, 0, -box_thickness/2 + bottom_thickness])
  cube([channel_width - 2, width - 4, box_thickness], center=true);


  translate([0, 0, -box_thickness - 1])
  hull() {
    translate([screw_hole_width/2, 0, 0])
    cylinder(h=bottom_thickness+2, r=screw_hole_radius);
    translate([-screw_hole_width/2, 0, 0])
    cylinder(h=bottom_thickness+2, r=screw_hole_radius);
  }
}
