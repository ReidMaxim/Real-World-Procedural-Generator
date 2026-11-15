// Pure geographic-world validation and interpolation. Units are local meters.
export function assertWorld(data) {
  if (!data || data.schema !== 1 || !data.meta || !["synthetic", "mapped", "measured"].includes(data.meta.kind)) throw Error("Invalid world provenance");
  if (!Number.isFinite(data.size) || data.size < 20 || data.size > 5000) throw Error("Invalid world size");
  const t = data.terrain;
  if (!t || !Number.isInteger(t.n) || t.n < 2 || t.n > 1025 || !Array.isArray(t.heights) || t.heights.length !== t.n * t.n || t.heights.some(v => !Number.isFinite(v))) throw Error("Invalid elevation grid");
  for (const road of data.roads ?? []) for (const pt of road) if (!Array.isArray(pt) || pt.length !== 2 || !pt.every(Number.isFinite)) throw Error("Invalid road");
  for (const b of data.buildings ?? []) if (!Array.isArray(b.footprint) || b.footprint.length < 3 || b.footprint.some(pt => !Array.isArray(pt) || pt.length !== 2 || !pt.every(Number.isFinite))) throw Error("Invalid building footprint");
  return data;
}
export function heightAt(world, x, z) {
  const { n, heights } = world.terrain, size = world.size;
  const gx = Math.max(0, Math.min(n - 1, (x / size + 0.5) * (n - 1)));
  const gz = Math.max(0, Math.min(n - 1, (z / size + 0.5) * (n - 1)));
  const i = Math.min(n - 2, Math.floor(gx)), j = Math.min(n - 2, Math.floor(gz)), u = gx - i, v = gz - j;
  const a = heights[j*n+i], b = heights[j*n+i+1], c = heights[(j+1)*n+i], d = heights[(j+1)*n+i+1];
  return a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v;
}
export function sampleTerrain(world, x, z) { return heightAt(world, x, z); }
export function stableHash(value) { let h=2166136261; for (const ch of String(value)) { h ^= ch.charCodeAt(0); h=Math.imul(h,16777619); } return h>>>0; }
export function rng(seed) { let s=seed>>>0; return () => ((s = (Math.imul(s,1664525)+1013904223)>>>0)/4294967296); }
export function pointInPolygon(x,z,pts) { let inside=false; for(let i=0,j=pts.length-1;i<pts.length;j=i++) { const [xi,zi]=pts[i],[xj,zj]=pts[j]; if((zi>z)!==(zj>z) && x < (xj-xi)*(z-zi)/(zj-zi)+xi) inside=!inside; } return inside; }
