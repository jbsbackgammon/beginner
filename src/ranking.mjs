export const EVENTS = [
  { id: 'overall', label: '初級戦総合', short: '総合', date: '2026-10-12', kind: 'overall' },
  { id: 'day1', label: '初級戦Day1', short: 'Day1', date: '2026-10-10', kind: 'points' },
  { id: 'day2', label: '初級戦Day2', short: 'Day2', date: '2026-10-11', kind: 'points' },
  { id: 'day3', label: '初級戦Day3', short: 'Day3', date: '2026-10-12', kind: 'points' },
  { id: 'two', label: '2ptマッチラウンドロビン', short: '2pt RR', date: '2026-10-10', kind: 'two' },
  { id: 'cube', label: 'キューブ有ラウンドロビン', short: 'キューブ有RR', date: '2026-10-11', kind: 'cube' },
  { id: 'school', label: '小学生選手権', short: '小学生選手権', date: '', kind: 'points' },
];
export const DEMO_EDITION_ID = '__beginner_demo_v34__';

/** Build temporary, random but rule-valid test records, never mutating live data.
 * 30 players, randomized attendance (26-29 per event), and 300 unique pairings
 * in each of the six individual events (1,800 results).
 */
export function createDemoEdition(random = Math.random) {
  const events = EVENTS.filter(e => e.id !== 'overall');
  const rand = () => {
    const n = Number(random());
    return Number.isFinite(n) ? Math.max(0, Math.min(0.999999999, n)) : 0.5;
  };
  const pick = items => items[Math.floor(rand() * items.length)];
  const shuffle = items => {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  };
  // Independently shuffle matching kanji/reading pairs, so each run creates
  // natural-looking, unique fictional names instead of テスト選手01...30.
  const surnames = shuffle([
    ['佐藤','さとう'], ['鈴木','すずき'], ['高橋','たかはし'], ['田中','たなか'],
    ['伊藤','いとう'], ['渡辺','わたなべ'], ['山本','やまもと'], ['中村','なかむら'],
    ['小林','こばやし'], ['加藤','かとう'], ['吉田','よしだ'], ['山田','やまだ'],
    ['佐々木','ささき'], ['山口','やまぐち'], ['松本','まつもと'], ['井上','いのうえ'],
    ['木村','きむら'], ['林','はやし'], ['清水','しみず'], ['山崎','やまざき'],
    ['森','もり'], ['池田','いけだ'], ['橋本','はしもと'], ['阿部','あべ'],
    ['石川','いしかわ'], ['前田','まえだ'], ['藤田','ふじた'], ['小川','おがわ'],
    ['後藤','ごとう'], ['岡田','おかだ'], ['長谷川','はせがわ'], ['村上','むらかみ'],
    ['近藤','こんどう'], ['石井','いしい'], ['坂本','さかもと'], ['遠藤','えんどう'],
    ['青木','あおき'], ['藤井','ふじい'], ['西村','にしむら'], ['福田','ふくだ'],
    ['太田','おおた'], ['三浦','みうら'], ['藤原','ふじわら'], ['岡本','おかもと'],
    ['松田','まつだ'], ['中川','なかがわ'], ['中島','なかじま'], ['原田','はらだ'],
    ['小野','おの'], ['竹内','たけうち'],
  ]);
  const givenNames = shuffle([
    ['悠斗','ゆうと'], ['陽菜','ひな'], ['蓮','れん'], ['結衣','ゆい'],
    ['大翔','ひろと'], ['美咲','みさき'], ['湊','みなと'], ['葵','あおい'],
    ['颯太','そうた'], ['凛','りん'], ['樹','いつき'], ['桜','さくら'],
    ['蒼','あおい'], ['紗良','さら'], ['陸','りく'], ['心春','こはる'],
    ['翔太','しょうた'], ['愛菜','まな'], ['陽翔','はると'], ['彩花','あやか'],
    ['悠真','ゆうま'], ['花音','かのん'], ['直樹','なおき'], ['菜月','なつき'],
    ['大輝','だいき'], ['莉子','りこ'], ['優斗','ゆうと'], ['美月','みづき'],
    ['拓海','たくみ'], ['琴音','ことね'], ['颯','はやて'], ['明日香','あすか'],
    ['健太','けんた'], ['千尋','ちひろ'], ['航平','こうへい'], ['理沙','りさ'],
    ['和真','かずま'], ['美優','みゆ'], ['一輝','かずき'], ['結菜','ゆいな'],
    ['海斗','かいと'], ['陽葵','ひまり'], ['颯介','そうすけ'], ['優奈','ゆうな'],
    ['悠人','ゆうと'], ['真央','まお'], ['大和','やまと'], ['優衣','ゆい'],
    ['翼','つばさ'], ['遥','はるか'],
  ]);
  const players = Array.from({length: 30}, (_, index) => {
    const id = index + 1;
    const [surname, surnameKana] = surnames[index];
    const [givenName, givenKana] = givenNames[index];
    return {id, name:`${surname} ${givenName}`, kana:`${surnameKana} ${givenKana}`, entries:[]};
  });

  // 26 entrants still provide 325 distinct pairs, enough for 300 games and a
  // useful "unplayed" list. Every event has one to four non-entrants.
  // Rotate the shuffled pool per event so even a deterministic test random
  // function produces different attendance for Day1 / Day2 / ... .
  const eventEntrants = {};
  events.forEach((event, index) => {
    const count = 26 + Math.floor(rand() * 4);
    const pool = shuffle(players.map(player => player.id));
    const offset = (index * 5) % pool.length;
    const rotated = pool.slice(offset).concat(pool.slice(0, offset));
    const selected = new Set(rotated.slice(0, count));
    eventEntrants[event.id] = selected;
    players.forEach(player => {
      if (selected.has(player.id)) player.entries.push(event.id);
    });
  });

  const matches = [];
  const waitingPlayers = {};
  const distribution = {day1:300,day2:300,day3:300,two:300,cube:300,school:300};
  for (const event of events) {
    const entrants = [...eventEntrants[event.id]].sort((a,b) => a-b);
    const pairs = [];
    for (let i = 0; i < entrants.length; i++) {
      for (let j = i + 1; j < entrants.length; j++) pairs.push([entrants[i], entrants[j]]);
    }
    shuffle(pairs);
    const count = distribution[event.id];
    if (pairs.length < count) throw Error('Not enough test pairings');
    for (let i = 0; i < count; i++) {
      const [a,b] = pairs[i];
      let sa,sb;
      if (event.kind === 'two') {
        [sa,sb] = pick([[2,0],[2,1],[1,1],[1,2],[0,2]]);
      } else {
        const score = pick(event.kind === 'cube' ? [1,2,3,4,6,8,12] : [1,2,3]);
        [sa,sb] = rand() < 0.5 ? [score,0] : [0,score];
      }
      matches.push({id:`demo-${event.id}-${String(i+1).padStart(3,'0')}`,event:event.id,a,b,sa,sb,matchNo:i+1});
    }
    // Guarantee that the sample waiting list includes an unplayed pairing,
    // even with deterministic test RNGs or a dense 300/435 played schedule.
    const remainingPair = pairs.slice(count)[0];
    const playedIds = [...new Set(pairs.slice(0,count).flatMap(([a,b])=>[a,b]))];
    const waiting = remainingPair ? [...remainingPair] : [];
    for(const id of shuffle(playedIds)) {
      if(waiting.length >= 8) break;
      if(!waiting.includes(id)) waiting.push(id);
    }
    waitingPlayers[event.id] = waiting.sort((a,b)=>a-b);
  }
  const demo = {
    id: DEMO_EDITION_ID,
    name:'【テストデータ】 BACKGAMMON CLASSIC 2026',
    players,matches,waitingPlayers,
    rosterVisibleRows:30,
    dates:Object.fromEntries(EVENTS.map(e=>[e.id,e.date])),
    reservationWaitingVersion:1,
  };
  ensureMatchNumbers(demo);
  return demo;
}
export const eventById = (id) => EVENTS.find(e => e.id === id);

