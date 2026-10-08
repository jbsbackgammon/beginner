import {EVENTS,eventById,validMatch,standings,entryCount,unplayedPairs,activePairings,reservePairing,cancelPairing,finishPairing,waitingPlayerIds,availableWaitingPlayers,addWaitingPlayer,removeWaitingPlayer,returnPlayersToWaiting,migrateReservedWaiting,canRegisterSelection,ensureMatchNumbers,nextMatchNumber,historySearchMatches} from './ranking.mjs';
const KEY='jbs-beginner-v1';
const eventIds=EVENTS.filter(e=>e.id!=='overall').map(e=>e.id);
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DEFAULT_EDITION_NAME='BACKGAMMON FESTIVAL 20XX';
const initial=()=>({schema:1,activeEditionId:'classic-2026',editions:[{id:'classic-2026',name:DEFAULT_EDITION_NAME,players:[],matches:[],pendingPairings:[],dates:Object.fromEntries(EVENTS.map(e=>[e.id,e.date]))}]});
let data;try{data=JSON.parse(localStorage.getItem(KEY)||'null')}catch{data=null}
if(!data || data.schema!==1 || !Array.isArray(data.editions))data=initial();
for(const edition of data.editions){
  ensureMatchNumbers(edition);
  migrateReservedWaiting(edition);
  // Change only the prefilled starter label; never overwrite a customized name.
  if(edition.id==='classic-2026' && edition.name==='BACKGAMMON CLASSIC 2026') edition.name=DEFAULT_EDITION_NAME;
}
// Backfill match numbers into older browser data without changing its storage key.
try{localStorage.setItem(KEY,JSON.stringify(data))}catch{ /* Save errors are reported on edit. */ }
let tab='players',activeEvent='day1',historySearch='',editingMatch=null,preselectedPair=null;
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
 $('app').innerHTML=({entry:renderEntry,players:renderPlayers,export:renderExport})[tab]();
 renderEditionPicker();
}
function dateFor(eventId){return ed().dates?.[eventId]||(ed().id==='classic-2026'?eventById(eventId)?.date:'')||''}
function resultsFor(event){return ed().matches.filter(x=>x.event===event)}
function side(m){return m.sa===m.sb?'引き分け':(m.sa>m.sb ? playerLabel(m.a):playerLabel(m.b))}
function historyTable(matches) {
 const shown=matches.filter(m=>historySearchMatches(m,historySearch,ed().players)).slice().sort((a,b)=>b.matchNo-a.matchNo).slice(0,80);
 const rows=shown.map(m=>{
  // Keep the original result untouched for correction and ranking calculation.
  const draw=m.sa===m.sb;
  const firstIsA=draw ? m.a<=m.b : m.sa>m.sb;
  const leftId=firstIsA?m.a:m.b,rightId=firstIsA?m.b:m.a;
  const leftScore=firstIsA?m.sa:m.sb,rightScore=firstIsA?m.sb:m.sa;
  const leftClass=draw?'history-score-draw':'history-score-win';
  const rightClass=draw?'history-score-draw':'';
  return `<tr><td class="history-number">${m.matchNo}</td><td class="history-name">${esc(playerLabel(leftId))}</td><td class="history-score"><span class="${leftClass}">${esc(leftScore)}</span><span class="history-score-separator"> - </span><span class="${rightClass}">${esc(rightScore)}</span></td><td class="history-name">${esc(playerLabel(rightId))}</td><td class="row-actions"><button class="btn small" data-action="edit-match" data-id="${esc(m.id)}">修正</button> <button class="btn small danger" data-action="delete-match" data-id="${esc(m.id)}">削除</button></td></tr>`;
 }).join('');
 return shown.length?`<table class="data-table history-table"><colgroup><col class="history-col-number"><col class="history-col-player"><col class="history-col-score"><col class="history-col-player"><col class="history-col-actions"></colgroup><thead><tr><th>試合</th><th>選手名</th><th>結果</th><th>選手名</th><th aria-label="操作"></th></tr></thead><tbody>${rows}</tbody></table>`:'<div class="empty">該当する試合がありません</div>';
}

