$fn=32;
  
hole_radius = 0.7;
pitch = 2.54;

union() {
difference() {
  cube([40,20,5]);
    
  translate([6,4.2, 1])
  cube([29,11.6,10]);
    
  translate([0,4.7, 3])
  cube([6,10.6,10]);
    
  translate([0,-1, 3.5])
  cube([20,30,10]);
  
  translate([2,10 - pitch*3/2,0])
  union() {
    for (i=[0:3]) {
      translate([0, pitch*i, -1])
      cylinder(h=5, r=hole_radius);
    }
  }
}

translate([5,0,0])
cube([10,20,2]);
}