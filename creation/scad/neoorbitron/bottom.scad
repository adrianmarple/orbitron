$fn=6;

use <../roundedcube.scad>;


big_r1 = 16.2/2;
big_r2 = 12;
column_offset = 35;
column_h = 120;
base_h = 80;
wall = 2;
strut_a = 30;
vert_pipe_offset = 36;
power_bank_w = 80.8;
power_bank_thick = 28.8;
power_bank_y = 20;
power_bank_z = 28;
kerf = 0.1;

usb_complex_y = 17;
usb_complex_w = 35+2*wall;
usb_x = 3.6;
usb_y = 27.5;
usb_w = 12.1;
usb_thick = 4.6;
usb_hole_extra = 1.2;

usb_top_wall = 0.6;
usb_h = 15.4;
usb_w2 = 15;
usb_thick2 = 9;
usb_wire_w = 9.4;

intersection() {
main();
translate([0,-24,0])
cube([36,100,100], center=true);
}
// insert();

module main() {
difference() {
union() {
    for (i = [0:2]) {
        rotate([0,0, 120*i])
        union() {
            translate([0,column_offset,0])
            rotate([0,0,30])
            cylinder(h = column_h, r=big_r2);
            
            translate([0,column_offset, 26])
            rotate([-90 - strut_a, 0, 0])
            rotate([0,0,30])
            cylinder(h=30, r=big_r2);
        }
    } // End for loop

rotate([0,0,30])
cylinder(h = base_h, r=column_offset + big_r2);
} // End union

// TODO:
// - holes for wire + usb-a mount

// Power bank
difference() {
    translate([0, power_bank_y, power_bank_z-1])
    scale([1,1,0.5])
    translate([-power_bank_thick/2,-power_bank_w,0])
    roundedcube([power_bank_thick,power_bank_w,300], radius=12, $fn=16);

    cube([100,100,2*power_bank_z], center=true);
}

rotate([0,0, 120])
translate([0,column_offset, 2])
cylinder(h = 100, r=big_r1-2, $fn=64);

for (i = [0:2]) {
    rotate([0,0, 120*i])
    union() {
        
        translate([0, column_offset, vert_pipe_offset])
        cylinder(h = 100, r=big_r1, $fn=64);
        
        translate([0, column_offset, 26])
        rotate([-90 - strut_a, 0, 0])
        rotate([0,0,30])
        translate([0,0,-5])
        cylinder(h = 100, r=big_r1, $fn=64);
    }
}


intersection() {
    translate([0, 0, -1])
    rotate([0,0,30])
    cylinder(h = base_h, r=column_offset + big_r2 - wall);

    union() {
        translate([-20, -usb_complex_y, -1])
        cube([30, usb_complex_w, power_bank_z+0.2+1]);

        translate([-38, -28, -1])
        cube([20, 36, vert_pipe_offset-wall+1]);

        translate([-38, -8, -1])
        cube([20, 36, base_h - wall+1]);
    }
}
} // End difference
}

module insert() {
difference() {
intersection() {
    rotate([0,0,30])
    cylinder(h = base_h, r=column_offset + big_r2 - wall - kerf);

    union() {
        translate([-20, -usb_complex_y, 0])
        cube([30, usb_complex_w, power_bank_z+0.2]);

        // translate([-38, -28, 0])
        // cube([20, 56, vert_pipe_offset-wall]);
    }
}

translate([-21, -usb_complex_y+wall, wall])
cube([21 - usb_x + usb_thick2/2,  usb_complex_w - 2*wall, power_bank_z - wall - usb_top_wall]);

// usb hole
translate([-usb_x+usb_hole_extra, power_bank_y - usb_y, power_bank_z])
cube([usb_thick + usb_hole_extra, usb_w, 10], center=true);

intersection() {
    rotate([0,0,30])
    cylinder(h = base_h, r=column_offset + big_r2 - 2*wall);

    translate([-38, -28+wall, wall])
    cube([20-wall, 56-2*wall, vert_pipe_offset]);
}

rotate([0,0, 120])
translate([0, column_offset, 26])
rotate([-90 - strut_a, 0, 0])
rotate([0,0,30])
translate([0,0,-5])
cylinder(h = 100, r=big_r1, $fn=64);
}

//usb-holder
translate([-usb_x, power_bank_y - usb_y, power_bank_z - usb_top_wall])
difference() {
    translate([0, 0, -power_bank_z/2 + usb_top_wall])
    cube([usb_thick2, usb_w2+2*wall, power_bank_z - usb_top_wall*2], center=true);

    translate([0, 0, -usb_h/2])
    cube([usb_thick2, usb_w2, usb_h], center=true);

    translate([-usb_thick2/2, usb_w2/2-5, -usb_h])
    cube([usb_thick2, 10, usb_wire_w]);
    
    translate([-usb_thick2/2, 0, -power_bank_z])
    cube([8, 100, 40], center=true);
}
}