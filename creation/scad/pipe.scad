// To be use for both import and standalone

$fn=64;


inner_wall_min = 1;
inner_wall_max = 1.6;
outer_wall = 1.8 + inner_wall_min;
kerf = 0.02;
default_h = 20;

//outer_cuff(8);
//inner_cuff_half(8);

module outer_cuff(pipe_radius, height=default_h) {
  difference() {
      cylinder(r=pipe_radius + outer_wall, h=height);
      
      cylinder(h=height,
        r1=pipe_radius + inner_wall_min,
        r2=pipe_radius + inner_wall_max);
  }
}

module inner_cuff_half(pipe_radius, height=default_h) {
  difference() {
      cylinder(h=height,
        r1=pipe_radius + inner_wall_max,
        r2=pipe_radius + inner_wall_min);
      
      cylinder(r=pipe_radius - kerf, h=height);
      translate([-50,0,-10])
      cube([100,100,100]);
      translate([0,0,height])
      cube([100,100,1], center=true);
  }
}
    