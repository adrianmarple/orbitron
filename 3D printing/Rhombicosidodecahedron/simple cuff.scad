$fn = 128; // smoothness

pipe_radius = 21.5;

difference() {
  cylinder(r=pipe_radius + 3, h=16);

  cylinder(r=pipe_radius, h=100);
}
