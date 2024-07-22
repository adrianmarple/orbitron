$fn=32;
angle = 60;
channel_width = 13;
overhang = 8;
width = 10;
thickness = 2;
wall_thickness = 2;
box_thickness = 10;
bottom_thickness = 3.4;
screw_hole_radius = 2.3;

difference() {
  union() {
    difference() {
      union() {
        positive1();
        rotate(a=angle, axis=[0,0,1])
        mirror([0,1,0])
        positive1();
      }
      negative1();
      rotate(a=angle, axis=[0,0,1])
      mirror([0,1,0])
      negative1();
    }
    positive2();
    rotate(a=angle, axis=[0,0,1])
    mirror([0,1,0])
    positive2();
  }
  negative2();
  rotate(a=angle, axis=[0,0,1])
  mirror([0,1,0])
  negative2();

  y = (overhang + wall_thickness + channel_width/2 - thickness/2);
  x = y * tan(angle);
  translate([x, y, -1])
  cylinder(h=thickness+2, r=screw_hole_radius);
}


module positive1() {
  translate([-width,0,0])
  cube([100, overhang + wall_thickness + channel_width, box_thickness + bottom_thickness + thickness]);
}

module negative1() {
  translate([-100, overhang + wall_thickness, thickness])
  cube([300, 100, box_thickness]);

  translate([-100, thickness, box_thickness])
  cube([300, 100, bottom_thickness]);

  translate([-100, overhang, box_thickness])
  cube([300, 100, 100]);
}

module positive2() {
  translate([-width, overhang + wall_thickness, 0])
  cube([thickness, channel_width, box_thickness]);

  translate([-width, overhang + wall_thickness + channel_width - thickness, 0])
  cube([100, thickness, box_thickness]);
}

module negative2() {
  translate([-100, overhang + wall_thickness + channel_width, -1])
  cube([300, 100, box_thickness + 2]);
}