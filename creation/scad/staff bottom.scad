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


power_female_r = power_connection_r + 1.4;

box_w = power_connection_r * 2 + 1;
box_thick = 18;
box_h = 90;
box_wall = 2;

power();
//controller();

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
            [24, 48],
            [24, 76],
            [30, 76],
            [30, 115],
            [0, 140],
        ]);
        }
    }// end union
    
    cylinder(h=power_connection_h + power_top_total, r=power_connection_r + 0.15);
    
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
        translate([0, -box_thick/2 - box_wall + 0.6, 70])
        rotate([90,0,0])
        linear_extrude(1)
        scale(0.4)
        import("./ravenstear.svg", center=true);
    }
    
    // Removal for "test"
    //translate([0, 0, 220])
    //cube([100,100,400], center=true);
}
}
    
module tossme() {
difference() {
union() {
for (i = [0:2]) {
    rotate([0,0, 120*i])
    union() {
        rotate([a1, 0, 0])
        translate([0,0,-81.63010851410841])
        translate([0,0,-l1])
        difference() {
            cylinder(h=l1, r=r2);
            
//            cylinder(h=l1 + 1, r=r1, $fn=64);
              
            translate([0, r2_p, 0])
            rotate([a2/2, 0, 0]) 
            translate([0, 0, -50])
            cube([100, 100, 100], center=true);
        }
        
        rotate([a1, 0, 0])
        translate([0,0,-81.63010851410841])
        translate([0, r2_p, -l1])
        rotate([a2/2, 0, 0]) 
        difference() {
            rotate([a2/2, 0, 0])    
            translate([0, -r2_p, -l2])
            difference() {
                cylinder(h=l2, r=r2);
            
 //               cylinder(h=l2, r=r1, $fn=64);
                
                translate([0, r2_p, 0])
                rotate([a3/2, 0, 0]) 
                translate([0, 0, -50])
                cube([100, 100, 100], center=true);
            }
            
            translate([-50, -50, 0])
            cube([100, 100, 100]);
        }
        
        rotate([a1, 0, 0])
        translate([0,0,-81.63010851410841])
        translate([0, r2_p, -l1])
        rotate([a2, 0, 0])
        translate([0, 0, -l2])
        rotate([a3/2, 0, 0]) 
        difference() {
            rotate([a3/2, 0, 0])    
            translate([0, -r2_p, -l3])
            cylinder(h=l3, r=r2);
            
  //          rotate([a3/2, 0, 0])    
  //          translate([0, -r2_p, -l3-1])
  //          cylinder(h=l3+1, r=r1, $fn=64);
            
            translate([-50, -50, 0])
            cube([100, 100, 100]);
        }
        
        translate([0,0,-150])
        rotate([-30,0,0])
        translate([0,7,10])
        cube([r2, 16, 35], center=true);
        
        translate([0,0, -195])
        rotate([90,0,30])
        linear_extrude(3, center=true)
        polygon([
            [big_r2_p, 0],
            [big_r2_p + 7, 0],
            [big_r2_p + 7, 12],
            [big_r2_p + 10, 12],
            [big_r2_p + 10, 25],
            [big_r2_p + 7, 25],
            [big_r2_p + 7, 42],
            [big_r2_p + 10, 42],
            [big_r2_p + 10, 75],
            [0, 90],
            [0, 80],
            [big_r2_p + 3, 70],
            [big_r2_p + 3, 50],
            [big_r2_p, 50],
        ]);
    }
} // End for loop
translate([0,0,-130])
//rotate([0,0,30])
union(){
    translate([0,0,-15])
    cylinder(h = 12, r1=big_r2, r2=r2);
    translate([0,0,-65])
    cylinder(h = 50, r=big_r2);
}
} // End union
translate([0,0,-108])
cylinder(h = 10, r=big_r1);
translate([0,0,-145])
cylinder(h = 12, r1=big_r1, r2=r2*0.5, $fn=64);
translate([0,0,-196])
cylinder(h = 51.01, r=big_r1, $fn=64);

//translate([0,0, -150])
//cube([200, 200, 100], center=true);

//cube([200, 200, 370], center=true);

for (i = [0:2]) {
    rotate([0,0, 120*i])
    union() {
        rotate([a1, 0, 0])
        translate([0,0,-81.63010851410841])
        translate([0,0,-l1])
        difference() {            
            cylinder(h=l1 + 1, r=r1, $fn=64);
              
            translate([0, r2_p, 0])
            rotate([a2/2, 0, 0]) 
            translate([0, 0, -50])
            cube([100, 100, 100], center=true);
        }
        
        rotate([a1, 0, 0])
        translate([0,0,-81.63010851410841])
        translate([0, r2_p, -l1])
        rotate([a2/2, 0, 0]) 
        difference() {      
            rotate([a2/2, 0, 0])    
            translate([0, -r2_p, -l2])
            difference() {
                cylinder(h=l2, r=r1, $fn=64);
                
                translate([0, r2_p, 0])
                rotate([a3/2, 0, 0]) 
                translate([0, 0, -50])
                cube([100, 100, 100], center=true);
            }
            
            translate([-50, -50, 0])
            cube([100, 100, 100]);
        }
        
        rotate([a1, 0, 0])
        translate([0,0,-81.63010851410841])
        translate([0, r2_p, -l1])
        rotate([a2, 0, 0])
        translate([0, 0, -l2])
        rotate([a3/2, 0, 0]) 
        difference() {
            rotate([a3/2, 0, 0])    
            translate([0, -r2_p, -l3-1])
            cylinder(h=l3+1, r=r1, $fn=64);
            
            translate([-50, -50, 0])
            cube([100, 100, 100]);
        }
        
        translate([0,7,-165])
        cube([4, 16, 36], center=true);
    }
} // End for loop

} // End difference
}