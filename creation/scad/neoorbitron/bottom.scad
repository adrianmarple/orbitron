$fn=6;

big_r1 = 16.2/2;
big_r2 = 12;
column_offset = 35;
column_h = 130;
base_h = 90;
base_r = column_offset + big_r2;
base_r_p = base_r * sqrt(3) / 2;

wall = 3;
strut_a = 45;
strut_z = 28;
vert_pipe_offset = 45;
power_bank_w = 80.8;
power_bank_thick = 28.8;
power_bank_y = 20;
power_bank_z = 28;
notch_r = 5;
notch_inset = 7;
kerf = 1.3;

usb_complex_y = 19;
usb_complex_w = 35+2*wall;
usb_x = 5.2;
usb_y = 28.3;
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
// translate([0,-25,0])
// translate([0,75,-20])
// cube([36,100,100], center=true);
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
            
            translate([0,column_offset, strut_z])
            rotate([-90 - strut_a, 0, 0])
            rotate([0,0,30])
            cylinder(h=26, r=big_r2);
        }
    } // End for loop

rotate([0,0,30])
cylinder(h = base_h, r=base_r);
} // End union


// Power bank
bank_r1 = 13;
bank_r2 = 5;
x = power_bank_thick/2 - bank_r1;
y = power_bank_w/2 - bank_r1;
echo(x);
bank_fn = 32;
translate([0, power_bank_y-power_bank_w/2, power_bank_z + bank_r2])
minkowski() {
    hull() {
        translate([x,y,0])
        cylinder(h=100, r=bank_r1-bank_r2, $fn=bank_fn);
        translate([-x,y,0])
        cylinder(h=100, r=bank_r1-bank_r2, $fn=bank_fn);
        translate([-x,-y,0])
        cylinder(h=100, r=bank_r1-bank_r2, $fn=bank_fn);
        translate([x,-y,0])
        cylinder(h=100, r=bank_r1-bank_r2, $fn=bank_fn);
    }
    sphere(r=bank_r2, $fn=bank_fn);
}
// Notch to view battery %
notch_y = -column_offset-big_r1 -notch_r + notch_inset;
translate([0,notch_y, -2])
cylinder(h = 100, r=notch_r, $fn=64);
translate([0,notch_y - 10, 0])
cube([2*notch_r, 20, 100], center=true);

// Extra hole for wire
rotate([0,0, 120])
translate([0,column_offset, strut_z])
cylinder(h = 100, r=big_r1-2, $fn=64);

for (i = [0:2]) {
    rotate([0,0, 120*i])
    union() {
        
        translate([0, column_offset, vert_pipe_offset])
        cylinder(h = 100, r=big_r1, $fn=64);
        
        translate([0, column_offset, strut_z])
        rotate([-90 - strut_a, 0, 0])
        rotate([0,0,30])
        translate([0,0,-5])
        cylinder(h = 100, r=big_r1, $fn=64);
    }
}

// Insert cavity
intersection() {
    translate([0, 0, -1])
    rotate([0,0,30])
    cylinder(h = base_h, r=column_offset + big_r2 - wall);

    union() {
        translate([-20, -usb_complex_y, -1])
        cube([30, usb_complex_w, power_bank_z+0.2+1]);

        translate([-38, -21, -1])
        cube([20, 36, vert_pipe_offset-wall+1]);

        translate([-38, -8, -1])
        cube([20, 36, base_h - wall+1]);
    }
}

// Deboss
for (i = [0:1]) {
    rotate([0,0,180*i + 90])
    translate([0, -base_r_p + 0.6, 50])
    rotate([90,0,0])
    linear_extrude(1)
    scale(0.4)
    import("../ravenstear.svg", center=true);
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

        translate([-38, -21+kerf, 0])
        cube([20, 49-2*kerf, vert_pipe_offset-wall]);
    }
}

translate([-21, -usb_complex_y+wall, wall])
cube([21 - usb_x + usb_thick2/2,  usb_complex_w - 2*wall, power_bank_z - wall - usb_top_wall]);

// usb hole
translate([-usb_x+usb_hole_extra, power_bank_y - usb_y, power_bank_z])
cube([usb_thick + usb_hole_extra, usb_w, 10], center=true);

intersection() {
    rotate([0,0,30])
    cylinder(h = base_h, r=column_offset + big_r2 - 2*wall - kerf);

    translate([-38, -21+wall+kerf, wall])
    cube([20-wall, 49-2*(wall+kerf), vert_pipe_offset]);
}

rotate([0,0, 120])
translate([0, column_offset, strut_z])
rotate([-90 - strut_a, 0, 0])
rotate([0,0,30])
translate([0,0,-5])
cylinder(h = 100, r=big_r1+0.4, $fn=64);
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