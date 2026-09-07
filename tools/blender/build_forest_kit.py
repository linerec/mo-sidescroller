"""Blender MCP source for Mo's reusable woodland kit. Blender +Z up / -Y front.
One metre tiles, separate top/edge overlays; props use a ground-centre pivot.
The .blend is an editable, labelled asset library, never a baked whole level.
"""
import bpy, math, random, json
from pathlib import Path
from mathutils import Vector

ROOT=Path(globals().get('MO_PROJECT_ROOT','/Users/owenkdev/Projects/Mo'))
OUT=ROOT/'assets/environment/woodland'; OUT.mkdir(parents=True,exist_ok=True)
scene=bpy.data.scenes.new('Mo • Nocturne woodland workshop')
bpy.context.window.scene=scene
scene.world=bpy.data.worlds.new('Woodland studio'); scene.world.color=(.30,.34,.28)
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.72,.80,.66,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5
materials={}
def mat(name, rgb):
    m=bpy.data.materials.new('Woodland_'+name);m.diffuse_color=(*rgb,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*rgb,1);bs.inputs['Roughness'].default_value=.88
    materials[name]=m;return m
# Linear palette: deep ink silhouettes, turquoise reflected light, rare warm seeds.
mat('earth',(.012,.018,.039));mat('earth_light',(.018,.043,.061));mat('bark',(.008,.019,.038));mat('bark_light',(.022,.067,.078))
mat('moss',(.025,.23,.20));mat('leaf_shadow',(.006,.020,.036));mat('leaf',(.015,.065,.073));mat('leaf_sun',(.030,.17,.15))
mat('stone',(.015,.045,.065));mat('cream',(.40,.57,.45));mat('coral',(.065,.23,.19));mat('gold',(.62,.74,.34))
mat('petal',(.12,.47,.34));mat('lavender',(.07,.23,.36));mat('far',(.025,.115,.155))
mat('glow',(.65,.90,.40));mat('rim',(.025,.38,.31))
bs=materials['glow'].node_tree.nodes.get('Principled BSDF')
bs.inputs['Emission Color'].default_value=(.65,.90,.40,1);bs.inputs['Emission Strength'].default_value=2.5
assets=[]; objects=[]; current=None; pieces=[]
def begin(asset_id,label,role,footprint,anchor='ground_center',collision=None):
    global current,pieces
    current=bpy.data.objects.new('ENV_'+asset_id,None);scene.collection.objects.link(current)
    current['asset_id']=asset_id; current['kit_version']=1;current['anchor']=anchor;current['role']=role
    assets.append({'id':asset_id,'label':label,'role':role,'footprint':footprint,'anchor':anchor,'collision':collision})
    objects.append(current);pieces=[]
def mesh(obj,name,material):
    obj.name='Kit_'+name;obj.data.materials.append(materials[material]);obj.parent=current
    for p in obj.data.polygons:p.use_smooth=True
    pieces.append(obj);return obj
def ball(name,loc,scale,material='leaf',segments=16,rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc)
    o=bpy.context.object;o.scale=scale;return mesh(o,name,material)
def box(name,loc,size,material,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        b=o.modifiers.new('Soft carved edges','BEVEL');b.width=bevel;b.segments=3
        bpy.ops.object.modifier_apply(modifier=b.name)
    o=mesh(o,name,material)
    for p in o.data.polygons:p.use_smooth=False
    return o
def curve(name,coords,radius,material='bark',taper=.3):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.resolution_u=8;data.bevel_depth=radius;data.bevel_resolution=2;data.use_fill_caps=True
    spline=data.splines.new('BEZIER');spline.bezier_points.add(len(coords)-1)
    for i,(p,co) in enumerate(zip(spline.bezier_points,coords)):
        p.co=co;p.radius=1-taper*i/(len(coords)-1);p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.object.convert(target='MESH');return mesh(bpy.context.object,name,material)
def leaf(name,loc,length=.25,width=.10,angle=0,material='leaf_sun'):
    # A folded, pointed leaf rather than a spherical bead.
    verts=[(0,0,0),(-width,0,length*.44),(0,-width*.28,length*.50),(width,0,length*.44),(0,0,length)]
    faces=[(0,2,1),(0,3,2),(1,2,4),(2,3,4)]
    d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update()
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler.y=angle
    o=mesh(o,name,material)
    # Actual two-sided geometry, so leaves remain visible from both game directions.
    solid=o.modifiers.new('Leaf thickness','SOLIDIFY');solid.thickness=.008
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=solid.name)
    return o
