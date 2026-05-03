
include <../utils.scad>

$fn=64;
width = 20;
channel_width = 22.3;
latch_height = 2;
overhang = 0.66;
wall_thickness = 2.8;
box_thickness = 9;
bottom_thickness = 2;
bottom_hole_d = 9.6;
bottom_hole_width = 20;

lip = 2;
inner_d = bottom_hole_d + 2*lip;
inner_thickness = 6;

outer_x = channel_width/2 + 1.2;

nail_angle = 30;
nail_d = 2.1;
sheath_wall = 1;
sheath_y = 1.7;

kerf = 0.4;

main();
nail_sheath();

module nail_sheath() {
difference() {
    union() {
        translate([0,sheath_y,0])
        rotate([nail_angle, 0, 0])
        translate([0,0,-2])
        cylinder(h=box_thickness+2, d=nail_d+2*sheath_wall);
        
        cylinder(h=inner_thickness/2, d1=bottom_hole_d-2*kerf, d2=inner_d-2*kerf);
        translate([0,0,inner_thickness/2])
        cylinder(h=inner_thickness/2, d2=bottom_hole_d-2*kerf, d1=inner_d-2*kerf);
    }
    
    translate([0,sheath_y,0])
    rotate([nail_angle, 0, 0])
    translate([0,0,-2])
    cylinder(h=box_thickness+3, d=nail_d);
    
    translate([0,0,-5])
    cube([10,10,10], center=true);
}
}


module main() {
difference() {
  translate([0,0,box_thickness])
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
    
  z_dim = box_thickness - inner_thickness+1;
  translate([0, 0, inner_thickness + z_dim/2])
  cube([channel_width, width - 4, z_dim], center=true);


  //cylinder(h=1, d=bottom_hole_d+0.2);
  cylinder(h=inner_thickness/2, d1=bottom_hole_d, d2=inner_d);
  translate([0,0,inner_thickness/2])
  cylinder(h=inner_thickness/2, d2=bottom_hole_d, d1=inner_d);
}
}