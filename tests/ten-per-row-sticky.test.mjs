import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {EVENTS,standings,createDemoEdition} from '../src/ranking.mjs';
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
const begin=app.indexOf('function personalMatchSequence(eventId,row){');
const end=app.indexOf('function personalReportHTML(id){',begin);
const data=createDemoEdition(()=>0.417);
const c={
  ed:()=>data,EVENTS,
  esc:s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])),
};
const {personalMatchSequence,personalResultDots}=runInNewContext(`${app.slice(begin,end)}\n({personalMatchSequence,personalResultDots})`,c);
for(const event of ['day1','two','overall']) {
 test(`${event}: dots wrap after precisely ten results, with none discarded`,()=>{
  const r=standings(data,event)[0];
  const matches=personalMatchSequence(event,r);
  const html=personalResultDots(event,r);
  const rows=[...html.matchAll(/<div class="personal-result-row">([\s\S]*?)<\/div>/g)]
   .map(x=>(x[1].match(/class="personal-dot /g)||[]).length);
  assert.equal(rows.length,Math.ceil(matches.length/10));
  assert.deepEqual(rows,Array.from({length:rows.length},(_,i)=>Math.min(10,matches.length-i*10)));
  assert.equal(rows.reduce((a,b)=>a+b,0),matches.length);
 });
}
test('scrolling sticky headers retain their top and bottom 1px borders',()=>{
 assert.match(css,/#app \.data-table \{\s*border-collapse:separate!important;/);
 assert.match(css, /#app \.data-table thead th \{[^}]*border-top:1px solid #9eb3a9!important;[^}]*border-bottom:1px solid #9eb3a9!important;/s);
 assert.match(css, /#print-area \.personal-card \.personal-results\s*\{[^}]*max-height:none!important;[^}]*overflow:visible!important;/s);
});
