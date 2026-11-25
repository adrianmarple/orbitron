$fn=6;

use <../utils.scad>

// Params than need calibrating
power_top = 2.5;
pcb_cavity_y = 7.5;
pcb_cavity_y_offset = 0.3;
usb_f_thick = 2.8;
usb_f_w = 12.2;
pcb_usb_y_offset = 0.2 + usb_f_thick/2;

r1 = 5.98;
r2 = 9;
r2_p = r2 * sqrt(3) / 2;

big_r1 = 22.5/2;
big_r2 = 15;
big_r2_p = big_r2 * sqrt(3) / 2;


pcb_length = 21.5;
pcb_width = 21;

battery_r = 27.4/2;
battery_power_z_offset = 16.1;
battery_power_r = 12/2;

power_connection_h = 30;
power_connection_r = 18;

battery_sleeve_h = 73.5;
battery_sleeve_r = battery_r + 1.6;



box_w = power_connection_r * 2 + 1;
box_thick = 36;
box_h = pcb_length + 0.3;
box_wall = 2;
chamf = 2;

power_r = (box_thick/2 - chamf) * 2 / sqrt(3);
pipe_z = power_connection_h + power_top + pcb_length;
pipe_l = 44;

//power();
controller();


module controller() {
    
difference() {
    union() {
        // Battery
        cylinder(h=power_connection_h + power_top + 2, r=power_r);
        
        translate([0,0,power_connection_h - battery_sleeve_h])
        cylinder(h=battery_sleeve_h, r=battery_sleeve_r, $fn=64);
        
        // Pipe
        cylinder(h = pipe_l+pipe_z, r=big_r2);
        
        
        
        // Actual box
        
        translate([0, 0, power_connection_h + power_top +box_h/2 + 2])
        rotate([90,0,0])
        rotate([0,0,30]) {
            cylinder(h=box_thick-2*chamf, d=box_w * 1.2, center=true);
            translate([0,0,box_thick/2 - chamf])
            cylinder(h=chamf, d1=box_w * 1.2, d2 = box_w*1.1);
            translate([0,0,-box_thick/2])
            cylinder(h=chamf, d2=box_w * 1.2, d1 = box_w*1.1);
        }
        
        
        translate([0,0, power_connection_h - 15.5])
        rotate([90,0,0])
        linear_extrude(6, center=true)
        union() {
        polygon([
            [0, -15],
            [24, 10],
            [24, 24],
            [14, 24],
            [14, 36],
            [24, 36],
            [24, 50],
            [0, 75],
        ]);
        rotate([0,180,0])
        polygon([
            [0, -15],
            [24, 10],
            [24, 24],
            [14, 24],
            [14, 36],
            [24, 36],
            [24, 50],
            [0, 75],
        ]);
        }
        
    }// end union
    
    
    // Power indicator
    translate([0,0,power_connection_h - battery_power_z_offset])
    rotate([-90,0,0])
    cylinder(h=100, r=battery_power_r, $fn=64);
    
    // Battery
    translate([0,0,power_connection_h - battery_sleeve_h-1])
    cylinder(h=battery_sleeve_h+1, r=battery_r, $fn=64);
        
    // PCB cavity
    translate([0, pcb_cavity_y_offset, power_connection_h + power_top + box_h/2+1])
    cube([pcb_width + 0.3, pcb_cavity_y, pcb_length+2], center=true);
    
    intersection() {
        translate([0,0,pipe_z-6])
        cylinder(h = 6.01, r1=big_r1 - 0.7, r2=big_r1, $fn=64);
        
        translate([0, pcb_cavity_y_offset, pipe_z-3])
        cube([pcb_width + 10, pcb_cavity_y, 7], center=true);
    }
    
    // USB hole
    translate([0, pcb_usb_y_offset, power_connection_h-1])
    cube([usb_f_w, usb_f_thick, 10], center=true);
    
    
    // Pipe
    translate([0,0,pipe_z])
    cylinder(h = 100, r=big_r1, $fn=64);
    
    
    // Deboss
    for (i = [0:1]) {
        rotate([0,0,180*i])
        translate([0, -box_thick/2 + 0.6, power_connection_h + power_top +box_h/2 + 2])
        rotate([90,0,0])
        linear_extrude(1)
        scale(0.3333)
        import("../ravenstear.svg", center=true);
    }
    
    //translate([-50, 0, -100])
    //cube([100,20,300]);
    
    // Removal for "test"
    //translate([0, 0, 212])
    //cube([100,100,400], center=true);
}
    
// Power window cover
difference() {
    translate([0,0,0])
    cylinder(h=power_connection_h, r=battery_r+0.6, $fn=64);
    
    translate([0,0,-1])
    cylinder(h=power_connection_h+2, r=battery_r, $fn=64);
}
}
