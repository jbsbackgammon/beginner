import {EVENTS,eventById,validMatch,standings,entryCount,unplayedPairs,activePairings,reservePairing,cancelPairing,finishPairing} from './ranking.mjs';
const KEY='jbs-beginner-v1';
const eventIds=EVENTS.filter(e=>e.id!=='overall').map(e=>e.id);
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initial=()=>({schema:1,activeEditionId:'classic-2026',editions:[{id:'classic-2026',name:'BACKGAMMON CLASSIC 2026',players:[],matches:[],pendingPairings:[],dates:Object.fromEntries(EVENTS.map(e=>[e.id,e.date]))}]});
let data;try{data=JSON.parse(localStorage.getItem(KEY)||'null')}catch{data=null}
if(!data || data.schema!==1 || !Array.isArray(data.editions))data=initial();
let tab='players',activeEvent='day1',historySearch='',playerSearch='',editingMatch=null,editingEntries=null,preselectedPair=null;
const ed=()=>data.editions.find(e=>e.id===data.activeEditionId)||data.editions[0];
const evLabel=(id)=>eventById(id)?.label||id;
const summaryId=(id)=>`${id}`;
const player=(id)=>ed().players.find(x=>x.id===id);
const playerLabel=id=>{const p=player(id);return p?`#${p.id} ${p.name}`:`#${id}（未登録）`};
const formatRate=n=>`${(n*100).toFixed(1)}%`;
const dayName=id=>({'day1':'Day1','day2':'Day2','day3':'Day3'}[id]||id);
function save(){try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){alert('ブラウザに保存できません。JSONバックアップを出力してください。')}renderEditionPicker();}
function notice(msg){const n=$('notice');n.textContent=msg;n.classList.add('show');setTimeout(()=>n.classList.remove('show'),4000)}
function eventSelect(selected,overall=false,id='event-picker'){return `<select id="${id}">${EVENTS.filter(e=>overall||e.id!=='overall').map(e=>`<option value="${e.id}" ${e.id===selected?'selected':''}>${esc(e.label)}</option>`).join('')}</select>`}
function playerOptions(selected=null){return `<option value="">選手を選択</option>`+[...ed().players].sort((a,b)=>(a.kana||a.name).localeCompare(b.kana||b.name,'ja')).map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${esc(`#${p.id} ${p.name}`)}</option>`).join('')}
function renderEditionPicker(){const box=$('edition-picker');if(box)box.innerHTML=data.editions.map(e=>`<option value="${esc(e.id)}" ${e.id===ed()?.id?'selected':''}>${esc(e.name)}</option>`).join('')}
function renderHeaderEvent(){
 const box=document.querySelector('.header-event'),select=$('header-event');
 box.hidden=(tab==='players');
 if(tab==='entry'&&activeEvent==='overall')activeEvent='day1';
 select.innerHTML=EVENTS.filter(e=>tab!=='entry'||e.id!=='overall').map(e=>`<option value="${e.id}">${esc(e.label)}</option>`).join('');
 select.value=activeEvent;
}
function render(){
 document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
 renderHeaderEvent();
 $('app').innerHTML=({entry:renderEntry,manage:renderManage,players:renderPlayers,rank:renderRank,export:renderExport})[tab]();
 renderEditionPicker();
}
function dateFor(eventId){return ed().dates?.[eventId]||(ed().id==='classic-2026'?eventById(eventId)?.date:'')||''}
function resultsFor(event){return ed().matches.filter(x=>x.event===event)}
function side(m){return m.sa===m.sb?'引き分け':(m.sa>m.sb ? playerLabel(m.a):playerLabel(m.b))}
function historyTable(matches) {
 const shown=matches.filter(m=>!historySearch||`${playerLabel(m.a)} ${playerLabel(m.b)}`.toLocaleLowerCase().includes(historySearch.toLocaleLowerCase())).slice().reverse().slice(0,80);
 const rows=shown.map(m=>{
  // Keep the original result untouched for correction and ranking calculation.
  const draw=m.sa===m.sb;
  const firstIsA=draw ? m.a<=m.b : m.sa>m.sb;
  const leftId=firstIsA?m.a:m.b,rightId=firstIsA?m.b:m.a;
  const leftScore=firstIsA?m.sa:m.sb,rightScore=firstIsA?m.sb:m.sa;
  const leftClass=draw?'history-score-draw':'history-score-win';
  const rightClass=draw?'history-score-draw':'';
  return `<tr><td class="history-name">${esc(playerLabel(leftId))}</td><td class="history-score"><span class="${leftClass}">${esc(leftScore)}</span><span class="history-score-separator"> - </span><span class="${rightClass}">${esc(rightScore)}</span></td><td class="history-name">${esc(playerLabel(rightId))}</td><td class="row-actions"><button class="btn small" data-action="edit-match" data-id="${esc(m.id)}">修正</button> <button class="btn small danger" data-action="delete-match" data-id="${esc(m.id)}">削除</button></td></tr>`;
 }).join('');
 return shown.length?`<table class="data-table history-table"><colgroup><col class="history-col-player"><col class="history-col-score"><col class="history-col-player"><col class="history-col-actions"></colgroup><thead><tr><th>選手名</th><th>結果</th><th>選手名</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table>`:'<div class="empty">該当する試合がありません</div>';
}

function pairingTable(pairs){
 const completed=resultsFor(activeEvent),busy=activePairings(ed(),activeEvent);
 const seen=new Set(),groups=new Map();
 for(const m of completed){seen.add(m.a);seen.add(m.b)}
 const busyIds=new Set(busy.flatMap(p=>[p.a,p.b]));
 for(const id of [...seen].filter(id=>!busyIds.has(id)).sort((a,b)=>a-b))groups.set(id,[]);
 for(const pair of pairs){groups.get(pair.a)?.push(pair.b);groups.get(pair.b)?.push(pair.a)}
 const filtered=[...groups];
 const list=filtered.length?`<table class="data-table pairing-list"><thead><tr><th>対戦待ち</th><th>未対戦</th></tr></thead><tbody>${filtered.map(([id,opps])=>`<tr><td class="pairing-name">${esc(playerLabel(id))}</td><td><div class="opponents">${opps.length?opps.sort((a,b)=>a-b).map(n=>`<button type="button" class="opponent-no" data-action="pick-pair" data-a="${id}" data-b="${n}" title="${esc(player(n)?.name||playerLabel(n))}" aria-label="${esc(playerLabel(n))}と対戦を組む">${n}</button>`).join(''):'<span class="muted">ー</span>'}</div></td></tr>`).join('')}</tbody></table>`:`<div class="empty">${seen.size?'斡旋できる選手がいません':'結果が登録された選手はいません'}</div>`;
 return list;
}
function matchPlayerField(side,id,label,winningSide){
 const selected=winningSide===side,other=winningSide&&winningSide!==side;
 const state=selected?'win':other?'lose':'';
 return `<div class="match-player"><div class="match-player-controls"><label class="field match-no-field"><input type="number" name="${side}_no" data-match-side="${side}" aria-label="${label}の番号" min="1" step="1" inputmode="numeric" value="${id||''}" placeholder="No."></label><label class="field match-name-field"><select name="${side}" data-match-side="${side}" aria-label="${label}の選手名">${playerOptions(id)}</select></label></div><button type="button" data-winner-button="${side}" class="winner-button ${state}" aria-pressed="${selected?'true':'false'}">${other?'負':'勝'}</button></div>`;
}
function renderEntry(){
 const e=eventById(activeEvent),matches=resultsFor(activeEvent),current=editingMatch?ed().matches.find(x=>x.id===editingMatch):null;
 const first=current?.a||preselectedPair?.a||null,second=current?.b||preselectedPair?.b||null;
 const winningSide=current?(current.sa>current.sb?'a':current.sb>current.sa?'b':''):'';
 const twoScore=current?`${current.sa}-${current.sb}`:'';
 const pts=e.kind==='cube'?[1,2,3,4,6,8,12]:[1,2,3];
 const pointsLabel=e.kind==='points'?{1:'1-0 シングル勝ち',2:'2-0 ギャモン勝ち',3:'3-0 バックギャモン勝ち'}:Object.fromEntries(pts.map(n=>[n,`${n}-0`]));
 const resultControl=e.kind==='two'?`<label class="field result-score"><span>得点</span><select name="result" required><option value="">結果を選択</option>${['2-0','2-1','1-1','1-2','0-2'].map(x=>`<option value="${x}" ${twoScore===x?'selected':''}>${x}</option>`).join('')}</select></label>`:`<label class="field result-score"><span>得点</span><select name="points">${pts.map(n=>`<option value="${n}" ${current&&Math.max(current.sa,current.sb)===n?'selected':''}>${pointsLabel[n]}</option>`).join('')}</select></label>`;
 const pairs=unplayedPairs(ed(),activeEvent);
 const form=`<form id="match-form" data-winner="${winningSide}"><div class="scoreline">${matchPlayerField('a',first,'左選手',winningSide)}<span class="vs match-versus" aria-hidden="true">VS</span>${matchPlayerField('b',second,'右選手',winningSide)}</div><div class="result-row">${resultControl}<button type="submit" class="btn primary">${current?'結果を更新':'結果を登録'}</button></div>${current?'<div class="btnset"><button type="button" class="btn" data-action="cancel-match">編集を取り消す</button></div>':''}</form>`;
 return `<div class="entry-grid"><div class="entry-left"><section class="box entry-form"><h3>結果入力</h3>${form}</section><section class="box entry-pairings"><div class="section-head"><h3>対戦斡旋</h3></div><div id="pair-results" class="table-scroll spaced pairing-scroll">${pairingTable(pairs)}</div></section></div><section class="box entry-history"><div class="section-head"><h3>結果履歴</h3></div><input id="history-filter" placeholder="選手名・番号で検索" value="${esc(historySearch)}" class="select-wide" aria-label="結果履歴検索"><div id="history-results" class="table-scroll spaced history-scroll">${historyTable(matches)}</div></section></div>`;
}
function setWinner(form,side){
 form.dataset.winner=side;
 form.querySelectorAll('[data-winner-button]').forEach(button=>{
  const state=!side?'':side===button.dataset.winnerButton?'win':'lose';
  button.classList.toggle('win',state==='win');button.classList.toggle('lose',state==='lose');
  button.textContent=state==='lose'?'負':'勝';button.setAttribute('aria-pressed',String(state==='win'));
 });
 const result=form.elements.namedItem('result');
 if(result){
  const old=result.value;
  if(!side){if(old!=='1-1')result.value='';}
  else if(side==='a'&&!['2-0','2-1'].includes(old))result.value=old==='1-2'?'2-1':'2-0';
  else if(side==='b'&&!['0-2','1-2'].includes(old))result.value=old==='2-1'?'1-2':'0-2';
 }
}
function syncMatchPlayer(el){
 const form=el.closest('#match-form');if(!form)return;
 const side=el.dataset.matchSide,number=form.elements.namedItem(side+'_no'),select=form.elements.namedItem(side);
 if(el.tagName==='SELECT'){number.value=select.value;return}
 const parsed=Number(number.value);select.value=number.value!==''&&player(parsed)?String(parsed):'';
}
function statsTable(eventId,preview=false){const rows=standings(ed(),eventId),isTwo=eventId==='two',overall=eventId==='overall';
 if(!rows.length)return '<div class="empty">表示できる成績がありません</div>';
 return `<div class="table-scroll"><table class="data-table"><thead><tr><th>順位</th><th>氏名</th><th>選手No.</th><th>試合</th><th>勝</th><th>負</th>${isTwo?'<th>引分</th>':''}<th>勝越</th><th>勝率</th>${!isTwo?'<th>得点</th><th>失点</th><th>得失点</th>':''}${overall?'<th>採用Day</th>':''}</tr></thead><tbody>${rows.map(r=>`<tr class="${r.rank<=3?'podium':''}"><td><strong>${r.rank}</strong></td><td class="player-name">${esc(r.name)}</td><td>${r.id}</td><td>${r.matches}</td><td>${r.wins}</td><td>${r.losses}</td>${isTwo?`<td>${r.draws}</td>`:''}<td class="${r.spread>=0?'pos':'neg'}">${r.spread>0?'+':''}${r.spread}</td><td>${formatRate(r.rate)}</td>${!isTwo?`<td>${r.scored}</td><td>${r.conceded}</td><td class="${r.diff>=0?'pos':'neg'}">${r.diff>0?'+':''}${r.diff}</td>`:''}${overall?`<td>${(r.selectedDays||[]).map(dayName).join('＋')}</td>`:''}</tr>`).join('')}</tbody></table></div>`;
}
function renderRank(){const e=eventById(activeEvent),rows=standings(ed(),activeEvent),n=activeEvent==='overall'?null:entryCount(ed(),activeEvent);
 return `<div class="box"><div class="overview"><div class="metric"><strong>${rows.length}</strong><span>${activeEvent==='overall'?'総合順位対象者':'対戦済み選手'}</span></div>${n!==null?`<div class="metric"><strong>${n}</strong><span>試合数</span></div>`:''}${rows.length?`<div class="metric"><strong>${esc(rows[0].name)}</strong><span>暫定1位</span></div>`:''}</div><div class="rule">${e.kind==='two'?'勝越試合数 → 勝率（引き分けを除く勝敗で計算） → 試合数':e.kind==='overall'?'Day3で対戦し、Day3を含む2日以上で試合のある選手が対象。得失点差の上位2大会を合算。順位は 得失点差 → 勝越試合数 → 勝率。':'得失点差 → 勝越試合数 → 勝率'}。同点の場合は同順位です。</div><div class="spaced">${statsTable(activeEvent)}</div></div>`;
}
function attendanceChoice(id,selected){
 const checked=!!selected?.entries?.includes(id);
 return `<div class="attendance-option"><span>${esc(eventById(id).short)}</span><button type="button" class="attendance-toggle ${checked?'attending':''}" data-entry-toggle="${id}" aria-pressed="${checked}" ${selected?'':'disabled'}>${checked?'出場':'ー'}</button><input type="hidden" name="entries" value="${id}" ${checked?'':'disabled'}></div>`;
}
function renderManage(){const e=ed();
 const selected=editingEntries?e.players.find(p=>p.id===editingEntries):null;
 const filtered=e.players.filter(p=>!playerSearch||`${p.id} ${p.name} ${p.kana||''}`.toLocaleLowerCase().includes(playerSearch.toLocaleLowerCase())).sort((a,b)=>a.id-b.id);
 const counts=eventIds.map(id=>`<div class="metric"><strong>${entryCount(e,id)}</strong><span>${eventById(id).short} 試合</span></div>`).join('');
 return `<div class="box edition-manage"><label class="field"><span>管理する大会データ</span><select id="edition-picker" aria-label="大会データ"></select></label><button type="button" class="btn" data-action="new-edition">大会を追加</button></div><div class="overview"><div class="metric"><strong>${e.players.length}</strong><span>登録選手</span></div>${counts}</div><div class="grid2"><div class="box"><h3>出場登録</h3><form id="entries-form"><label class="field"><span>対象選手</span><select id="entries-player" name="player" required><option value="">選手を選択</option>${[...e.players].sort((a,b)=>a.id-b.id).map(p=>`<option value="${p.id}" ${selected?.id===p.id?'selected':''}>${esc(`#${p.id} ${p.name}`)}</option>`).join('')}</select></label><div class="player-grid">${eventIds.map(id=>attendanceChoice(id,selected)).join('')}</div><div class="btnset"><button class="btn primary" type="submit" ${selected?'':'disabled'}>出場登録を保存</button></div></form><p class="muted">選手の新規登録や番号・名前・読み方の変更は「選手管理」で行います。</p><hr class="thin"><h3>大会の日付設定</h3><form id="dates-form"><div class="player-grid">${eventIds.map(id=>`<label class="field"><span>${esc(eventById(id).short)}</span><input type="date" name="${id}" value="${esc(e.dates?.[id]||dateFor(id))}"></label>`).join('')}</div><button class="btn" type="submit">日付を保存</button></form><hr class="thin"><h3>バックアップ・大会管理</h3><div class="btnset"><button class="btn" data-action="backup">JSON出力</button><button class="btn" data-action="load">JSON取込</button><button class="btn danger" data-action="delete-edition">この大会を削除</button></div><p class="muted">別端末とのデータ共有は自動では行われません。JSON出力・取込をご利用ください。</p></div><div class="box"><div class="section-head"><h3>選手別の出場登録（${filtered.length}名）</h3></div><input id="player-filter" placeholder="氏名・ふりがな・選手番号で検索" value="${esc(playerSearch)}" class="select-wide"><div class="table-scroll spaced">${filtered.length?`<table class="data-table"><thead><tr><th>番号</th><th>氏名</th><th>出場大会</th><th>操作</th></tr></thead><tbody>${filtered.map(p=>`<tr><td>${p.id}</td><td>${esc(p.name)}</td><td>${(p.entries||[]).map(x=>esc(eventById(x)?.short||x)).join('、')||'—'}</td><td><button class="btn small" data-action="edit-entries" data-id="${p.id}">変更</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty">該当する選手がいません</div>'}</div></div></div>`;
}
function rosterNumbers(e){
 const ordinary=e.players.filter(p=>Number.isInteger(p.id)&&p.id>0&&p.id<=1000).map(p=>p.id);
 const highest=Math.max(0,...ordinary);
 // Always expose numbered blank rows; when players reach the end, extend the grid automatically.
 const end=Math.max(100,Math.ceil((highest+10)/20)*20);
 const ids=Array.from({length:end},(_,i)=>i+1);
 return ids.concat(e.players.map(p=>p.id).filter(id=>id>end).sort((a,b)=>a-b));
}
function renderPlayers(){
 const e=ed(),byId=new Map(e.players.map(p=>[p.id,p])),numbers=rosterNumbers(e);
 const header=['初級戦Day1','初級戦Day2','初級戦Day3','2ptマッチRR','キューブ有RR'];
 const rows=numbers.map(id=>{
  const p=byId.get(id),active=!!p?.name?.trim();
  const cells=eventIds.map((event,i)=>{
   const attending=!!p?.entries?.includes(event);
   return `<td><button type="button" class="roster-attendance ${attending?'attending':''}" data-roster-event="${event}" aria-pressed="${attending}" aria-label="No.${id} ${header[i]} ${attending?'出場':'未出場'}" ${active?'':'disabled'}>${attending?'出場':'ー'}</button></td>`;
  }).join('');
  return `<tr data-roster-id="${id}" class="${active?'':'roster-inactive'}"><td class="roster-no">${id}</td><td><input type="text" data-roster-name aria-label="No.${id} 選手" autocomplete="off" maxlength="100" value="${esc(p?.name||'')}"></td><td><input type="text" data-roster-kana aria-label="No.${id} よみ" autocomplete="off" maxlength="100" value="${esc(p?.kana||'')}" ${active?'':'disabled'}></td>${cells}</tr>`;
 }).join('');
 return `<div class="box roster-box"><div class="table-scroll roster-scroll"><table class="data-table roster-matrix"><thead><tr><th>番号</th><th>選手</th><th>よみ</th>${header.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function rosterRowState(tr){
 const active=!!tr.querySelector('[data-roster-name]').value.trim();
 tr.classList.toggle('roster-inactive',!active);
 tr.querySelector('[data-roster-kana]').disabled=!active;
 tr.querySelectorAll('[data-roster-event]').forEach(button=>button.disabled=!active);
}
function rosterNameChange(input){
 const tr=input.closest('[data-roster-id]'),id=Number(tr.dataset.rosterId);
 const name=input.value.trim(),p=player(id);
 const tail=[...tr.closest('tbody').querySelectorAll('[data-roster-id]')].map(row=>Number(row.dataset.rosterId)).filter(n=>n<=1000).at(-1);
 if(!name){
  if(p && (ed().matches.some(m=>m.a===id||m.b===id) || (ed().pendingPairings||[]).some(q=>q.a===id||q.b===id))){
   alert('この選手には試合記録または対戦中の割当があります。名前を空欄にはできません。');
   input.value=p.name;rosterRowState(tr);return;
  }
  if(p)ed().players=ed().players.filter(x=>x.id!==id);
  tr.querySelector('[data-roster-kana]').value='';
  tr.querySelectorAll('[data-roster-event]').forEach(button=>{button.setAttribute('aria-pressed','false');button.classList.remove('attending');button.textContent='ー';button.setAttribute('aria-label',button.getAttribute('aria-label').replace(/ (出場|未出場)$/,' 未出場'));});
 }else if(p){p.name=name;}else{
  ed().players.push({id,name,kana:tr.querySelector('[data-roster-kana]').value.trim(),entries:[]});
 }
 input.value=name;rosterRowState(tr);save();
 // Keep a margin of blank numbered rows with no add-player button.
 if(name && id>=tail-10)render();
}
function rosterKanaChange(input){
 const id=Number(input.closest('[data-roster-id]').dataset.rosterId),p=player(id);
 if(!p)return;
 p.kana=input.value.trim();input.value=p.kana;save();
}
function rosterEventChange(button){
 const id=Number(button.closest('[data-roster-id]').dataset.rosterId),p=player(id);
 if(!p || !p.name.trim())return;
 const event=button.dataset.rosterEvent,entries=new Set(p.entries||[]);
 const attending=button.getAttribute('aria-pressed')!=='true';
 if(attending)entries.add(event);else entries.delete(event);
 p.entries=eventIds.filter(x=>entries.has(x));
 button.setAttribute('aria-pressed',String(attending));
 button.classList.toggle('attending',attending);
 button.textContent=attending?'出場':'ー';
 button.setAttribute('aria-label',`No.${id} ${eventById(event).label} ${attending?'出場':'未出場'}`);
 save();
}

function reportHTML(id){const e=eventById(id);const rows=standings(ed(),id);const date=id==='overall'? dateFor('day3'):dateFor(id);const isTwo=id==='two',overall=id==='overall';
 return `<div class="report"><div class="report-heading"><div class="smallcaps">JAPAN BACKGAMMON SOCIETY</div><h2>${esc(ed().name)}　${esc(e.label)}　成績表</h2><small>${esc(date)}　／　日本バックギャモン協会</small></div><table><thead><tr><th>順位</th><th>氏名</th><th>No.</th><th>試合</th><th>勝</th><th>負</th>${isTwo?'<th>引</th>':''}<th>勝越</th><th>勝率</th>${!isTwo?'<th>得点</th><th>失点</th><th>得失点</th>':''}${overall?'<th>採用Day</th>':''}</tr></thead><tbody>${rows.map(r=>`<tr><td>${r.rank}</td><td>${esc(r.name)}</td><td>${r.id}</td><td>${r.matches}</td><td>${r.wins}</td><td>${r.losses}</td>${isTwo?`<td>${r.draws}</td>`:''}<td>${r.spread>0?'+':''}${r.spread}</td><td>${formatRate(r.rate)}</td>${!isTwo?`<td>${r.scored}</td><td>${r.conceded}</td><td>${r.diff>0?'+':''}${r.diff}</td>`:''}${overall?`<td>${r.selectedDays.map(dayName).join('＋')}</td>`:''}</tr>`).join('')||`<tr><td colspan="12">成績データなし</td></tr>`}</tbody></table><p class="muted" style="margin-top:12px">${rows.length}名　／　${isTwo?'勝越→勝率→試合数':'得失点差→勝越→勝率'}順</p></div>`;
}
function renderExport(){return `<div class="box"><label class="field rank-event"><span>大会名</span><input id="edition-name-input" type="text" value="${esc(ed().name)}" maxlength="120"></label><div class="btnset"><button class="btn primary" data-action="print">PDF出力・印刷</button><button class="btn" data-action="csv">CSV出力</button></div><p class="muted">PDF出力ボタンからブラウザの印刷画面を開き、「PDFに保存」を選択してください。A4縦で出力します。</p></div>${reportHTML(activeEvent)}`}
function matchSave(form){const f=new FormData(form),a=Number(f.get('a_no')||f.get('a')),b=Number(f.get('b_no')||f.get('b'));
 let sa,sb;
 if(activeEvent==='two'){
  const result=String(f.get('result')||'');
  if(!['2-0','2-1','1-1','1-2','0-2'].includes(result)){alert('試合結果を選択してください。');return}
  [sa,sb]=result.split('-').map(Number);
 }else{
  const winner=form.dataset.winner;
  if(!['a','b'].includes(winner)){alert('左右いずれかの「勝」ボタンを選択してください。');return}
  const val=Number(f.get('points'));
  sa=winner==='a'?val:0;sb=winner==='b'?val:0;
 }
 const m={id:editingMatch||'m'+Date.now()+'-'+Math.random().toString(36).slice(2,8),event:activeEvent,a,b,sa,sb};const err=validMatch(m,new Set(ed().players.map(p=>p.id)));if(err){alert(err);return}
 const repeated=ed().matches.some(x=>x.id!==m.id&&x.event===m.event&&((x.a===a&&x.b===b)||(x.a===b&&x.b===a)));
 if(repeated&&!confirm('この2名は既にこの大会で対戦しています。重複対戦として登録しますか？'))return;
 if(editingMatch){const i=ed().matches.findIndex(x=>x.id===editingMatch);if(i<0)return;ed().matches[i]=m;}else ed().matches.push(m);
 finishPairing(ed(),activeEvent,a,b);
 editingMatch=null;preselectedPair=null;save();render();notice('試合結果を保存しました。');
}

function entriesSave(form){const f=new FormData(form),id=Number(f.get('player')),p=player(id);if(!p){alert('対象選手を選択してください。');return}
 p.entries=f.getAll('entries').filter(id=>eventIds.includes(id));editingEntries=p.id;save();render();notice('出場登録を保存しました。');}
function toggleAttendance(button){
 const active=button.getAttribute('aria-pressed')!=='true';
 button.setAttribute('aria-pressed',String(active));
 button.classList.toggle('attending',active);
 button.textContent=active?'出場':'ー';
 button.parentElement.querySelector('input[name="entries"]').disabled=!active;
}
function asCSV(id){const isTwo=id==='two',overall=id==='overall';let h=['順位','氏名','選手No.','試合','勝','負'];if(isTwo)h.push('引分');h.push('勝越','勝率');if(!isTwo)h.push('得点','失点','得失点');if(overall)h.push('採用Day');
 const lines=[h,...standings(ed(),id).map(r=>{const a=[r.rank,r.name,r.id,r.matches,r.wins,r.losses];if(isTwo)a.push(r.draws);a.push(r.spread,formatRate(r.rate));if(!isTwo)a.push(r.scored,r.conceded,r.diff);if(overall)a.push(r.selectedDays.map(dayName).join('+'));return a})];
 const safe=s=>{const t=String(s??'');return '"'+(typeof s==='string'&&/^[=+\-@\t\r]/.test(t)?"'":'')+t.replaceAll('"','""')+'"'};return '\ufeff'+lines.map(a=>a.map(safe).join(',')).join('\r\n')}
function download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function timestamp(){const d=new Date(),pad=x=>String(x).padStart(2,'0');return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`}
function normalizeImport(x){if(!x||x.schema!==1||!Array.isArray(x.editions))throw Error('対応するJSON形式ではありません。');const ids=new Set();for(const e of x.editions){if(typeof e.id!=='string'||typeof e.name!=='string'||ids.has(e.id)||!Array.isArray(e.players)||!Array.isArray(e.matches))throw Error('大会データが不正です。');ids.add(e.id);const pids=new Set();for(const p of e.players){if(!Number.isInteger(p.id)||pids.has(p.id)||!String(p.name||'').trim())throw Error('選手マスタに重複・不正値があります。');pids.add(p.id)}const mids=new Set();for(const m of e.matches){if(typeof m.id!=='string'||mids.has(m.id))throw Error('試合IDの重複があります。');mids.add(m.id);const issue=validMatch(m,pids);if(issue)throw Error(`${e.name}: ${issue}`)}e.pendingPairings=Array.isArray(e.pendingPairings)?e.pendingPairings:[];
 const busyByEvent=new Map();
 for(const q of e.pendingPairings){
  if(!q||!eventIds.includes(q.event)||!Number.isInteger(q.a)||!Number.isInteger(q.b)||q.a===q.b||!pids.has(q.a)||!pids.has(q.b))throw Error('対戦中の割当データが不正です。');
  const used=busyByEvent.get(q.event)||new Set();
  if(used.has(q.a)||used.has(q.b))throw Error('同じ選手の対戦中割当が重複しています。');
  used.add(q.a);used.add(q.b);busyByEvent.set(q.event,used);
 }
 e.dates=e.dates||{};for(const p of e.players){p.entries=Array.isArray(p.entries)?p.entries.filter(v=>eventIds.includes(v)):[]}}return x}
function fileLoad(){const i=document.createElement('input');i.type='file';i.accept='.json,application/json';i.onchange=async()=>{if(!i.files?.length)return;try{const raw=JSON.parse(await i.files[0].text());const imported=normalizeImport(raw);let n=0;for(const e of imported.editions){if(data.editions.some(x=>x.id===e.id)){if(!confirm(`「${e.name}」が存在します。上書きしますか？（操作を取り消せません）`))continue;data.editions=data.editions.filter(x=>x.id!==e.id)}data.editions.push(e);data.activeEditionId=e.id;n++}if(n){save();render();notice(`${n}大会分のデータを取り込みました。`)}else notice('取り込みは行われませんでした。');}catch(e){alert('JSON取込エラー：'+e.message)}};i.click();}
function newEdition(){const name=prompt('新しい大会データの名称','BACKGAMMON CLASSIC 2027');if(!name?.trim())return;const id='edition-'+Date.now();data.editions.push({id,name:name.trim(),players:[],matches:[],pendingPairings:[],dates:{}});data.activeEditionId=id;activeEvent='day1';$('header-event').value='day1';save();render();notice('大会データを作成しました。')}
function onAction(action,id){switch(action){
 case 'edit-match':{const m=ed().matches.find(x=>String(x.id)===String(id));if(!m)return;activeEvent=m.event;$('header-event').value=m.event;editingMatch=m.id;preselectedPair=null;tab='entry';render();window.scrollTo({top:0,behavior:'smooth'});break}
 case 'cancel-match':editingMatch=null;preselectedPair=null;render();break;
 case 'delete-match':if(!confirm('この試合結果を削除しますか？'))return;ed().matches=ed().matches.filter(m=>String(m.id)!==String(id));if(editingMatch===id)editingMatch=null;save();render();notice('試合結果を削除しました。');break;
 case 'edit-entries':editingEntries=Number(id);tab='manage';render();window.scrollTo({top:0,behavior:'smooth'});break;
 case 'new-edition':newEdition();break;
 case 'backup':download(`beginner_${timestamp()}.json`,JSON.stringify({schema:1,activeEditionId:data.activeEditionId,editions:data.editions},null,2),'application/json');break;
 case 'load':fileLoad();break;
 case 'rename-edition':{const name=prompt('大会データの名称',ed().name);if(!name?.trim())return;ed().name=name.trim();save();render();break}
 case 'delete-edition':{if(data.editions.length===1){alert('最後の大会は削除できません。');return}if(!confirm(`「${ed().name}」の選手・試合データをすべて削除しますか？`))return;data.editions=data.editions.filter(e=>e.id!==data.activeEditionId);data.activeEditionId=data.editions[0].id;save();render();break}
 case 'print':$('print-area').innerHTML=reportHTML(activeEvent);window.print();break;
 case 'csv':download(`beginner_${activeEvent}_${timestamp()}.csv`,asCSV(activeEvent),'text/csv;charset=utf-8');break;
 }}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;editingMatch=null;editingEntries=null;render()}));
