import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {EVENTS,standings,standingsWithUnranked,createDemoEdition} from '../src/ranking.mjs';
const src=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const style=readFileSync(new URL('../style.css',import.meta.url),'utf8');
const start=src.indexOf('function personalMatchSequence(eventId,row){');
const end=src.indexOf('function renderExport(){',start);
assert.ok(start>0&&end>start);
const demo=createDemoEdition(()=>0.417);
const context={
 ed:()=>demo,standings,standingsWithUnranked,EVENTS,
 player:id=>demo.players.find(p=>p.id===id),
 eventById:id=>EVENTS.find(e=>e.id===id),
 dateFor:id=>EVENTS.find(e=>e.id===id)?.date||'',
 venueFor:()=> 'ワイヤーズホテル品川シーサイド',
 pdfEditionTitle:()=> 'BACKGAMMON CLASSIC 2026',
 esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 formatRate:n=>`${(n*100).toFixed(1)}%`
};
const fn=runInNewContext(`${src.slice(start,end)}\n({personalMatchSequence,personalResultDots,personalReportHTML})`,context);
test('A4 exactly 2×4 with no sheet padding, grey edge dividers, and black titles',()=>{
 assert.match(style,/#print-area \.personal-sheet \{width:210mm!important;height:297mm!important;padding:0!important/);
 assert.match(style,/grid-template-columns:repeat\(2,105mm\)!important;grid-template-rows:repeat\(4,74\.25mm\)!important/);
 assert.match(style,/#print-area \.personal-card:nth-child\(odd\)/);
 assert.match(style,/#print-area \.personal-card:nth-child\(-n\+2\)/);
 assert.match(style,/personal-event-title.*color:#000/);
});
test('PDF uses number-sorted cards, prominent rank, separated dates and association',()=>{
 const html=fn.personalReportHTML('day1');
 assert.match(html,/BACKGAMMON CLASSIC 2026/);
 assert.match(html,/初級戦Day1　個人成績 #\d+/);
 assert.match(html,/class="personal-rank"><span class="personal-rank-label">優勝<\/span><span class="personal-rank-total"> \/ \d+名<\/span><\/div>/);
 assert.doesNotMatch(html,/class="personal-rank-label">第1位/);
 assert.match(html,/class="personal-rank-label">2位<\/span><span class="personal-rank-total"> \/ \d+名<\/span>/);
 assert.doesNotMatch(html,/class="personal-rank-label">第\d+位<\/span>/);
 assert.match(html,/勝越[+-]?\d+　勝率\d+\.\d%/);
 assert.match(html,/得点\d+　失点-\d+　得失点差[+-]?\d+/);
 assert.match(html,/2026-10-10　ワイヤーズホテル品川シーサイド/);
 assert.match(html,/主催　日本バックギャモン協会/);
 assert.equal((html.match(/class="personal-card(?: is-blank)?"/g)||[]).length,32);
 const ids=[...html.matchAll(/個人成績 #(\d+)/g)].map(v=>Number(v[1]));
 assert.deepEqual(ids,ids.slice().sort((a,b)=>a-b));
});
test('win/loss dots include match scores except 2-point match; draw is shown',()=>{
 const p=standings(demo,'day1')[0];
 const dots=fn.personalResultDots('day1',p);
 assert.match(dots,/class="personal-dot is-(win|lose)"/);
 assert.match(dots,/aria-label="[勝負] (?:1|2|3)点"/);
 const two=standings(demo,'two')[0];
 const twoDots=fn.personalResultDots('two',two);
 assert.match(twoDots,/class="personal-dot is-draw is-triangle"/);
 assert.match(twoDots,/aria-label="引分">△<\/span>/);
 assert.doesNotMatch(twoDots,/点"/);
 assert.doesNotMatch(twoDots,/class="personal-dot is-draw"[^>]*>\s*<\/span>/);
});
test('overall only prints adopted Day matches',()=>{
 const p=standings(demo,'overall')[0];
 const history=fn.personalMatchSequence('overall',p);
 const n=p.selectedDays.reduce((sum,day)=>sum+demo.matches.filter(m=>m.event===day&&(m.a===p.id||m.b===p.id)).length,0);
 assert.equal(history.length,n);
 assert.equal(history.length,p.matches);
});

test('personal PDF both numeric summary lines print with normal font weight',()=>{
 const block=style.match(/#print-area \.personal-card \.personal-summary,\s*#print-area \.personal-card \.personal-score-totals \{([^}]*)\}/g);
 assert.ok(block?.some(rule=>/font-weight:\s*400\s*!important/.test(rule)));
});
test('overall omits personal match symbols but keeps the two stats lines',()=>{
 const html=fn.personalReportHTML('overall');
 assert.match(html,/class="personal-summary"/);
 assert.match(html,/class="personal-score-totals"/);
 assert.doesNotMatch(html,/class="personal-dot/);
});
test('every personal match row uses the same ten-slot left-aligned grid',()=>{
 assert.match(style,/grid-template-columns:repeat\(10,var\(--personal-dot-size\)\)!important/);
 assert.match(style,/width:var\(--personal-row-width\)!important/);
 assert.match(style,/justify-content:start!important/);
});

test('the individual PDF rank is at least 28pt while summary text stays regular weight',()=>{
 assert.match(style,/#print-area \.personal-card \.personal-rank \{\s*font-size:28pt!important/);
});

test('personal PDF count uses ranked players and centers the whole rank-and-count group',()=>{
 const html=fn.personalReportHTML('day1');
 const participantCount=standings(demo,'day1').length;
 const totals=[...html.matchAll(/class="personal-rank-total"> \/ (\d+)名<\/span>/g)];
 assert.equal(totals.length,participantCount);
 assert.ok(totals.every(m=>Number(m[1])===participantCount));
 assert.match(style,/#print-area \.personal-card \.personal-rank \{\s*display:flex!important;\s*justify-content:center!important;\s*align-items:flex-end!important;/);
 assert.match(style,/#print-area \.personal-card \.personal-rank-total \{[^}]*white-space:pre!important;/);
 assert.doesNotMatch(style,/#print-area \.personal-card \.personal-rank-total \{[^}]*position:absolute;/);
 assert.match(style,/#print-area \.personal-card \.personal-rank-total \{[^}]*font-size:12pt!important;/);
});

test('personal PDF requested seven text groups are all 12pt',()=>{
 for (const selector of ['personal-event-title','personal-event-detail','personal-footer','personal-rank-total']) {
  const rules=[...style.matchAll(new RegExp(`#print-area \\.personal-card \\.${selector} \\{([^}]*)\\}`,'g'))];
  assert.ok(rules.some(rule=>/font-size:\s*12pt\s*!important/.test(rule[1])),`${selector} must be 12pt in print`);
 }
 assert.match(style,/#print-area \.personal-card \.personal-summary,\s*#print-area \.personal-card \.personal-score-totals \{\s*font-size:12pt!important/);
 assert.match(style,/#print-area \.personal-card \.personal-rank \{\s*font-size:28pt!important/);
});

// v68: The overall and event-specific personal PDFs show an explicit + for
// positive score differences, without prefixing 0 or a negative number.
test('personal score difference uses + only for positive values in every event',()=>{
 let positive=0,negative=0,zero=0;
 for(const event of EVENTS){
  const html=fn.personalReportHTML(event.id);
  const cards=[...html.matchAll(/<article class="personal-card">([\s\S]*?)<\/article>/g)];
  assert.ok(cards.length>0,`${event.id}: cards missing`);
  for(const [,card] of cards){
   const match=card.match(/class="personal-score-totals">得点(\d+)　失点(-?\d+)　得失点差([+-]?\d+)<\/div>/);
   assert.ok(match,`${event.id}: personal score totals missing`);
   const [,scored,conceded,displayed]=match;
   const diff=Number(scored)+Number(conceded);
   assert.equal(displayed,diff>0?`+${diff}`:String(diff),`${event.id}: unexpected difference prefix`);
   if(diff>0)positive++; else if(diff<0)negative++; else zero++;
  }
 }
 assert.ok(positive>0 && negative>0 && zero>0,'test sample must cover all three signs');
});
