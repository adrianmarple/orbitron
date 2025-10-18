$fn=6;


big_r1 = 16.2/2;
big_r2 = 12;
h = 50;
strut_a = 30;

difference() {
union() {
    
    rotate([90,0,-30])
    translate([0,0,-10])
    cylinder(h = h+10, r=big_r2);
    
    rotate([90,0,30])
    translate([0,0,-10])
    cylinder(h = h+10, r=big_r2);
    
    
    translate([0,-3,0])
    rotate([90-strut_a,0,0])
    cylinder(h = h, r=big_r2);

} // End union

rotate([30, 0, 0])
translate([-20, 0, -20])
cube([40, 40, 40]);
rotate([-30, 0, 0])
translate([-20, 0, -20])
cube([40, 40, 40]);
translate([-20, 0, -20])
cube([40, 40, 40]);

rotate([90,0,-30])
translate([0,0,14])
cylinder(h = h, r=big_r1, $fn=64);
    
rotate([90,0,30])
translate([0,0,14])
cylinder(h = h, r=big_r1, $fn=64);


translate([0,-3,0])
rotate([90-strut_a,0,0])
translate([0,0,20])
cylinder(h = h, r=big_r1, $fn=64);
} // End difference