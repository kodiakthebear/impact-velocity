// Renders the actual map from segfault_arena.html via CPU raytracing of its box list.
const fs=require('fs');
const THREE=require('three');
const {PNG}=require('pngjs');

const html=fs.readFileSync(__dirname+'/../index.html','utf8');
function slice(a,b){const i=html.indexOf(a);const j=html.indexOf(b,i);if(i<0||j<0)throw new Error('slice fail: '+a);return html.slice(i,j);}

// --- pull the game's own code ---
const utils="function clamp(v,a,b){return v<a?a:v>b?b:v;}\nfunction rand(a,b){return a+Math.random()*(b-a);}\nfunction V3(x,y,z){return new THREE.Vector3(x||0,y||0,z||0);}\n";
const worldCode=slice("var colliders=[]","var SPAWNS=");           // arrays + matCol/neonMat/block/decor/strip/panel/container/openContainer/skyline/buildWorld + buildWorld();
const matHelpers=slice("function gm(s){","function buildVM");      // gm, gmc + trailing consts (GUNMETAL... ends before buildVM)
const botCode=slice("function makeBot(nm,team){","function botHitMeshes(){");

const scene=new THREE.Scene();
const sandbox=utils+worldCode+"\n"+matHelpers+"\n"+botCode+
"\nvar b1=makeBot('skull','red'); b1.pos.set(4,0,14); b1.g.position.copy(b1.pos); b1.g.rotation.y=Math.PI;"+
"\nvar b2=makeBot('ally','blue'); b2.pos.set(-5,0,10); b2.g.position.copy(b2.pos); b2.g.rotation.y=Math.PI*0.9;";
(new Function('THREE','scene',sandbox))(THREE,scene);
scene.updateMatrixWorld(true);

// --- collect boxes ---
const boxes=[];
scene.traverse(o=>{
  if(!o.isMesh||!o.geometry||!o.geometry.parameters||o.geometry.parameters.width===undefined)return;
  const p=o.geometry.parameters;
  const pos=new THREE.Vector3(), q=new THREE.Quaternion(), s=new THREE.Vector3();
  o.matrixWorld.decompose(pos,q,s);
  const e=new THREE.Euler().setFromQuaternion(q,'YXZ');
  const m=o.material;
  boxes.push({
    cx:pos.x,cy:pos.y,cz:pos.z,
    hx:p.width/2*s.x, hy:p.height/2*s.y, hz:p.depth/2*s.z,
    ry:e.y, // only Y rotation is meaningful in this scene; small X/Z rots on mags ignored
    col:[m.color.r,m.color.g,m.color.b],
    emi:m.emissive?[m.emissive.r*m.emissiveIntensity,m.emissive.g*m.emissiveIntensity,m.emissive.b*m.emissiveIntensity]:[0,0,0]
  });
});
console.log('boxes:',boxes.length);

// --- lighting: mirror the game's rig ---
const AMB=[0x8f/255*0.85,0xa3/255*0.85,0xcf/255*0.85];
const HEMI_SKY=[0x7d/255,0x95/255,0xc9/255], HEMI_GND=[0x2a/255,0x2f/255,0x42/255], HEMI_I=0.7;
const MOON_C=[0xb8/255,0xcc/255,0xff/255], MOON_I=0.9;
const MOON_D=new THREE.Vector3(30,52,20).normalize();
const PLS=[[-7.5,-7.5,[1,0.2,0.5]],[7.5,7.5,[0.2,0.8,1]],[-7.5,7.5,[0.6,0.3,1]],[7.5,-7.5,[1,0.5,0.15]],
  [0,-20,[0.2,0.8,1]],[0,20,[1,0.2,0.5]],[-20,0,[1,0.2,0.5]],[20,0,[0.2,0.8,1]]].map(p=>({x:p[0],y:4.6,z:p[1],c:p[2],i:0.85,d:26}));
const FOGC=[0x0d/255,0x13/255,0x22/255], FOG0=50, FOG1=170;
const BG=[0x0a/255,0x0e/255,0x1c/255];
const EXPO=1.2;