/** Result entry is permitted only for players explicitly registered for that event. */
export function isEventEntrant(edition, eventId, playerId) {
  if (!eventById(eventId) || eventId === 'overall' || !Number.isInteger(playerId)) return false;
  return (edition?.players || []).some(p => p.id === playerId && String(p.name || '').trim()
    && Array.isArray(p.entries) && p.entries.includes(eventId));
}

export function eligibleEventPlayers(edition, eventId) {
  if (!eventById(eventId) || eventId === 'overall') return [];
  return (edition?.players || []).filter(p => isEventEntrant(edition,eventId,p.id));
}
export const REGISTRATION_CONFIRM_GAP_MS = 6 * 60 * 60 * 1000;

/** Most recent successful result registration across all stored editions.
 * v31 and earlier encoded the creation time in IDs like m1791440000000-abc123.
 * Recognizing these IDs avoids losing the reminder when upgrading old browser data.
 */
export function latestResultRegistrationAt(editions) {
  let latest = null;
  for (const edition of editions || []) {
    const saved = edition.lastResultRegisteredAt;
    if (Number.isSafeInteger(saved) && saved > 0) latest = Math.max(latest ?? 0, saved);
    for (const match of edition.matches || []) {
      const legacy = /^m(\d{13})-[a-z0-9]+$/i.exec(String(match.id || ''));
      if (legacy) {
        const time = Number(legacy[1]);
        if (Number.isSafeInteger(time) && time > 0) latest = Math.max(latest ?? 0, time);
      }
    }
  }
  return latest;
}

