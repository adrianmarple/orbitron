# Run via:
# /Applications/Blender.app/Contents/MacOS/Blender --background --python cubecloud.py

import bpy # type: ignore
import random
import math
from mathutils import Vector, Euler # type: ignore

# Settings
num_cubes = 100
sphere_radius = 5
cube_min_size = 0.3
cube_max_size = 0.5
output_path = "default.stl"  # Change to your desired path

# Delete all existing objects
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def random_point_in_sphere(radius):
    # Using rejection sampling for uniform distribution
    while True:
        x, y, z = [random.uniform(-radius, radius) for _ in range(3)]
        if x*x + y*y + z*z <= radius*radius:
            return Vector((x, y, z))

# Create cubes
for i in range(num_cubes):
    size = random.uniform(cube_min_size, cube_max_size)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    cube = bpy.context.active_object
    cube.scale = (size, size, size)
    cube.location = random_point_in_sphere(sphere_radius)
    cube.rotation_euler = Euler((random.uniform(0, math.pi),
                                 random.uniform(0, math.pi),
                                 random.uniform(0, math.pi)), 'XYZ')

# Join all cubes into one mesh
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.context.scene.objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]
bpy.ops.object.join()

# Export as STL
bpy.ops.wm.stl_export(filepath=output_path, export_selected_objects=True)
print(f"Exported to: {output_path}")
