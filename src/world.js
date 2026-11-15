import * as THREE from "three";
import { decorateWorld } from "./details.js";
import {heightAt,rng,stableHash,pointInPolygon} from "./geo.js";
const CYAN=0x39e8ee, PINK=0xff44ba;
export function makeWorld(data,seed=2049) {
 const group=new THREE.Group(), random=rng(seed), size=data.size, n=data.terrain.n;
 const geo=new THREE.PlaneGeometry(size,size,n-1,n-1);
 geo.rotateX(-Math.PI/2);
 const pos=geo.getAttribute("position");
 // PlaneGeometry has negative Z ordering after rotateX; sample by actual local coordinates.
 for(let i=0;i<pos.count;i++){ const x=pos.getX(i), z=pos.getZ(i);pos.setY(i,heightAt(data,x,z)-0.2); }
 geo.computeVertexNormals();
 const ground=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0x17252b,roughness:0.89,metalness:0.2,flatShading:false}));
 group.add(ground);
 const grid=new THREE.GridHelper(size,25,0x194557,0x152b3e);grid.position.y=Math.min(...data.terrain.heights)-0.18;group.add(grid);
 const roadMat=new THREE.MeshStandardMaterial({color:0x111720,roughness:0.24,metalness:0.65,side:THREE.DoubleSide});
 const stripeMat=new THREE.MeshBasicMaterial({color:0x376a81,transparent:true,opacity:0.65});
 for(const line of data.roads??[]) for(let i=0;i<line.length-1;i++){
   const [ax,az]=line[i], [bx,bz]=line[i+1], dx=bx-ax,dz=bz-az, len=Math.hypot(dx,dz);
   if(len<0.1) continue;
   const steps=Math.max(2,Math.ceil(len/3)), vertices=[],uvs=[],indices=[];
   for(let s=0;s<=steps;s++){const t=s/steps,x=ax+dx*t,z=az+dz*t,ox=-dz/len*5,oz=dx/len*5;
     for(const sign of [-1,1]){vertices.push(x+ox*sign,heightAt(data,x+ox*sign,z+oz*sign)+0.07,z+oz*sign);uvs.push(t,sign);}
     if(s<steps){let k=s*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
   }
   const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));g.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();
   group.add(new THREE.Mesh(g,roadMat));
   const stripePoints=[];for(let s=0;s<=steps;s++){let t=s/steps,x=ax+dx*t,z=az+dz*t;stripePoints.push(new THREE.Vector3(x,heightAt(data,x,z)+0.1,z));}
   const streak=new THREE.Line(new THREE.BufferGeometry().setFromPoints(stripePoints),new THREE.LineDashedMaterial({color:0x4ec9d9,dashSize:2,gapSize:4,transparent:true,opacity:0.45}));streak.computeLineDistances();group.add(streak);
 }
 const colliderPolys=[], buildingRecords=[];
 const wallMaterials=[0x19252d,0x22323d,0x25313b,0x152734].map(color=>new THREE.MeshStandardMaterial({color,metalness:0.55,roughness:0.55}));
 const glowMaterials=[CYAN,PINK,0xffad44,0xb3ff4c].map(color=>new THREE.MeshBasicMaterial({color}));
 for(const b of data.buildings??[]){
   const shape=new THREE.Shape(), fp=b.footprint;
   fp.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
   const height=Number.isFinite(b.height)&&b.height>2?b.height:(12+Math.floor(random()*18)*2);
   const geom=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,steps:1});
   geom.rotateX(-Math.PI/2); // Shape y=-z => world z after transform.
   let base=0;for(const [x,z] of fp)base+=heightAt(data,x,z);base/=fp.length;
   geom.translate(0,base,0);
   const m=new THREE.Mesh(geom,wallMaterials[Math.floor(random()*wallMaterials.length)]);group.add(m);
   colliderPolys.push(fp);
   buildingRecords.push({building:b,base,height});
   // Thin procedural neon rooftop fins, seeded independently from geographic coordinates.
   const color=glowMaterials[Math.floor(random()*glowMaterials.length)];
   const [x,z]=fp[0];const fin=new THREE.Mesh(new THREE.BoxGeometry(0.45,Math.min(height,15),0.45),color);
   fin.position.set(x,base+height-Math.min(height,15)/2+0.4,z);group.add(fin);
 }
 const detailing=decorateWorld(group,data,seed,buildingRecords);
 const stars=new THREE.BufferGeometry(), count=450, drops=new Float32Array(count*3);
 for(let i=0;i<count;i++){drops[i*3]=(random()-.5)*size;drops[i*3+1]=random()*34+1;drops[i*3+2]=(random()-.5)*size;}
 stars.setAttribute("position",new THREE.BufferAttribute(drops,3));
 const rain=new THREE.Points(stars,new THREE.PointsMaterial({color:0x64b6ef,size:0.22,transparent:true,opacity:0.65}));group.add(rain);
 const lamps=[];for(const road of (data.roads??[]).slice(0,8))for(const [x,z] of road.filter((_,i)=>i%2===0)){
   const light=new THREE.PointLight(random()>0.5?CYAN:PINK,8,30,2);light.position.set(x,heightAt(data,x,z)+6,z);group.add(light);lamps.push(light);
 }
 const sun=new THREE.HemisphereLight(0x48769e,0x090d19,1.35);group.add(sun);
 group.add(new THREE.DirectionalLight(0x5f779b,0.65));
 return {group,colliderPolys,detailStats:detailing.stats,update(time){const a=rain.geometry.attributes.position;for(let i=0;i<count;i++){let v=a.array[i*3+1]-0.35;if(v<0)v+=35;a.array[i*3+1]=v;}a.needsUpdate=true;},dispose(){group.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])if(!wallMaterials.includes(m)&&!glowMaterials.includes(m)&&m!==roadMat&&m!==stripeMat){ m.map?.dispose();m.dispose(); }}});roadMat.dispose();stripeMat.dispose();wallMaterials.forEach(x=>x.dispose());glowMaterials.forEach(x=>x.dispose());}};
}
export function canOccupy(x,z,polys,size) {return Math.abs(x)<size/2-2&&Math.abs(z)<size/2-2&&!polys.some(p=>pointInPolygon(x,z,p));}