/** No dialog for the first registration; confirm only after a six-hour gap. */
export function needsTournamentConfirmation(editions, now = Date.now()) {
  const previous = latestResultRegistrationAt(editions);
  return previous !== null && Number.isFinite(now)
    && now - previous >= REGISTRATION_CONFIRM_GAP_MS;
}

/** Result history matches player numbers, names, and readings only.
 * A number-only query must match a complete player number (not score or match number).
 */
export function historySearchMatches(match, rawQuery, players) {
  const query=String(rawQuery??'').normalize('NFKC').trim().toLocaleLowerCase();
  if(!query)return true;
  const ids=[match.a,match.b];
  // Treat a standalone player number as an exact ID, never a substring
  // of #13, #30, a score, or a result-history match number.
  if(/^#?\d+$/.test(query)) {
    const number=Number(query.replace(/^#/,''));
    return ids.some(id=>id===number);
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

/** Registered participants who are not currently waiting; there is no separate in-progress status. */
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

/** Confirm a proposed pairing by removing both people from the waiting list.
 * No pending/in-progress record is created. Each can be added again separately.
 */
export function arrangeWaitingPair(edition, eventId, a, b) {
  if (!unplayedPairs(edition,eventId).some(p=>p.a===Math.min(a,b)&&p.b===Math.max(a,b))) return false;
  storeWaiting(edition,eventId,waitingPlayerIds(edition,eventId).filter(id=>id!==a&&id!==b));
  return true;
}

/** Convert v47 and earlier saved data. Preserve completed results and the
 * waiting-list state but discard the former in-progress reservation records.
 */
export function migrateReservedWaiting(edition) {
  if(edition.reservationWaitingVersion!==1 && Array.isArray(edition.pendingPairings)) {
    for(const event of EVENTS.filter(e=>e.id!=='overall')) {
      const pairedIds=new Set(edition.pendingPairings.filter(p=>p?.event===event.id).flatMap(p=>[p.a,p.b]));
      if(pairedIds.size)storeWaiting(edition,event.id,waitingPlayerIds(edition,event.id).filter(id=>!pairedIds.has(id)));
    }
  }
  delete edition.pendingPairings;
  delete edition.reservationWaitingVersion;
  return edition;
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
  const ids=waitingPlayerIds(edition,eventId),pairs=[];
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