function pairingTable(pairs){
 const busy=activePairings(ed(),activeEvent);
 const groups=new Map();
 const busyIds=new Set(busy.flatMap(p=>[p.a,p.b]));
 for(const id of waitingPlayerIds(ed(),activeEvent).filter(id=>!busyIds.has(id)))groups.set(id,[]);
 for(const pair of pairs){groups.get(pair.a)?.push(pair.b);groups.get(pair.b)?.push(pair.a)}
 const filtered=[...groups];
 const list=filtered.length?`<table class="data-table pairing-list"><thead><tr><th>対戦待ち</th><th>未対戦相手</th><th aria-label="操作"></th></tr></thead><tbody>${filtered.map(([id,opps])=>`<tr><td class="pairing-name">${esc(playerLabel(id))}</td><td class="pairing-opponents"><div class="opponents">${opps.length?opps.sort((a,b)=>a-b).map(n=>`<button type="button" class="opponent-no" data-action="pick-pair" data-a="${id}" data-b="${n}" title="${esc(player(n)?.name||playerLabel(n))}" aria-label="${esc(playerLabel(n))}と対戦を組む">${n}</button>`).join(''):'<span class="muted">ー</span>'}</div></td><td class="pairing-actions"><button type="button" class="btn small pairing-remove" data-action="remove-waiting" data-id="${id}" aria-label="${esc(playerLabel(id))}を対戦待ちから削除">削除</button></td></tr>`).join('')}</tbody></table>`:`<div class="empty">${busy.length?'対戦待ちの選手がいません':'対戦待ちの選手がいません'}</div>`;
 return list;
}
function matchPlayerField(side,id,label,winningSide){
 const selected=winningSide===side,other=['a','b'].includes(winningSide)&&winningSide!==side;
 const state=selected?'win':other?'lose':'';
 return `<div class="match-player"><div class="match-player-controls"><label class="field match-no-field"><input type="number" name="${side}_no" data-match-side="${side}" aria-label="${label}の番号" min="1" step="1" inputmode="numeric" value="${id||''}" placeholder="No."></label><label class="field match-name-field"><select name="${side}" data-match-side="${side}" aria-label="${label}の選手名">${playerOptions(id)}</select></label></div><button type="button" data-winner-button="${side}" class="winner-button ${state}" aria-pressed="${selected?'true':'false'}">${other?'負':'勝'}</button></div>`;
}
function renderEntry(){
 const e=eventById(activeEvent),matches=resultsFor(activeEvent),current=editingMatch?ed().matches.find(x=>x.id===editingMatch):null;
 const first=current?.a||preselectedPair?.a||null,second=current?.b||preselectedPair?.b||null;
 const winningSide=''; // Require a deliberate button press, including during corrections.
 const twoScore=current?`${current.sa}-${current.sb}`:'';
 const pts=e.kind==='cube'?[1,2,3,4,6,8,12]:[1,2,3];
 const pointsLabel=e.kind==='points'?{1:'1-0 シングル勝ち',2:'2-0 ギャモン勝ち',3:'3-0 バックギャモン勝ち'}:Object.fromEntries(pts.map(n=>[n,`${n}-0`]));
 const resultControl=e.kind==='two'?`<label class="field result-score"><select name="result" aria-label="得点" required><option value="">得点を選択</option>${['2-0','2-1','1-1','1-2','0-2'].map(x=>`<option value="${x}" ${twoScore===x?'selected':''}>${x}</option>`).join('')}</select></label>`:`<label class="field result-score"><select name="points" aria-label="得点" required><option value="">得点を選択</option>${pts.map(n=>`<option value="${n}" ${current&&Math.max(current.sa,current.sb)===n?'selected':''}>${pointsLabel[n]}</option>`).join('')}</select></label>`;
 const addable=availableWaitingPlayers(ed(),activeEvent);
 const addControl=`<div class="pairing-add"><select id="pair-add-player" aria-label="対戦待ちに追加する選手番号" ${addable.length?'':'disabled'}><option value="">選手選択</option>${addable.map(p=>`<option value="${p.id}">${esc(`#${p.id} ${p.name}`)}</option>`).join('')}</select><button type="button" class="btn small" data-action="add-waiting" ${addable.length?'':'disabled'}>追加</button></div>`;
 const pairs=unplayedPairs(ed(),activeEvent);
 const middle=e.kind==='two'
   ? `<div class="vs match-versus two-controls"><span class="versus-label">VS</span><button type="button" class="draw-button" data-draw-button aria-pressed="false">引分</button></div>`
   : `<span class="vs match-versus" aria-hidden="true">VS</span>`;
 const form=`<form id="match-form" data-kind="${e.kind}" data-winner="${winningSide}"><div class="scoreline ${e.kind==='two'?'two-entry':''}">${matchPlayerField('a',first,'左選手',winningSide)}${middle}${matchPlayerField('b',second,'右選手',winningSide)}</div><div class="result-row">${resultControl}<button type="submit" class="btn primary" disabled>${current?'結果を更新':'結果登録'}</button></div>${current?'<div class="btnset"><button type="button" class="btn" data-action="cancel-match">編集を取り消す</button></div>':''}</form>`;
 return `<div class="entry-grid"><div class="entry-left"><section class="box entry-form"><h3>結果入力</h3>${form}</section><section class="box entry-pairings"><div class="section-head pairing-title"><h3>対戦斡旋</h3>${addControl}</div><div id="pair-results" class="table-scroll spaced pairing-scroll">${pairingTable(pairs)}</div></section></div><section class="box entry-history"><div class="section-head history-title"><h3>結果履歴</h3><input id="history-filter" placeholder="選手名・番号で検索" value="${esc(historySearch)}" aria-label="結果履歴検索"></div><div id="history-results" class="table-scroll spaced history-scroll">${historyTable(matches)}</div></section></div>`;
}
function updateSubmitEnabled(form){
 const score=String((form.elements.namedItem('result')||form.elements.namedItem('points'))?.value||'');
 // A match needs two different, registered players. Check both dropdowns, whose
 // values are kept in sync with the corresponding number inputs.
 const left=String(form.elements.namedItem('a')?.value||'');
 const right=String(form.elements.namedItem('b')?.value||'');
 const distinctPlayers=left!==''&&right!==''&&left!==right;
 const submit=form.querySelector('button[type="submit"]');
 if(submit)submit.disabled=!distinctPlayers || !score || !canRegisterSelection(form.dataset.kind,form.dataset.winner,score);
}
function setWinner(form,side){
 form.dataset.winner=side;
 form.querySelectorAll('[data-winner-button]').forEach(button=>{
  const state=!['a','b'].includes(side)?'':side===button.dataset.winnerButton?'win':'lose';
  button.classList.toggle('win',state==='win');button.classList.toggle('lose',state==='lose');
  button.textContent=state==='lose'?'負':'勝';button.setAttribute('aria-pressed',String(state==='win'));
 });
 const draw=form.querySelector('[data-draw-button]');
 if(draw){draw.classList.toggle('selected',side==='draw');draw.setAttribute('aria-pressed',String(side==='draw'));}
 updateSubmitEnabled(form);
}
function syncMatchPlayer(el){
 const form=el.closest('#match-form');if(!form)return;
 const side=el.dataset.matchSide,number=form.elements.namedItem(side+'_no'),select=form.elements.namedItem(side);
 if(el.tagName==='SELECT')number.value=select.value;
 else {const parsed=Number(number.value);select.value=number.value!==''&&player(parsed)?String(parsed):'';}
 updateSubmitEnabled(form);
}
function statsTable(eventId,preview=false){
 const rows=standings(ed(),eventId),isTwo=eventId==='two',overall=eventId==='overall';
 if(!rows.length)return '<div class="empty">表示できる成績がありません</div>';
 const headers=['順位','選手',isTwo?'③試合':'試合','勝','負',...(isTwo?['引分']:[]),isTwo?'①勝越':'②勝越',isTwo?'②勝率':'③勝率',...(!isTwo?['得点','失点','①得失点差']:[]),...(overall?['採用Day']:[])];
 const td=(label,value,cls='')=>`<td data-label="${label}"${cls?` class="${cls}"`:''}>${value}</td>`;
 const html=rows.map(r=>{
  const cells=[
   td('順位',`<strong>${r.rank}</strong>`,'standings-rank'),td('選手',esc(`#${r.id} ${r.name}`),'player-name'),td(isTwo?'③試合':'試合',r.matches),td('勝',r.wins),td('負',r.losses),
   ...(isTwo?[td('引分',r.draws)]:[]),td('勝越',`${r.spread>0?'+':''}${r.spread}`,r.spread>=0?'pos':'neg'),td('勝率',formatRate(r.rate)),
   ...(!isTwo?[td('得点',r.scored),td('失点',r.conceded),td('得失点',`${r.diff>0?'+':''}${r.diff}`,r.diff>=0?'pos':'neg')]:[]),
   ...(overall?[td('採用Day',(r.selectedDays||[]).map(dayName).join('＋'))]:[])
  ];
  return `<tr class="${r.rank<=3?'podium':''}">${cells.join('')}</tr>`;
 });
 return `<div class="table-scroll"><table class="data-table standings-table"><thead><tr>${headers.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${html.join('')}</tbody></table></div>`;
}
function rosterNumbers(e){
 const highest=e.players.reduce((n,p)=>Number.isInteger(p.id)&&p.id>0?Math.max(n,p.id):n,0);
 const visible=Math.max(30,highest,Number.isInteger(e.rosterVisibleRows)?e.rosterVisibleRows:0);
 return Array.from({length:visible},(_,i)=>i+1);
}
function renderPlayers(){
 const e=ed(),byId=new Map(e.players.map(p=>[p.id,p])),numbers=rosterNumbers(e);
 const header=['初級戦Day1','初級戦Day2','初級戦Day3','2ptマッチRR','キューブ有RR','小学生選手権'];
 const rows=numbers.map(id=>{
  const p=byId.get(id),active=!!p?.name?.trim();
  const cells=eventIds.map((event,i)=>{
   const attending=!!p?.entries?.includes(event);
   return `<td data-label="${esc(header[i])}"><button type="button" class="roster-attendance ${attending?'attending':''}" data-roster-event="${event}" aria-pressed="${attending}" aria-label="No.${id} ${header[i]} ${attending?'出場':'未出場'}" ${active?'':'disabled'}>${attending?'出場':'ー'}</button></td>`;
  }).join('');
  return `<tr data-roster-id="${id}" class="${active?'':'roster-inactive'}"><td class="roster-no" data-label="番号">${id}</td><td data-label="選手"><input type="text" data-roster-name aria-label="No.${id} 選手" autocomplete="off" maxlength="100" value="${esc(p?.name||'')}"></td><td data-label="よみ"><input type="text" data-roster-kana aria-label="No.${id} よみ" autocomplete="off" maxlength="100" value="${esc(p?.kana||'')}" ${active?'':'disabled'}></td>${cells}</tr>`;
 }).join('');
 return `<div class="box roster-box"><div class="table-scroll roster-scroll"><table class="data-table roster-matrix"><thead><tr><th>番号</th><th>選手</th><th>よみ</th>${header.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows}</tbody><tfoot><tr class="roster-add-row"><td colspan="${header.length+3}"><button type="button" class="btn" data-action="add-roster-row">次の10行を追加</button></td></tr></tfoot></table></div></div>`;
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
 if(!name){
  if(p && (ed().matches.some(m=>m.a===id||m.b===id) || (ed().pendingPairings||[]).some(q=>q.a===id||q.b===id))){
   alert('この選手には試合記録または対戦中の割当があります。名前を空欄にはできません。');
   input.value=p.name;rosterRowState(tr);return;
  }
  if(p){
   ed().players=ed().players.filter(x=>x.id!==id);
   for(const ids of Object.values(ed().waitingPlayers||{}))if(Array.isArray(ids)){
    const index=ids.indexOf(id);if(index!==-1)ids.splice(index,1);
   }
  }
  tr.querySelector('[data-roster-kana]').value='';
  tr.querySelectorAll('[data-roster-event]').forEach(button=>{button.setAttribute('aria-pressed','false');button.classList.remove('attending');button.textContent='ー';button.setAttribute('aria-label',button.getAttribute('aria-label').replace(/ (出場|未出場)$/,' 未出場'));});
 }else if(p){p.name=name;}else{
  ed().players.push({id,name,kana:tr.querySelector('[data-roster-kana]').value.trim(),entries:[]});
 }
 input.value=name;rosterRowState(tr);save();
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

function reportHTML(id){
 const e=eventById(id),rows=standings(ed(),id),date=id==='overall'?dateFor('day3'):dateFor(id),isTwo=id==='two',overall=id==='overall';
 const headers=['順位','選手',isTwo?'③試合':'試合','勝','負',...(isTwo?['引']:[]),isTwo?'①勝越':'②勝越',isTwo?'②勝率':'③勝率',...(!isTwo?['得点','失点','①得失点差']:[]),...(overall?['採用Day']:[])];
 const tr=rows.map(r=>{
  const vals=[r.rank,esc(`#${r.id} ${r.name}`),r.matches,r.wins,r.losses,...(isTwo?[r.draws]:[]),`${r.spread>0?'+':''}${r.spread}`,formatRate(r.rate),...(!isTwo?[r.scored,r.conceded,`${r.diff>0?'+':''}${r.diff}`]:[]),...(overall?[(r.selectedDays||[]).map(dayName).join('＋')]:[])];
  return `<tr>${vals.map((v,i)=>`<td data-label="${headers[i]}"${i===0?' class="standings-rank"':''}>${v}</td>`).join('')}</tr>`;
 }).join('');
 return `<div class="report"><div class="report-heading"><div class="smallcaps">JAPAN BACKGAMMON SOCIETY</div><h2>${esc(ed().name)}　${esc(e.label)}　成績表</h2><small>${esc(date)}　／　日本バックギャモン協会</small></div><table class="report-data-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${tr||`<tr><td colspan="12">成績データなし</td></tr>`}</tbody></table><p class="muted" style="margin-top:12px">${rows.length}名　／　${isTwo?'勝越→勝率→試合数':'得失点差→勝越→勝率'}順</p></div>`;
}
function renderExport(){
 // Combined screen: compact print controls above the live standings table.
 const day=activeEvent==='overall'?'day3':activeEvent;
 return `<section class="box report-settings"><div class="report-controls">
  <label class="field report-name"><span>大会名</span><input id="edition-name-input" type="text" value="${esc(ed().name)}" maxlength="120"></label>
  <label class="field report-date"><span>開催日</span><input id="edition-date-input" type="date" value="${esc(dateFor(day))}"></label>
  <button type="button" class="btn primary report-print" data-action="print">PDF出力</button>
 </div></section><section class="box report-rankings">${statsTable(activeEvent)}</section>`;
}

function matchSave(form){const f=new FormData(form),a=Number(f.get('a_no')||f.get('a')),b=Number(f.get('b_no')||f.get('b'));
 if(!a||!b||a===b){alert(a===b&&a>0?'同じ選手同士の結果は登録できません。':'左右に異なる選手を指定してください。');return}
 let sa,sb;
 const winner=form.dataset.winner;
 if(activeEvent==='two'){
  const result=String(f.get('result')||'');
  if(!canRegisterSelection('two',winner,result)){alert('「勝」または「引分」を選択し、対応する得点を選んでください。');return}
  [sa,sb]=result.split('-').map(Number);
 }else{
  if(!canRegisterSelection(eventById(activeEvent).kind,winner)){alert('左右いずれかの「勝」ボタンを選択してください。');return}
  const raw=String(f.get('points')||'');
  if(!raw){alert('得点を選択してください。');return}
  const val=Number(raw);
  sa=winner==='a'?val:0;sb=winner==='b'?val:0;
 }
 const m={id:editingMatch||'m'+Date.now()+'-'+Math.random().toString(36).slice(2,8),event:activeEvent,a,b,sa,sb};const err=validMatch(m,new Set(ed().players.map(p=>p.id)));if(err){alert(err);return}
 const repeated=ed().matches.some(x=>x.id!==m.id&&x.event===m.event&&((x.a===a&&x.b===b)||(x.a===b&&x.b===a)));
 if(repeated&&!confirm('この2名は既にこの大会で対戦しています。重複対戦として登録しますか？'))return;
 if(editingMatch){const i=ed().matches.findIndex(x=>x.id===editingMatch);if(i<0)return;m.matchNo=ed().matches[i].matchNo;ed().matches[i]=m;}else{m.matchNo=nextMatchNumber(ed(),activeEvent);ed().matches.push(m);}
 finishPairing(ed(),activeEvent,a,b);
 returnPlayersToWaiting(ed(),activeEvent,a,b);
 editingMatch=null;preselectedPair=null;save();render();notice('試合結果を保存しました。');
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
 if(e.waitingPlayers!==undefined){
  if(!e.waitingPlayers||typeof e.waitingPlayers!=='object'||Array.isArray(e.waitingPlayers))throw Error('対戦待ちデータが不正です。');
  for(const [key,list] of Object.entries(e.waitingPlayers)){
   if(!eventIds.includes(key)||!Array.isArray(list)||list.some(id=>!Number.isInteger(id)||!pids.has(id))||new Set(list).size!==list.length)throw Error('対戦待ちに無効な選手番号があります。');
  }
 }
 e.dates=e.dates||{};for(const p of e.players){p.entries=Array.isArray(p.entries)?p.entries.filter(v=>eventIds.includes(v)):[]}ensureMatchNumbers(e);migrateReservedWaiting(e)}return x}
