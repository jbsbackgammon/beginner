import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Exercise the same markup helper used in rankings, full PDF, and individual PDF.
const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const functionSource = source.match(/function adoptedDayIcons\(row\)\{[\s\S]*?\n\}\n(?=function pdfEditionTitle)/)?.[0];
assert.ok(functionSource, 'adoptedDayIcons helper must exist');

function render(entries, selectedDays) {
 const edition={matches:[]};
 const fn=runInNewContext(`${functionSource}\nadoptedDayIcons`, {
  player:()=>({entries}), ed:()=>edition,
  esc:s=>String(s), dayName:s=>s,
 });
 return fn({id:7,selectedDays});
}

function icons(html){
 return [...html.matchAll(/<span class="adopted-day ([^"]+)"[^>]*>(.*?)<\/span>/g)]
  .map(m=>({cls:m[1],text:m[2]}));
}

test('Day1+3 keeps the hidden Day2 slot between ① and ③',()=>{
 assert.deepEqual(icons(render(['day1','day3'], ['day1','day3'])), [
  {cls:'is-adopted',text:'①'},
  {cls:'is-not-entered',text:''},
  {cls:'is-adopted',text:'③'},
 ]);
});

test('Day2+3 keeps the hidden Day1 slot before ②',()=>{
 assert.deepEqual(icons(render(['day2','day3'], ['day2','day3'])), [
  {cls:'is-not-entered',text:''},
  {cls:'is-adopted',text:'②'},
  {cls:'is-adopted',text:'③'},
 ]);
});

test('Attended-but-not-adopted Day remains visible with gray text',()=>{
 assert.deepEqual(icons(render(['day1','day2','day3'], ['day1','day3'])), [
  {cls:'is-adopted',text:'①'},
  {cls:'is-not-adopted',text:'②'},
  {cls:'is-adopted',text:'③'},
 ]);
});
