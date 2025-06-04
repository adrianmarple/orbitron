$fn=32;
  
hole_radius = 0.7;
pitch = 2.54;

difference() {
  union() {
    translate([0,0,1])
    cube([30,65,3], center=true);
      
    translate([11.5,29,0])
    union() {
      cylinder(h=6.050000000000001, r=2.5);
      cylinder(h=9.05, r=1.33);
    }
    translate([11.5,-29,0])
    union() {
      cylinder(h=6.050000000000001, r=2.5);
      cylinder(h=9.05, r=1.33);
    }
    translate([-11.5,29,0])
    union() {
      cylinder(h=6.050000000000001, r=2.5);
      cylinder(h=9.05, r=1.33);
    }
    translate([-11.5,-29,0])
    union() {
      cylinder(h=6.050000000000001, r=2.5);
      cylinder(h=9.05, r=1.33);
    }
  }
  
  indicies = [1,2,5,8];

  translate([-11.5 - pitch/2,29 - 5,0])
  union() {
    for (i=[0:len(indicies) - 1]) {
      translate([0, -pitch * indicies[i], -1])
      cylinder(h=5, r=hole_radius);
    }
  }
  translate([-11.5 + pitch/2,29 - 5,0])
  union() {
    for (i=[0:9]) {
//      translate([0, -pitch*i, -1])
//      cylinder(h=5, r=hole_radius);
    }
  }
}