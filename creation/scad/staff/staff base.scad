$fn=6;

use <../utils.scad>

r1 = 5.98;
r2 = 9;
r2_p = r2 * sqrt(3) / 2;

big_r1 = 22.5/2;
big_r2 = 14;
big_r2_p = big_r2 * sqrt(3) / 2;

l1 = 30;
l2 = 45;
l3 = 50;

a1 = 35.264389682754654;
a2 = -60;
a3 = -45;


battery_r = 27.35/2;
battery_power_z_offset = 16.1;
battery_power_r = 12/2;

power_connection_h = 30;
power_connection_r = 18;
power_top_thin = 1.6;
power_top_total = 1.6;

battery_sleeve_h = 73.5;
battery_sleeve_r = battery_r + 1.6;

usb_h = 15;
usb_w = 12.1;
usb_thick = 4.6;
usb_w2 = 13.2;
usb_thick2 = 6.8;
usb_y_offset = battery_r - 11;
usb_wire_w = 4.5;


power_female_r = power_connection_r + 2;

box_w = power_connection_r * 2 + 1;
box_thick = 18;
box_h = 90;
box_wall = 2;
seeed_h = 30;

//power();
//controller();
seeed_sled();

module seeed_sled() {
    rotate([90,0,0])
    difference() {
        cube([power_connection_r * 2 + box_wall, box_thick, seeed_h]);
    
        translate([1.2, box_thick/2 - 3.6, -1])
        cube([21.2, box_thick, 32]);
        
        
        translate([10, box_thick/2 - 3.6, seeed_h/2 + 7])
        cube([40, box_thick, 20]);
        translate([10, box_thick/2 - 3.6, seeed_h/2 - 27])
        cube([40, box_thick, 20]);
        
        translate([-1, box_thick/2, 21])
        rotate([0,90,0])
        pillinder(9.5, 1.8, 10);
    }
}

module power() {
difference() {
    union() {
        translate([0,0,power_connection_h - battery_sleeve_h])
        cylinder(h=battery_sleeve_h, r=battery_sleeve_r, $fn=64);
        
        cylinder(h=power_connection_h + power_top_total, r=power_connection_r);
    translate([0, usb_y_offset+.5, power_connection_h + usb_h/2 + 0.5])
    cube([usb_w2+4, usb_thick2+1, usb_h+1], center=true);
    }
    
    // Power indicator
    translate([0,0,power_connection_h - battery_power_z_offset])
    rotate([-90,0,0])
    cylinder(h=100, r=battery_power_r, $fn=64);
    
    translate([0, usb_y_offset, power_connection_h])
    cube([usb_w, usb_thick, usb_h], center=true);
    translate([0, usb_y_offset, power_connection_h + (power_top_thin + usb_h)/2])
    cube([usb_w2, usb_thick2, usb_h - power_top_thin], center=true);
    translate([0, usb_y_offset, power_connection_h + usb_h])
    cube([usb_wire_w, usb_thick2, 5], center=true);
    translate([0, usb_y_offset - usb_thick2/2, power_connection_h + usb_h])
    cube([usb_w2, usb_thick2, 5], center=true);
    
    translate([0,0,power_connection_h - battery_sleeve_h-1])
    cylinder(h=battery_sleeve_h+1, r=battery_r, $fn=64);
}

difference() {
    translate([0,0,0])
    cylinder(h=power_connection_h, r=battery_r+0.6, $fn=64);
    
    translate([0,0,-1])
    cylinder(h=power_connection_h+1, r=battery_r, $fn=64);
}

}

module controller() {
difference() {
    union() {
        cylinder(h=power_connection_h + power_top_total + 2, r=power_female_r);
        translate([0,0,power_connection_h + power_top_total + 2])
        cylinder(h=30, r1=power_female_r, r2=1);
        
        // Actual box
        translate([0, 0, power_connection_h + power_top_total +box_h/2])
        rotate([90,0,0])
        linear_extrude(box_thick+2*box_wall, center=true)
        polygon([
            [0, -box_h/2 - 20],
            [-box_w/2 - box_wall, -box_h/2 - box_wall],
            [-box_w/2 - box_wall, box_h/2 + box_wall],
            [0, box_h/2 + 20],
            [box_w/2 + box_wall, box_h/2 + box_wall],
            [box_w/2 + box_wall, -box_h/2 - box_wall],
        ]);
        //cube([box_w+2*box_wall, box_thick+2*box_wall, box_h+2*box_wall], center=true);
        
        translate([0,0,power_connection_h + power_top_total + box_h-36])
        cylinder(h = 30, r1=1, r2=big_r2);
        translate([0,0,power_connection_h + power_top_total + box_h-6])
        cylinder(h = 56, r=big_r2);
        
        
        translate([0,0, power_connection_h - 16])
        rotate([90,0,0])
        linear_extrude(5, center=true)
        union() {
        polygon([
            [0, -15],
            [30, 10],
            [30, 47],
            [14, 47],
            [14, 77],
            [30, 77],
            [30, 115],
            [0, 140],
        ]);
        rotate([0,180,0])
        polygon([
            [0, -15],
            [30, 10],
            [30, 47],
            [14, 47],
            [14, 77],
            [30, 77],
            [30, 115],
            [0, 140],
        ]);
        }
    }// end union
    
    cylinder(h=power_connection_h + power_top_total, r=power_connection_r + 0.08);
    
    translate([0, 0, power_connection_h + power_top_total + box_h/2])
    cube([power_connection_r*2, box_thick, box_h], center=true);
    
    // Power indicator
    translate([0,0,power_connection_h - battery_power_z_offset])
    rotate([-90,0,0])
    cylinder(h=100, r=battery_power_r, $fn=64);
    
    translate([0,0,power_connection_h + power_top_total + box_h])
    cylinder(h = 51, r=big_r1, $fn=64);
    
    translate([0, 0, -50])
    cube([100, 100, 100], center=true);
    
    
    // Entrance for seeed sled
    translate([-20, 0, 76])
    cube([10, box_thick, 30], center=true);
    
    // Hole to be able to poke seeed sled out
    translate([15, 0, 76])
    rotate([0,90,0])
    cylinder(h = 10, r=3, $fn=64);
    
    // Deboss
    for (i = [0:1]) {
        rotate([0,0,180*i])
        translate([0, -box_thick/2 - box_wall + 0.6, 76])
        rotate([90,0,0])
        linear_extrude(1)
        scale(0.4)
        import("../ravenstear.svg", center=true);
    }
    
    // Removal for "test"
    //translate([0, 0, 212])
    //cube([100,100,400], center=true);
}
}
