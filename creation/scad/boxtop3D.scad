$fn=32;

thickness = 0.4;

MM_TO_DPI = 2.83464566929;
SCALE = 0.096 * MM_TO_DPI;
svg_file = "/Users/adrianmarple/Dropbox/LumatronManufacturing/qr.svg";

//scale([60/54, 60/54, 1])
union() {
  translate([-27,-27,0])
  scale([0.999, 0.999, 1])
  scale([MM_TO_DPI, MM_TO_DPI, 1])
  linear_extrude(height = thickness)
  import("qrframe.svg");

  translate([-24,-24,thickness])
  scale([SCALE, SCALE, 1])
  linear_extrude(height = 0.2)
  import(svg_file);
}
