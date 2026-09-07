"""Run inside Blender (MCP execute_blender_code or Blender Text Editor).
Creates an isolated scene; never replaces the currently open project file.
"""
import bpy
import math
import json
import struct
import random
from pathlib import Path
from mathutils import Vector

ROOT = Path(globals().get('MO_PROJECT_ROOT', '/Users/owenkdev/Projects/Mo'))
OUT = ROOT / 'assets/characters/mochi'
OUT.mkdir(parents=True, exist_ok=True)
scene = bpy.data.scenes.new('Mochi • Storybook')
bpy.context.window.scene = scene
scene.render.fps = 30
scene.world = bpy.data.worlds.new('Mochi studio world')
scene.world.color = (0.3, 0.3, 0.3)

def material(name, color, roughness=0.85, emission=0):
    m = bpy.data.materials.new('Mochi_' + name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Roughness'].default_value = roughness
    if emission:
        bs.inputs['Emission Color'].default_value = (*color, 1)
        bs.inputs['Emission Strength'].default_value = emission
    return m

cream = material('rice white', (0.98, 0.965, 0.92))
ink = material('warm ink', (0.033, 0.022, 0.028))
pink = material('rose cheeks', (0.98, 0.22, 0.28))
green = material('sage leaf', (0.30, 0.52, 0.28))
gold = material('honey lantern', (1, 0.62, 0.16), emission=0.35)

# Round glutinous-rice dumpling: continuously curved shoulders and lower sides.
profile=[(0.008,0.01),(0.012,0.31),(0.025,0.43),(0.065,0.50),(0.15,0.58),(0.28,0.64),(0.44,0.67),(0.60,0.65),(0.77,0.60),(0.92,0.49),(1.03,0.34),(1.10,0.15),(1.12,0.01)]
def face_y(x,z):
    for (za,ra),(zb,rb) in zip(profile,profile[1:]):
        if za<=z<=zb:
            r=ra+(rb-ra)*(z-za)/max(0.00001,zb-za)
            return -0.85*r*math.sqrt(max(0.001,1-(abs(x)/r)**2))-0.012
    return -0.48

def face_point(x,z): return (x,face_y(x,z),z)

armdata = bpy.data.armatures.new('MochiRig')
rig = bpy.data.objects.new('MochiRig', armdata)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bones = {}
def bone(name, head, parent=None):
    b = armdata.edit_bones.new(name)
    b.head = head
    b.tail = Vector(head) + Vector((0, 0, 0.15))
    if parent: b.parent = bones[parent]
    bones[name] = b
bone('root', (0, 0, 0))
bone('body', (0, 0, 0), 'root')
for name, pos in {
    'eye.L':face_point(-0.16,0.49), 'eye.R':face_point(0.26,0.49),
    'brow.L':face_point(-0.16,0.68), 'brow.R':face_point(0.26,0.68),
    'mouth':face_point(0.05,0.36), 'mouth.O':face_point(0.05,0.36),
    'hand.L':(-0.60,-0.10,0.26), 'hand.R':(0.60,-0.10,0.26),
    'curl':(-0.03,0,1.10), 'socket_item':(0.66,-0.40,0.48),
    'sparkle.L':(-0.85,0,0.9), 'sparkle.R':(0.85,0,1.15),
    'sleep':(0.55,0,1.3),
}.items(): bone(name, pos, 'body' if not name.startswith(('sparkle','sleep')) else 'root')
bpy.ops.object.mode_set(mode='OBJECT')
parts = []
def bind(obj, name, mat, joint='body'):
    obj.name = 'Mochi_' + name
    obj.data.materials.append(mat)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    group = obj.vertex_groups.new(name=joint)
    group.add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
    mod = obj.modifiers.new('Mochi skin', 'ARMATURE'); mod.object = rig
    obj.parent = rig
    for p in obj.data.polygons: p.use_smooth = True
    parts.append(obj)
    return obj

def ball(name, pos, scale, mat=cream, joint='body', rotation=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, location=pos)
    o = bpy.context.object; o.scale = scale
    if rotation: o.rotation_euler = rotation
    return bind(o, name, mat, joint)

def stroke(name, points, radius=0.018, mat=ink, joint='body'):
    c = bpy.data.curves.new(name, 'CURVE'); c.dimensions='3D'; c.bevel_depth=radius; c.bevel_resolution=3; c.use_fill_caps=True
    s = c.splines.new('BEZIER'); s.bezier_points.add(len(points)-1)
    for p, co in zip(s.bezier_points,points): p.co=co; p.handle_left_type='AUTO'; p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c); scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active=o
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    return bind(bpy.context.object,name,mat,joint)

