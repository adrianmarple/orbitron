$fn=32;
width = 20;
strut_length = 40;
latch_height = 2;
overhang = 0.66;
wall_thickness = 2.6;
box_thickness = 2;
bottom_thickness = 2;
screw_hole_radius = 2.3;
screw_hole_width = 6;

outer_x = strut_length + 1.2;

module strut() {
  rotate([90,0,0])
  translate([0, 0, -width/2])
  linear_extrude(width)
  polygon([
    [-outer_x, -box_thickness],
    [-outer_x, wall_thickness + latch_height],
    [-strut_length + overhang, wall_thickness],
    [-strut_length, wall_thickness],
    [-strut_length, 0],
    [0, 0],
    [0, -box_thickness],
  ]);
}

difference() {
  union() {
    strut();
    rotate([0,0,120])
    strut();
    rotate([0,0,-120])
    strut();
  }
  
  translate([0,0, -box_thickness-0.05])
  linear_extrude(box_thickness + 0.1, scale=2) 
  circle(r=screw_hole_radius);
}
  