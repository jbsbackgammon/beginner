import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
const js=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');

test('final-results PDF title is repeated with the column header across pages',()=>{
  assert.match(js, /class="report-title-row"/);
  assert.match(js, /<thead>\$\{repeatHeading\}<tr class="report-column-row"/);
  assert.match(css, /#print-area \.report-data-table thead\s*\{\s*display:table-header-group!important;/);
});
test('roster append row has a single 1px top divider',()=>{
  assert.match(css, /#app \.roster-matrix tbody tr:last-child > td\s*\{\s*border-bottom:0!important;/);
  assert.match(css, /#app \.roster-matrix tfoot \.roster-add-row > td\s*\{\s*border:0!important;\s*border-top:1px solid #cbd8d0!important;/);
});