verts=[]; faces=[]; N=48
for z,r in profile:
    for i in range(N):
        a=2*math.pi*i/N
        co,si=math.cos(a),math.sin(a)
        verts.append((r*co,r*0.85*si,z))
for j in range(len(profile)-1):
    for i in range(N):
        k=j*N+i; n=j*N+(i+1)%N
        faces.append((k,n,n+N,k+N))
faces += [tuple(reversed(range(N))),tuple((len(profile)-1)*N+i for i in range(N))]
me=bpy.data.meshes.new('rice cake surface'); me.from_pydata(verts,[],faces); me.update()
o=bpy.data.objects.new('Body',me); scene.collection.objects.link(o)
sub=o.modifiers.new('Soft silhouette','SUBSURF'); sub.levels=2
bpy.context.view_layer.objects.active=o; bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
bpy.ops.object.modifier_apply(modifier=sub.name)
bind(o,'Body',cream)
blush=material('watercolor blush',(1,1,1))
vc=blush.node_tree.nodes.new('ShaderNodeVertexColor'); vc.layer_name='Blush'
blush.node_tree.links.new(vc.outputs['Color'],blush.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
for side,x in [('L',-0.16),('R',0.26)]:
    ball('Eye.'+side,face_point(x,0.49),(0.041,0.015,0.044),ink,'eye.'+side,(0,0.28 if side=='L' else -0.28,0))
    coords=[(x-0.072,0.72),(x,0.695),(x+0.065,0.675)] if side=='L' else [(x-0.065,0.675),(x,0.695),(x+0.072,0.72)]
    stroke('Brow.'+side,[face_point(px,pz) for px,pz in coords],0.010,ink,'brow.'+side)
    # Flush, subtly mottled square blush instead of protruding round cheek beads.
    cx=-0.34 if side=='L' else 0.43; cz=0.38; size=0.105; steps=8
    cv=[]; cf=[]
    for j in range(steps+1):
        for i in range(steps+1):
            px=cx+size*(i/steps-0.5); pz=cz+size*(j/steps-0.5)
            cv.append((px,face_y(px,pz)-0.003,pz))
    for j in range(steps):
        for i in range(steps):
            k=j*(steps+1)+i; cf.append((k,k+1,k+steps+2,k+steps+1))
    cm=bpy.data.meshes.new('Square blush '+side); cm.from_pydata(cv,[],cf); cm.update()
    colors=cm.color_attributes.new(name='Blush',type='FLOAT_COLOR',domain='CORNER')
    rng=random.Random(31 if side=='L' else 47)
    for poly in cm.polygons:
        fade=rng.uniform(0.0,0.35)
        for li in poly.loop_indices: colors.data[li].color=(0.96,0.29+fade,0.37+fade*0.8,1)
    cheek=bpy.data.objects.new('Square blush '+side,cm); scene.collection.objects.link(cheek)
    bind(cheek,'Cheek.'+side,blush)
stroke('V smile',[face_point(0.005,0.37),face_point(0.05,0.337),face_point(0.095,0.37)],0.010,ink,'mouth')
ball('Surprise mouth',face_point(0.05,0.36),(0.032,0.012,0.041),ink,'mouth.O')
ball('Hand.L',(-0.60,-0.10,0.26),(0.070,0.080,0.092),cream,'hand.L',(0,-0.45,0))
ball('Hand.R',(0.61,-0.10,0.26),(0.085,0.065,0.055),cream,'hand.R',(0,0.25,0))
stroke('Tiny hand crease',[(-0.624,-0.17,0.305),(-0.641,-0.183,0.25),(-0.614,-0.17,0.23)],0.006,ink,'hand.L')
stroke('Curled sprout',[(-0.03,0,1.10),(-0.09,0,1.175),(-0.085,0,1.30),(-0.02,0,1.375),(0.065,0,1.38),(0.115,0,1.335),(0.102,0,1.298),(0.043,0,1.30)],0.014,ink,'curl')
ball('Lantern',(0.66,-0.40,0.51),(0.12,0.1,0.16),gold,'socket_item')
stroke('Lantern handle',[(0.58,-0.4,0.62),(0.58,-0.4,0.74),(0.74,-0.4,0.74),(0.74,-0.4,0.62)],0.014,ink,'socket_item')

def star(name,x,z,joint):
    points=[]
    for i in range(9):
        a=math.pi/2+i*math.pi/4; r=0.14 if i%2==0 else 0.045
        points.append((x+math.cos(a)*r,-0.05,z+math.sin(a)*r))
    stroke(name,points,0.018,gold,joint)
star('Twinkle.L',-0.85,0.9,'sparkle.L'); star('Twinkle.R',0.85,1.15,'sparkle.R')
stroke('Sleep Z',[(0.48,-0.02,1.40),(0.62,-0.02,1.40),(0.48,-0.02,1.26),(0.62,-0.02,1.26)],0.018,green,'sleep')

CLIPS={'idle':2.4,'run':0.6,'attack':0.6,'use_item':1.2,'sleepy':3.2,'jump':0.5,'double_jump':0.6,'fall':0.8,'land':0.3,'hit':0.2,'damage':0.7,'happy':1.4,'dead':0.9}
rig.animation_data_create()
hidden=['mouth.O','socket_item','sparkle.L','sparkle.R','sleep']
def pose(t,d,name):
    p=rig.pose.bones; u=t/d; wave=math.sin(u*math.tau); pulse=math.sin(u*math.pi)
    for b in p:
        b.location=(0,0,0); b.rotation_mode='XYZ'; b.rotation_euler=(0,0,0); b.scale=(1,1,1)
    for n in hidden: p[n].scale=(0.001,)*3
    # Bone local Y points upward in Blender, local Z points toward camera.
    def squash(x,y): p['body'].scale=(x,y,1/math.sqrt(x*y))
    def lift(y): p['body'].location.y=y
    def eyes(y):
        for n in ['eye.L','eye.R']: p[n].scale.y=y
    if name=='idle':
        squash(1.055-0.018*wave,0.94+0.025*wave)
        eyes(0.12 if 0.73<u<0.79 else 1)
        p['curl'].rotation_euler.z=wave*0.08
    elif name=='run':
        squash(1+0.07*wave,1-0.07*wave); lift(abs(wave)*0.09)
        p['body'].rotation_euler.z=-0.08
        p['hand.L'].rotation_euler.z=wave*0.4; p['hand.R'].rotation_euler.z=-wave*0.4
    elif name=='attack':
        wind=math.sin(min(u/0.32,1)*math.pi/2) if u<0.32 else max(0,1-(u-0.32)/0.68)
        squash(1+0.20*pulse,1-0.15*pulse)
        p['body'].rotation_euler.z=0.18*wind if u<0.32 else -0.3*wind
        p['body'].location.x=0.19*pulse if u>0.32 else -0.1*wind
        for n in ['brow.L','brow.R']: p[n].scale=(1,1,1)
        p['hand.R'].location.x=0.24*pulse; eyes(0.7)
    elif name=='use_item':
        p['socket_item'].scale=(1,)*3; p['socket_item'].location.y=0.18*pulse
        p['hand.R'].location.y=0.20*pulse; p['hand.R'].location.z=0.22*pulse
        p['body'].rotation_euler.z=0.10*pulse; eyes(0.65)
    elif name=='sleepy':
        for n in ['brow.L','brow.R']: p[n].scale=(0.001,)*3
        squash(1.09+0.02*wave,0.86-0.025*wave); eyes(0.12)
        p['body'].rotation_euler.z=0.055+0.025*wave
        p['sleep'].scale=(0.8+0.15*wave,)*3; p['sleep'].location.y=0.06*wave
    elif name=='jump': squash(1-0.17*pulse,1+0.23*pulse); eyes(1.15)
    elif name=='double_jump':
        squash(1-0.12*pulse,1+0.12*pulse); p['body'].rotation_euler.z=-math.tau*u
        for n in ['sparkle.L','sparkle.R']: p[n].scale=(max(0.001,pulse),)*3
    elif name=='fall': squash(1.07,0.94); p['hand.L'].location.y=0.1; p['hand.R'].location.y=0.1
    elif name=='land': squash(1+0.23*pulse,1-0.24*pulse)
    elif name=='hit':
        squash(1+0.12*pulse,1-0.16*pulse); p['body'].rotation_euler.z=0.22*pulse
        eyes(0.13); p['mouth'].scale=(0.001,)*3; p['mouth.O'].scale=(1,)*3
    elif name=='damage':
        p['body'].rotation_euler.z=0.10*math.sin(u*math.tau*2)*(1-u)
        eyes(0.25+0.75*u); squash(1+0.08*(1-u),1-0.09*(1-u))
        p['mouth'].scale=(0.001,)*3; p['mouth.O'].scale=(0.7,)*3
    elif name=='happy':
        for n in ['brow.L','brow.R']: p[n].scale=(0.001,)*3
        lift(abs(math.sin(u*math.tau))*0.22); squash(1-0.05*pulse,1+0.08*pulse); eyes(0.28)
        p['hand.L'].rotation_euler.z=-0.7*pulse; p['hand.R'].rotation_euler.z=0.7*pulse
        for n in ['sparkle.L','sparkle.R']: p[n].scale=(max(0.001,pulse),)*3
    elif name=='dead':
        squash(1+0.23*min(u*2,1),1-0.65*min(u*2,1)); eyes(0.10)
    p['curl'].rotation_euler.z+=0.06*wave

actions={}
for name,duration in CLIPS.items():
    action=bpy.data.actions.new(name); action.use_fake_user=True
    rig.animation_data.action=action
    end=round(duration*30)
    for f in range(end+1):
        pose(f/30,duration,name)
        for b in rig.pose.bones:
            for prop in ['location','rotation_euler','scale']: b.keyframe_insert(data_path=prop,frame=f,group=b.name)
    actions[name]=action
    track=rig.animation_data.nla_tracks.new(); track.name=name
    strip=track.strips.new(name,0,action); track.mute=True
rig.animation_data.action=actions['idle']
scene.frame_set(0)
rig['character_id']='mochi'; rig['contract_version']=1
rig['front']='Blender -Y / glTF +Z'; rig['ground_origin']=True

def export():
    bpy.ops.object.select_all(action='DESELECT')
    for o in [rig]+parts: o.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(OUT/'mochi.glb'),export_format='GLB',use_selection=True,use_active_scene=True,
        export_animations=True,export_animation_mode='ACTIONS',export_anim_single_armature=False,
        export_frame_range=False,export_force_sampling=True,export_extras=True,export_yup=True)
    # Existing Blender projects may already have 'idle', etc. Preserve their Actions
    # and normalize only this rig's exported clip names to the game contract.
    target=OUT/'mochi.glb'; raw=target.read_bytes(); length=struct.unpack_from('<I',raw,12)[0]
    data=json.loads(raw[20:20+length]); names={a.name:n for n,a in actions.items()}
    for clip in data.get('animations',[]): clip['name']=names.get(clip['name'],clip['name'])
    assert set(c['name'] for c in data['animations'])==set(CLIPS), 'Unexpected exported Actions'
    js=json.dumps(data,separators=(',',':'),ensure_ascii=False).encode(); js+=b' '*((-len(js))%4)
    tail=raw[20+length:]
    target.write_bytes(struct.pack('<III',0x46546c67,2,20+len(js)+len(tail))+struct.pack('<II',len(js),0x4E4F534A)+js+tail)

