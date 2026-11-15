import * as THREE from "three";
import {assertWorld,heightAt} from "./geo.js";
import {demoWorld} from "./demo.js";
import {makeWorld,canOccupy} from "./world.js";
import "./style.css";
const canvas=document.querySelector("#view"), source=document.querySelector("#source"), details=document.querySelector("#details"), error=document.querySelector("#error");
let data,seed=2049,current=null,locked=false;
const keys=new Set(),camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,0.1,1200);
camera.rotation.order="YXZ";
let renderer;
try { renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25; }
catch(e){error.textContent="WebGL2 unavailable: "+e.message;throw e;}
const scene=new THREE.Scene();scene.background=new THREE.Color(0x060c1b);scene.fog=new THREE.FogExp2(0x091827,0.009);
async function load(){
 let url=new URLSearchParams(location.search).get("world") || "data/russell-266.json";
 if(url && !/^[-\w/]+\.json$/.test(url)){error.textContent="World path rejected. Use a local relative JSON path.";url=null;}
 if(url){try{const resp=await fetch(import.meta.env.BASE_URL+url.replace(/^\//,""));if(!resp.ok)throw Error("HTTP "+resp.status);data=assertWorld(await resp.json());}
 catch(e){error.textContent="World dataset failed: "+e.message+"; displaying clearly labeled synthetic fixture.";}}
 if(!data)data=assertWorld(demoWorld());
 source.textContent=data.meta.kind==="measured"?"REAL MAP + USGS ELEVATION: "+data.meta.label:data.meta.kind==="mapped"?"REAL OSM MAP / FLAT TERRAIN PLACEHOLDER: "+data.meta.label:"SYNTHETIC DEMO — NOT LIDAR / OSM";
 source.className="notice "+(data.meta.kind==="synthetic"?"synthetic":"measured");
 details.textContent=data.size+"m × "+data.size+"m · "+data.buildings.length+" footprints · "+data.roads.length+" roads · style seed "+seed+" · "+(current?.detailStats ? `${current.detailStats.windows} windows · ${current.detailStats.signs} signs · ` : "")+(data.meta.elevation_note||data.meta.attribution||"");
 rebuild();
}
function rebuild(){
 if(current){scene.remove(current.group);current.dispose();}
 current=makeWorld(data,seed);scene.add(current.group);
 camera.position.set(0,heightAt(data,0,0)+1.72,0);
 if(!canOccupy(0,0,current.colliderPolys,data.size)){let placed=false;for(let r=10;r<data.size/2&&!placed;r+=10)for(let a=0;a<32;a++){const x=r*Math.cos(a*Math.PI/16),z=r*Math.sin(a*Math.PI/16);if(canOccupy(x,z,current.colliderPolys,data.size)){camera.position.set(x,heightAt(data,x,z)+1.72,z);placed=true;break;}}}
 details.textContent=data.size+"m × "+data.size+"m · "+data.buildings.length+" footprints · "+data.roads.length+" roads · style seed "+seed+" · "+(current?.detailStats ? `${current.detailStats.windows} windows · ${current.detailStats.signs} signs · ` : "")+(data.meta.elevation_note||data.meta.attribution||"");
}
document.querySelector("#enter").addEventListener("click",()=>canvas.requestPointerLock());
canvas.addEventListener("click",()=>{if(!locked)canvas.requestPointerLock();});
document.addEventListener("pointerlockchange",()=>{locked=document.pointerLockElement===canvas;document.body.classList.toggle("playing",locked);});
document.addEventListener("mousemove",e=>{if(!locked)return;camera.rotation.y-=e.movementX*0.002;camera.rotation.x=Math.max(-1.4,Math.min(1.4,camera.rotation.x-e.movementY*0.002));});
document.addEventListener("keydown",e=>{keys.add(e.code);if(["KeyW","KeyA","KeyS","KeyD","Space"].includes(e.code))e.preventDefault();});
document.addEventListener("keyup",e=>keys.delete(e.code));
window.addEventListener("blur",()=>keys.clear());
document.querySelector("#regen").addEventListener("click",()=>{seed=(seed*1664525+1013904223)>>>0;rebuild();});
document.querySelector("#reset").addEventListener("click",()=>rebuild());
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
const clock=new THREE.Clock();
function frame(){
 requestAnimationFrame(frame);const dt=Math.min(clock.getDelta(),0.05);
 if(current&&locked){
   const speed=(keys.has("ShiftLeft")?13:6)*dt, f=Number(keys.has("KeyW"))-Number(keys.has("KeyS")),s=Number(keys.has("KeyD"))-Number(keys.has("KeyA"));
   const len=Math.hypot(f,s)||1,ang=camera.rotation.y,dx=(-Math.sin(ang)*f+Math.cos(ang)*s)/len*speed,dz=(-Math.cos(ang)*f-Math.sin(ang)*s)/len*speed;
   const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/0.25));
   for(let i=0;i<steps;i++){let x=camera.position.x+dx/steps,z=camera.position.z+dz/steps;
     if(canOccupy(x,camera.position.z,current.colliderPolys,data.size))camera.position.x=x;
     if(canOccupy(camera.position.x,z,current.colliderPolys,data.size))camera.position.z=z;
   }
   camera.position.y=heightAt(data,camera.position.x,camera.position.z)+1.72;
 }
 if(current)current.update(performance.now()/1000);
 renderer.render(scene,camera);
}
load().catch(e=>{error.textContent=e.message;});frame();
