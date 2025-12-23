$fn=6;

r1 = 5.98;
r2 = 9;
r2_p = r2 * sqrt(3) / 2;

big_r1 = 22.4/2;
big_r2 = 14;
big_r2_p = big_r2 * sqrt(3) / 2;

l1 = 20;
l2 = 45;
l3 = 48;

a1 = 35.264389682754654;
a2 = -60;
a3 = -30;

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
        
        translate([0,0,-148])
        rotate([-30,0,0])
        translate([0,8,10])
        cube([r2, 13, 35], center=true);
        
        translate([0,0, -198])
        rotate([90,0,30])
        linear_extrude(4, center=true)
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
            [0, 100],
            [0, 91],
            [big_r2_p + 3, 73],
            [big_r2_p + 3, 50],
            [big_r2_p, 50],
        ]);
    }
} // End for loop
translate([0,0,-133])
//rotate([0,0,30])
union(){
    translate([0,0,-15])
    cylinder(h = 12, r1=big_r2, r2=r2);
    translate([0,0,-65])
    cylinder(h = 50, r=big_r2);
}
} // End union
translate([0,0,-102])
cylinder(h = 10, r=big_r1);
translate([0,0,-148])
cylinder(h = 12, r1=big_r1, r2=r2*0.5, $fn=64);
translate([0,0,-199])
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
        
        l = i == 0 ? l2 : 14;
        rotate([a1, 0, 0])
        translate([0,0,-81.63010851410841])
        translate([0, r2_p, -l1])
        rotate([a2/2, 0, 0]) 
        difference() {      
            rotate([a2/2, 0, 0])    
            translate([0, -r2_p, -l])
            difference() {
                cylinder(h=l, r=r1, $fn=64);
                
                translate([0, r2_p, 0])
                rotate([a3/2, 0, 0]) 
                translate([0, 0, -50])
                cube([100, 100, 100], center=true);
            }
            
            translate([-50, -50, 0])
            cube([100, 100, 100]);
        }
        
        if (i == 0) {
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
        }
    }
} // End for loop

} // End difference