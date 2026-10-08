import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {latestResultRegistrationAt, needsTournamentConfirmation, REGISTRATION_CONFIRM_GAP_MS} from '../src/ranking.mjs';

const HOUR=60*60*1000;
const now=Date.UTC(2026,9,8,7);
const edition=(timestamp, matches=[])=>({lastResultRegisteredAt:timestamp,matches});

test('first result never prompts',()=>{
  assert.equal(latestResultRegistrationAt([edition(undefined)]),null);
  assert.equal(needsTournamentConfirmation([edition(undefined)],now),false);
});
test('threshold is exactly six hours',()=>{
  assert.equal(REGISTRATION_CONFIRM_GAP_MS,6*HOUR);
  assert.equal(needsTournamentConfirmation([edition(now-6*HOUR+1)],now),false);
  assert.equal(needsTournamentConfirmation([edition(now-6*HOUR)],now),true);
  assert.equal(needsTournamentConfirmation([edition(now-7*HOUR)],now),true);
});
test('uses most recent result across editions',()=>{
  const eds=[edition(now-8*HOUR),edition(now-5*HOUR)];
  assert.equal(latestResultRegistrationAt(eds),now-5*HOUR);
  assert.equal(needsTournamentConfirmation(eds,now),false);
});
test('v31 match IDs supply migration fallback, ignoring unrelated IDs',()=>{
  const older=now-8*HOUR;
  const recent=now-2*HOUR;
  const oldEdition={matches:[{id:`m${older}-abc123`},{id:'excel-match-99'}]};
  assert.equal(latestResultRegistrationAt([oldEdition]),older);
  assert.equal(needsTournamentConfirmation([oldEdition],now),true);
  oldEdition.matches.push({id:`m${recent}-def456`});
  assert.equal(needsTournamentConfirmation([oldEdition],now),false);
});
test('explicit registration timestamp survives deletions and JSON round trip',()=>{
  const eds=[edition(now-8*HOUR)];
  const restored=JSON.parse(JSON.stringify(eds));
  assert.equal(needsTournamentConfirmation(restored,now),true);
  restored[0].lastResultRegisteredAt=now;
  assert.equal(needsTournamentConfirmation(restored,now+HOUR),false);
  assert.equal(needsTournamentConfirmation(restored,now+6*HOUR),true);
});
test('correct save flow: only new entries guard, cancel avoids mutations, last timestamp updated after push',()=>{
  const code=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  assert.match(code,/!editingMatch\s*&&\s*needsTournamentConfirmation\(data\.editions\)/);
  assert.match(code,/if\(!confirm\(message\)\)return;/);
  assert.match(code,/大会名の確認/);
  assert.match(code,/大会名「\$\{evLabel\(activeEvent\)\}」に間違いないか確認してください。/);
  assert.doesNotMatch(code,/種目：\$\{evLabel\(activeEvent\)\}/);
  assert.match(code,/ed\(\)\.matches\.push\(m\);ed\(\)\.lastResultRegisteredAt=Date\.now\(\)/);
});
