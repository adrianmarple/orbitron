$fn=64;
width = 30;
channel_width = 22.3;
latch_height = 2;
overhang = 4;
inner_h = 2.6*2 + 15.1 + 0.2;
thickness = 1.3;

outer_x = channel_width/2 + thickness;

difference() {
  linear_extrude(width, center=true)
  polygon([
    [-outer_x, -thickness],
    [-outer_x, inner_h + thickness],
    [-channel_width/2 + overhang - thickness, inner_h + thickness],
    [-channel_width/2 + overhang, inner_h],
    [-channel_width/2, inner_h],
    [-channel_width/2, 0],
    [channel_width/2, 0],
    [channel_width/2, inner_h],
    [channel_width/2 - overhang, inner_h],
    [channel_width/2 - overhang + thickness, inner_h + thickness],
    [outer_x, inner_h + thickness],
    [outer_x, -thickness],
  ]);

  translate([0,1,0])
  rotate([-90,0,0])
  cylinder(h=100, r=channel_width/2);
}