def finish():
    # One editable mesh per module, retaining material slots and root metadata.
    bpy.ops.object.select_all(action='DESELECT')
    for o in pieces:o.select_set(True)
    bpy.context.view_layer.objects.active=pieces[0]
    if len(pieces)>1:bpy.ops.object.join()
    o=bpy.context.object;o.name=current['asset_id']+'_mesh'
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    return current

for variant in ['a','b']:
    begin('soil_'+variant,'흙 속 '+variant.upper(),'solid',[1,1],'cell_bottom_left',{'size':[1,1],'offset':[.5,.5]})
    # Flat, exact x/z mating planes: never bevel the connection faces.
    box('seamless soil',(.5,.45,.5),(1,2,1),'earth')
    # World-space patina in the renderer bridges tile joins without image textures.
    finish()

for variant in ['a','b']:
    begin('top_'+variant,'잔디 윗면 '+variant.upper(),'surface',[1,0],'surface_left')
    box('moss seam',(.5,.45,-.045),(1,2,.09),'moss')
    rnd=random.Random(73 if variant=='a' else 83).random
    for i in range(14):
        x=.02+rnd()*.96;y=-.45+rnd()*1.5
        leaf('wind grass',(x,y,-.01),.12+rnd()*.24,.009+rnd()*.01,-.15-rnd()*.45,'leaf_sun' if i%5 else 'moss')
    curve('luminous moss lip',[(0,-.554,-.006),(.25,-.558,-.01),(.55,-.554,-.006),(1,-.554,-.006)],.012,'rim',0)
    finish()
for side in ['left','right']:
    begin('edge_'+side,'흙 둔덕 '+('왼쪽' if side=='left' else '오른쪽'),'edge',[1,1],'cell_bottom_left')
    x=.03 if side=='left' else .97
    for i in range(5):ball('side moss',(x,-.535,.88-i*.09),(.045,.065,.12-i*.008),'moss',12,8)
    curve('rootlet',[(x,-.59,.78),(x+(.05 if side=='left' else -.05),-.60,.49),(x,-.585,.27)],.013,'bark_light',.65)
    finish()
begin('roots','매달린 뿌리','edge',[1,0],'surface_left')
for x in [.18,.56,.83]:curve('hanging root',[(x,-.51,0),(x+.08,-.55,-.18),(x-.06,-.53,-.36)],.017,'bark',.85)
finish()
for part in ['left','middle','right','single']:
    begin('platform_'+part,'나무 발판 '+part,'platform',[1,.3],'surface_left',{'size':[1,.3],'offset':[.5,-.15],'oneWay':True})
    box('timber',(.5,.20,-.15),(1,1.4,.3),'bark',.035)
    box('walk surface',(.5,.20,-.028),(1,1.4,.055),'bark_light',.015)
    for y in [-.27,.19,.65]:
        curve('wood grain',[(.04,y,-.002),(.33,y+.035,-.001),(.65,y-.014,-.001),(.96,y+.014,-.002)],.006,'bark',0)
    if part in ['left','single']:ball('end moss',(.10,-.38,-.055),(.14,.12,.065),'moss',12,8)
    if part in ['right','single']:ball('end moss',(.90,-.38,-.055),(.14,.12,.065),'moss',12,8)
    finish()

