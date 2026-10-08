import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const src=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const extract=(start,end)=>{const a=src.indexOf(start),b=src.indexOf(end,a+1);assert.ok(a>=0&&b>a);return src.slice(a,b);};
const fake=[{rank:1,id:9,name:'長い日本語の選手名',matches:3,wins:2,losses:1,draws:0,spread:1,rate:.6667,scored:8,conceded:5,diff:3,selectedDays:['day1','day3']}];
const context={eventById:()=>({label:'初級戦Day1'}),dateFor:()=> '2026-10-10',standings:()=>fake,ed:()=>({name:'BACKGAMMON CLASSIC 2026'}),esc:s=>String(s),formatRate:()=> '66.7%',adoptedDayIcons:()=>'<span>① ③</span>',pdfHeading:()=>'<h2>最終成績</h2>'};
const stats=runInNewContext(extract('function statsTable(eventId,preview=false){','function rosterNumbers')+'\nstatsTable',context);
const final=runInNewContext(extract('function reportHTML(id){','// A4 portrait: two columns by four rows')+'\nreportHTML',context);
for (const [id,order] of [['day1',['得失点差','勝越','勝率']],['overall',['得失点差','勝越','勝率']],['two',['勝越','勝率','試合']]]){
  test(`${id}: ranking order is shown on a smaller second line in both tables`,()=>{
    for (const render of [stats,final]){
      const html=render(id);
      order.forEach((label,i)=>{
        assert.match(html,new RegExp(`<span class="rank-header-label">${label}</span><small class="rank-header-order">ー ${i+1} ー</small>`));
      });
      assert.doesNotMatch(html,/<th>①得失点差<\/th>/);
      assert.match(html,/<th>選手<\/th>/);
    }
  });
}
test('final results PDF player column is 24% and statistical columns stay equal',()=>{
  const html=final('overall');
  const widths=[...html.matchAll(/<col style="width:([\d.]+)%">/g)].map(x=>+x[1]);
  assert.equal(widths[0],7);assert.equal(widths[1],24);
  widths.slice(3).forEach(w=>assert.ok(Math.abs(w-widths[2])<.00001));
});
