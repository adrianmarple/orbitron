
include <../utils.scad>

$fn=32;
width = 20;
channel_width = 22.3;
latch_height = 2;
overhang = 0.66;
wall_thickness = 2.8;
box_thickness = 9;
bottom_thickness = 2;
bottom_hole_d = 9;
bottom_hole_width = 8;

inner_d = bottom_hole_d + 3;
inner_h = 2;

outer_x = channel_width/2 + 1.2;

nail_angle = 30;
nail_d = 2;
sheath_wall = 1;
sheath_y = 1.5;

kerf = 0.2;

nail_sheath();
main();


module nail_sheath() {
difference() {
    union() {
        translate([0,sheath_y,0])
        rotate([nail_angle, 0, 0])
        translate([0,0,-2])
        cylinder(h=box_thickness+2, d=nail_d+2*sheath_wall);
        
        cylinder(h=2*bottom_thickness + inner_h, d=bottom_hole_d-2*kerf);
        translate([0,0,bottom_thickness+kerf])
        cylinder(h=inner_h-2*kerf, d=inner_d-2*kerf);
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
translate([0,0,box_thickness])
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
  pillinder(bottom_hole_width + bottom_hole_d, bottom_hole_d/2, bottom_thickness+2);
}
}