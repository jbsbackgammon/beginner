import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const fnSource=source.match(/function statsTable\(eventId,preview=false\)\{[\s\S]*?\n\}\n(?=function rosterNumbers)/)?.[0];
assert.ok(fnSource,'statsTable source not found');
const row={rank:1,id:9,name:'け',matches:14,wins:9,losses:5,draws:0,spread:4,rate:9/14,scored:19,conceded:6,diff:13,selectedDays:['day1','day3']};
const statsTable=runInNewContext(`${fnSource}\nstatsTable`,{
 standings:()=>[row],ed:()=>({}),esc:s=>String(s),formatRate:n=>String(n),adoptedDayIcons:()=>'<span class="adopted-days">①②③</span>',
});
for(const event of ['overall','day1','two','cube','school']){
 test(`the ${event} ranking widens only the player column; rank is half width`,()=>{
   const html=statsTable(event);
   const cols=html.match(/<colgroup>(.*?)<\/colgroup>/)?.[1];
   assert.ok(cols,'colgroup must exist');
   const widths=[...cols.matchAll(/<col style="width:([\d.]+)%">/g)].map(m=>Number(m[1]));
   const headers=(html.match(/<thead><tr>(.*?)<\/tr><\/thead>/)?.[1].match(/<th>/g)||[]).length;
   assert.equal(widths.length,headers);
   assert.ok(widths.length>2);
   assert.ok(Math.abs(widths.reduce((a,b)=>a+b,0)-100)<0.002);
   assert.ok(Math.abs(widths[1]-3*widths[0])<0.0001);
   for(const w of widths.slice(2))assert.ok(Math.abs(w-2*widths[0])<0.0001);
 });
}
