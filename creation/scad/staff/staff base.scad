$fn=6;

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

//power();
controller();

module seeed_holder() {
    // TODO
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
            [30, 48],
            [24, 48],
            [24, 76],
            [30, 76],
            [30, 115],
            [0, 140],
        ]);
        rotate([0,180,0])
        polygon([
            [0, -15],
            [30, 10],
            [30, 48],
            [14, 48],
            [14, 76],
            [30, 76],
            [30, 115],
            [0, 140],
        ]);
        }
    }// end union
    
    cylinder(h=power_connection_h + power_top_total, r=power_connection_r + 0.8);
    
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
    
    // Deboss
    for (i = [0:1]) {
        rotate([0,0,180*i])
        translate([0, -box_thick/2 - box_wall + 0.6, 76.3])
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
