// Intentionally synthetic fixture. Never present as downloaded LiDAR or OSM.
export function demoWorld() {
  const n=101, size=500, heights=[];
  for(let j=0;j<n;j++) for(let i=0;i<n;i++) {
    const x=(i/(n-1)-0.5)*size, z=(j/(n-1)-0.5)*size;
    heights.push(Math.round((4*Math.sin(x/96)+2.2*Math.cos(z/74)+1.5*Math.sin((x+z)/38))*100)/100);
  }
  const roads=[ [[-235,-48],[235,-48]], [[-235,85],[235,85]], [[-85,-235],[-85,235]], [[85,-235],[85,235]] ];
  const buildings=[];
  for(let ix=-4;ix<=4;ix++) for(let iz=-4;iz<=4;iz++){
    const x=ix*47+15,z=iz*47+13;
    if(Math.abs(x+85)<25 || Math.abs(x-85)<25 || Math.abs(z+48)<25 || Math.abs(z-85)<25) continue;
    buildings.push({id:"demo-"+ix+"-"+iz,footprint:[[x-15,z-14],[x+15,z-14],[x+15,z+14],[x-15,z+14]]});
  }
  return {schema:1,size,terrain:{n,heights},roads,buildings,meta:{kind:"synthetic",label:"Synthetic demonstration — NOT real-world mapping",attribution:"Generated fixture; no external source",center:null}};
}
