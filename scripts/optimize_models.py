import numpy as np,struct,json,io,os,glob,sys,time,copy
from PIL import Image
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; SRC=ROOT/'sources';DEST=ROOT/'assets';DEST.mkdir(parents=True,exist_ok=True)
SOURCES={
'mannequin':'manequim de tecido 3d modelo-2.glb',
'overalls_cream':'cream overalls 3d model.glb',
'jacket_cream':'cream short sleeve jacket 3d model.glb',
'pants_cargo':'cargo pants 3d model.glb',
'pants_black':'black cargo pants 3d model.glb',
'cap_camo':'camouflage cap 3d model.glb',
'cap_plaid':'plaid cap 3d model.glb',
'cap_leopard':'leopard print cap 3d model-2.glb',
}

def optimize(key,path):
 t=time.monotonic();orig=(SRC/path).read_bytes();jlen=struct.unpack_from('<I',orig,12)[0];j=json.loads(orig[20:20+jlen]);binoff=20+jlen+8
 prim=j['meshes'][0]['primitives'][0]
 def attr(index):
  a=j['accessors'][index];view=j['bufferViews'][a['bufferView']];n={'VEC3':3,'VEC2':2,'SCALAR':1}[a['type']];dt={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']];return np.frombuffer(orig,dtype=dt,count=a['count']*n,offset=binoff+view.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,n)
 pos=attr(prim['attributes']['POSITION']).copy();nor=attr(prim['attributes']['NORMAL']).copy();uv=attr(prim['attributes']['TEXCOORD_0']).copy();faces=attr(prim['indices']).reshape(-1,3).astype(np.int32,copy=False)
 # Spatial + UV grouping to preserve material seams. A conservative quantized voxel grid maintains the silhouette while reducing ~1M verts to ~60-120k.
 step=.0055 if key=='mannequin' else (.006 if key.startswith('cap') else .0065)
 qpos=np.round(pos/step).astype(np.int32)
 quv=np.round(uv/.055).astype(np.int32)
 keys=np.column_stack((qpos,quv))
 unique,inv=np.unique(keys,axis=0,return_inverse=True)
 n=len(unique)
 count=np.bincount(inv,minlength=n).astype(np.float32)
 def avg(src):return np.column_stack([np.bincount(inv,weights=src[:,k],minlength=n)/count for k in range(src.shape[1])]).astype(np.float32)
 pnew=avg(pos);nnew=avg(nor);unew=avg(uv)
 nnew/=np.maximum(np.linalg.norm(nnew,axis=1,keepdims=True),1e-8)
 mapped=inv[faces];keep=(mapped[:,0]!=mapped[:,1])&(mapped[:,1]!=mapped[:,2])&(mapped[:,0]!=mapped[:,2]);mapped=mapped[keep].astype(np.uint32,copy=False)
 # Remove degenerate triangles formed by vertex clustering and repeated triangles within the same face.
 mapped=np.unique(mapped,axis=0)
 # Remove unused vertices for smaller output
 used,rerank=np.unique(mapped,return_inverse=True)
 pnew=pnew[used];nnew=nnew[used];unew=unew[used];mapped=rerank.reshape(-1,3).astype('<u4')
 print(key,'verts',len(pos),'->',len(pnew),'tri',len(faces),'->',len(mapped),'preprocess',round(time.monotonic()-t,1),flush=True)
 buffers=bytearray();views=[];acc=[];images=[]
 def appendbuf(data):
  nonlocal buffers
  while len(buffers)%4:buffers.append(0)
  off=len(buffers);buffers+=data
  views.append({'buffer':0,'byteOffset':off,'byteLength':len(data)})
  return len(views)-1
 for name,arr,comp,typ in [('POSITION',pnew,5126,'VEC3'),('NORMAL',nnew,5126,'VEC3'),('TEXCOORD_0',unew,5126,'VEC2'),('indices',mapped.reshape(-1,1),5125,'SCALAR')]:
  idx=appendbuf(arr.tobytes());entry={'bufferView':idx,'componentType':comp,'count':len(arr),'type':typ}
  if name=='POSITION':entry.update({'max':pnew.max(axis=0).tolist(),'min':pnew.min(axis=0).tolist()})
  acc.append(entry)
 for img in j['images']:
  bview=j['bufferViews'][img['bufferView']];source=orig[binoff+bview['byteOffset']:binoff+bview['byteOffset']+bview['byteLength']]
  im=Image.open(io.BytesIO(source)).convert('RGB')
  size=1280 if key.startswith('cap') else 1024
  im.thumbnail((size,size),Image.Resampling.LANCZOS)
  raw=io.BytesIO()
  im.save(raw,format='JPEG',quality=83,optimize=True,subsampling=0 if 'basecolor' in img['name'] else 2)
  images.append({'bufferView':appendbuf(raw.getvalue()),'mimeType':'image/jpeg'})
 out={
 'asset':{'version':'2.0','generator':'DOTH optimized original Tripo mesh assets'},
 'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0,'name':key}],
 'buffers':[{'byteLength':len(buffers)}],'bufferViews':views,'accessors':acc,
 'images':images,'textures':copy.deepcopy(j['textures']),'samplers':copy.deepcopy(j.get('samplers',[])),
 'materials':copy.deepcopy(j['materials']),
 'meshes':[{'primitives':[{'attributes':{'POSITION':0,'NORMAL':1,'TEXCOORD_0':2},'indices':3,'material':0,'mode':4}]}]
 }
 # normalTexture remains supported, images are JPEG after conversion.
 jbytes=json.dumps(out,separators=(',',':'),ensure_ascii=True).encode()
 while len(jbytes)%4:jbytes+=b' '
 while len(buffers)%4:buffers.append(0)
 size=12+8+len(jbytes)+8+len(buffers)
 glb=struct.pack('<4sII',b'glTF',2,size)+struct.pack('<I4s',len(jbytes),b'JSON')+jbytes+struct.pack('<I4s',len(buffers),b'BIN\0')+buffers
 dst=DEST/f'{key}.glb';dst.write_bytes(glb)
 print('saved',dst.name,round(dst.stat().st_size/1e6,2),'MB','time',round(time.monotonic()-t,1),flush=True)
 return {'key':key,'vertices':int(len(pnew)),'triangles':int(len(mapped)),'bytes':len(glb)}

if __name__=='__main__':
 results=[]
 for key,filename in SOURCES.items():results.append(optimize(key,filename))
 (DEST/'manifest.json').write_text(json.dumps(results,indent=2))
