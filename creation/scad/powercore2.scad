
$fn=64;

module column() {
    translate([0, 0, -99.6])
    //translate([0,0,-82.3])
    difference() {
//        cylinder(h=32 + 99.6 - 82.3, r=7.5);
        cylinder(h=46 + 99.6 - 82.3, r=8.2);
        translate([0,0,-1])
        cylinder(h=100, r=6.7);
    }
}

module column_ring() {
    union() {
        rotate([-26.5650512,0,0])
        column();
        rotate([26.5650512,0,0])
        column();
        rotate([180 - 26.5650512,0,0])
        column();
        rotate([180 + 26.5650512,0,0])
        column();
    }
}
module column_ring_() {
    union() {
        _column_ring();
        rotate([90,0,0])
        _column_ring();
    }
}

  module wedge(angle, width, thickness, skew) {
      M = [[1, 0, 0, 0],
           [-skew, 1, 0, 0],
           [0, 0, 1, 0],
           [0, 0, 0, 1]];
      x = angle < 0 ? thickness : 0;
      y = -tan(angle) * thickness * (angle < 0 ? 1 : -1);
      rotate(a=-90, v=[0,0,1])
      multmatrix(M)
      rotate(a=-90, v=[0,1,0])
      linear_extrude(width, center=true)
      polygon([[0,0], [thickness, 0], [x, y]]);
  }

  module pcb_clip(height, width, inset, pcb_thickness, clip_thickness, notch_height) {
    union() {
      translate([0,0,height/2])
      cube([width, clip_thickness, height], center=true);
        
      translate([-width/2, -clip_thickness/2,height])
      cube([width, clip_thickness/2-inset, pcb_thickness + notch_height]);
        
      translate([0, -inset, height+pcb_thickness])
      rotate(a=90, v=[0,0,1])
      wedge(30, width, notch_height, 0);
    }
  }


is_top = false;

  
rotate(a=is_top ? 0 : 180, v=[1, 0, 0])
union() {
difference() {
    
sphere(41, $fn=25);

//rotate([0,45,0])
union() {
    column_ring();
    rotate([0,0,90])
    rotate([0,90,0])
    column_ring();
    rotate([0,90,0])
    rotate([0,0,90])
    column_ring();
}

//rotate([0,45,0])
rotate([0,0,90])
rotate([-90 + 26.5650512,0,0])
translate([0,0,-82.3])
cylinder(h=80, r=6.8);


//rotate([0,45,0])
rotate([0,0,45])
rotate([0,56.5,0])
translate([0,0,-50])
cube([15, 9, 100], center=true);

translate([-100,-100,is_top ? -100 : 0])
cube([200, 200, 100]);

cylinder(h=20, r=35, center=true);

}

if (!is_top)
translate([5,15,-10])
union() {
  translate([0,-30,0])
  pcb_clip(5, 10, 0.2, 1.6, 4, 1);
  rotate(a=180, v=[0,0,1])
  pcb_clip(5, 10, 0.2, 1.6, 4, 1);
}
};
