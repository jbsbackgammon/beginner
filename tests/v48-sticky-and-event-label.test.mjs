import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EVENTS} from '../src/ranking.mjs';
const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
test('2pt event uses shortened official name without changing its ID',()=>{
  const event=EVENTS.find(e=>e.id==='two');
  assert.equal(event.label,'2ptマッチラウンドロビン');
  assert.equal(event.kind,'two');
});
test('sticky table header keeps line while scrolling, including Chromium collapsed-border fix',()=>{
  assert.match(css,/#app \.data-table \{\s*border-collapse:separate!important;/);
  assert.match(css,/#app \.data-table thead th \{[\s\S]*?border-bottom:1px solid #9eb3a9!important;/);
  assert.match(css,/#app \.data-table thead th::after \{[\s\S]*?height:2px;/);
});


test('overall standings and PDF use Day as column label',()=>{
  const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  assert.match(app,/overall\?\['Day'\]/);
  assert.match(app,/td\('Day',adoptedDayIcons\(r\)/);
  assert.match(app,/aria-label="Day"/);
  assert.doesNotMatch(app,/採用Day/);
});