document.querySelectorAll('[data-header-action]').forEach(b=>b.addEventListener('click',()=>onAction(b.dataset.headerAction)));
renderHeaderEvent();
$('header-event').addEventListener('change',e=>{activeEvent=e.target.value;editingMatch=null;preselectedPair=null;historySearch='';render()});
$('app').addEventListener('submit',e=>{if(e.target.id==='match-form'){e.preventDefault();matchSave(e.target)}else if(e.target.id==='entries-form'){e.preventDefault();entriesSave(e.target)}else if(e.target.id==='dates-form'){e.preventDefault();const f=new FormData(e.target);ed().dates={};for(const id of eventIds)if(f.get(id))ed().dates[id]=String(f.get(id));ed().dates.overall=ed().dates.day3||'';save();render();notice('大会の日付を保存しました。')}});
$('app').addEventListener('change',e=>{if(e.target.id==='edition-picker'){data.activeEditionId=e.target.value;activeEvent='day1';$('header-event').value='day1';editingMatch=null;editingEntries=null;save();render()}else if(e.target.id==='edition-name-input'){const name=e.target.value.trim();if(!name){e.target.value=ed().name;return}ed().name=name;save();render();notice('大会名を保存しました。')}else if(e.target.matches('[data-match-side]')){syncMatchPlayer(e.target)}else if(e.target.name==='result'&&e.target.closest('#match-form')){const score=e.target.value;setWinner(e.target.closest('#match-form'),score==='1-1'?'':score==='2-0'||score==='2-1'?'a':score==='0-2'||score==='1-2'?'b':'')}else if(e.target.id==='entries-player'){editingEntries=e.target.value?Number(e.target.value):null;render()}else if(e.target.matches('[data-roster-name]')){rosterNameChange(e.target)}else if(e.target.matches('[data-roster-kana]')){rosterKanaChange(e.target)}});
$('app').addEventListener('click',e=>{const rosterToggle=e.target.closest('[data-roster-event]');if(rosterToggle){rosterEventChange(rosterToggle);return}const attendance=e.target.closest('[data-entry-toggle]');if(attendance){toggleAttendance(attendance);return}const win=e.target.closest('[data-winner-button]');if(win){const form=win.closest('#match-form');setWinner(form,form.dataset.winner===win.dataset.winnerButton?'':win.dataset.winnerButton);return}const b=e.target.closest('[data-action]');if(!b)return;if(b.dataset.action==='pick-pair'){
 const a=Number(b.dataset.a),c=Number(b.dataset.b);
 if(!unplayedPairs(ed(),activeEvent).some(p=>p.a===Math.min(a,c)&&p.b===Math.max(a,c))){notice('この組み合わせは斡旋できません。');render();return}
 if(!confirm(`${playerLabel(a)} と ${playerLabel(c)} の対戦を組みますか？`))return;
 if(!reservePairing(ed(),activeEvent,a,c)){notice('この組み合わせは既に斡旋されています。');render();return}
 preselectedPair={a,b:c};editingMatch=null;save();render();notice('対戦を組みました。');$('match-form')?.scrollIntoView({behavior:'smooth',block:'nearest'});return
 }
 if(b.dataset.action==='cancel-pair'){
 const a=Number(b.dataset.a),c=Number(b.dataset.b);
 if(!confirm(`${playerLabel(a)} と ${playerLabel(c)} の対戦斡旋を取り消しますか？`))return;
 if(cancelPairing(ed(),activeEvent,a,c)){
  if(preselectedPair?.a===a&&preselectedPair?.b===c)preselectedPair=null;
  save();render();notice('対戦斡旋を取り消しました。');
 }
 return
 }
 onAction(b.dataset.action,b.dataset.id)});
$('app').addEventListener('input',e=>{if(e.target.id==='history-filter'){historySearch=e.target.value;$('history-results').innerHTML=historyTable(resultsFor(activeEvent))}else if(e.target.matches('input[data-match-side]')){syncMatchPlayer(e.target)}else if(e.target.id==='player-filter'){playerSearch=e.target.value;const sel=e.target.selectionStart;render();$('player-filter')?.focus();$('player-filter')?.setSelectionRange(sel,sel)}else if(e.target.matches('[data-roster-name]')){rosterRowState(e.target.closest('[data-roster-id]'))}});
renderEditionPicker();render();
