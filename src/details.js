import * as THREE from "three";
import { heightAt, rng, stableHash } from "./geo.js";

// Visual dressing only. Source geography and building footprints remain untouched.
// Batch windows in one draw call per color, rather than constructing thousands of meshes.
export function decorateWorld(group, data, seed, buildingRecords) {
  const random = rng(seed ^ 0x923af1);
  const assets = new THREE.Group();
  group.add(assets);
  const palette = [0x54ebff, 0xff55c8, 0xffbf68, 0xa7fa78];
  const windowColors = [0x182b38, 0x59d5e4, 0xf2a0ca, 0xffcc79];
  const windowInstances = windowColors.map(() => []);
  const frameInstances = [];
  const roofInstances = [];
  const edgeInstances = [];
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0,1,0);
  function put(list,x,y,z,w,h,d,angle=0) {
    position.set(x,y,z);
    quaternion.setFromAxisAngle(yAxis, angle);
    scale.set(w,h,d);
    matrix.compose(position, quaternion, scale);
    list.push(matrix.clone());
  }
  for (const record of buildingRecords) {
    const { footprint: fp } = record.building;
    const height = record.height, base = record.base;
    const r = rng(stableHash(record.building.id ?? JSON.stringify(fp)) ^ seed);
    // Horizontal facade panels and individual windows face each footprint edge.
    for(let i=0;i<fp.length;i++){
      const a=fp[i],b=fp[(i+1)%fp.length],dx=b[0]-a[0],dz=b[1]-a[1];
      const len=Math.hypot(dx,dz);if(len<3)continue;
      const angle=-Math.atan2(dz,dx), nx=dz/len, nz=-dx/len;
      const cols=Math.min(22,Math.floor(len/2.5));
      const floors=Math.min(22,Math.floor((height-2)/3.2));
      const cx=(a[0]+b[0])/2+nx*.09,cz=(a[1]+b[1])/2+nz*.09;
      for(let row=0;row<floors;row++){
        const yy=base+2.65+row*3.2;
        // Strong horizontal bands give large buildings a readable silhouette.
        if(row%3===0)put(edgeInstances,cx,yy+0.76,cz,len,0.075,0.18,angle);
        for(let c=0;c<cols;c++){
          const t=(c+.5)/cols,x=a[0]+dx*t+nx*.17,z=a[1]+dz*t+nz*.17;
          const lit=r();
          const color=lit<.48?0:lit<.78?1:lit<.93?2:3;
          put(windowInstances[color],x,yy,z,Math.min(1.4,len/cols*.66),1.15,.075,angle);
          if(lit>.82)put(frameInstances,x,yy+0.7,z,Math.min(1.5,len/cols*.7),.05,.12,angle);
        }
      }
      // Corners and side ribs make the silhouette feel less like an untextured block.
      const ribCount=Math.min(8,Math.floor(len/12));
      for(let c=0;c<=ribCount;c++){const t=c/Math.max(1,ribCount),x=a[0]+dx*t+nx*.12,z=a[1]+dz*t+nz*.12;
        put(edgeInstances,x,base+height/2,z,.15,height,.24,angle);
      }
    }
    const cx=fp.reduce((s,p)=>s+p[0],0)/fp.length,cz=fp.reduce((s,p)=>s+p[1],0)/fp.length;
    // Air handlers and roof vents add useful irregularity to the skyline.
    for(let i=0;i<Math.min(4,1+Math.floor(r()*4));i++){
      const x=cx+(r()-.5)*5,z=cz+(r()-.5)*5;
      put(roofInstances,x,base+height+0.6,z,1.3+r()*1.7,1.2,1.1+r(),r()*Math.PI);
    }
  }
  function createInstances(items,material,geometry,limit=50000){
    if(!items.length)return;
    const mesh=new THREE.InstancedMesh(geometry,material,Math.min(items.length,limit));
    items.slice(0,limit).forEach((m,i)=>mesh.setMatrixAt(i,m));
    mesh.instanceMatrix.needsUpdate=true;
    mesh.frustumCulled=false;assets.add(mesh);
  }
  const windowGeo=new THREE.BoxGeometry(1,1,1);
  windowInstances.forEach((items,i)=>createInstances(items,new THREE.MeshBasicMaterial({color:windowColors[i],transparent:i===0,opacity:i===0?.85:1}),windowGeo));
  createInstances(frameInstances,new THREE.MeshBasicMaterial({color:0x81b7c8}),windowGeo);
  createInstances(edgeInstances,new THREE.MeshStandardMaterial({color:0x364650,metalness:.65,roughness:.46}),windowGeo);
  createInstances(roofInstances,new THREE.MeshStandardMaterial({color:0x263740,metalness:.65,roughness:.65}),windowGeo);

  // Small curated sign atlas: every billboard is a generated CanvasTexture.
  const labels=["NIGHT MARKET","SECTOR 07","KIRA RAMEN","SYNTH LAB","DATA EXCHANGE","VOID HOTEL","METRO","NOVA TECH","GHOST SIGNAL","NOODLES","OPEN 24H","UPLINK"];
  const signMaterials=[];
  function signTexture(text,color){
    const canvas=document.createElement("canvas");canvas.width=512;canvas.height=128;
    const ctx=canvas.getContext("2d");
    ctx.fillStyle="#06111b";ctx.fillRect(0,0,512,128);
    ctx.strokeStyle=color;ctx.lineWidth=9;ctx.strokeRect(8,8,496,112);
    ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=16;ctx.font="bold 43px monospace";
    ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(text,256,67,455);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
  }
  const signGeos=[];
  for(let i=0;i<Math.min(26,buildingRecords.length);i++){
    const record=buildingRecords[i],fp=record.building.footprint;
    if(fp.length<2)continue;
    const a=fp[0],b=fp[1],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
    if(len<5)continue;
    const index=Math.floor(random()*labels.length),color=["#64ecff","#ff65c2","#ffbd64","#bbf68a"][i%4];
    const texture=signTexture(labels[index],color);
    const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,transparent:false});
    signMaterials.push(material);
    const width=Math.min(9,Math.max(4,len*.65));
    const geom=new THREE.PlaneGeometry(width,1.9);signGeos.push(geom);
    const sign=new THREE.Mesh(geom,material);
    sign.position.set((a[0]+b[0])/2+dz/len*.27,record.base+Math.min(record.height-2,5), (a[1]+b[1])/2-dx/len*.27);
    sign.rotation.y=-Math.atan2(dz,dx);
    assets.add(sign);
  }

  // Roadside poles and local lights use sparse placement to avoid GPU light overload.
  const polePositions=[];
  for (const line of data.roads??[])for(let segment=0;segment<line.length-1;segment++){
    const a=line[segment],b=line[segment+1],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
    if(len<1)continue;
    for(let dist=14;dist<len;dist+=36){
      const t=dist/len,side=segment%2?1:-1,x=a[0]+dx*t-dz/len*7*side,z=a[1]+dz*t+dx/len*7*side;
      if(Math.abs(x)>data.size/2-8||Math.abs(z)>data.size/2-8)continue;
      polePositions.push({x,z,y:heightAt(data,x,z)});
    }
  }
  const poleMatrices=[],poleGlow=[];
  polePositions.slice(0,48).forEach((p,i)=>{
    put(poleMatrices,p.x,p.y+3,p.z,.15,6,.15);
    put(poleGlow,p.x,p.y+6.1,p.z,1.3,.15,.55);
    if(i<12){const light=new THREE.PointLight(palette[i%palette.length],3,20,2);light.position.set(p.x,p.y+6,p.z);assets.add(light);}
  });
  createInstances(poleMatrices,new THREE.MeshStandardMaterial({color:0x31444b,metalness:.85}),windowGeo);
  createInstances(poleGlow,new THREE.MeshBasicMaterial({color:0x55dbf7}),windowGeo);

  // Neon guard rails, debris and service cabinets are geometric, seeded and low-poly.
  const cabinetMatrices=[],crateMatrices=[];
  for(const p of polePositions.slice(0,36)){
    if(random()<.56)put(cabinetMatrices,p.x+2,p.y+.85,p.z+1,.8,1.7,.65);
    if(random()<.45)put(crateMatrices,p.x-1.7,p.y+.34,p.z-2,.7,.7,.7);
  }
  createInstances(cabinetMatrices,new THREE.MeshStandardMaterial({color:0x42535b,roughness:.75}),windowGeo);
  createInstances(crateMatrices,new THREE.MeshStandardMaterial({color:0x5e4a3a,roughness:.95}),windowGeo);

  return { assets,stats:{windows:windowInstances.reduce((sum,items)=>sum+items.length,0),signs:signMaterials.length,poles:polePositions.length} };
}
