$fn = 128; // smoothness

vertex();
// pipe_holder_cuff();

main_vertex = [1, 1, 4.2360679775];
u = main_vertex / norm(main_vertex);
e_y = [0,1,0];
e_z = [0,0,1];

adjacent_verticies = [
  [1, -1, 4.2360679775],
  [-1, 1, 4.2360679775],
  [0, 2.61803398875, 3.61803398875],
  [2.61803398875, 1.61803398875, 3.2360679775],
];


gap = 0.5;
wall_thickness = 1.6;
spur_offset = 16.666;
spur_height = 2;

MIRROR = 1; // 1;

socket_radius = 21; // For 1.25" schedule 40 PVC pipe
pipe_holder_depth = 12;
pipe_holder_thickness = 3;

cube_dims = [10, 6, 31];
female_dims = [
  cube_dims[0] - 2*wall_thickness,
  cube_dims[1] - wall_thickness,
  18
];
male_dims = female_dims - gap*[2,1,1];

center_length = 2*cube_dims[2] * norm(main_vertex) / norm(adjacent_verticies[0] - main_vertex);
echo(center_length);


module pipe_holder_cuff() {
  difference() {
    // cylinder(r=socket_radius + 2*pipe_holder_thickness, h=pipe_holder_depth/2 + pipe_holder_thickness - 1);
    cylinder(r=socket_radius + 2*pipe_holder_thickness, h=pipe_holder_depth + pipe_holder_thickness - 1);

    cylinder(r=socket_radius+0.5, h=100);

    translate([0, 0, pipe_holder_thickness])
    cylinder(r=socket_radius + pipe_holder_thickness + 1, h=100);
  }
}

module vertex() {
  // suppor_pillar();

  a = -atan2(sqrt(2), main_vertex[2]);
  mirror([MIRROR,0,0])
  rotate(v=[1,-1,0], a=a)
  difference() {
    union() {
      edges();
//      square_support();
    }

    edges_negative();
  }

/*
  module suppor_pillar() {
    difference() {
      translate([0,0,5])
      cylinder(r=cube_dims[0] / 2, h=center_length);

      translate([0,0,center_length])
      sphere(r=102); // 4 inches
    }
  }
*/
  
  module square_support() {
    square_length = cube_dims[2] - cube_dims[0]/2;

    translate([-cube_dims[2], -cube_dims[2], -1]) {
      difference() {
        union() {
          translate([0, 0, -pipe_holder_depth])
          cylinder(r=socket_radius + pipe_holder_thickness , h=3/2*pipe_holder_depth + cube_dims[1]);
          cube([square_length, square_length, cube_dims[1]]);
        }

        translate([0, 0, -pipe_holder_depth - 1]) {
          cylinder(r=socket_radius, h=100);

          translate([-100 + 0.5, -100, 0])
          cube([100, 200, 100]);

          translate([-100, -100 + 0.5, 0])
          cube([200, 100, 100]);
        }
      }
    }
  }

  module edges() {
    for(i = [0:3]) {
      v = adjacent_verticies[i];
      e = (v - main_vertex) / 2;
      
      
      xy = [e[0], e[1], 0];
      a0 = acos((xy * e_y) / norm(xy)) * (e[0] < 0 ? 1:-1);
      
      c = cross(e_z, e);
      a1 = asin(norm(c));
      
      o_p1 = u - (u * e) * e;
      o_p2 = e_z - (e_z * e) * e;
      a2 = acos((o_p1 * o_p2) / norm(o_p1) / norm(o_p2)) * (e[0] < 0 ? -1:1);
      
      rotate(v=c, a=a1)
      rotate(v=[0,0,1], a=a2 + a0 + 180) {
        edge(i%2 == MIRROR);
      }
    }
  }
  
  module edge(male) {
    if (male) {
      union() {
        body();
        
        translate([
            -male_dims[0]/2,
            cube_dims[1] - male_dims[1],
            cube_dims[2]
        ]) {
          cube(male_dims);
        }
      }
    } else {
      difference() {
        body();
        
        translate([
            -female_dims[0]/2,
            cube_dims[1] - female_dims[1],
            cube_dims[2] - female_dims[2]
        ]) {
          cube(female_dims);
        }
      }
    }
    
    module body() {
      translate([-cube_dims[0]/2, 0, 0]) {
        cube(cube_dims);
      }
      // translate([0, cube_dims[1], cube_dims[2] - spur_offset]) {
      //   translate([-cube_dims[0]/2, 0, 0]) {
      //     cube([wall_thickness, spur_height, wall_thickness]);
      //   }
      //   translate([cube_dims[0]/2 - wall_thickness, 0, 0]) {
      //     cube([wall_thickness, spur_height, wall_thickness]);
      //   }
      // }
    }
  }
  
  module edges_negative() {
    for(v = adjacent_verticies) {
      e = (v - main_vertex) / 2;
      
      
      xy = [e[0], e[1], 0];
      a0 = acos((xy * e_y) / norm(xy)) * (e[0] < 0 ? 1:-1);
      
      c = cross(e_z, e);
      a1 = asin(norm(c));
      
      o_p1 = u - (u * e) * e;
      o_p2 = e_z - (e_z * e) * e;
      a2 = acos((o_p1 * o_p2) / norm(o_p1) / norm(o_p2)) * (e[0] < 0 ? -1:1);
      
      rotate(v=c, a=a1)
      rotate(v=[0,0,1], a=a2 + a0 + 180)
      translate([-cube_dims[0]/2, -cube_dims[1], 0]) {
        cube(cube_dims);
      }
    }
  }
}
