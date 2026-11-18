import test from 'node:test';
import assert from 'node:assert/strict';
import {arcDistanceKm,closestKm,distanceKm,paths,stats,matches,stage,dateTime} from '../web/model.mjs';
const storm={name:'Test',id:'example',year:2000,p:[[0,0,0,null,null,'TD'],[360,0,4,45,1000,'TS']]};
test('closest approach includes the segment between recorded fixes',()=>{
  assert.ok(closestKm(storm,[0,2])<0.001);
  assert.ok(Math.abs(arcDistanceKm([1,2],[0,0],[0,4])-111.195)<0.01);
});
test('segment ends, degenerate points and date line',()=>{
  assert.ok(Math.abs(arcDistanceKm([0,-1],[0,0],[0,4])-distanceKm([0,-1],[0,0]))<0.001);
  assert.ok(arcDistanceKm([0,-180],[0,179],[0,-179])<0.001);
  assert.equal(arcDistanceKm([0,0],[0,2],[0,2]),distanceKm([0,0],[0,2]));
  assert.deepEqual(paths([[0,0,179],[120,0,-179]]),[[[0,179],[0,181]]]);
});
test('gaps over 12 hours are excluded from drawing and proximity',()=>{
  const data={p:[[0,0,0],[780,0,4]]};
  assert.ok(closestKm(data,[0,2])>222);
  assert.equal(paths(data.p).length,2);
});
test('unknown observations and zeros remain distinct',()=>{
  assert.deepEqual(stats(storm),{peak:45,low:1000,duration:6});
  assert.equal(stats({p:[[0,1,1,null,null,'TD']]}).peak,null);
  assert.equal(stats({p:[[0,1,1,0,null,'TD']]}).peak,0);
});
test('queries combine tokens and historical time is UTC',()=>{
  assert.ok(matches(storm,'2000 tes'));assert.ok(!matches(storm,'1990'));
  assert.equal(stage('EX'),'Extratropical');assert.match(dateTime(-1),/1969/);assert.match(dateTime(0),/UTC/);
});
