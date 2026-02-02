$fn=128;


r = 142.4/2;
h = 25;
wall = 1.4;

screw_r = 5.2;
nut_r = 8.1;

hole_r = 3;
roundness = 2;

side_hole_z = 14.5;
side_hole_r = 8.5;

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
    cylinder(h=2*wall, r=nut_r+wall);
  }
  
  translate([r - hole_r - wall, 0, wall])
  cylinder(h=h, r=hole_r);
  translate([-(r - hole_r - wall), 0, wall])
  cylinder(h=h, r=hole_r);
  
  cylinder(h=h, r=screw_r);
  translate([0,0,wall])
  cylinder(h=h, r=nut_r, $fn=6);
  
  translate([0, 0, side_hole_z])
  rotate([90,0,0])
  cylinder(h=r, r=side_hole_r);
}