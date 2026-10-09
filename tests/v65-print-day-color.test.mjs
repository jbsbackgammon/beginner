import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');

test('printed overall Day badge uses black instead of green while screen keeps its original green',()=>{
  assert.match(css,/\.adopted-day\.is-adopted\{background:#16804e;color:#fff/);
  const printRules=css.slice(css.indexOf('/* v65: Use black'));
  assert.match(printRules,/@media print\s*\{/);
  assert.match(printRules,/#print-area \.report-data-table \.adopted-day\.is-adopted/);
  assert.match(printRules,/#print-area \.personal-card \.adopted-day\.is-adopted/);
  assert.match(printRules,/background:#000!important;/);
  assert.match(printRules,/color:#fff!important;/);
  assert.doesNotMatch(printRules,/#16804e/);
});