def crown(loc,size,rnd,material):
    # Sculpted, shallow leaf masses: broad painted silhouettes rather than sphere clusters.
    count=40; sx,sy,sz=size; phase=rnd()*6.28; verts=[(0,-sy*.32,0),(0,sy*.32,0)]
    for i in range(count):
        a=i*math.tau/count
        r=1+.055*math.sin(a*7+phase)+.035*math.sin(a*13-phase)
        verts.append((math.cos(a)*sx*r,0,math.sin(a)*sz*r))
    faces=[]
    for i in range(count):
        faces.append((0,2+i,2+(i+1)%count));faces.append((1,2+(i+1)%count,2+i))
    data=bpy.data.meshes.new('Painted leaf mass');data.from_pydata(verts,[],faces);data.update()
    o=bpy.data.objects.new('Painted leaf mass',data);scene.collection.objects.link(o);o.location=loc
    return mesh(o,'leaf mass',material)
for kind,h,seed in [('oak',6.6,8),('birch',7.8,19),('willow',6.0,31)]:
    begin('tree_'+kind,{'oak':'포근한 참나무','birch':'키 큰 자작나무','willow':'늘어진 버드나무'}[kind],'tree',[5,h])
    rnd=random.Random(seed).random;bark='bark_light' if kind=='birch' else 'bark'
    curve('trunk',[(0,0,0),(-.13,.04,h*.27),(.16,0,h*.54),(-.18,.02,h*.84)],.31 if kind!='birch' else .22,bark,.78)
    for side in [-1,1]:
        curve('root',[(0,0,.28),(side*.30,-.07,.12),(side*.85,-.10,.02)],.14,bark,.93)
        curve('main bough',[(.02,0,h*.40),(side*.68,0,h*.64),(side*1.55,.05,h*.75)],.16,bark,.87)
        curve('bark inlay',[(side*.07,-.25,.26),(side*.10,-.20,h*.32),(side*.06,-.11,h*.53)],.012,'bark_light',.55)
    for i in range(13):
        a=i*2.4;r=.7+rnd()*1.1
        x=math.cos(a)*r; yy=math.sin(a)*r*.55;z=h*.72+rnd()*h*.20
        crown((x,yy,z),(1.0+rnd()*.40,.72+rnd()*.40,.68+rnd()*.40),rnd,['leaf_shadow','leaf','leaf_sun'][i%3])
    for i in range(28):
        a=rnd()*math.tau;r=1.1+rnd()*.9
        leaf('canopy leaf',(math.cos(a)*r,-.85-rnd()*.35,h*.80+math.sin(a)*.9),.20+rnd()*.13,.07,a*.7,'leaf')
    if kind=='willow':
        for side in [-1,1]:
            for j in range(3):
                x=side*(1+j*.35);z=h*.77
                curve('hanging vine',[(x,-.40,z),(x+side*.1,-.5,z-.7),(x-side*.08,-.48,z-1.7)],.026,'leaf_shadow',.7)
                for k in range(7):leaf('willow leaf',(x,-.52,z-.15-k*.22),.20,.065,side*.9,'leaf')
    if kind=='birch':
        for k in range(7):curve('bark marking',[(-.12,-.205,.7+k*.42),(0,-.23,.68+k*.42),(.10,-.21,.69+k*.42)],.018,'bark',.5)
    finish()

for index in [0,1]:
    begin('bush_'+str(index),'작은 관목 '+str(index+1),'prop',[1.7,1.0])
    rnd=random.Random(44+index).random
    for i in range(5):crown(((i-2)*.25,rnd()*.30,.35+rnd()*.18),(.48,.40,.40),rnd,['leaf','leaf_sun','leaf_shadow'][i%3])
    for i in range(10):leaf('bush tip',((rnd()-.5)*1.3,-.3,.5+rnd()*.25),.22,.075,(rnd()-.5)*1.5,'leaf_sun')
    finish()
begin('fern','고사리','prop',[1.2,.85])
for a in [-1.1,-.65,0,.65,1.1]:
    dx=math.sin(a)*.6;dz=math.cos(a)*.85
    curve('fern stem',[(0,0,0),(dx*.4,0,dz*.65),(dx,0,dz)],.012,'leaf',.6)
    for k in range(1,8):
        t=k/8
        for side in [-1,1]:leaf('fern leaflet',(dx*t*t,-.02,dz*t),.18*(1-t*.65),.045,side*1.0+a*.3,'leaf_sun')
