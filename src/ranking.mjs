export const EVENTS = [
  { id: 'day1', label: '初級戦 Day1', short: 'Day1', date: '2026-10-10', kind: 'points' },
  { id: 'day2', label: '初級戦 Day2', short: 'Day2', date: '2026-10-11', kind: 'points' },
  { id: 'day3', label: '初級戦 Day3', short: 'Day3', date: '2026-10-12', kind: 'points' },
  { id: 'two', label: '2ポイントマッチラウンドロビン', short: '2pt RR', date: '2026-10-10', kind: 'two' },
  { id: 'cube', label: 'キューブ有ラウンドロビン', short: 'キューブ有RR', date: '2026-10-11', kind: 'cube' },
  { id: 'overall', label: '初級戦 総合', short: '総合', date: '2026-10-12', kind: 'overall' },
];
export const eventById = (id) => EVENTS.find(e => e.id === id);
export const allowedCubePoints = [1,2,3,4,6,8,12];
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
