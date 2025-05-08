$fn=32;


port_width = 9.2;
port_length = 10.6;
port_radius = 1.6;

pcb_width = 9.1;
pcb_thickness = 1;
pcb_cover_length = 1;

wall_thickness = 2; //1.8; //2;
latch_overhang = 0.6;
latch_height = 2;
latch_gap = 0.5;
latch_width = 1.2;

sleeve_width = port_width + 1.2;
sleeve_thickness = port_radius * 2 + 2;

top_gap = 1;
top_thickness = 2;
top_border = 3;
top_width = port_width + top_border + 4;
top_radius = port_radius + top_border;


outer_x = sleeve_width/2 + latch_gap + latch_width;
outer_y = port_length - top_thickness - top_gap + pcb_cover_length;

echo(outer_x*2);
echo(sleeve_thickness);

module pillinder(width, radius, height) {
  hull() {
    translate([width/2 - radius, 0, 0])
    cylinder(h=height, r=radius);
    translate([-width/2 + radius, 0, 0])
    cylinder(h=height, r=radius);
  }
}
    

difference() {
union() {
  rotate([90,0,0])
  translate([0, 0, -sleeve_thickness/2])
  linear_extrude(sleeve_thickness)
  polygon([
    [-outer_x, 0],
    [-outer_x, wall_thickness],
    [-outer_x - latch_overhang, wall_thickness],
    [-outer_x + latch_width, wall_thickness + latch_height],
    [-outer_x + latch_width, 0],
    [-sleeve_width/2, 0],
    [-sleeve_width/2, outer_y],
    [sleeve_width/2, outer_y],
    [sleeve_width/2, 0],
    [outer_x - latch_width, 0],
    [outer_x - latch_width, wall_thickness + latch_height],
    [outer_x + latch_overhang, wall_thickness],
    [outer_x, wall_thickness],
    [outer_x, 0],
  ]);

  translate([0,0,-top_thickness])
  pillinder(top_width, top_radius, top_thickness);
}

  translate([0, 0, port_length -top_thickness -top_gap + pcb_cover_length/2+1])
  cube([pcb_width, pcb_thickness, pcb_cover_length+2], center=true);


  translate([0, 0, -top_thickness -top_gap])
  pillinder(port_width, port_radius, port_length);
}