function fileLoad(){const i=document.createElement('input');i.type='file';i.accept='.json,application/json';i.onchange=async()=>{if(!i.files?.length)return;try{const raw=JSON.parse(await i.files[0].text());const imported=normalizeImport(raw);let n=0;for(const e of imported.editions){if(data.editions.some(x=>x.id===e.id)){if(!confirm(`「${e.name}」が存在します。上書きしますか？（操作を取り消せません）`))continue;data.editions=data.editions.filter(x=>x.id!==e.id)}data.editions.push(e);data.activeEditionId=e.id;n++}if(n){save();render();notice(`${n}大会分のデータを取り込みました。`)}else notice('取り込みは行われませんでした。');}catch(e){alert('JSON取込エラー：'+e.message)}};i.click();}
function newEdition(){const name=prompt('新しい大会データの名称','BACKGAMMON CLASSIC 2027');if(!name?.trim())return;const id='edition-'+Date.now();data.editions.push({id,name:name.trim(),players:[],matches:[],pendingPairings:[],dates:{}});data.activeEditionId=id;activeEvent='day1';$('header-event').value='day1';save();render();notice('大会データを作成しました。')}
function onAction(action,id){switch(action){
 case 'add-roster-row':{
  const visible=rosterNumbers(ed());
  ed().rosterVisibleRows=visible.length+10;
  save();render();
  const tr=$('app').querySelector(`[data-roster-id="${ed().rosterVisibleRows}"]`);
  tr?.querySelector('[data-roster-name]')?.focus({preventScroll:true});
  tr?.scrollIntoView({block:'nearest',behavior:'smooth'});
  break;
 }
 case 'add-waiting':{
  const id=Number($('pair-add-player')?.value);
  if(!id){notice('追加する選手番号を選んでください。');return}
  const reserved=activePairings(ed(),activeEvent).find(q=>q.a===id||q.b===id);
  if(reserved){
   const opponent=reserved.a===id?reserved.b:reserved.a;
   if(!confirm(`${playerLabel(id)} は ${playerLabel(opponent)} と対戦中です。対戦斡旋を解除して、両選手を対戦待ちに戻しますか？`))return;
   if(!cancelPairing(ed(),activeEvent,reserved.a,reserved.b))return;
   if(preselectedPair && [reserved.a,reserved.b].includes(preselectedPair.a) && [reserved.a,reserved.b].includes(preselectedPair.b))preselectedPair=null;
   save();render();notice(`${playerLabel(id)} を対戦待ちに追加しました。`);break;
  }
  if(!addWaitingPlayer(ed(),activeEvent,id)){notice('この選手は対戦待ちに追加できません。');return}
  save();render();notice(`${playerLabel(id)} を対戦待ちに追加しました。`);break
 }
 case 'remove-waiting':{
  const playerId=Number(id);
  if(removeWaitingPlayer(ed(),activeEvent,playerId)){
   save();render();notice(`${playerLabel(playerId)} を対戦待ちから削除しました。`);
  }
  break
 }
 case 'edit-match':{const m=ed().matches.find(x=>String(x.id)===String(id));if(!m)return;activeEvent=m.event;$('header-event').value=m.event;editingMatch=m.id;preselectedPair=null;tab='entry';render();window.scrollTo({top:0,behavior:'smooth'});break}
 case 'cancel-match':editingMatch=null;preselectedPair=null;render();break;
 case 'delete-match':if(!confirm('この試合結果を削除しますか？'))return;ed().matches=ed().matches.filter(m=>String(m.id)!==String(id));if(editingMatch===id)editingMatch=null;save();render();notice('試合結果を削除しました。');break;
 case 'backup':download(`beginner_${timestamp()}.json`,JSON.stringify({schema:1,activeEditionId:data.activeEditionId,editions:data.editions},null,2),'application/json');break;
 case 'load':fileLoad();break;
 case 'delete-all':{
  if(!confirm('【全削除】保存されているすべての大会データ・選手・試合結果・対戦斡旋を削除します。元に戻せません。必要な場合は、先にJSON出力でバックアップしてください。\n\n本当に全削除しますか？'))return;
  data=initial();tab='players';activeEvent='day1';historySearch='';editingMatch=null;preselectedPair=null;
  save();render();notice('すべての管理データを削除しました。');break;
 }
 case 'rename-edition':{const name=prompt('大会データの名称',ed().name);if(!name?.trim())return;ed().name=name.trim();save();render();break}
 case 'delete-edition':{if(data.editions.length===1){alert('最後の大会は削除できません。');return}if(!confirm(`「${ed().name}」の選手・試合データをすべて削除しますか？`))return;data.editions=data.editions.filter(e=>e.id!==data.activeEditionId);data.activeEditionId=data.editions[0].id;save();render();break}
 case 'print':$('print-area').innerHTML=reportHTML(activeEvent);window.print();break;
 }}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;editingMatch=null;render()}));
