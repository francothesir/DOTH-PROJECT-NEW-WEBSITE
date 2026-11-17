/* DOTH® Product Archive — single, on-demand WebGL viewer for optimized GLB files.
   No CDN or external JS runtime; preview posters rendered from the same 3D assets. */
(()=>{
'use strict';
const modal=document.getElementById('archive-modal');
const canvas=document.getElementById('archive-canvas');
const heading=document.getElementById('archive-modal-name');
const subhead=document.getElementById('archive-modal-description');
const status=document.getElementById('archive-modal-status');
const closeButton=document.getElementById('archive-close');
const fallbackPoster=document.createElement('img');fallbackPoster.className='archive-poster';fallbackPoster.alt='Prévia do objeto 3D';canvas.parentElement.insertBefore(fallbackPoster,canvas);
if(!modal||!canvas)return;
const validKeys=new Set(['overalls_cream','jacket_cream','pants_cargo','pants_black','cap_camo','cap_plaid','cap_leopard']);
let gl=null,program=null,attributes={},uniforms={},mesh=null,tex=null;
let active=false,job=0,raf=0,rotation=0,pitch=.065,distance=2.45,baseDistance=2.45,dragging=false,px=0,py=0,autospin=true,monochrome=false,lastTrigger=null;
function setStatus(message){status.textContent=message;status.hidden=!message;}
function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
function perspective(d,ratio,n,f){const v=1/Math.tan(d*Math.PI/360);return new Float32Array([v/ratio,0,0,0,0,v,0,0,0,0,(f+n)/(n-f),-1,0,0,(2*f*n)/(n-f),0]);}
function yawMat(v){const c=Math.cos(v),s=Math.sin(v);return new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]);}
function pitchMat(v){const c=Math.cos(v),s=Math.sin(v);return new Float32Array([1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]);}
function viewMat(z){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,-z,1]);}
function compile(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
function init(){if(gl)return true;gl=canvas.getContext('webgl',{alpha:true,depth:true,antialias:true,desynchronized:true});if(!gl){setStatus('WebGL indisponível neste navegador.');return false;}
 const vs=`attribute vec3 aPos; attribute vec3 aNormal; attribute vec2 aUV; uniform mat4 uMVP; uniform mat4 uModel; uniform vec3 uCenter; varying vec3 vN; varying vec2 vUV; void main(){gl_Position=uMVP*vec4(aPos-uCenter,1.0);vN=mat3(uModel)*aNormal;vUV=aUV;}`;
 const fs=`precision mediump float; uniform sampler2D uTex; uniform float uGray; varying vec3 vN; varying vec2 vUV; void main(){vec3 n=normalize(vN);vec3 base=texture2D(uTex,vUV).rgb;float light=.67+.38*max(0.,dot(n,normalize(vec3(-.45,.7,.9))))+.12*max(0.,dot(n,normalize(vec3(.5,.15,-.75))));vec3 c=base*light; if(uGray>.5){float v=dot(c,vec3(.3,.59,.11));c=vec3(v);}gl_FragColor=vec4(c,1.);}`;
 try{program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vs));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
 attributes={pos:gl.getAttribLocation(program,'aPos'),norm:gl.getAttribLocation(program,'aNormal'),uv:gl.getAttribLocation(program,'aUV')};
 uniforms={mvp:gl.getUniformLocation(program,'uMVP'),model:gl.getUniformLocation(program,'uModel'),center:gl.getUniformLocation(program,'uCenter'),tex:gl.getUniformLocation(program,'uTex'),gray:gl.getUniformLocation(program,'uGray')};
 gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);return true;}catch(e){console.error('[DOTH archive]',e);setStatus('Não foi possível iniciar o visualizador 3D.');return false;}}
