
$fn=32;

w = 48.5;
d = 46.2;
h = 66;

wall = 1.4;

difference() {
    cube([w+2*wall, d+2*wall, h+2*wall], center=true);
    
    cube([w,d,h], center=true);

    translate([-w/2,0,h/2])
    rotate([0,45,0])
    translate([0, 0, h/2])
    cube([200, d+10, h], center=true);
    
    translate([0,0, h/2-12])
    rotate([0,90,0])
    cylinder(h=100, d=4, center=true);
    
    translate([0,0, h/2-36])
    rotate([0,90,0])
    cylinder(h=100, d=4, center=true);
}
