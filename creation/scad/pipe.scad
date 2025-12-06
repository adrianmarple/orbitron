// To be used for both import and standalone

$fn=64;


inner_wall_min = 1;
inner_wall_max = 1.6;
outer_wall = 1.8 + inner_wall_min;
kerf = 0.02;
default_h = 20;
stop_thick = 1.2;

//outer_cuff(8);
//inner_cuff_half(8);
jammer(8);

module outer_cuff(pipe_radius, height=default_h) {
  h = height - stop_thick;
  translate([0,0,stop_thick])
  difference() {
      cylinder(r=pipe_radius + outer_wall, h=h);
      
      cylinder(h=h,
        r1=pipe_radius + inner_wall_min,
        r2=pipe_radius + inner_wall_max);
  }
  difference() {
    cylinder(h=stop_thick, r=pipe_radius + outer_wall);
      
    cylinder(h=stop_thick, r=pipe_radius);
  }
}

module inner_cuff_half(pipe_radius, height=default_h) {
  h = height - stop_thick;
  difference() {
      cylinder(h=h,
        r1=pipe_radius + inner_wall_max,
        r2=pipe_radius + inner_wall_min);
      
      cylinder(r=pipe_radius - kerf, h=h);
      translate([-50,0,-10])
      cube([100,100,100]);
      translate([0,0,h])
      cube([100,100,2], center=true);
  }
}

module jammer(pipe_radius) {
    difference() {
        union() {
            cylinder(h = 20, r=pipe_radius + inner_wall_min - 0.1);
            translate([0,-pipe_radius/2,5])
            cube([50, 6 + pipe_radius, 10], center=true);
        }
        
        translate([0,0,-1])
        cylinder(h = 100, r=pipe_radius + 0.1);
        
        cut_w = pipe_radius * 1.8;
        translate([-cut_w/2,0,-1])
        cube([cut_w, 100, 100]);
    }
}
