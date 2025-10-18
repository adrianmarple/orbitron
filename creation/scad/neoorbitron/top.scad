$fn=6;

r1 = 8.2 - 0.02;
r2 = r1+3;
r2_p = r2 * sqrt(3) / 2;

big_r1 = 16.2/2;
big_r2 = 12;
big_r2_p = big_r2 * sqrt(3) / 2;
column_offset = 35;

d = 160.2154203133267;
l1 = 30;
l2a = 110;
l2b = 60;
l3 = 50;

a1 = 25.56144583679776;
a2 = -52;
a3 = -45;

difference() {
union() {
for (i = [0:2:5]) {
    l2 = i%2==0 ? l2a : l2b;
    rotate([0,0, 60*i])
    union() {
        rotate([a1, 0, 0])
        translate([0,0,-d])
        translate([0,0,-l1])
        difference() {
            cylinder(h=l1, r=r2);
                          
            translate([0, r2_p, 0])
            rotate([a2/2, 0, 0]) 
            translate([0, 0, -50])
            cube([100, 100, 100], center=true);
        }
        
        rotate([a1, 0, 0])
        translate([0,0,-d])
        translate([0, r2_p, -l1])
        rotate([a2/2, 0, 0]) 
        difference() {
            rotate([a2/2, 0, 0])    
            translate([0, -r2_p, -l2])
            difference() {
                cylinder(h=l2, r=r2);
                            
                translate([0, r2_p, 0])
                rotate([a3/2, 0, 0]) 
                translate([0, 0, -50])
                cube([100, 100, 100], center=true);
            }
            
            translate([-50, -50, 0])
            cube([100, 100, 100]);
        }
        
        rotate([a1, 0, 0])
        translate([0,0,-d])
        translate([0, r2_p, -l1])
        rotate([a2, 0, 0])
        translate([0, 0, -l2])
        rotate([a3/2, 0, 0]) 
        difference() {
            rotate([a3/2, 0, 0])    
            translate([0, -r2_p, -l3])
            cylinder(h=l3, r=r2);

            translate([-50, -50, 0])
            cube([100, 100, 100]);
        }
        

        translate([0,0,-275])
        translate([0,15,0])
        cube([r2, 30, 40], center=true);
        
        side_column_h = 66;
        if (i%2 == 0) {
            translate([0,column_offset,-230])
            union(){
                translate([0,0,-65+side_column_h])
                cylinder(h = 10, r1=big_r2, r2=r2-3);
                translate([0,0,-65])
                cylinder(h = side_column_h, r=big_r2);
            }
        }
    }
} // End for loop
middle_column_h = 85;
translate([0, 0,-230])
union(){
    translate([0,0,middle_column_h-65])
    cylinder(h = 16, r1=big_r2+6, r2=r2-1);
    translate([0,0,-65])
    cylinder(h = middle_column_h, r=big_r2+6);
}
} // End union

// cube([200, 200, 550], center=true);

for (i = [0:2:5]) {
    l2 = i%2==0 ? l2a : l2b;
    rotate([0,0, 60*i])
    union() {

        translate([0,column_offset,-300])
        cylinder(h = 43, r=big_r1, $fn=64);

        rotate([a1, 0, 0])
        translate([0,0,-d])
        translate([0,0,-l1])
        difference() {            
            cylinder(h=l1 + 1, r=r1, $fn=64);
              
            translate([0, r2_p, 0])
            rotate([a2/2, 0, 0]) 
            translate([0, 0, -50])
            cube([100, 100, 100], center=true);
        }
        
        if (i == 0) {
            rotate([a1, 0, 0])
            translate([0,0,-d])
            translate([0, r2_p, -l1])
            rotate([a2/2, 0, 0]) 
            difference() {      
                rotate([a2/2, 0, 0])    
                translate([0, -r2_p, -l2-1])
                difference() {
                    cylinder(h=l2+1, r=r1, $fn=64);
                    
                    translate([0, r2_p, 0])
                    rotate([a3/2, 0, 0]) 
                    translate([0, 0, -50])
                    cube([100, 100, 100], center=true);
                }
                
                translate([-50, -50, 0])
                cube([100, 100, 100]);
            }
        }
    }
} // End for loop

} // End difference