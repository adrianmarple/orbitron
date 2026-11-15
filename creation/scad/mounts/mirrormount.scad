$fn=32;
width = 20;
channel_width = 23.3;
latch_height = 2;
overhang = 0.66;
wall_thickness = 2.8;
box_thickness = 3;
other_thickness = 2.4;

center_offset = 4;
tongue_extension = 0;
mirror_thickness = 3.7;


outer_x = channel_width/2 + 1.2;
lowest_y = -box_thickness - mirror_thickness - other_thickness;

translate([0, 0, -width/2])
linear_extrude(width)
polygon([
[-outer_x, -box_thickness],
[-outer_x, wall_thickness + latch_height],
[-channel_width/2 + overhang, wall_thickness],
[-channel_width/2, wall_thickness],
[-channel_width/2, 0],
[channel_width/2, 0],
[channel_width/2, wall_thickness],
[channel_width/2 - overhang, wall_thickness],
[outer_x, wall_thickness + latch_height],
[outer_x, lowest_y],
[-outer_x-tongue_extension, lowest_y],
[-outer_x-tongue_extension, lowest_y + other_thickness],
[center_offset, lowest_y + other_thickness],
[center_offset, -box_thickness],
]);
