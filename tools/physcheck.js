// Simulates movement using the ACTUAL collision code + world extracted from the game file.
const fs=require('fs');
const THREE=require('three');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
function slice(a,b){const i=html.indexOf(a);const j=html.indexOf(b,i);if(i<0||j<0)throw new Error('slice fail: '+a);return html.slice(i,j);}

const utils="function clamp(v,a,b){return v<a?a:v>b?b:v;}\nfunction rand(a,b){return a+Math.random()*(b-a);}\nfunction V3(x,y,z){return new THREE.Vector3(x||0,y||0,z||0);}\n";
const worldCode=slice("var colliders=[]","var SPAWNS=");
const physCode=slice("function boxPen(bb,c){","/* ---- tracers");

const scene=new THREE.Scene();
const ctx={colliders:null,moveBody:null};
const code=utils+worldCode+"\n"+physCode+"\nctx.colliders=colliders; ctx.moveBody=moveBody;";
(new Function('THREE','scene','ctx',code))(THREE,scene,ctx);
console.log('colliders:',ctx.colliders.length);

function makeBody(x,y,z){return {pos:new THREE.Vector3(x,y,z),vel:new THREE.Vector3(),onGround:false};}
const dt=1/60, R=0.45, H=1.8;
let fails=0;
function check(name,cond,detail){
  console.log((cond?'PASS':'FAIL')+'  '+name+(cond?'':'  -> '+detail));
  if(!cond)fails++;
}

// 1) THE BUG REPRO: spawn, walk forward (-z) for 5s. Old code ejects on frame 1.
let b=makeBody(0,1,26);
let minX=1e9,maxX=-1e9,maxAbsZ=0,ejectFrame=-1;
for(let f=0;f<300;f++){
  b.vel.x=0; b.vel.z=-7.5;                 // walk speed toward centre
  ctx.moveBody(b,dt,R,H,22);
  minX=Math.min(minX,b.pos.x); maxX=Math.max(maxX,b.pos.x);
  maxAbsZ=Math.max(maxAbsZ,Math.abs(b.pos.z));
  if(ejectFrame<0&&(Math.abs(b.pos.x)>31||Math.abs(b.pos.z)>31))ejectFrame=f;
}
check('walk forward stays inside arena',ejectFrame<0,'ejected at frame '+ejectFrame+' pos='+b.pos.x.toFixed(1)+','+b.pos.z.toFixed(1));
check('stopped by geometry, not passed through',Math.abs(b.pos.z)<26.5&&Math.abs(b.pos.z)>1,'z='+b.pos.z.toFixed(2));
check('feet stay on deck',Math.abs(b.pos.y)<0.05,'y='+b.pos.y.toFixed(3));

// 2) walk east into perimeter wall: must stop at inner face (x = 30 - R)
b=makeBody(0,1,26);
for(let f=0;f<400;f++){ b.vel.x=7.5; b.vel.z=0; ctx.moveBody(b,dt,R,H,22); }
check('east wall stops player at inner face',b.pos.x>28.5&&b.pos.x<=30-R+0.01,'x='+b.pos.x.toFixed(3));

// 3) diagonal strafe along the wall must slide, not eject
b=makeBody(28,0,20);
for(let f=0;f<300;f++){ b.vel.x=6; b.vel.z=-6; ctx.moveBody(b,dt,R,H,22); }
check('sliding along wall stays inside',Math.abs(b.pos.x)<31&&Math.abs(b.pos.z)<31,'pos='+b.pos.x.toFixed(1)+','+b.pos.z.toFixed(1));

// 4) jump onto a SINGLE corner crate (1.3 high at 24,-24; no stack there)
b=makeBody(24,0,-21.2);
let landed=false;
for(let f=0;f<360;f++){
  b.vel.x=0; b.vel.z=-4.5;
  if(b.onGround&&b.pos.z<-21.6&&b.pos.z>-23.2)b.vel.y=8.6;
  ctx.moveBody(b,dt,R,H,22);
  if(b.onGround&&Math.abs(b.pos.y-1.3)<0.05)landed=true;
}
check('can jump onto crate top',landed,'final y='+b.pos.y.toFixed(2)+' z='+b.pos.z.toFixed(2));

// 5) run through an open container tunnel (0,-20 alongX): pass under the roof
b=makeBody(-8,0,-20);
let passed=false, bonked=false;
for(let f=0;f<400;f++){
  b.vel.x=7.5; b.vel.z=0;
  ctx.moveBody(b,dt,R,H,22);
  if(b.pos.y>2.0)bonked=true;
  if(b.pos.x>8)passed=true;
}
check('runs through open container tunnel',passed&&!bonked,'x='+b.pos.x.toFixed(1)+' bonked='+bonked);

// 6) 20s of random-direction running: never leaves arena, never launched upward
b=makeBody(5,0,5);
let out=false,launched=false;
let ang=0;
for(let f=0;f<1200;f++){
  if(f%45===0)ang=Math.random()*Math.PI*2;
  b.vel.x=Math.cos(ang)*11.5; b.vel.z=Math.sin(ang)*11.5;
  if(f%120===0&&b.onGround)b.vel.y=8;
  ctx.moveBody(b,dt,R,H,22);
  if(Math.abs(b.pos.x)>31||Math.abs(b.pos.z)>31)out=true;
  if(b.pos.y>9)launched=true;
}
check('20s fuzz run: never exits arena',!out,'pos='+b.pos.x.toFixed(1)+','+b.pos.z.toFixed(1));
check('20s fuzz run: never launched above walls',!launched,'y peak seen');

console.log(fails===0?'\nALL PHYSICS TESTS PASS':'\n'+fails+' TESTS FAILED');
process.exit(fails?1:0);
