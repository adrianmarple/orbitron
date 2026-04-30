
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
bottom_hole_width = bottom_hole_d;

lip = 2;
inner_d = bottom_hole_d + 2*lip;
inner_h = 2;

outer_x = channel_width/2 + 1.2;

nail_angle = 30;
nail_d = 2.1;
sheath_wall = 1;
sheath_y = 1.7;

hatch_dowel_d = 4;
hatch_dowel_y = width/2 - hatch_dowel_d;
hatch_dowel_x = channel_width/2 - hatch_dowel_d + 2;
hatch_dowel_kerf = 0.1;

v_kerf = 0.4;
h_kerf = 0.1;


//main();
hatch();
//nail_sheath();

module nail_sheath() {
difference() {
    union() {
        translate([0,sheath_y,0])
        rotate([nail_angle, 0, 0])
        translate([0,0,-2])
        cylinder(h=box_thickness+2, d=nail_d+2*sheath_wall);
        
        cylinder(h=2*bottom_thickness + inner_h, d=bottom_hole_d-2*h_kerf);
        translate([0,0,bottom_thickness+v_kerf])
        cylinder(h=inner_h-2*v_kerf, d=inner_d-2*h_kerf);
    }
    
    translate([0,sheath_y,0])
    rotate([nail_angle, 0, 0])
    translate([0,0,-2])
    cylinder(h=box_thickness+3, d=nail_d);
    
    translate([0,0,-5])
    cube([10,10,10], center=true);
}
}

module hatch() {
  difference() {
    thick = bottom_thickness - 0.2;
    translate([0,0,thick/2])
    cube([channel_width, width - 4, thick], center=true);
      
    translate([0, 0, -1])
    pillinder(bottom_hole_width, bottom_hole_d/2, box_thickness+2);
  }
    
  translate([hatch_dowel_x, hatch_dowel_y, 0])
  cylinder(h=bottom_thickness*2, d=hatch_dowel_d - 2*hatch_dowel_kerf);
  translate([hatch_dowel_x, -hatch_dowel_y, 0])
  cylinder(h=bottom_thickness*2, d=hatch_dowel_d - 2*hatch_dowel_kerf);
  translate([-hatch_dowel_x, hatch_dowel_y, 0])
  cylinder(h=bottom_thickness*2, d=hatch_dowel_d - 2*hatch_dowel_kerf);
  translate([-hatch_dowel_x, -hatch_dowel_y, 0])
  cylinder(h=bottom_thickness*2, d=hatch_dowel_d - 2*hatch_dowel_kerf);
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
    
  z_dim = box_thickness - bottom_thickness - inner_h;
  translate([0, 0, -z_dim/2 + bottom_thickness])
  cube([channel_width, width - 4, z_dim], center=true);


  translate([0, 0, -box_thickness + bottom_thickness])
  pillinder(bottom_hole_width + 2*lip, inner_d/2, inner_h);
  
  translate([0, 0, -box_thickness - 1])
  pillinder(bottom_hole_width, bottom_hole_d/2, box_thickness+2);
  
  // Hatch negative space
  translate([0,0, -box_thickness]) {
  translate([0,0, bottom_thickness/2])
  cube([channel_width, width - 4, bottom_thickness], center=true);
      
  translate([hatch_dowel_x, hatch_dowel_y, 0])
  cylinder(h=bottom_thickness*2+0.4, d=hatch_dowel_d);
  translate([hatch_dowel_x, -hatch_dowel_y, 0])
  cylinder(h=bottom_thickness*2+0.4, d=hatch_dowel_d);
  translate([-hatch_dowel_x, hatch_dowel_y, 0])
  cylinder(h=bottom_thickness*2+0.4, d=hatch_dowel_d);
  translate([-hatch_dowel_x, -hatch_dowel_y, 0])
  cylinder(h=bottom_thickness*2+0.4, d=hatch_dowel_d);
  }
}
}