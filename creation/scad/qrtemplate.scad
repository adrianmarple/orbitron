$fn=32;

thickness = 0.4;

SCALE = 0.096;
svg_file = "/Users/adrianmarple/Dropbox/LumatronManufacturing/qr.svg";

//scale([60/54, 60/54, 1])
union() {
  translate([-27,-27,0])
  scale([0.999, 0.999, 1])
  linear_extrude(height = thickness)
  import("qrframe.svg", dpi=25.4);

  translate([-24,-24,thickness])
  scale([SCALE, SCALE, 1])
  linear_extrude(height = 0.2)
  import(svg_file, dpi=25.4);
}
