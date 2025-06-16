
card_thickness = 2.4;
embossing_h = 0.2;

scale([1.111, 1.111, 1])
union() {
    translate([0, 75, 0])
    linear_extrude(card_thickness + embossing_h)
    scale(0.33)
    import("./ravenstear.svg", center=true);
    
    translate([0, 28, 0])
    linear_extrude(card_thickness + embossing_h)
    scale(0.22)
    import("./linkqr.svg", center=true);
            
    linear_extrude(card_thickness)
    scale(0.8)
    union() {
    polygon([
        //[0, -15],
        [0, -10],
        [6, -10], 
        [30, 10],
        [30, 64],
        [24, 64],
        [24, 80],
        [30, 80],
        [30, 105],
        [6, 125],
        [0, 125],
        //[0, 140],
    ]);
    rotate([0,180,0])
    polygon([
        //[0, -15],
        [0, -10],
        [6, -10], 
        [30, 10],
        [30, 64],
        [24, 64],
        [24, 80],
        [30, 80],
        [30, 105],
        [6, 125],
        [0, 125],
    ]);
    }
}