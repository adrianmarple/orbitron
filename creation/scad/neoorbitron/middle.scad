$fn=6;


big_r1 = 16.2/2;
big_r2 = 12;
column_offset = 35;
column_h = 80;
billboard_h = 60;
billboard_thickness = 11;
billboard_y = -column_offset * 0.557 - 10;

difference() {
union() {
for (i = [0:2]) {
    rotate([0,0, 120*i])
    union() {
        
        translate([0, billboard_y, column_h/2])
        rotate([-90,0,0])
        scale([1.1,1.1,1])
        linear_extrude(height = billboard_thickness)
        import("../qrframe.svg", center=true, dpi=25.4);

        // translate([0,billboard_y, column_h/2])
        // cube([column_offset*2, billboard_thickness, billboard_h], center=true);
        
        translate([0,column_offset,0])
        cylinder(h = column_h, r=big_r2);
    }
} // End for loop
} // End union

// cube([200, 200, 550], center=true);

for (i = [0:2]) {
    rotate([0,0, 120*i])
    union() {
        translate([0, billboard_y - 0.1, column_h/2])
        rotate([-90,0,0])
        linear_extrude(height = 1)
        import("../qrframe.svg", center=true, dpi=25.4);
        
        translate([0,column_offset,-1])
        cylinder(h = 100, r=big_r1, $fn=64);
    }
}

} // End difference