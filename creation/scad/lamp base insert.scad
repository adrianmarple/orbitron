$fn=128;

use <utils.scad>

r = 142.4/2;
outer_r = 151/2;
h = 22;
base_h = 2;
wall = 2;

screw_r = 5.2;
nut_r = 8.5;

hole_r = 3;
hole_kerf = 0.1;
roundness = 2;

side_hole_z = 14.5;
side_hole_d = 12;//10.2;

arduino_w = 18;
arduino_l = 21.5;
arduino_pcb = 1.3;

usbc_offset = 2;
usbc_h = 3.4;
usbc_w = 9.3;

//bottom();
intersection() {
insert();
translate([0,r,0])
cube([40, 50, 50], center=true);
}

module bottom() {
  union() {
    linear_extrude(base_h+wall)
    offset(-roundness)
    offset(roundness)
    union() {
      difference() {
        circle(r=r);
        circle(r=r-wall);
      }
      translate([r - hole_r - wall, 0, 0])
      circle(r=hole_r+wall);
      translate([-(r - hole_r - wall), 0, 0])
      circle(r=hole_r+wall);
    }
    cylinder(h=wall, r=r);
    
  // Bottom connection holes
    hole_h = wall+base_h + 3;
    translate([r - hole_r - wall, 0, wall])
    cylinder(h=hole_h, r=hole_r-hole_kerf);
    translate([-(r - hole_r - wall), 0, wall])
    cylinder(h=hole_h, r=hole_r-hole_kerf);
  }
}

module insert() {
difference() {
  union() {
    linear_extrude(h)
    offset(-roundness)
    offset(roundness)
    union() {
      difference() {
        circle(r=r);
        circle(r=r-wall);
      }
      translate([r - hole_r - wall, 0, 0])
      circle(r=hole_r+wall);
      translate([-(r - hole_r - wall), 0, 0])
      circle(r=hole_r+wall);
    }
    cylinder(h=wall, r=r);
    cylinder(h=wall + 4, r=nut_r+wall);
    
  }
  
  // Solder hole
  translate([r/2, 0, 0])
  cylinder(h=h, r=nut_r);
  
  // Bottom connection holes
  translate([r - hole_r - wall, 0, wall])
  cylinder(h=h, r=hole_r);
  translate([-(r - hole_r - wall), 0, wall])
  cylinder(h=h, r=hole_r);
  
  // Nut
  cylinder(h=h, r=screw_r);
  translate([0,0,wall])
  cylinder(h=h, r=nut_r, $fn=6);
  
  // arduino holder gap
  translate([0, r, h/2 + wall])
  cube([arduino_w + 2*wall, arduino_l + wall+10, h], center=true);
  
}

  // arduino holder
  difference() {
    union() {
      translate([-arduino_w/2 - wall, outer_r - usbc_offset - arduino_l - wall, 0])
      cube([arduino_w + 2*wall, arduino_l + 2*wall, side_hole_z]);
       
      translate([0, outer_r - usbc_offset, side_hole_z])
      rotate([-90,0,0])
      cylinder(h=usbc_offset, d=side_hole_d);
    }
    
    difference() {
      cylinder(h=h, r=outer_r + 2);
      cylinder(h=h, r=outer_r);
    }
    
    //arduino itself
    translate([-arduino_w/2, outer_r - usbc_offset - arduino_l, side_hole_z - usbc_h/2 - arduino_pcb])
    cube([arduino_w, arduino_l, 10]);
    
    // back wire
    translate([-2, outer_r - usbc_offset - 1.5*arduino_l, side_hole_z - usbc_h/2 - arduino_pcb])
    cube([4, arduino_l, 10]);
    // pins troughs
    translate([-arduino_w/2, outer_r - usbc_offset - arduino_l, side_hole_z - usbc_h/2 - arduino_pcb - 2])
    cube([3, arduino_l, 10]);
    translate([arduino_w/2-3, outer_r - usbc_offset - arduino_l, side_hole_z - usbc_h/2 - arduino_pcb - 2])
    cube([3, arduino_l, 10]);
    
    //usbc hole
    translate([0, outer_r, side_hole_z])
    rotate([90,0,0])
    pillinder(usbc_w, usbc_h/2, 10);
  }
}