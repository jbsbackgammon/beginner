import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const start=source.indexOf('function playerOptions(selected=null,excluded=null){');
const end=source.indexOf('\nfunction renderEditionPicker(){',start);
assert.ok(start>=0&&end>start,'playerOptions signature exists');
const names=[{id:10,name:'十'},{id:2,name:'二'},{id:1,name:'一'}];
const playerOptions=Function('ed','esc',source.slice(start,end)+'\nreturn playerOptions;')(
 ()=>({players:names}), v=>String(v)
);

test('opponent is absent rather than merely disabled',()=>{
 const options=playerOptions(2,1);
 assert.doesNotMatch(options,/value="1"/);
 assert.match(options,/value="2" selected/);
 assert.match(options,/value="10"/);
 assert.ok(options.indexOf('value="2"')<options.indexOf('value="10"'));
});
test('when opponent is unselected, all players reappear',()=>{
 const options=playerOptions(null,null);
 for(const id of [1,2,10])assert.match(options,new RegExp(`value="${id}"`));
});
