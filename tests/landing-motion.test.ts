import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identityFaces,trackProgress} from '../apps/landing/src/identity-geometry.ts';

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
