# code initially generated via chatGPT

import bpy
import sys
import os

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def import_stl(filepath):
    bpy.ops.wm.stl_import(filepath=filepath)
    return bpy.context.selected_objects[0]

def apply_limited_dissolve(obj, angle_limit=0.087):  # radians (5 degrees default)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.dissolve_limited(angle_limit=angle_limit)
    bpy.ops.object.mode_set(mode='OBJECT')

def export_stl(obj, filepath):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.wm.stl_export(filepath=filepath, export_selected_objects=True)

def main():
    # Get args after '--'
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []

    if len(argv) < 2:
        print("Usage: blender --background --python dissolve_stl.py -- input.stl output.stl")
        return

    input_path = os.path.abspath(argv[0])
    output_path = os.path.abspath(argv[1])

    clear_scene()
    obj = import_stl(input_path)
    apply_limited_dissolve(obj)
    export_stl(obj, output_path)
    print(f"Exported simplified STL to {output_path}")

if __name__ == "__main__":
    main()
