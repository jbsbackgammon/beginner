export const EVENTS = [
  { id: 'overall', label: '初級戦総合', short: '総合', date: '2026-10-12', kind: 'overall' },
  { id: 'day1', label: '初級戦Day1', short: 'Day1', date: '2026-10-10', kind: 'points' },
  { id: 'day2', label: '初級戦Day2', short: 'Day2', date: '2026-10-11', kind: 'points' },
  { id: 'day3', label: '初級戦Day3', short: 'Day3', date: '2026-10-12', kind: 'points' },
  { id: 'two', label: '2ポイントマッチラウンドロビン', short: '2pt RR', date: '2026-10-10', kind: 'two' },
  { id: 'cube', label: 'キューブ有ラウンドロビン', short: 'キューブ有RR', date: '2026-10-11', kind: 'cube' },
  { id: 'school', label: '小学生選手権', short: '小学生選手権', date: '', kind: 'points' },
];
export const eventById = (id) => EVENTS.find(e => e.id === id);
/** Result history matches player numbers, names, and readings only.
 * A number-only query must match a complete player number (not score or match number).
 */
export function historySearchMatches(match, rawQuery, players) {
  const query=String(rawQuery??'').trim().toLocaleLowerCase();
  if(!query)return true;
  const ids=[match.a,match.b];
  if(/^#?\d+$/.test(query)) {
    const number=Number(query.replace(/^#/,''));
    return ids.includes(number);
  }
  return ids.some(id=>{
    const player=(players||[]).find(p=>p.id===id);
    return [`#${id} ${player?.name||''}`,player?.name||'',player?.kana||'']
      .some(value=>String(value).toLocaleLowerCase().includes(query));
  });
}

export const allowedCubePoints = [1,2,3,4,6,8,12];
/** Only an explicit win/draw selection compatible with the score can be registered. */
export function canRegisterSelection(kind, selection, score='') {
  if(kind==='two'){
    return (selection==='a'&&['2-0','2-1'].includes(score))
      || (selection==='b'&&['1-2','0-2'].includes(score))
      || (selection==='draw'&&score==='1-1');
  }
  return (kind==='points'||kind==='cube')&&['a','b'].includes(selection);
}

export function validMatch(m, playerIds) {
  const ev = eventById(m.event);
  if (!ev || ev.kind === 'overall') return '大会が正しくありません。';
  if (!playerIds.has(m.a) || !playerIds.has(m.b)) return '選手番号が存在しません。';
  if (m.a === m.b) return '同じ選手同士は登録できません。';
  if (!Number.isInteger(m.sa) || !Number.isInteger(m.sb)) return '得点は整数で入力してください。';
  if (ev.kind === 'two') {
    if (![[2,0],[2,1],[1,1],[1,2],[0,2]].some(([a,b]) => a===m.sa && b===m.sb)) return '2pt戦は2-0・2-1・1-1・1-2・0-2のいずれかです。';
  } else {
    if (!((m.sa>0 && m.sb===0)||(m.sb>0 && m.sa===0))) return '勝者の得点を入力してください。';
    const pt = Math.max(m.sa,m.sb);
    if (ev.kind === 'cube' ? !allowedCubePoints.includes(pt) : ![1,2,3].includes(pt)) return '得点が大会ルールの範囲外です。';
  }
  return '';
}
const empty = p => ({ id:p.id, name:p.name, kana:p.kana||'', matches:0, wins:0, losses:0, draws:0, diff:0, scored:0, conceded:0, spread:0, rate:0, rank:null });
export function compareStats(a,b,kind) {
  const keys = kind === 'two' ? ['spread','rate','matches'] : ['diff','spread','rate'];
  for (const k of keys) if (a[k]!==b[k]) return b[k]-a[k];
  return 0;
}
export function assignRanks(arr, kind) {
  const sorted=[...arr].sort((a,b)=>compareStats(a,b,kind)|| (a.kana||a.name).localeCompare(b.kana||b.name,'ja') ||a.id-b.id);
  sorted.forEach((x,i)=>x.rank=(i && compareStats(sorted[i-1],x,kind)===0)?sorted[i-1].rank:i+1);
  return sorted;
}
/** Assign permanent, event-local match numbers to legacy results in entry order.
 * Numbers are never recycled after deletion; edits retain the original number.
 */
export function ensureMatchNumbers(edition) {
  const matches=edition.matches||[];
  if (!edition.nextMatchNumbers || typeof edition.nextMatchNumbers!=='object' || Array.isArray(edition.nextMatchNumbers)) edition.nextMatchNumbers={};
  for(const event of EVENTS.filter(e=>e.id!=='overall')) {
    const eventMatches=matches.filter(m=>m.event===event.id);
    const used=new Set();
    let highest=0;
    for(const m of eventMatches) {
      if(Number.isSafeInteger(m.matchNo) && m.matchNo>0 && !used.has(m.matchNo)) {
        used.add(m.matchNo);
        highest=Math.max(highest,m.matchNo);
      }else{
        m.matchNo=null;
      }
    }
    // Existing entries (including imported Excel records) retain their array order.
    for(const m of eventMatches) if(m.matchNo===null) m.matchNo=++highest;
    const previous=edition.nextMatchNumbers[event.id];
    edition.nextMatchNumbers[event.id]=Math.max(Number.isSafeInteger(previous)&&previous>0?previous:1,highest+1);
  }
  return edition;
}

/** Reserve a new number only when a result is first created. */
export function nextMatchNumber(edition,eventId) {
  if(!EVENTS.some(e=>e.id===eventId&&e.id!=='overall')) throw Error('Unknown match event');
  ensureMatchNumbers(edition);
  const number=edition.nextMatchNumbers[eventId];
  edition.nextMatchNumbers[eventId]=number+1;
  return number;
}

export function standings(edition,eventId) {
  if (eventId==='overall') return overallStandings(edition);
  const ev=eventById(eventId);
  if (!ev) return [];
  const byId = new Map((edition.players||[]).map(p=>[p.id,empty(p)]));
  for(const m of edition.matches||[]) {
    if(m.event!==eventId) continue;
    const a=byId.get(m.a), b=byId.get(m.b);
    if (!a||!b) continue;
    a.matches++; b.matches++;
    if(m.sa>m.sb){a.wins++;b.losses++} else if(m.sa<m.sb){b.wins++;a.losses++} else {a.draws++;b.draws++}
    if(ev.kind!=='two') {a.scored+=m.sa;a.conceded-=m.sb;b.scored+=m.sb;b.conceded-=m.sa}
  }
  for(const row of byId.values()) {
    row.diff=row.scored+row.conceded;
    row.spread=row.wins-row.losses;
    const decisive = row.wins+row.losses;
    row.rate=(ev.kind==='two' ? decisive : row.matches) ? row.wins/(ev.kind==='two'?decisive:row.matches) : 0;
  }
  return assignRanks([...byId.values()].filter(r=>r.matches>0),ev.kind);
}
export function overallStandings(edition) {
  const days=['day1','day2','day3'];
  const stats=Object.fromEntries(days.map(id=>[id,new Map(standings(edition,id).map(r=>[r.id,r]))]));
  const players=edition.players||[], result=[];
  for(const p of players){
    const available=days.map((d,i)=>({day:d,index:i,row:stats[d].get(p.id)})).filter(x=>x.row?.matches>0);
    if(available.length<2||!stats.day3.has(p.id)) continue;
    // Existing Excel: difference, then W-L, number of matches, then earlier Day on an exact tie.
    const selected=available.sort((a,b)=> b.row.diff-a.row.diff || b.row.spread-a.row.spread || b.row.matches-a.row.matches || a.index-b.index).slice(0,2);
    const r=empty(p); r.selectedDays=selected.map(x=>x.day).sort((a,b)=>days.indexOf(a)-days.indexOf(b));
    for(const x of selected){for(const k of ['matches','wins','losses','draws','scored','conceded'])r[k]+=x.row[k]}
    r.diff=r.scored+r.conceded;r.spread=r.wins-r.losses;r.rate=r.matches?r.wins/r.matches:0;
    result.push(r);
  }
  return assignRanks(result,'points');
}
export function entryCount(edition,eventId){return (edition.matches||[]).filter(m=>m.event===eventId).length}


/** Players explicitly waiting for a match, per event.
 * Legacy editions without a saved list use players who have completed a game.
 * Once a list is edited, it becomes explicit so manual removal persists.
 */
export function waitingPlayerIds(edition, eventId) {
  if (!eventById(eventId) || eventId === 'overall') return [];
  const valid=new Set((edition.players||[]).map(p=>p.id));
  const stored=edition.waitingPlayers?.[eventId];
  const ids=Array.isArray(stored) ? stored : (edition.matches||[])
    .filter(m=>m.event===eventId).flatMap(m=>[m.a,m.b]);
  return [...new Set(ids.filter(id=>valid.has(id)))].sort((a,b)=>a-b);
}

function storeWaiting(edition, eventId, ids) {
  edition.waitingPlayers ||= {};
  edition.waitingPlayers[eventId]=[...new Set(ids)].sort((a,b)=>a-b);
}

/** All participants entered in this event who are not in the waiting list.
 * A player with an assigned match is no longer waiting, so they may be shown
 * in the picker (they remain unavailable for another pairing until finished).
 */
export function availableWaitingPlayers(edition, eventId) {
  if (!eventById(eventId) || eventId==='overall') return [];
  const waiting=new Set(waitingPlayerIds(edition,eventId));
  return (edition.players||[])
    .filter(p=>p.entries?.includes(eventId)&&!waiting.has(p.id))
    .sort((a,b)=>a.id-b.id);
}

/** Add a registered participant not currently in the waiting list. */
export function addWaitingPlayer(edition, eventId, id) {
  if (!eventById(eventId) || eventId==='overall') return false;
  if (!availableWaitingPlayers(edition,eventId).some(p=>p.id===id)) return false;
  // Re-adding a reserved player without cancelling the reservation creates a
  // hidden "waiting" entry. The UI must cancel the reservation explicitly.
  if (activePairings(edition,eventId).some(p=>p.a===id||p.b===id)) return false;
  const ids=waitingPlayerIds(edition,eventId);
  if (ids.includes(id)) return false;
  storeWaiting(edition,eventId,[...ids,id]);
  return true;
}

/** Remove just this player from the waiting list, without erasing results. */
export function removeWaitingPlayer(edition, eventId, id) {
  const ids=waitingPlayerIds(edition,eventId);
  if (!ids.includes(id)) return false;
  storeWaiting(edition,eventId,ids.filter(n=>n!==id));
  return true;
}

/** Completed games send both participants back to waiting if an explicit list exists. */
export function returnPlayersToWaiting(edition, eventId, a, b) {
  if (!Array.isArray(edition.waitingPlayers?.[eventId])) return;
  storeWaiting(edition,eventId,[...waitingPlayerIds(edition,eventId),a,b]);
}

/** Reservations live separately from match results; older saved data has no such field. */
export function activePairings(edition, eventId) {
  return (edition.pendingPairings || []).filter(p=>p.event===eventId);
}

/** Reserve both players until a result is entered (or the reservation is cancelled).
 * Move them out of the waiting list, so both appear in the add picker.
 */
export function reservePairing(edition, eventId, a, b) {
  if (!unplayedPairs(edition,eventId).some(p=>p.a===Math.min(a,b)&&p.b===Math.max(a,b))) return false;
  if (!Array.isArray(edition.pendingPairings)) edition.pendingPairings=[];
  storeWaiting(edition,eventId,waitingPlayerIds(edition,eventId).filter(id=>id!==a&&id!==b));
  edition.pendingPairings.push({event:eventId,a:Math.min(a,b),b:Math.max(a,b)});
  return true;
}

export function cancelPairing(edition, eventId, a, b) {
  const old=edition.pendingPairings||[];
  edition.pendingPairings=old.filter(p=>!(p.event===eventId && ((p.a===a&&p.b===b)||(p.a===b&&p.b===a))));
  if(old.length===edition.pendingPairings.length) return false;
  storeWaiting(edition,eventId,[...waitingPlayerIds(edition,eventId),a,b]);
  return true;
}

/** Upgrade older saved reservations, where assigned players were kept in the
 * waiting list and only hidden by the UI. Run once for each edition.
 */
export function migrateReservedWaiting(edition) {
  if (edition.reservationWaitingVersion===1) return edition;
  for(const event of EVENTS.filter(e=>e.id!=='overall')) {
    const busy=new Set(activePairings(edition,event.id).flatMap(p=>[p.a,p.b]));
    if(!busy.size) continue;
    storeWaiting(edition,event.id,waitingPlayerIds(edition,event.id).filter(id=>!busy.has(id)));
  }
  edition.reservationWaitingVersion=1;
  return edition;
}

/** A registered result frees the match's participants from any reserved pairing. */
export function finishPairing(edition, eventId, a, b) {
  edition.pendingPairings=(edition.pendingPairings||[]).filter(p=>p.event!==eventId || (![a,b].includes(p.a)&&![a,b].includes(p.b)));
}

/** List pairs of players who have both played in this event but have never met and are not busy. */
export function unplayedPairs(edition, eventId) {
  if (!eventById(eventId) || eventId==='overall') return [];
  const matches=(edition.matches||[]).filter(m=>m.event===eventId);
  const players=new Map((edition.players||[]).map(p=>[p.id,p]));
  const counts=new Map(),played=new Set();
  const key=(a,b)=>`${Math.min(a,b)}:${Math.max(a,b)}`;
  for (const m of matches) {
    if (!players.has(m.a) || !players.has(m.b) || m.a===m.b) continue;
    counts.set(m.a,(counts.get(m.a)||0)+1);
    counts.set(m.b,(counts.get(m.b)||0)+1);
    played.add(key(m.a,m.b));
  }
  const busy=new Set(activePairings(edition,eventId).flatMap(p=>[p.a,p.b]));
  const ids=waitingPlayerIds(edition,eventId).filter(id=>!busy.has(id)),pairs=[];
  for (let i=0;i<ids.length;i++) for (let j=i+1;j<ids.length;j++) {
    const a=ids[i],b=ids[j];
    if (!played.has(key(a,b))) pairs.push({a,b,playedA:counts.get(a),playedB:counts.get(b)});
  }
  // Prioritize balanced, less-played opponents without changing the eligibility rule.
  return pairs.sort((x,y)=>
    (x.playedA+x.playedB)-(y.playedA+y.playedB) ||
    Math.abs(x.playedA-x.playedB)-Math.abs(y.playedA-y.playedB) ||
    x.a-y.a || x.b-y.b);
}
