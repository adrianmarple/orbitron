$fn=64;


d0 = 6.6;
d1 = 9.5;
d2 = 20;
h1 = 4;
h2 = 16;

difference() {
  union() {
    cylinder(h=h2, d=d1);
    cylinder(h=h1, d=d2, $fn=6);
  }

  cylinder(h=h2, d=d0);
}