def studio():
    floor=material('paper backdrop',(0.73,0.79,0.67))
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,0))
    bpy.context.object.name='Studio floor'; bpy.context.object.data.materials.append(floor)
    def aim(o,at): o.rotation_euler=(Vector(at)-o.location).to_track_quat('-Z','Y').to_euler()
    for name,pos,power,size in [('Key',(-3,-4,6),500,4),('Fill',(4,-1,3),220,3),('Rim',(1,3,4),400,3)]:
        d=bpy.data.lights.new(name,'AREA'); d.energy=power; d.shape='DISK'; d.size=size
        o=bpy.data.objects.new(name,d); scene.collection.objects.link(o); o.location=pos; aim(o,(0,0,0.5))
    d=bpy.data.cameras.new('Portrait camera'); cam=bpy.data.objects.new('Portrait camera',d); scene.collection.objects.link(cam)
    cam.location=(0.6,-7,1.75); aim(cam,(0,0,0.62)); d.type='ORTHO'; d.ortho_scale=2.35; scene.camera=cam
    scene.render.engine='CYCLES'; scene.cycles.samples=32
    scene.render.resolution_x=900; scene.render.resolution_y=900; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'

def save_source():
    # The standalone source also gets exact contract names. Restore any names in
    # the user's other open scenes immediately after writing the isolated file.
    names={n:a.name for n,a in actions.items()}; conflicts=[]
    try:
        for name,action in actions.items():
            other=bpy.data.actions.get(name)
            if other and other!=action:
                conflicts.append((other,name)); other.name='__Mochi_previous_'+name
            action.name=name
        bpy.data.libraries.write(str(OUT/'mochi.blend'),{scene},fake_user=True)
    finally:
        for name,action in actions.items(): action.name=names[name]
        for other,name in conflicts: other.name=name

export()
studio()
save_source()
scene.render.filepath=str(OUT/'preview.png')
print(json.dumps({'scene':scene.name,'clips':CLIPS,'meshes':len(parts),'vertices':sum(len(o.data.vertices) for o in parts),'output':str(OUT)}))
