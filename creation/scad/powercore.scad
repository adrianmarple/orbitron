
$fn=64;

module column() {
    translate([0, 0, -99.6])
    //translate([0,0,-82.3])
    difference() {
        cylinder(h=32 + 99.6 - 82.3, r=7.5);
        translate([0,0,-1])
        cylinder(h=100, r=6);
    }
}

module column_ring() {
    union() {
        rotate([-26.5650512,0,0])
        column();
        rotate([26.5650512,0,0])
        column();
        rotate([90 - 26.5650512,0,0])
        column();
        rotate([90 + 26.5650512,0,0])
        column();
        rotate([180 - 26.5650512,0,0])
        column();
        rotate([180 + 26.5650512,0,0])
        column();
        rotate([270 - 26.5650512,0,0])
        column();
        rotate([270 + 26.5650512,0,0])
        column();
    }
}

module power_bank(dims, corner_radius) {
    hull() {
        translate([dims[0]/2 - corner_radius, dims[1]/2 - corner_radius, 0])
        cylinder(h=dims[2], r=corner_radius, center=true);
        translate([-dims[0]/2 + corner_radius, dims[1]/2 - corner_radius, 0])
        cylinder(h=dims[2], r=corner_radius, center=true);
        translate([-dims[0]/2 + corner_radius, -dims[1]/2 + corner_radius, 0])
        cylinder(h=dims[2], r=corner_radius, center=true);
        translate([dims[0]/2 - corner_radius, -dims[1]/2 + corner_radius, 0])
        cylinder(h=dims[2], r=corner_radius, center=true);
    }
}

is_top = true;

rotate(a=is_top ? 0 : 180, v=[1, 0, 0])
difference() {
    
sphere(55, $fn=256);

rotate(a=45, v=[0,1,0])
union() {
    column_ring();
    rotate([0,90,0])
    column_ring();
    rotate([0,0,90])
    column_ring();
}

rotate(a=45, v=[0,1,0])
rotate([0,0,90])
rotate([270 - 26.5650512,0,0])
translate([0,0,-82.3])
cylinder(h=80, r=6.1);

translate([-100,-100,is_top ? -100 : 0])
cube([200, 200, 100]);

mirror([0,1,0])
translate([0,0,2])
union() {
    translate([-2,0,0])
    rotate(a=90, v=[0,1,0])
    power_bank([68.5, 67.2, 27.8], 8);
    
    translate([-10, 0, -10])
    cube([28, 48, 12]);
    translate([-6, 0, -2])
    difference() {
        cube([10, 49, 23.8]);
        
        translate([0, 0, 10])
        rotate(a=5, v=[1,0,0])
        translate([0, 49, -10])
        cube([10, 10, 24]);
    }
    translate([-4, 30, -23.5])
    cube([8, 100, 12]);
}

translate([19,0,2])
cube([16, 45, 68], center=true);
translate([25,0,5])
cube([30, 40, 40], center=true);

translate([0, 0, -100])
cylinder(h=100, r=6);
translate([14, 0, -32])
cube([26, 6, 8], center=true);

}
