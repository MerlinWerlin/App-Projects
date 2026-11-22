"""Import this app's generated GLB into an editable Blender file and inspect clip custody."""
import bpy
import json
import math
from pathlib import Path
from mathutils import Vector

root = Path(__file__).resolve().parent.parent
asset_dir = root / 'assets' / 'character'
source = asset_dir / 'mochi-motion-proof.glb'
destination = asset_dir / 'mochi-motion-proof.blend'
assert source.is_file() and destination.parent == asset_dir
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
names = {a.name for a in bpy.data.actions}
tracks = {track.name for obj in bpy.data.objects if obj.animation_data for track in obj.animation_data.nla_tracks}
required = ['Nap_to_ready', 'Chips_to_ready', 'Idle', 'Greeting', 'Listening', 'Speaking']
assert all(any(r in n for n in names | tracks) for r in required), sorted(names | tracks)
paws = [obj.name for obj in bpy.data.objects if obj.name in ['paw_fore_left','paw_fore_right','paw_hind_left','paw_hind_right']]
assert len(paws) == 4, paws
# An inspection camera and studio lights make the source file useful to an artist.
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = 720
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100
scene.render.fps = 30
scene.world.color = (.16,.14,.12)
bpy.ops.object.camera_add(location=(.1,1.35,4.5))
camera = bpy.context.object
camera.name = 'InspectionCamera'
camera.rotation_euler = (Vector((0,1.25,0))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.lens = 52
scene.camera = camera
for name, location, energy, size, color in [
    ('Key',(-3,4,4),450,4,(1,.87,.72)),
    ('Fill',(3,2,3),200,3,(.82,.9,1)),
    ('Rim',(1,4,-3),400,3,(1,.78,.54)),
]:
    bpy.ops.object.light_add(type='AREA',location=location)
    light=bpy.context.object
    light.name=name
    light.data.energy=energy
    light.data.shape='DISK'
    light.data.size=size
    light.data.color=color
    light.rotation_euler=(Vector((0,1.2,0))-light.location).to_track_quat('-Z','Y').to_euler()
scene.frame_set(1)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(destination), compress=True)
result={'result':'passed','paws':paws,'clipFamilies':required,'actionCount':len(names),'nlaTrackCount':len(tracks),'blenderVersion':bpy.app.version_string,'note':'Editable import verified. This is the first motion rig, not final production art.'}
(asset_dir/'blender-verification.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print('MEOW_BLENDER_PROOF '+json.dumps(result))
