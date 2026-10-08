import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canRegisterSelection} from '../src/ranking.mjs';

// Test the actual UI eligibility handler with a small, dependency-free fake form.
const src=readFileSync(new URL('../src/app.js', import.meta.url),'utf8');
const start=src.indexOf('function updateSubmitEnabled(form){');
const end=src.indexOf('\nfunction setWinner(form,side){',start);
assert.ok(start>=0&&end>start,'entry eligibility handler should be defined');
const updateSubmitEnabled=Function('player','canRegisterSelection',src.slice(start,end)+'\nreturn updateSubmitEnabled;')(
  id=>[1,2,3].includes(id)?{id}:undefined,canRegisterSelection
);
function makeForm(kind='points') {
  const inputs={a:{value:''},b:{value:''},points:{value:''},result:{value:''}};
  const buttons=[{disabled:false},{disabled:false}];
  if(kind==='two')buttons.push({disabled:false});
  const submit={disabled:false};
  return {inputs,buttons,submit,dataset:{winner:'',kind},
    elements:{namedItem(name){if(name==='result'&&kind!=='two')return null;if(name==='points'&&kind==='two')return null;return inputs[name]}},
    querySelectorAll(sel){return buttons},
    querySelector(sel){return submit},
  };
}
const check=(form)=>{updateSubmitEnabled(form);return form};
test('no or one registered player disables winners, score and submit',()=>{
  const f=makeForm();
  check(f);assert.ok(f.buttons.every(b=>b.disabled));assert.equal(f.inputs.points.disabled,true);assert.equal(f.submit.disabled,true);
  f.inputs.a.value='1';check(f);
  assert.ok(f.buttons.every(b=>b.disabled));assert.equal(f.inputs.points.disabled,true);assert.equal(f.submit.disabled,true);
});
test('two distinct players unlock outcomes; chosen outcome unlocks score; chosen score unlocks submit',()=>{
  const f=makeForm();f.inputs.a.value='1';f.inputs.b.value='2';check(f);
  assert.ok(f.buttons.every(b=>!b.disabled));assert.equal(f.inputs.points.disabled,true);assert.equal(f.submit.disabled,true);
  f.dataset.winner='a';check(f);assert.equal(f.inputs.points.disabled,false);assert.equal(f.submit.disabled,true);
  f.inputs.points.value='2';check(f);assert.equal(f.submit.disabled,false);
  f.inputs.b.value='1';check(f);assert.ok(f.buttons.every(b=>b.disabled));assert.equal(f.inputs.points.disabled,true);assert.equal(f.submit.disabled,true);
});
test('unknown player numbers are ineligible',()=>{
  const f=makeForm();f.inputs.a.value='1';f.inputs.b.value='999';f.dataset.winner='a';f.inputs.points.value='1';check(f);
  assert.ok(f.buttons.every(b=>b.disabled));assert.equal(f.inputs.points.disabled,true);assert.equal(f.submit.disabled,true);
});
test('two-point draw button and matching score require a valid player pair',()=>{
  const f=makeForm('two');check(f);assert.ok(f.buttons.every(b=>b.disabled));
  f.inputs.a.value='1';f.inputs.b.value='2';check(f);
  assert.ok(f.buttons.every(b=>!b.disabled));assert.equal(f.inputs.result.disabled,true);
  f.dataset.winner='draw';check(f);assert.equal(f.inputs.result.disabled,false);assert.equal(f.submit.disabled,true);
  f.inputs.result.value='1-1';check(f);assert.equal(f.submit.disabled,false);
  f.inputs.result.value='2-0';check(f);assert.equal(f.submit.disabled,true);
});
test('winner button disabled markup, player-number sorting and yellow notice styling are present',()=>{
  assert.match(src,/pairReady\?'':'disabled'/);
  assert.match(src,/\.sort\(\(a,b\)=>a\.id-b\.id\)/);
  const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
  assert.match(css,/\.topbar \.tabs #notice\.show\s*\{\s*background:#ffe58c;/);
});
