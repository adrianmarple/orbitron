$fn=32;


usbc_width = 9.05; // 9.1
usbc_thickness = 1;
usbc_pcb_length = 5.6;

pad_length = 2.2;

holder_thickness = 2.4;
holder_length = 2;

pcb_thickness = 1.6;

long = false;

pcb_width = long ? 14 : 13;
pcb_length = long ? 5.4 : 2.2;

th = 1; 

difference() {
union() {
    translate([-usbc_width/2 - th,  -th, 0])
    cube([usbc_width + 2*th, holder_thickness + 2*th, holder_length]);
    
    translate([-pcb_width/2 - th, -pcb_thickness - th, 0])
    cube([pcb_width + 2*th, pcb_thickness + 2*th, pcb_length]);
    
    translate([-usbc_width/2 - th, -th + (holder_thickness - usbc_thickness)/2, 0])
    cube([usbc_width + 2*th, usbc_thickness + 2*th, usbc_pcb_length]);
}

    translate([-usbc_width/2, 0, 0])
    cube([usbc_width, holder_thickness, holder_length]);
    
    translate([-pcb_width/2, -pcb_thickness, 0])
    cube([pcb_width, pcb_thickness, pcb_length + 10]);

    echo(usbc_pcb_length - pad_length);
    translate([-usbc_width/2, (holder_thickness - usbc_thickness)/2, 0])
    cube([usbc_width, usbc_thickness, usbc_pcb_length]);
    translate([-usbc_width/2, -pcb_thickness - th, usbc_pcb_length - pad_length])
    cube([usbc_width, (usbc_thickness+holder_thickness)/2 + pcb_thickness + th, usbc_pcb_length + 10]);
}
