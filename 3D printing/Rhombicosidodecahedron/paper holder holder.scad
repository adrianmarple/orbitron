$fn = 128; // smoothness

pipe_radius = 21.5;

intersection() {
  difference() {

    rotate(a=30, v=[0,0,1])
    cylinder(r1=pipe_radius + 61, r2=pipe_radius+81, h=20, $fn=3);

    cylinder(r=pipe_radius, h=100);

    slit();

    rotate(a=120, v=[0,0,1])
    slit();
    rotate(a=-120, v=[0,0,1])
    slit();
  }

  cylinder(r=pipe_radius + 52, h=100);
}
  

module slit() {
  translate([0, 31, 3.5])
  rotate(a=45, v=[1,0,0])
  translate([-52, 0, 0])
  cube([104, 100, 3.5]);
}