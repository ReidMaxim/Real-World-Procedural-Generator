import test from "node:test";
import assert from "node:assert/strict";
import {assertWorld,heightAt,pointInPolygon,rng} from "../src/geo.js";
import {demoWorld} from "../src/demo.js";
test("demo is unambiguously synthetic",()=>{const w=assertWorld(demoWorld());assert.equal(w.meta.kind,"synthetic");assert.equal(w.terrain.heights.length,10201);});
test("height bilinear interpolation and clamping",()=>{const w={schema:1,size:20,terrain:{n:2,heights:[0,10,20,30]},meta:{kind:"measured"}};assertWorld(w);assert.equal(heightAt(w,0,0),15);assert.equal(heightAt(w,-10,-10),0);assert.equal(heightAt(w,10,10),30);});
test("invalid provenance rejected",()=>assert.throws(()=>assertWorld({...demoWorld(),meta:{kind:"unknown"}})));
test("polygon collision predicate",()=>{const p=[[0,0],[5,0],[5,5],[0,5]];assert.equal(pointInPolygon(2,2,p),true);assert.equal(pointInPolygon(6,2,p),false);});
test("seeded streams reproduce",()=>{const a=rng(2049),b=rng(2049);for(let i=0;i<20;i++)assert.equal(a(),b());});