function accessor(meta,bin,ab,id){const a=meta.accessors[id],b=meta.bufferViews[a.bufferView],components={VEC3:3,VEC2:2,SCALAR:1}[a.type];const offset=bin+(b.byteOffset||0)+(a.byteOffset||0);const Ctor=a.componentType===5126?Float32Array:a.componentType===5125?Uint32Array:Uint16Array;return new Ctor(ab,offset,a.count*components);}
function buffer(data,target){const x=gl.createBuffer();gl.bindBuffer(target,x);gl.bufferData(target,data,gl.STATIC_DRAW);return x;}
function clearMesh(){if(mesh){gl.deleteBuffer(mesh.pos);gl.deleteBuffer(mesh.norm);gl.deleteBuffer(mesh.uv);gl.deleteBuffer(mesh.inds);mesh=null;}if(tex){gl.deleteTexture(tex);tex=null;}}
function embeddedGLB(data){const bytes=atob(data),ab=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)ab[i]=bytes.charCodeAt(i);return ab.buffer;}
async function loadGLB(key,token){let ab;if(window.DOTH_EMBEDDED_MODELS?.[key]){ab=embeddedGLB(window.DOTH_EMBEDDED_MODELS[key]);}else{const response=await fetch('assets/'+key+'.glb');if(!response.ok)throw new Error('Arquivo indisponível: '+key);ab=await response.arrayBuffer();}if(token!==job)return;
 const dv=new DataView(ab);if(dv.getUint32(0,true)!==0x46546c67)throw new Error('GLB inválido');const size=dv.getUint32(12,true),meta=JSON.parse(new TextDecoder().decode(new Uint8Array(ab,20,size)));const bin=20+size+8,primitive=meta.meshes[0].primitives[0];
 const positions=accessor(meta,bin,ab,primitive.attributes.POSITION),normals=accessor(meta,bin,ab,primitive.attributes.NORMAL),uv=accessor(meta,bin,ab,primitive.attributes.TEXCOORD_0),indices=accessor(meta,bin,ab,primitive.indices);
 if(indices instanceof Uint32Array&&!gl.getExtension('OES_element_index_uint'))throw new Error('Índices WebGL não suportados neste dispositivo');
 clearMesh();const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<positions.length;i+=3)for(let j=0;j<3;j++){min[j]=Math.min(min[j],positions[i+j]);max[j]=Math.max(max[j],positions[i+j]);}
 const center=min.map((v,i)=>(v+max[i])/2),extent=max.map((v,i)=>v-min[i]);baseDistance=Math.max(1.6,Math.max(...extent)*2.32);distance=baseDistance;
 mesh={pos:buffer(positions,gl.ARRAY_BUFFER),norm:buffer(normals,gl.ARRAY_BUFFER),uv:buffer(uv,gl.ARRAY_BUFFER),inds:buffer(indices,gl.ELEMENT_ARRAY_BUFFER),count:indices.length,type:indices instanceof Uint32Array?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT,center};
 const textureIndex=meta.materials[primitive.material]?.pbrMetallicRoughness?.baseColorTexture?.index;
 tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([205,201,196,255]));
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 if(textureIndex!==undefined){const imageIdx=meta.textures[textureIndex].source,im=meta.images[imageIdx],bufferView=meta.bufferViews[im.bufferView];const bytes=ab.slice(bin+(bufferView.byteOffset||0),bin+(bufferView.byteOffset||0)+bufferView.byteLength);const url=URL.createObjectURL(new Blob([bytes],{type:im.mimeType||'image/jpeg'}));const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;}).finally(()=>URL.revokeObjectURL(url));if(token!==job)return;
 gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);}
 fallbackPoster.style.display='none';setStatus('');}
