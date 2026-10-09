import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const js=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const start=js.indexOf('function onAction(action,id){');
const end=js.indexOf("document.querySelectorAll('[data-tab]')",start);
assert.ok(start>=0&&end>start,'action dispatcher is present');
const actions=js.slice(start,end);

// A re-render removes and replaces the history scrolling element. Simulate
// this operation and a narrow-screen page scroll reset to verify both values
// are restored after the existing match is selected for editing.
test('editing an old result keeps the history scroll and page position',()=>{
 let history={scrollTop:820};
 const header={value:'day1'};
 let pageX=15,pageY=410,renderCount=0;
 const win={
  get scrollX(){return pageX;},get scrollY(){return pageY;},
  scrollTo(x,y){pageX=x;pageY=y;}
 };
 const deps={
  ed:()=>({matches:[{id:'old',event:'day1',matchNo:4,a:1,b:2,sa:1,sb:0}]}),
  $:id=>id==='history-results'?history:id==='header-event'?header:null,
  window:win,
  render:()=>{renderCount++;history={scrollTop:0};pageX=0;pageY=0;}
 };
 const factory=Function('deps',`
  let activeEvent='day1',tab='entry',editingMatch=null,preselectedPair=null;
  const {ed,$,window,render}=deps;
  ${actions}
  return {onAction,getState:()=>({activeEvent,tab,editingMatch,preselectedPair})};
 `);
 const {onAction,getState}=factory(deps);
 onAction('edit-match','old');
 assert.equal(renderCount,1);
 assert.equal(history.scrollTop,820,'the history row remains in the same scrolled area');
 assert.deepEqual([pageX,pageY],[15,410],'the page position remains unchanged on narrow screens');
 assert.deepEqual(getState(),{activeEvent:'day1',tab:'entry',editingMatch:'old',preselectedPair:null});
 assert.equal(header.value,'day1');
});

test('a missing match does not change scroll or trigger render',()=>{
 let history={scrollTop:315};let count=0;
 const deps={ed:()=>({matches:[]}),$:id=>id==='history-results'?history:{value:'day1'},window:{scrollX:0,scrollY:0,scrollTo:()=>{count++;}},render:()=>{count++;}};
 const {onAction}=Function('deps',`let activeEvent='day1',tab='entry',editingMatch=null,preselectedPair=null;const {ed,$,window,render}=deps;${actions};return {onAction}`)(deps);
 onAction('edit-match','not-found');
 assert.equal(count,0);
 assert.equal(history.scrollTop,315);
});
