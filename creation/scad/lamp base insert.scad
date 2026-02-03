$fn=128;


r = 142.4/2;
h = 25;
base_h = 2;
wall = 2;

screw_r = 5.2;
nut_r = 8.5;

hole_r = 3;
hole_kerf = 0.1;
roundness = 2;

side_hole_z = 14.5;
side_hole_r = 8.5;

bottom();

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
  
  // Side hole
  translate([0, 0, side_hole_z])
  rotate([90,0,0])
  cylinder(h=r, r=side_hole_r);
}
}