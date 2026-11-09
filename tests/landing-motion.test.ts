import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identityFaces,trackProgress} from '../apps/landing/src/identity-geometry.ts';
import {resolveMotionPolicy} from '../apps/landing/src/motion-policy.ts';
import {introFrame} from '../apps/landing/src/opening.ts';

test('scroll progress clamps and handles a non-scrollable track',()=>{
  assert.equal(trackProgress(100,1700,1000),0);
  assert.equal(trackProgress(-350,1700,1000),.5);
  assert.equal(trackProgress(-900,1700,1000),1);
  assert.equal(trackProgress(-1,400,900),0);
  assert.equal(trackProgress(Number.NaN,1700,900),0);
});

test('original faceted identity stays finite, shaded and depth sorted at every pose',()=>{
  for(const turn of [-1,0,.5,1,2]){
    const faces=identityFaces(turn);
    assert.equal(faces.length,192);
    assert.ok(faces.every(face=>face.points.length===4&&face.points.every(([x,y])=>Number.isFinite(x)&&Number.isFinite(y))));
    assert.ok(faces.every(face=>face.shade>=0&&face.shade<=1));
    for(let i=1;i<faces.length;i++)assert.ok(faces[i]!.depth>=faces[i-1]!.depth);
  }
  assert.deepEqual(identityFaces(.4),identityFaces(.4));
  assert.notDeepEqual(identityFaces(0),identityFaces(1));
});

const inputs={width:1440,height:900,finePointer:true,reducedMotion:false,saveData:false,lowResource:false,hidden:false,queryOff:false,userMode:'auto' as const};

test('motion policy separates hidden animation from pin eligibility and handles viewport boundaries',()=>{
  assert.equal(resolveMotionPolicy(inputs).intro,true);
  assert.equal(resolveMotionPolicy({...inputs,width:600,height:900}).pin,false);
  assert.equal(resolveMotionPolicy({...inputs,width:600,height:900}).intro,true);
  assert.equal(resolveMotionPolicy({...inputs,height:600}).intro,false);
  assert.equal(resolveMotionPolicy({...inputs,hidden:true}).pin,true);
  assert.equal(resolveMotionPolicy({...inputs,hidden:true}).animate,false);
  assert.equal(resolveMotionPolicy({...inputs,width:0}).reason,'invalid-viewport');
});

test('motion policy blocks the intro for explicit and constrained modes',()=>{
  for(const patch of [{queryOff:true},{userMode:'off' as const},{reducedMotion:true},{saveData:true},{lowResource:true},{userMode:'reduced' as const}]) {
    const policy=resolveMotionPolicy({...inputs,...patch});
    assert.equal(policy.intro,false);
    assert.equal(policy.static,true);
  }
});

test('intro projection clamps exact opening boundaries and fails open for invalid time',()=>{
  assert.equal(introFrame(0).stage,'seed');
  assert.equal(introFrame(120).assembly,0);
  assert.equal(introFrame(560).assembly,1);
  assert.equal(introFrame(400).letters[0],0);
  assert.equal(introFrame(900).letters[0],1);
  assert.equal(introFrame(1040).descriptor,1);
  assert.equal(introFrame(1200).handoff,0);
  assert.equal(introFrame(1800).stage,'ready');
  assert.deepEqual(introFrame(Number.NaN),{stage:'ready',assembly:1,letters:[1,1,1,1,1,1,1],descriptor:1,handoff:1,nameOpacity:0,overlayOpacity:0});
});
