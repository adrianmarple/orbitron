$fn=6;


big_r1 = 16.2/2;
big_r2 = 12;
column_offset = 35;
column_h = 80;
billboard_h = 60;
billboard_thickness = 11;
billboard_y = -column_offset * 0.557 - 10;

insert_h = 10;
insert_strut_w = 16;
insert_strut_thick = 3;

//main();
//translate([0,0,63])
insert();
//translate([0,billboard_y+0.5,90])
//rotate([90,0,0])
//instructions();

module instructions() {
    difference() {
        cube([60, 40, 1], center=true);
        
        translate([0, -20, 0])
        cube([insert_strut_w, 2*insert_strut_thick, 2], center=true);
    }
    linear_extrude(0.9) {
        translate([0, 10])
        text("Scan to", halign="center", valign="center", size=10);
        translate([0, -6])
        text("Play", halign="center", valign="center", size=10);
    }
}


module insert() {
    cylinder(h=insert_h+7, r=(-billboard_y-billboard_thickness) / 0.866 - 0.1);
    for (i = [0:2]) {
        rotate([0,0, 120*i + 60])
        union() {
            translate([-insert_strut_w/2,0,insert_h-insert_strut_thick])
            cube([insert_strut_w,-billboard_y+1,insert_strut_thick]);
            
            translate([-insert_strut_w/2,-billboard_y-2,insert_h])
            cube([insert_strut_w, 1, 4]);
            translate([-insert_strut_w/2,-billboard_y,insert_h])
            cube([insert_strut_w, 1, 4]);
        }
    }
}

module main() {
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
} // End main