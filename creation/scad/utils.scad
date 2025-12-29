
module pillinder(width, radius, height) {
  hull() {
    translate([width/2 - radius, 0, 0])
    cylinder(h=height, r=radius, $fn=64);
    translate([-width/2 + radius, 0, 0])
    cylinder(h=height, r=radius, $fn=64);
  }
}
