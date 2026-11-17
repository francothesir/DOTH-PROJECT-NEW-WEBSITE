from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import trimesh, math, time
ROOT=Path(__file__).resolve().parents[1]/'assets'
OUT=ROOT/'previews';OUT.mkdir(parents=True, exist_ok=True)

names=['mannequin','overalls_cream','jacket_cream','pants_cargo','pants_black','cap_camo','cap_plaid','cap_leopard']
# A textured mesh rasterization approximation for catalog fallback images.
for name in names:
    start=time.time()
    scene=trimesh.load(ROOT/(name+'.glb'),force='scene')
    mesh=list(scene.geometry.values())[0]
    vertices=mesh.vertices.astype('float32')
    center=(vertices.max(0)+vertices.min(0))/2
    vert=vertices-center
    # rotate slightly to reveal 3D structure
    yaw=np.deg2rad(165 if name=='cap_leopard' else -15)
    pitch=np.deg2rad(5)
    cy,sy=np.cos(yaw),np.sin(yaw)
    cp,sp=np.cos(pitch),np.sin(pitch)
    ry=np.array([[cy,0,sy],[0,1,0],[-sy,0,cy]],dtype='float32')
    rx=np.array([[1,0,0],[0,cp,-sp],[0,sp,cp]],dtype='float32')
    rot=ry@rx
    vv=vert@rot.T
    faces=mesh.faces.astype('int32')
    p=vv[faces]
    # For camera on +z, far triangles first. Face culling is avoided as GLB normals can be inconsistent.
    depths=p[:,:,2].mean(1)
    order=np.argsort(depths)
    face_centers=mesh.triangles_center
    face_uv=mesh.visual.uv[faces].mean(1)
    tex=np.array(mesh.visual.material.baseColorTexture.convert('RGB'))
    htex,wtex=tex.shape[:2]
    u=np.clip((face_uv[:,0]%1)* (wtex-1),0,wtex-1).astype('int32')
    v=np.clip((1-(face_uv[:,1]%1))*(htex-1),0,htex-1).astype('int32')
    cols=tex[v,u,:].astype('float32')
    # direction of studio lights
    norms=mesh.face_normals@rot.T
    diffuse=np.maximum(0,np.sum(norms * np.array([-.3,.45,.85]),axis=1))
    backlight=np.maximum(0,np.sum(norms * np.array([.6,.25,-.5]),axis=1))
    lights=np.clip(.67+.37*diffuse+.16*backlight,.45,1.15)
    cols=np.clip(cols*lights[:,None]+4,0,255).astype('uint8')
    # Object fit to 680x820 transparent canvas
    H,W=820,680
    dim=vv.max(0)-vv.min(0)
    fit=min(590/max(dim[0],1e-4),710/max(dim[1],1e-4))
    # caps need width while clothing fits height
    xs=(vv[:,0]*fit+W/2).astype('float32')
    ys=(H/2-vv[:,1]*fit).astype('float32')
    points=np.stack([xs,ys],axis=1)[faces]
    img=Image.new('RGBA',(W,H),(0,0,0,0))
    draw=ImageDraw.Draw(img)
    # raster painter algorithm, downscale target thumbnail later
    for f in order:
        a,b,c=points[f]
        draw.polygon((tuple(a),tuple(b),tuple(c)),fill=tuple(int(q) for q in cols[f])+ (255,))
    img.thumbnail((440,532),Image.Resampling.LANCZOS)
    img.save(OUT/(name+'.webp'),format='WEBP',quality=88,method=4)
    print(name, 'faces',len(faces),'time',round(time.time()-start,1),'s',flush=True)

from PIL import ImageOps
img=Image.open(OUT/'cap_leopard.webp').convert('RGBA')
gray=ImageOps.grayscale(img.convert('RGB'))
Image.merge('RGBA',(gray,gray,gray,img.getchannel('A'))).save(OUT/'cap_leopard_pb.webp',format='WEBP',quality=90)