finish()
begin('mushrooms','작은 버섯 무리','prop',[1.1,.7])
for x,y,s in [(-.25,0,.65),(.24,.13,.44),(.03,-.22,.31)]:
    curve('mushroom stalk',[(x,y,0),(x-.03,y,s*.30),(x,y,s*.60)],s*.06,'cream',.25)
    cap=ball('mushroom cap',(x,y,s*.63),(s*.40,s*.34,s*.22),'coral')
    for i in range(7):
        a=i*2.4;r=s*(.09+.03*(i%3));ball('cap spot',(x+math.cos(a)*r,y+math.sin(a)*r,s*.82),(.026,.022,.009),'glow',8,6)
finish()
begin('flowers','들꽃 무리','prop',[.8,.55])
for x,y,h,flower in [(-.2,0,.45,'petal'),(.18,.09,.52,'lavender'),(.05,-.19,.30,'cream')]:
    curve('flower stem',[(x,y,0),(x+.025,y,h*.55),(x,y,h)],.009,'leaf',0)
    for i in range(5):
        a=i*math.tau/5
        o=ball('petal',(x+math.cos(a)*.064,y-.01,h+math.sin(a)*.064),(.05,.022,.036),flower,10,6);o.rotation_euler.y=-a
    ball('flower heart',(x,y-.032,h),(.035,.017,.035),'glow',10,6)