document.querySelectorAll('[data-header-action]').forEach(b=>b.addEventListener('click',()=>onAction(b.dataset.headerAction)));
renderHeaderEvent();
$('header-event').addEventListener('change',e=>{activeEvent=e.target.value;editingMatch=null;preselectedPair=null;historySearch='';render()});
$('app').addEventListener('submit',e=>{if(e.target.id==='match-form'){e.preventDefault();matchSave(e.target)}});
$('app').addEventListener('change',e=>{if(e.target.id==='edition-picker'){data.activeEditionId=e.target.value;activeEvent='day1';$('header-event').value='day1';editingMatch=null;save();render()}else if(e.target.id==='edition-name-input'){const name=e.target.value.trim();if(!name){e.target.value=ed().name;return}ed().name=name;save();render();notice('大会名を保存しました。')}else if(e.target.matches('[data-match-side]')){syncMatchPlayer(e.target)}else if(['result','points'].includes(e.target.name)&&e.target.closest('#match-form')){updateSubmitEnabled(e.target.closest('#match-form'))}else if(e.target.id==='edition-date-input'){const day=activeEvent==='overall'?'day3':activeEvent;ed().dates=ed().dates||{};ed().dates[day]=e.target.value;if(day==='day3')ed().dates.overall=e.target.value;save();render()}else if(e.target.matches('[data-roster-name]')){rosterNameChange(e.target)}else if(e.target.matches('[data-roster-kana]')){rosterKanaChange(e.target)}});
$('app').addEventListener('click',e=>{const rosterToggle=e.target.closest('[data-roster-event]');if(rosterToggle){rosterEventChange(rosterToggle);return}const win=e.target.closest('[data-winner-button]');if(win){const form=win.closest('#match-form');setWinner(form,form.dataset.winner===win.dataset.winnerButton?'':win.dataset.winnerButton);return}const draw=e.target.closest('[data-draw-button]');if(draw){const form=draw.closest('#match-form');setWinner(form,form.dataset.winner==='draw'?'':'draw');return}const b=e.target.closest('[data-action]');if(!b)return;if(b.dataset.action==='pick-pair'){
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
$('app').addEventListener('input',e=>{if(e.target.id==='history-filter'){historySearch=e.target.value;$('history-results').innerHTML=historyTable(resultsFor(activeEvent))}else if(e.target.matches('input[data-match-side]')){syncMatchPlayer(e.target)}else if(e.target.matches('[data-roster-name]')){rosterRowState(e.target.closest('[data-roster-id]'))}});
renderEditionPicker();render();