function render(){if(!active)return;const r=canvas.getBoundingClientRect();if(r.width&&r.height){const dpr=Math.min(window.devicePixelRatio||1,2),w=Math.max(1,Math.floor(r.width*dpr)),h=Math.max(1,Math.floor(r.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
 gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 if(mesh){if(autospin&&!dragging)rotation+=.0025;gl.useProgram(program);const scene=mul(yawMat(rotation),pitchMat(pitch));gl.uniformMatrix4fv(uniforms.model,false,scene);gl.uniformMatrix4fv(uniforms.mvp,false,mul(perspective(37,w/h,.05,25),mul(viewMat(distance),scene)));gl.uniform3fv(uniforms.center,mesh.center);gl.uniform1f(uniforms.gray,monochrome?1:0);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);gl.uniform1i(uniforms.tex,0);
 for(const [attr,buf,n] of [['pos',mesh.pos,3],['norm',mesh.norm,3],['uv',mesh.uv,2]]){const loc=attributes[attr];gl.enableVertexAttribArray(loc);gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.vertexAttribPointer(loc,n,gl.FLOAT,false,0,0);}
 gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.inds);gl.drawElements(gl.TRIANGLES,mesh.count,mesh.type,0);}}
 raf=requestAnimationFrame(render);}
async function open(button){const key=button.getAttribute('data-view-glb');if(!validKeys.has(key))return;lastTrigger=button;heading.textContent=button.getAttribute('data-title')||'ARQUIVO 3D';subhead.textContent=button.getAttribute('data-context')||'MODELO 3D DO ACERVO DOTH';monochrome=button.getAttribute('data-mono')==='true';fallbackPoster.src='assets/previews/'+(monochrome?'cap_leopard_pb':key)+'.webp';fallbackPoster.style.display='block';rotation=key==='cap_leopard'?Math.PI-.13:-.13; pitch=.07;autospin=true;active=true;modal.classList.add('open');modal.setAttribute('aria-hidden','false');modal.removeAttribute('inert');document.body.classList.add('archive-modal-active');closeButton.focus();if(!init()){setStatus('PRÉVIA 2D — ACELERAÇÃO 3D INDISPONÍVEL');return;}
 setStatus('CARREGANDO OBJETO 3D…');const token=++job;cancelAnimationFrame(raf);raf=requestAnimationFrame(render);try{await loadGLB(key,token);}catch(e){if(token===job){console.error('[DOTH archive]',e);setStatus('PRÉVIA 2D — MODELO 3D NÃO CARREGOU.');}}}
function close(){if(!active)return;active=false;++job;dragging=false;cancelAnimationFrame(raf);clearMesh();modal.classList.remove('open');modal.setAttribute('aria-hidden','true');modal.setAttribute('inert','');document.body.classList.remove('archive-modal-active');lastTrigger?.focus();}
document.getElementById('products-grid').addEventListener('click',e=>{const button=e.target.closest('[data-view-glb]');if(button){e.preventDefault();open(button);}});
closeButton.addEventListener('click',close);modal.addEventListener('click',e=>{if(e.target===modal)close();});document.addEventListener('keydown',e=>{if(!active)return;if(e.key==='Escape'){e.stopPropagation();close();}else if(e.key==='ArrowLeft'){rotation-=.3;}else if(e.key==='ArrowRight'){rotation+=.3;}});
canvas.addEventListener('pointerdown',e=>{if(!active)return;dragging=true;px=e.clientX;py=e.clientY;autospin=false;canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(!dragging)return;rotation+=(e.clientX-px)*.012;pitch=Math.max(-.47,Math.min(.47,pitch+(e.clientY-py)*.006));px=e.clientX;py=e.clientY;});
['pointerup','pointercancel','lostpointercapture'].forEach(k=>canvas.addEventListener(k,()=>dragging=false));canvas.addEventListener('wheel',e=>{if(!active)return;e.preventDefault();distance=Math.max(.85,Math.min(5.6,distance+(e.deltaY>0?.15:-.15)));},{passive:false});
document.getElementById('archive-turn-left').addEventListener('click',()=>{rotation-=.35;autospin=false;});document.getElementById('archive-turn-right').addEventListener('click',()=>{rotation+=.35;autospin=false;});document.getElementById('archive-reset').addEventListener('click',()=>{rotation=-.13;pitch=.07;distance=baseDistance;autospin=true;});
window.DOTH_GALLERY_3D={open,close,validKeys};
})();