finish()
begin('grass','풀 포기','prop',[.55,.35])
for i in range(9):leaf('blade',((i%3-1)*.09,(i//3)*.07,0),.18+(i%4)*.045,.02,(i%3-1)*.3,'leaf_sun' if i%2 else 'leaf')
finish()
begin('rock','이끼 바위','prop',[1.2,.70])
ball('stone',(-.12,0,.29),(.58,.42,.32),'stone',14,9);ball('moss',(-.13,0,.51),(.48,.33,.12),'moss',14,9)
ball('small stone',(.46,-.13,.12),(.24,.20,.15),'stone',12,8)
finish()
begin('arch','오래된 숲의 돌문','landmark',[2.4,3.1])
for side in [-1,1]:
    for k in range(5):box('old stone',(side*.90,0,.24+k*.43),(.46,.7,.44),'stone',.09)
for i in range(9):
    a=i*math.pi/8
    o=box('arch stone',(math.cos(a)*.9,0,2.05+math.sin(a)*.72),(.44,.72,.40),'stone',.08);o.rotation_euler.y=a-math.pi/2
    ball('arch moss',(math.cos(a)*.9,0,2.26+math.sin(a)*.72),(.26,.39,.09),'moss',12,8)
curve('arch ivy',[(-.8,-.41,2.8),(-.67,-.43,1.9),(-.96,-.41,1.0)],.019,'leaf_shadow',.6)
for k in range(8):leaf('ivy leaf',(-.8+(k%2)*.14,-.45,2.7-k*.20),.18,.075,(-1 if k%2 else 1)*.6,'leaf')
finish()
begin('distant_tree','먼 숲 실루엣','backdrop',[5,8])
curve('far trunk',[(0,0,0),(.2,0,3),(-.2,0,7)],.22,'far',.7)
for side in [-1,1]:curve('far branch',[(0,0,3),(side,0,5),(side*1.8,0,6)],.14,'far',.8)
for x,z in [(-1.6,6),(-.7,7),(.8,7.2),(1.6,6.2),(0,7.5)]:ball('far canopy',(x,0,z),(1.4,.45,.85),'far',12,8)
finish()
begin('hill','먼 언덕','backdrop',[12,4])
ball('wooded hill',(0,0,-.2),(6,1.2,3.8),'far',24,12)
finish()

# Monument modules. These remain independent pieces with the same metre/pivot contract.
begin('keeper','등불을 지키는 숲지기','actor',[.8,1.5])
# A modest cloaked forest resident. Its gameplay rig is still owned by the NPC entity.
bpy.ops.mesh.primitive_cone_add(vertices=32,radius1=.34,radius2=.18,depth=.94,location=(0,0,.50))
mesh(bpy.context.object,'cloak','bark')
ball('hood',(0,0,1.13),(.34,.25,.36),'leaf_shadow',24,16)
ball('face opening',(0,-.205,1.10),(.20,.045,.20),'earth',20,12)
for x in [-.075,.075]:ball('keeper eye',(x,-.247,1.12),(.025,.015,.035),'glow',10,6)
curve('walking staff',[(.38,0,.02),(.40,0,.75),(.37,0,1.4)],.022,'bark_light',0)
ball('staff lamp',(.37,0,1.40),(.065,.055,.09),'glow',12,8)
finish()

begin('cliff_face','깊은 절벽 단면','foundation',[1,8],'surface_left')
verts=[]
for row,z in enumerate([0,-1.1,-3.4,-5.8,-8]):
    for col in range(5):
        x=col/4;front=-.55-.08*math.sin(math.pi*col/4)*math.sin(col*2.1+row*.9)
        verts.append((x,front,z))
faces=[]
for row in range(4):
    for col in range(4):
        k=row*5+col;faces.append((k,k+1,k+6,k+5))
d=bpy.data.meshes.new('Cliff strata');d.from_pydata(verts,[],faces);d.update()
o=bpy.data.objects.new('Cliff strata',d);scene.collection.objects.link(o);mesh(o,'cliff face','earth')
# Side/back volume joins the exact top cell footprint; face remains continuous in X.
box('cliff core',(.5,.51,-4),(1,1.86,8),'earth')
finish()

begin('ancient_tree','잠든 숲의 거신','landmark',[17,20])
# Open heart formed by entwined trunks: a hollow tree, not a solid backdrop billboard.
curve('ancient left trunk',[(-3,0,0),(-5,.2,4),(-4.3,.15,9),(-3,0,14),(0,0,17),(4,.2,16)],1.55,'bark',.40)
curve('ancient right trunk',[(5,1,0),(6,.5,4),(5.7,.3,9),(5,0,15),(2,0,17)],2.0,'bark',.30)
curve('heart lower root',[(-4,0,4),(-1,-.2,3),(3,0,3.5),(6,0,6)],.85,'bark',.3)
curve('skyward bough',[(3,.2,15),(7,.2,18),(11,0,18.8),(13,0,18.3)],.85,'bark',.93)
curve('left bough',[(-3,0,14),(-8,.5,16),(-10,0,19)],.65,'bark',.93)
for side in [-1,1]:
    for i in range(3):
        x=side*(3+i*.7)
        curve('spreading ancient root',[(x,.2,3),(x+side*1.2,0,1),(x+side*(3+i),-.1,0)],.50,'bark',.92)
for coords in [[(-4.6,-1.22,1),(-5.4,-1.17,5),(-4.8,-1.22,10),(-3.6,-1.22,14)],[(5.4,-1.35,2),(6.4,-1.40,6),(5.8,-1.48,12),(4.8,-1.50,15)],[(-2.7,-1.25,15),(0,-1.35,17),(3,-1.35,16.7)]]:
    curve('turquoise bark vein',coords,.025,'rim',.75)
rnd=random.Random(704).random
for i in range(19):
    x=-6+rnd()*14;z=16.4+rnd()*2.5
    crown((x,1+rnd()*2,z),(2+rnd(),1.1,.65+rnd()*.5),rnd,'leaf_shadow')
for i,(x,z,r) in enumerate([(-3.5,12,.25),(-2.6,12.6,.21),(-1.4,13.15,.28),(-3.2,13.4,.24),(-2.6,14.1,.30),(-1.4,14.6,.19),(-.5,15,.22)]):
    o=ball('heart lantern',(x,-1.5,z),(r,r*.7,r*1.65),'glow',16,10);o.rotation_euler.y=-.35+i*.11
for i in range(11):
    x=-3.5+i*.9;z=15.5+math.sin(i)*.7
    curve('ancient hanging moss',[(x,-.7,z),(x+.18,-.8,z-1.1),(x-.15,-.7,z-2.5-rnd()*1.2)],.025,'leaf_sun',.88)
finish()

begin('root_arch','거대한 뿌리 아치','landmark',[12,16])
curve('arching root',[(-4,0,0),(-5,0,5),(-3.4,0,10),(1,0,13),(6,.2,15)],.80,'bark',.87)
curve('root light',[(-4.4,-.65,1),(-5.3,-.60,5),(-3.8,-.42,10),(.8,-.25,13)],.018,'rim',.75)
for i in range(6):
    x=-2+i*.65;z=11+i*.40
    curve('trailing fibres',[(x,0,z),(x+.15,-.1,z-1),(x-.2,0,z-2)],.018,'leaf',.9)
finish()

begin('glow_reeds','빛나는 씨앗 풀','prop',[.8,1.0])
for i in range(5):
    x=(i-2)*.12;h=.45+(i%3)*.20
    curve('seed stem',[(x,0,0),(x-.10,0,h*.7),(x+.07,0,h)],.007,'leaf_sun',.5)
    ball('seed lamp',(x+.07,0,h),(.035,.030,.060),'glow',10,6)
finish()

begin('hanging_vine','천장에서 늘어진 덩굴','prop',[1,4],'top_center')
for i in range(4):
    x=i*.23
    curve('long fibre',[(x,0,0),(x+.2,0,-1.2),(x-.12,0,-2.4),(x+.05,0,-3.3-i*.22)],.014,'leaf',.8)
    for k in range(6):leaf('small vine leaf',(x+.05,-.02,-k*.46-.2),.13,.035,.5 if k%2 else -.5,'leaf_sun')
finish()

# Library layout is presentation only. Runtime strips each root's display transform.
for i,o in enumerate(objects):
    role=o['role']; entry=assets[i]
    if entry['id']=='ancient_tree':o.location=(27,22,0)
    elif entry['id']=='root_arch':o.location=(44,22,0)
    elif entry['id']=='cliff_face':o.location=(26,4,8)
    elif entry['id']=='hanging_vine':o.location=(28,4,4)
    elif role=='tree':o.location=(3+(i-11)*6,14,0)
    elif role=='backdrop':o.location=(10+(i-len(objects)+2)*12,25,0)
    else:
        n=sum(1 for ob in objects[:i] if ob['role'] not in ['tree','backdrop'])
        o.location=((n%8)*3.1,(n//8)*5,0)
    o['footprint']=entry['footprint']

bpy.ops.object.select_all(action='DESELECT')
for root in objects:
    root.select_set(True)
    for child in root.children:child.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'woodland-kit.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_animations=False,export_extras=True,export_yup=True)
manifest={'version':1,'artRevision':2,'name':'모찌의 숲 · 심연의 빛','grid':1,'depth':2,'front':'+Z','up':'+Y','library':'woodland-kit.glb','assets':assets}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))

# Add labels and a soft studio for the editable source / review render only.
for root,entry in zip(objects,assets):
    data=bpy.data.curves.new('Label '+entry['id'],'FONT');data.body=entry['id'];data.size=.23;data.align_x='CENTER'
    ob=bpy.data.objects.new(data.name,data);scene.collection.objects.link(ob);ob.location=root.location+Vector((.5,-1.1,.03));ob.rotation_euler=(math.pi/2,0,0);data.materials.append(materials['bark'])
bpy.ops.mesh.primitive_plane_add(size=150,location=(10,10,-.07));bpy.context.object.data.materials.append(materials['cream'])
def aim(o,point):o.rotation_euler=(Vector(point)-o.location).to_track_quat('-Z','Y').to_euler()
for name,pos,power,size in [('Key',(3,-10,22),2600,14),('Fill',(25,10,20),2000,15)]:
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=pos;aim(o,(10,8,0))
d=bpy.data.cameras.new('Workshop camera');o=bpy.data.objects.new('Workshop camera',d);scene.collection.objects.link(o);o.location=(42,-49,35);aim(o,(21,12,6));d.type='ORTHO';d.ortho_scale=66;scene.camera=o
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.render.resolution_x=1600;scene.render.resolution_y=1050;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
scene.render.filepath=str(OUT/'kit-preview.png')
bpy.data.libraries.write(str(OUT/'woodland-kit.blend'),{scene},fake_user=True)
print(json.dumps({'assets':len(assets),'ids':[a['id'] for a in assets],'out':str(OUT)}))