function hitBox(b,ox,oy,oz,dx,dy,dz){
  let lox=ox-b.cx, loz=oz-b.cz, ldx=dx, ldz=dz;
  if(b.ry){const c=Math.cos(-b.ry),s2=Math.sin(-b.ry);
    const tx=lox*c - loz*s2, tz=lox*s2 + loz*c; lox=tx; loz=tz;
    const tdx=ldx*c - ldz*s2, tdz=ldx*s2 + ldz*c; ldx=tdx; ldz=tdz;}
  const loy=oy-b.cy, ldy=dy;
  let t0=1e-4,t1=Infinity,nAxis=-1,nSign=0;
  const o=[lox,loy,loz],d=[ldx,ldy,ldz],h=[b.hx,b.hy,b.hz];
  for(let a=0;a<3;a++){
    if(Math.abs(d[a])<1e-9){ if(o[a]<-h[a]||o[a]>h[a])return null; continue; }
    let ta=(-h[a]-o[a])/d[a], tb=(h[a]-o[a])/d[a];
    let sgn=-1; if(ta>tb){const tmp=ta;ta=tb;tb=tmp;sgn=1;}
    if(ta>t0){t0=ta;nAxis=a;nSign=sgn;}
    if(tb<t1)t1=tb;
    if(t0>t1)return null;
  }
  if(nAxis<0)return null;
  let n=[0,0,0]; n[nAxis]=nSign;
  if(b.ry){const c=Math.cos(b.ry),s2=Math.sin(b.ry);
    const nx=n[0]*c-n[2]*s2, nz=n[0]*s2+n[2]*c; n[0]=nx;n[2]=nz;}
  return {t:t0,n};
}
function trace(ox,oy,oz,dx,dy,dz){
  let best=null;
  for(const b of boxes){const h=hitBox(b,ox,oy,oz,dx,dy,dz); if(h&&(!best||h.t<best.t)){best=h;best.b=b;}}
  return best;
}
function aces(x){x*=EXPO;return Math.max(0,Math.min(1,(x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14)));}
function shade(hit,ox,oy,oz,dx,dy,dz){
  if(!hit)return BG;
  const px=ox+dx*hit.t, py=oy+dy*hit.t, pz=oz+dz*hit.t;
  const n=hit.n, al=hit.b.col, em=hit.b.emi;
  const hemiMix=(n[1]+1)/2;
  const out=[0,0,0];
  const ndl=Math.max(0,n[0]*MOON_D.x+n[1]*MOON_D.y+n[2]*MOON_D.z);
  for(let c=0;c<3;c++){
    let li=AMB[c]+(HEMI_SKY[c]*hemiMix+HEMI_GND[c]*(1-hemiMix))*HEMI_I+MOON_C[c]*MOON_I*ndl;
    out[c]=al[c]*li+em[c];
  }
  for(const L of PLS){
    const lx=L.x-px,ly=L.y-py,lz=L.z-pz;
    const dist=Math.sqrt(lx*lx+ly*ly+lz*lz);
    if(dist>L.d)continue;
    const nd=Math.max(0,(n[0]*lx+n[1]*ly+n[2]*lz)/dist);
    const att=Math.pow(Math.max(0,1-dist/L.d),2)*L.i;
    for(let c=0;c<3;c++)out[c]+=al[c]*L.c[c]*nd*att;
  }
  const f=Math.max(0,Math.min(1,(hit.t-FOG0)/(FOG1-FOG0)));
  for(let c=0;c<3;c++)out[c]=out[c]*(1-f)+FOGC[c]*f;
  return out;
}
function render(name,eye,look,fovDeg,W,H){
  const png=new PNG({width:W,height:H});
  const fwd=new THREE.Vector3().subVectors(look,eye).normalize();
  const right=new THREE.Vector3().crossVectors(fwd,new THREE.Vector3(0,1,0)).normalize();
  const up=new THREE.Vector3().crossVectors(right,fwd).normalize();
  const th=Math.tan(fovDeg*Math.PI/360);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const u=(x/W*2-1)*th*(W/H), v=(1-y/H*2)*th;
    const d=new THREE.Vector3().copy(fwd).addScaledVector(right,u).addScaledVector(up,v).normalize();
    const hit=trace(eye.x,eye.y,eye.z,d.x,d.y,d.z);
    const c=shade(hit,eye.x,eye.y,eye.z,d.x,d.y,d.z);
    const i=(y*W+x)*4;
    // linear -> ACES -> sRGB
    png.data[i]=Math.round(Math.pow(aces(c[0]),1/2.2)*255);
    png.data[i+1]=Math.round(Math.pow(aces(c[1]),1/2.2)*255);
    png.data[i+2]=Math.round(Math.pow(aces(c[2]),1/2.2)*255);
    png.data[i+3]=255;
  }
  fs.writeFileSync(name,PNG.sync.write(png));
  console.log('wrote',name);
}
render('eye.png',new THREE.Vector3(0,1.6,26),new THREE.Vector3(0,1.6,0),92,480,270);
render('high.png',new THREE.Vector3(26,18,26),new THREE.Vector3(0,0,0),70,480,270);
