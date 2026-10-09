import {EVENTS,eventById,validMatch,standings,standingsWithUnranked,entryCount,unplayedPairs,arrangeWaitingPair,waitingPlayerIds,availableWaitingPlayers,addWaitingPlayer,removeWaitingPlayer,returnPlayersToWaiting,migrateReservedWaiting,canRegisterSelection,ensureMatchNumbers,nextMatchNumber,historySearchMatches,needsTournamentConfirmation,isEventEntrant,eligibleEventPlayers,createDemoEdition,DEMO_EDITION_ID} from './ranking.mjs';
const KEY='jbs-beginner-v1';
const eventIds=EVENTS.filter(e=>e.id!=='overall').map(e=>e.id);
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DEFAULT_EDITION_NAME='BACKGAMMON CLASSIC 2026';
const DEFAULT_VENUE='ワイヤーズホテル品川シーサイド';
const initial=()=>({schema:1,activeEditionId:'classic-2026',editions:[{id:'classic-2026',name:DEFAULT_EDITION_NAME,venue:DEFAULT_VENUE,players:[],matches:[],dates:Object.fromEntries(EVENTS.map(e=>[e.id,e.date]))}]});
let data;try{data=JSON.parse(localStorage.getItem(KEY)||'null')}catch{data=null}
if(!data || data.schema!==1 || !Array.isArray(data.editions))data=initial();
for(const edition of data.editions){
  if(typeof edition.venue!=='string')edition.venue=DEFAULT_VENUE;
  ensureMatchNumbers(edition);
  migrateReservedWaiting(edition);
  // Change only the prefilled starter label; never overwrite a customized name.
  if(edition.id==='classic-2026' && edition.name==='BACKGAMMON FESTIVAL 20XX') edition.name=DEFAULT_EDITION_NAME;
}
// Backfill match numbers into older browser data without changing its storage key.
try{localStorage.setItem(KEY,JSON.stringify(data))}catch{ /* Save errors are reported on edit. */ }
let tab='players',activeEvent='day1',historySearch='',editingMatch=null,preselectedPair=null;
const ed=()=>data.editions.find(e=>e.id===data.activeEditionId)||data.editions[0];
const evLabel=(id)=>eventById(id)?.label||id;
const summaryId=(id)=>`${id}`;
const player=(id)=>ed().players.find(x=>x.id===id);
const playerLabel=id=>{const p=player(id);return p?`${p.name} #${p.id}`:`（未登録）#${id}`};
const formatRate=n=>`${(n*100).toFixed(1)}%`;
const dayName=id=>({'day1':'Day1','day2':'Day2','day3':'Day3'}[id]||id);
// The three symbols identify the event days, not three separate ranking positions.
// Always reserve three fixed positions.  A day is visible only when the player
// entered it (or has a recorded result), so ①②③ line up between players.
function adoptedDayIcons(row){
 const registered=new Set(player(row.id)?.entries||[]);
 const adopted=new Set(row.selectedDays||[]);
 const symbols={day1:'①',day2:'②',day3:'③'};
 const content=['day1','day2','day3'].map(day=>{
  const entered=registered.has(day)||ed().matches.some(m=>m.event===day&&(m.a===row.id||m.b===row.id));
  if(!entered)return `<span class="adopted-day is-not-entered" aria-hidden="true"></span>`;
  return `<span class="adopted-day ${adopted.has(day)?'is-adopted':'is-not-adopted'}" title="${esc(dayName(day))}${adopted.has(day)?'（採用）':'（不採用）'}" aria-label="${esc(dayName(day))}${adopted.has(day)?'採用':'不採用'}">${symbols[day]}</span>`;
 }).join('');
 return `<span class="adopted-days" aria-label="Day">${content}</span>`;
}
function pdfEditionTitle(){
 // Use the entered tournament name unchanged in both PDF exports.
 return ed().name;
}
function venueFor(){return typeof ed().venue==='string'?ed().venue:DEFAULT_VENUE}
function pdfHeading(eventId, participantCount){
 const label=eventById(eventId)?.label||'';
 const date=eventId==='overall'?dateFor('day3'):dateFor(eventId);
 const detail=[date,`出場${participantCount}名`,venueFor(),'主催 日本バックギャモン協会'].filter(Boolean).join('・');
 return `<div class="report-heading"><h2>${esc(pdfEditionTitle())} ${esc(label)} 最終成績</h2><small>${esc(detail)}</small></div>`;
}

function save(){try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){alert('ブラウザに保存できません。JSONバックアップを出力してください。')}renderEditionPicker();}
let noticeTimeout=null;
function notice(msg){const n=$('notice');if(!n)return;clearTimeout(noticeTimeout);n.textContent=msg;n.title=msg;n.classList.add('show');noticeTimeout=setTimeout(()=>{n.classList.remove('show');n.textContent='';n.removeAttribute('title');},4000)}
function eventSelect(selected,overall=false,id='event-picker'){return `<select id="${id}">${EVENTS.filter(e=>overall||e.id!=='overall').map(e=>`<option value="${e.id}" ${e.id===selected?'selected':''}>${esc(e.label)}</option>`).join('')}</select>`}
function playerOptions(selected=null,excluded=null){return `<option value="">選手を選択</option>`+eligibleEventPlayers(ed(),activeEvent).filter(p=>p.id!==excluded).sort((a,b)=>a.id-b.id).map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${esc(`${p.name} #${p.id}`)}</option>`).join('')}
function renderEditionPicker(){const box=$('edition-picker');if(box)box.innerHTML=data.editions.map(e=>`<option value="${esc(e.id)}" ${e.id===ed()?.id?'selected':''}>${esc(e.name)}</option>`).join('')}
function renderHeaderEvent(){
 const box=document.querySelector('.header-event'),select=$('header-event');
 box.hidden=(tab==='players');
 if(tab==='entry'&&activeEvent==='overall')activeEvent='day1';
 select.innerHTML=EVENTS.filter(e=>tab!=='entry'||e.id!=='overall').map(e=>`<option value="${e.id}">${esc(e.label)}</option>`).join('');
 select.value=activeEvent;
 const demoButton=document.querySelector('[data-header-action="test"]');
 if(demoButton){
  const testing=data.activeEditionId===DEMO_EDITION_ID;
  demoButton.textContent=testing?'テスト終了':'テスト';
  demoButton.classList.toggle('is-testing',testing);
  demoButton.setAttribute('aria-pressed',String(testing));
 }
}
function render(){
 document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
 renderHeaderEvent();
 $('app').innerHTML=({entry:renderEntry,players:renderPlayers,export:renderExport})[tab]();
 if(tab==='entry')updateSubmitEnabled($('match-form'));
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
  return `<tr class="${editingMatch===m.id?'is-editing':''}" data-history-match-id="${esc(m.id)}" aria-selected="${editingMatch===m.id}"><td class="history-number">${m.matchNo}</td><td class="history-name">${esc(playerLabel(leftId))}</td><td class="history-score"><span class="${leftClass}">${esc(leftScore)}</span><span class="history-score-separator"> - </span><span class="${rightClass}">${esc(rightScore)}</span></td><td class="history-name">${esc(playerLabel(rightId))}</td><td class="row-actions"><button class="btn small" data-action="edit-match" data-id="${esc(m.id)}">修正</button> <button class="btn small danger" data-action="delete-match" data-id="${esc(m.id)}">削除</button></td></tr>`;
 }).join('');
 return shown.length?`<table class="data-table history-table"><colgroup><col class="history-col-number"><col class="history-col-player"><col class="history-col-score"><col class="history-col-player"><col class="history-col-actions"></colgroup><thead><tr><th>試合</th><th>選手名</th><th>結果</th><th>選手名</th><th aria-label="操作"></th></tr></thead><tbody>${rows}</tbody></table>`:'<div class="empty">該当する試合がありません</div>';
}

function pairingTable(pairs){
 const groups=new Map();
 for(const id of waitingPlayerIds(ed(),activeEvent))groups.set(id,[]);
 for(const pair of pairs){groups.get(pair.a)?.push(pair.b);groups.get(pair.b)?.push(pair.a)}
 const filtered=[...groups];
 const list=filtered.length?`<table class="data-table pairing-list"><thead><tr><th>対戦待ち</th><th>未対戦相手</th><th aria-label="操作"></th></tr></thead><tbody>${filtered.map(([id,opps])=>`<tr><td class="pairing-name">${esc(playerLabel(id))}</td><td class="pairing-opponents"><div class="opponents">${opps.length?opps.sort((a,b)=>a-b).map(n=>`<button type="button" class="opponent-no" data-action="pick-pair" data-a="${id}" data-b="${n}" title="${esc(player(n)?.name||playerLabel(n))}" aria-label="${esc(playerLabel(n))}と対戦を組む">${n}</button>`).join(''):'<span class="muted">ー</span>'}</div></td><td class="pairing-actions"><button type="button" class="btn small pairing-remove" data-action="remove-waiting" data-id="${id}" aria-label="${esc(playerLabel(id))}を対戦待ちから削除">削除</button></td></tr>`).join('')}</tbody></table>`:`<div class="empty">対戦待ちの選手がいません</div>`;
 return list;
}
function matchPlayerField(side,id,label,otherId){
 return `<div class="match-player"><div class="match-player-controls"><label class="field match-no-field"><input type="number" name="${side}_no" data-match-side="${side}" aria-label="${label}の番号" min="1" step="1" inputmode="numeric" value="${id||''}" placeholder="番号"></label><label class="field match-name-field"><select name="${side}" data-match-side="${side}" aria-label="${label}の選手名">${playerOptions(id,otherId)}</select></label></div></div>`;
}
function outcomeButton(side,winningSide){
 const selected=winningSide===side,other=['a','b'].includes(winningSide)&&!selected;
 return `<button type="button" data-winner-button="${side}" class="winner-button ${selected?'win':other?'lose':''}" aria-pressed="${selected}">${other?'負':'勝'}</button>`;
}
// 2pt scores are restricted to the selected outcome, independently of player selection.
function twoScoreOptions(winner, selected=''){
 const scores={a:['2-0','2-1'],b:['0-2','1-2'],draw:['1-1']}[winner]||[];
 const current=winner==='draw'?'1-1':selected;
 return `${winner==='draw'?'':'<option value="">得点を選択</option>'}${scores.map(score=>`<option value="${score}" ${score===current?'selected':''}>${score}</option>`).join('')}`;
}
// Point values are stored as the winner's points; only the displayed score
// changes direction when the winner is the player on the right.
function pointsScoreOptions(kind,winner,selected=''){
 const pts=kind==='cube'?[1,2,3,4,6,8,12]:[1,2,3];
 const labels={1:'シングル勝ち',2:'ギャモン勝ち',3:'バックギャモン勝ち'};
 return '<option value="">得点を選択</option>'+pts.map(n=>{
  const score=winner==='b'?`0-${n}`:`${n}-0`;
  const label=kind==='points'?`${score} ${labels[n]}`:score;
  return `<option value="${n}" ${String(n)===String(selected)?'selected':''}>${label}</option>`;
 }).join('');
}
function syncScoreOptions(form){
 if(form.dataset.kind==='two'){
  const select=form.elements.namedItem('result');if(!select)return;
  const chosen=select.value;
  select.innerHTML=twoScoreOptions(form.dataset.winner,chosen);
  // For a draw the only allowed score is 1-1, including before player selection.
  if(form.dataset.winner==='draw')select.value='1-1';
 }else{
  const select=form.elements.namedItem('points');if(!select)return;
  const chosen=select.value;
  select.innerHTML=pointsScoreOptions(form.dataset.kind,form.dataset.winner,chosen);
 }
}
function renderEntry(){
 const e=eventById(activeEvent),matches=resultsFor(activeEvent),current=editingMatch?ed().matches.find(x=>x.id===editingMatch):null;
 const first=current?.a||preselectedPair?.a||null,second=current?.b||preselectedPair?.b||null;
 // New registrations start with the left player winning. Corrections reflect the recorded result.
 const winningSide=current?(current.sa===current.sb?'draw':current.sa>current.sb?'a':'b'):'a';
 const twoScore=current?`${current.sa}-${current.sb}`:'';
 const resultControl=e.kind==='two'?`<label class="field result-score"><select name="result" aria-label="得点" required disabled>${twoScoreOptions(winningSide,twoScore)}</select></label>`:`<label class="field result-score"><select name="points" aria-label="得点" required disabled>${pointsScoreOptions(e.kind,winningSide,current?Math.max(current.sa,current.sb):'')}</select></label>`;
 const addable=availableWaitingPlayers(ed(),activeEvent);
 const addControl=`<div class="pairing-add"><select id="pair-add-player" aria-label="対戦待ちに追加する選手番号" ${addable.length?'':'disabled'}><option value="">選手選択</option>${addable.map(p=>`<option value="${p.id}">${esc(`${p.name} #${p.id}`)}</option>`).join('')}</select><button type="button" class="btn small" data-action="add-waiting" ${addable.length?'':'disabled'}>追加</button></div>`;
 const pairs=unplayedPairs(ed(),activeEvent);
 const drawButton=e.kind==='two'
   ? `<button type="button" class="draw-button ${winningSide==='draw'?'selected':''}" data-draw-button aria-pressed="${winningSide==='draw'}">引分</button>`
   : `<span aria-hidden="true"></span>`;
 const form=`<form id="match-form" data-kind="${e.kind}" data-winner="${winningSide}" data-player-pair="${first||''}:${second||''}"><div class="scoreline outcome-row ${e.kind==='two'?'two-entry':''}">${outcomeButton('a',winningSide)}${drawButton}${outcomeButton('b',winningSide)}</div><div class="scoreline ${e.kind==='two'?'two-entry':''}">${matchPlayerField('a',first,'左選手',second)}<span class="vs match-versus" aria-hidden="true">VS</span>${matchPlayerField('b',second,'右選手',first)}</div><div class="result-row">${resultControl}<div class="result-actions">${current?'<button type="button" class="btn" data-action="cancel-match">編集取消</button>':''}<button type="submit" class="btn primary" disabled>${current?'結果更新':'結果登録'}</button></div></div></form>`;
 return `<div class="entry-grid"><div class="entry-left"><section class="box entry-form"><h3>結果入力</h3>${form}</section><section class="box entry-pairings"><div class="section-head pairing-title"><h3>対戦斡旋</h3>${addControl}</div><div id="pair-results" class="table-scroll spaced pairing-scroll">${pairingTable(pairs)}</div></section></div><section class="box entry-history"><div class="section-head history-title"><h3>結果履歴</h3><input id="history-filter" placeholder="選手名・番号で検索" value="${esc(historySearch)}" aria-label="結果履歴検索"></div><div id="history-results" class="table-scroll spaced history-scroll">${historyTable(matches)}</div></section></div>`;
}
function updateSubmitEnabled(form){
 if(!form)return;
 // All outcome buttons, including the 2pt draw, remain operable before player selection.
 // Score and submission still require two different registered players.
 const left=String(form.elements.namedItem('a')?.value||'');
 const right=String(form.elements.namedItem('b')?.value||'');
 const pairReady=Boolean(left&&right&&left!==right&&isEventEntrant(ed(),activeEvent,Number(left))&&isEventEntrant(ed(),activeEvent,Number(right)));
 const outcomeSelected=pairReady&&['a','b','draw'].includes(form.dataset.winner)&&
  (form.dataset.winner!=='draw'||form.dataset.kind==='two');
 const scoreSelect=form.elements.namedItem('result')||form.elements.namedItem('points');
 if(scoreSelect)scoreSelect.disabled=!outcomeSelected;
 const score=String(scoreSelect?.value||'');
 const submit=form.querySelector('button[type="submit"]');
 if(submit)submit.disabled=!outcomeSelected||!score||!canRegisterSelection(form.dataset.kind,form.dataset.winner,score);
}
function setWinner(form,side){
 if(!form)return;
 form.dataset.winner=side;
 form.querySelectorAll('[data-winner-button]').forEach(button=>{
  const state=!['a','b'].includes(side)?'':side===button.dataset.winnerButton?'win':'lose';
  button.classList.toggle('win',state==='win');button.classList.toggle('lose',state==='lose');
  button.textContent=state==='lose'?'負':'勝';button.setAttribute('aria-pressed',String(state==='win'));
 });
 const draw=form.querySelector('[data-draw-button]');
 if(draw){draw.classList.toggle('selected',side==='draw');draw.setAttribute('aria-pressed',String(side==='draw'));}
 syncScoreOptions(form);
 updateSubmitEnabled(form);
}
// Keep each player's name dropdown free of the opponent's current selection.
// Rebuild both sides when a name or number changes so previously excluded
// players become available again as soon as the other side changes.
function refreshMatchPlayerOptions(form,changedSide){
 const selects={a:form.elements.namedItem('a'),b:form.elements.namedItem('b')};
 const values={a:selects.a.value,b:selects.b.value};
 if(values.a&&values.a===values.b){
  // Duplicate number input is not a valid dropdown selection. Preserve the
  // number field for correction, but keep the other side's existing player.
  values[changedSide]='';
 }
 for(const side of ['a','b']){
  const opponent=values[side==='a'?'b':'a'];
  selects[side].innerHTML=playerOptions(values[side]?Number(values[side]):null,opponent?Number(opponent):null);
 }
}
function syncMatchPlayer(el){
 const form=el.closest('#match-form');if(!form)return;
 const side=el.dataset.matchSide,number=form.elements.namedItem(side+'_no'),select=form.elements.namedItem(side);
 if(el.tagName==='SELECT')number.value=select.value;
 else {const parsed=Number(number.value);select.value=number.value!==''&&isEventEntrant(ed(),activeEvent,parsed)?String(parsed):'';}
 refreshMatchPlayerOptions(form,side);
 const pair=String(form.elements.namedItem('a')?.value||'')+':'+String(form.elements.namedItem('b')?.value||'');
 if(form.dataset.playerPair!==pair){
  // Preserve an outcome chosen before the two players are selected.
  // Changing an already complete pair still resets to the usual left-side win.
  const hadPair=(form.dataset.playerPair||'').split(':').filter(Boolean).length===2;
  form.dataset.playerPair=pair;
  if(hadPair)setWinner(form,'a');
  const score=form.elements.namedItem('result')||form.elements.namedItem('points');
  if(score)score.value=form.dataset.kind==='two'&&form.dataset.winner==='draw'?'1-1':'';
 }
 updateSubmitEnabled(form);
}
function statsTable(eventId,preview=false){
 const rows=standingsWithUnranked(ed(),eventId),isTwo=eventId==='two',overall=eventId==='overall';
 if(!rows.length)return '<div class="empty">表示できる成績がありません</div>';
 const headers=['順位','選手',isTwo?'③試合':'試合','勝','負',...(isTwo?['引分']:[]),isTwo?'①勝越':'②勝越',isTwo?'②勝率':'③勝率','得点','失点',isTwo?'得失点差':'①得失点差',...(overall?['Day']:[])];
 const displayHeader=h=>{const m=/^([①②③])(.+)$/.exec(h);return m?`<span class="rank-header-label">${esc(m[2])}</span><small class="rank-header-order">ー ${'①②③'.indexOf(m[1])+1} ー</small>`:esc(h);};
 const td=(label,value,cls='')=>`<td data-label="${label}"${cls?` class="${cls}"`:''}>${value}</td>`;
 const html=rows.map(r=>{
  const cells=[
   td('順位',`<strong>${r.rank}</strong>`,'standings-rank'),td('選手',esc(`${r.name} #${r.id}`),'player-name'),td(isTwo?'③試合':'試合',r.matches),td('勝',r.wins),td('負',r.losses),
   ...(isTwo?[td('引分',r.draws)]:[]),td('勝越',`${r.spread>0?'+':''}${r.spread}`,r.spread>=0?'pos':'neg'),td('勝率',formatRate(r.rate)),
   td('得点',r.scored),td('失点',r.conceded),td('得失点差',`${r.diff>0?'+':''}${r.diff}`,r.diff>=0?'pos':'neg'),
   ...(overall?[td('Day',adoptedDayIcons(r),'adopted-days-cell')]:[])
  ];
  return `<tr class="${r.isUnranked?'is-unranked':r.rank<=3?'podium':''}">${cells.join('')}</tr>`;
 });
 // Only the player column is wider: 1.5 units, rank is half a unit,
 // and every statistics column remains one unit. Total width stays 100%.
 const unitWidth=100/headers.length;
 const colWidths=`<colgroup><col style="width:${(unitWidth/2).toFixed(5)}%"><col style="width:${(unitWidth*1.5).toFixed(5)}%">${headers.slice(2).map(()=>`<col style="width:${unitWidth.toFixed(5)}%">`).join('')}</colgroup>`;
 return `<div class="table-scroll"><table class="data-table standings-table">${colWidths}<thead><tr>${headers.map(x=>`<th>${displayHeader(x)}</th>`).join('')}</tr></thead><tbody>${html.join('')}</tbody></table></div>`;
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
  return `<tr data-roster-id="${id}" class="${active?'':'roster-inactive'}"><td class="roster-no" data-label="番号">${id}</td><td data-label="選手"><input type="text" data-roster-name aria-label="No.${id} 選手" autocomplete="off" maxlength="100" value="${esc(p?.name||'')}"></td><td data-label="よみ"><input type="text" data-roster-kana aria-label="No.${id} よみ" autocomplete="off" maxlength="100" value="${esc(p?.kana||'')}" ${active?'':'disabled'}></td><td class="roster-rank-exclusion" data-label="順位外"><input type="checkbox" data-roster-rank-excluded aria-label="No.${id} 順位外" ${p?.excludeFromRanking===true?'checked':''} ${active?'':'disabled'}></td>${cells}</tr>`;
 }).join('');
 return `<div class="box roster-box"><div class="table-scroll roster-scroll"><table class="data-table roster-matrix"><thead><tr><th>番号</th><th>選手</th><th>よみ</th><th>順位外</th>${header.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows}</tbody><tfoot><tr class="roster-add-row"><td colspan="${header.length+4}"><button type="button" class="btn" data-action="add-roster-row">次の10行を追加</button></td></tr></tfoot></table></div></div>`;
}
function rosterRowState(tr){
 const active=!!tr.querySelector('[data-roster-name]').value.trim();
 tr.classList.toggle('roster-inactive',!active);
 tr.querySelector('[data-roster-kana]').disabled=!active;
 tr.querySelector('[data-roster-rank-excluded]').disabled=!active;
 tr.querySelectorAll('[data-roster-event]').forEach(button=>button.disabled=!active);
}
function rosterNameChange(input){
 const tr=input.closest('[data-roster-id]'),id=Number(tr.dataset.rosterId);
 const name=input.value.trim(),p=player(id);
 if(!name){
  if(p && ed().matches.some(m=>m.a===id||m.b===id)){
   alert('この選手には試合記録があります。名前を空欄にはできません。');
   input.value=p.name;rosterRowState(tr);return;
  }
  if(p){
   ed().players=ed().players.filter(x=>x.id!==id);
   for(const ids of Object.values(ed().waitingPlayers||{}))if(Array.isArray(ids)){
    const index=ids.indexOf(id);if(index!==-1)ids.splice(index,1);
   }
  }
  tr.querySelector('[data-roster-kana]').value='';
  tr.querySelector('[data-roster-rank-excluded]').checked=false;
  tr.querySelectorAll('[data-roster-event]').forEach(button=>{button.setAttribute('aria-pressed','false');button.classList.remove('attending');button.textContent='ー';button.setAttribute('aria-label',button.getAttribute('aria-label').replace(/ (出場|未出場)$/,' 未出場'));});
 }else if(p){p.name=name;}else{
  ed().players.push({id,name,kana:tr.querySelector('[data-roster-kana]').value.trim(),excludeFromRanking:false,entries:[]});
 }
 input.value=name;rosterRowState(tr);save();
}
function rosterKanaChange(input){
 const id=Number(input.closest('[data-roster-id]').dataset.rosterId),p=player(id);
 if(!p)return;
 p.kana=input.value.trim();input.value=p.kana;save();
}
function rosterRankExclusionChange(input){
 const id=Number(input.closest('[data-roster-id]').dataset.rosterId),p=player(id);
 if(!p || !p.name.trim()){input.checked=false;return}
 p.excludeFromRanking=input.checked;
 save();
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
 const e=eventById(id),rows=standingsWithUnranked(ed(),id),date=id==='overall'?dateFor('day3'):dateFor(id),isTwo=id==='two',overall=id==='overall';
 const headers=['順位','選手',isTwo?'③試合':'試合','勝','負',...(isTwo?['引分']:[]),isTwo?'①勝越':'②勝越',isTwo?'②勝率':'③勝率','得点','失点',isTwo?'得失点差':'①得失点差',...(overall?['Day']:[])];
 const displayHeader=h=>{const m=/^([①②③])(.+)$/.exec(h);return m?`<span class="rank-header-label">${esc(m[2])}</span><small class="rank-header-order">ー ${'①②③'.indexOf(m[1])+1} ー</small>`:esc(h);};
 const tr=rows.map(r=>{
  const vals=[r.rank,esc(`${r.name} #${r.id}`),r.matches,r.wins,r.losses,...(isTwo?[r.draws]:[]),`${r.spread>0?'+':''}${r.spread}`,formatRate(r.rate),r.scored,r.conceded,`${r.diff>0?'+':''}${r.diff}`,...(overall?[adoptedDayIcons(r)]:[])];
  return `<tr${r.isUnranked?' class="is-unranked"':''}>${vals.map((v,i)=>`<td data-label="${headers[i]}"${i===0?' class="standings-rank"':''}>${v}</td>`).join('')}</tr>`;
 }).join('');
 // The event's statistical columns (from 試合 to the last field) share one width.
 // Increase the player column slightly for full Japanese names.
 const columnCount=headers.length-2;
 const dataWidth=69/columnCount;
 const columnWidths=`<colgroup><col style="width:7%"><col style="width:24%">${Array.from({length:columnCount},()=>`<col style="width:${dataWidth.toFixed(6)}%">`).join('')}</colgroup>`;
 // Keep the two-line tournament title, its divider, and the column labels
 // together in THEAD. Browsers repeat table-header-group on every printed page.
 const repeatHeading=`<tr class="report-title-row"><th class="report-heading-cell" colspan="${headers.length}">${pdfHeading(id,rows.length)}</th></tr>`;
 return `<div class="report"><table class="report-data-table">${columnWidths}<thead>${repeatHeading}<tr class="report-column-row">${headers.map(h=>`<th>${displayHeader(h)}</th>`).join('')}</tr></thead><tbody>${tr||`<tr><td colspan="${headers.length}">成績データなし</td></tr>`}</tbody></table></div>`;
}
// A4 portrait: two columns by four rows, eight individual results per sheet.
// Within an event the circles follow their original match number, oldest first.
// Overall uses ONLY the two adopted days, matching its published totals.
function personalMatchSequence(eventId,row){
 const days=eventId==='overall' ? (row.selectedDays||[]) : [eventId];
 const dayOrder=new Map(EVENTS.map((e,i)=>[e.id,i]));
 return ed().matches.filter(m=>days.includes(m.event)&&(m.a===row.id||m.b===row.id))
  .sort((a,b)=>(dayOrder.get(a.event)??99)-(dayOrder.get(b.event)??99)
     ||(Number(a.matchNo)||0)-(Number(b.matchNo)||0));
}
function personalResultDots(eventId,row){
 // Overall reports show summary statistics only. Retain an empty spacer so
 // the date and organiser stay aligned with cards for the other events.
 if(eventId==='overall')return '<div class="personal-results" aria-hidden="true"></div>';
 const two=eventId==='two';
 const matches=personalMatchSequence(eventId,row);
 // Exactly ten results per row, with left-aligned partial final rows.
 const perRow=10;
 const rowCount=Math.max(1,Math.ceil(matches.length/perRow));
 const dot=rowCount<=2?6.3:rowCount===3?5.6:rowCount===4?4.9:rowCount===5?4.3:3.8;
 const dots=matches.map(m=>{
  const mine=m.a===row.id?m.sa:m.sb;
  const theirs=m.a===row.id?m.sb:m.sa;
  const status=mine>theirs?'win':mine<theirs?'lose':'draw';
  const score=two?'':Math.max(m.sa,m.sb);
  const triangle=two&&status==='draw';
  return `<span class="personal-dot is-${status}${triangle?' is-triangle':''}" title="${esc(`${status==='win'?'勝':status==='lose'?'負':'引分'} ${m.sa}-${m.sb}`)}" aria-label="${esc(`${status==='win'?'勝':status==='lose'?'負':'引分'}${two?'':` ${score}点`}`)}">${triangle?'△':score||''}</span>`;
 });
 const rows=[];
 for(let i=0;i<dots.length;i+=perRow){
  rows.push(`<div class="personal-result-row">${dots.slice(i,i+perRow).join('')}</div>`);
 }
 return `<div class="personal-results" style="--personal-dot-size:${dot.toFixed(2)}mm;--personal-row-width:${(dot*perRow+(perRow-1)*0.8).toFixed(2)}mm">${rows.join('')}</div>`;
}
// Overall personal cards show each Day's own ranking criteria, including Days
// not selected for the overall score. Match statistics are event-local.
function overallPersonalDayDetails(row,dayResults){
 const selected=new Set(row.selectedDays||[]);
 const registrations=new Set(player(row.id)?.entries||[]);
 const lines=['day1','day2','day3'].map((day,i)=>{
  const dayStats=dayResults[day].get(row.id);
  // A recorded match also counts as attendance, even for older imported data
  // without the corresponding roster checkbox.
  if(!dayStats && !registrations.has(day)){
   return `<div class="personal-overall-day">Day${i+1}：不出場</div>`;
  }
  const diff=dayStats?.diff??0;
  const spread=dayStats?.spread??0;
  const rate=dayStats?.rate??0;
  const signed=n=>n>0?`+${n}`:String(n);
  const adoption=selected.has(day)?'　採用':'';
  return `<div class="personal-overall-day">Day${i+1}：得失点差${signed(diff)}　勝越${signed(spread)}　勝率${formatRate(rate)}${adoption}</div>`;
 }).join('');
 return `<div class="personal-overall-days">${lines}</div>`;
}
function personalReportHTML(id){
 const rows=standings(ed(),id).slice().sort((a,b)=>a.id-b.id);
 const two=id==='two',label=eventById(id)?.label||'';
 const date=id==='overall'?dateFor('day3'):dateFor(id);
 const overallDayResults=id==='overall'
  ? Object.fromEntries(['day1','day2','day3'].map(day=>[
     day,new Map(standingsWithUnranked(ed(),day).map(stats=>[stats.id,stats]))
    ]))
  : null;
 const cell=r=>{
  if(!r)return `<article class="personal-card is-blank" aria-hidden="true"></article>`;
  const history=personalMatchSequence(id,r);
  // 2pt standings do not use points for rankings, but individual cards can
  // display their actual played-game points without affecting those rankings.
  let scored=r.scored,conceded=r.conceded;
  if(two){
   scored=history.reduce((n,m)=>n+(m.a===r.id?m.sa:m.sb),0);
   conceded=-history.reduce((n,m)=>n+(m.a===r.id?m.sb:m.sa),0);
  }
  const diff=scored+conceded;
  return `<article class="personal-card">
   <div class="personal-event-title">${esc(pdfEditionTitle())}</div>
   <div class="personal-event-detail">${esc(label)}　個人成績 #${r.id}</div>
   <div class="personal-rank"><span class="personal-rank-label">${r.rank===1?'優勝':`${r.rank}位`}</span><span class="personal-rank-total"> / ${rows.length}名</span></div>
   <div class="personal-summary">${r.matches}試合　${r.wins}勝${r.losses}敗${two?` ${r.draws}引分`:''}　勝越${r.spread>0?`+${r.spread}`:r.spread}　勝率${formatRate(r.rate)}</div>
   <div class="personal-score-totals">得点${scored}　失点${conceded}　得失点差${diff>0?`+${diff}`:diff}</div>
   ${id==='overall'?overallPersonalDayDetails(r,overallDayResults):personalResultDots(id,r)}
   <div class="personal-footer"><div>${esc([date,venueFor()].filter(Boolean).join('　'))}</div><div>主催　日本バックギャモン協会</div></div>
  </article>`;
 };
 if(!rows.length)return `<div class="personal-sheets"><section class="personal-sheet"><div class="personal-empty">対象の成績がありません</div></section></div>`;
 const sheets=[];
 for(let start=0;start<rows.length;start+=8){
  const segment=rows.slice(start,start+8);
  sheets.push(`<section class="personal-sheet"><div class="personal-grid">${Array.from({length:8},(_,i)=>cell(segment[i])).join('')}</div></section>`);
 }
 return `<div class="personal-sheets">${sheets.join('')}</div>`;
}
function renderExport(){
 // Combined screen: compact print controls above the live standings table.
 const day=activeEvent==='overall'?'day3':activeEvent;
 return `<section class="box report-settings"><div class="report-controls">
  <label class="field report-name"><span>大会名</span><input id="edition-name-input" type="text" value="${esc(ed().name)}" maxlength="120"></label>
  <label class="field report-venue"><span>会場名</span><input id="edition-venue-input" type="text" value="${esc(venueFor())}" maxlength="160"></label>
  <label class="field report-date"><span>開催日</span><input id="edition-date-input" type="date" value="${esc(dateFor(day))}"></label>
  <button type="button" class="btn primary report-print" data-action="print-all">最終成績PDF</button>
  <button type="button" class="btn primary report-print" data-action="print-personal">個人成績PDF</button>
 </div></section><section class="box report-rankings">${statsTable(activeEvent)}</section>`;
}

// Register and update results through the same validation path. In particular,
// a correction retains its match number and does not reset the six-hour alert.
function matchSave(form){
 const f=new FormData(form);
 const a=Number(f.get('a_no')||f.get('a'));
 const b=Number(f.get('b_no')||f.get('b'));
 if(!a||!b||a===b){
  alert(a===b&&a>0?'同じ選手同士の結果は登録できません。':'左右に異なる選手を指定してください。');
  return;
 }
 if(!isEventEntrant(ed(),activeEvent,a)||!isEventEntrant(ed(),activeEvent,b)){
  alert(`${evLabel(activeEvent)}で出場登録されている選手だけが結果登録できます。選手管理の出場設定をご確認ください。`);
  return;
 }

 const winner=form.dataset.winner;
 let sa,sb;
 if(activeEvent==='two'){
  const result=String(f.get('result')||'');
  if(!canRegisterSelection('two',winner,result)){
   alert('「勝」または「引分」を選択し、対応する得点を選んでください。');
   return;
  }
  [sa,sb]=result.split('-').map(Number);
 }else{
  if(!canRegisterSelection(eventById(activeEvent).kind,winner)){
   alert('左右いずれかの「勝」ボタンを選択してください。');
   return;
  }
  const raw=String(f.get('points')||'');
  if(!raw){alert('得点を選択してください。');return;}
  const val=Number(raw);
  sa=winner==='a'?val:0;
  sb=winner==='b'?val:0;
 }

 const m={id:editingMatch||'m'+Date.now()+'-'+Math.random().toString(36).slice(2,8),event:activeEvent,a,b,sa,sb};
 const err=validMatch(m,new Set(ed().players.map(p=>p.id)));
 if(err){alert(err);return;}

 // Only new registrations, never corrections, require a confirmation after six hours.
 if(!editingMatch && needsTournamentConfirmation(data.editions)){
  const message=`大会名の確認\n前回の結果登録から6時間以上経過しています。\n大会名「${evLabel(activeEvent)}」に間違いないか確認してください。\nこの大会に結果を登録しますか？`;
  if(!confirm(message))return;
 }
 const repeated=ed().matches.some(x=>x.id!==m.id&&x.event===m.event&&((x.a===a&&x.b===b)||(x.a===b&&x.b===a)));
 if(repeated&&!confirm('この2名は既にこの大会で対戦しています。重複対戦として登録しますか？'))return;

 if(editingMatch){
  const i=ed().matches.findIndex(x=>x.id===editingMatch);
  if(i<0)return;
  m.matchNo=ed().matches[i].matchNo;
  ed().matches[i]=m;
 }else{
  m.matchNo=nextMatchNumber(ed(),activeEvent);
  ed().matches.push(m);
  ed().lastResultRegisteredAt=Date.now();
 }
 returnPlayersToWaiting(ed(),activeEvent,a,b);
 editingMatch=null;
 preselectedPair=null;
 save();render();notice('試合結果を保存しました。');
}
// All fields are quoted. Prefix spreadsheet formulas so CSV cannot execute
// arbitrary formula text when opened in spreadsheet applications.
function asCSV(id){
 const isTwo=id==='two',overall=id==='overall';
 const header=['順位','氏名','選手No.','試合','勝','負'];
 if(isTwo)header.push('引分');
 header.push('勝越','勝率','得点','失点','得失点差');
 if(overall)header.push('Day');
 const lines=[header,...standings(ed(),id).map(r=>{
  const values=[r.rank,r.name,r.id,r.matches,r.wins,r.losses];
  if(isTwo)values.push(r.draws);
  values.push(r.spread,formatRate(r.rate),r.scored,r.conceded,r.diff);
  if(overall)values.push(r.selectedDays.map(dayName).join('+'));
  return values;
 })];
 const safe=s=>{
  const t=String(s??'');
  return '"'+(typeof s==='string'&&/^[=+\-@\t\r]/.test(t)?"'":'')+t.replaceAll('"','""')+'"';
 };
 return '\ufeff'+lines.map(values=>values.map(safe).join(',')).join('\r\n');
}
function download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function timestamp(){const d=new Date(),pad=x=>String(x).padStart(2,'0');return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`}
// Preserve schema 1 and the current browser-storage key for older event data.
// Validate every edition before merging it into the current local copy.
function normalizeImport(x){
 if(!x||x.schema!==1||!Array.isArray(x.editions))throw Error('対応するJSON形式ではありません。');
 const ids=new Set();
 for(const e of x.editions){
  if(typeof e.id!=='string'||typeof e.name!=='string'||ids.has(e.id)||!Array.isArray(e.players)||!Array.isArray(e.matches)){
   throw Error('大会データが不正です。');
  }
  ids.add(e.id);
  const pids=new Set();
  for(const p of e.players){
   if(!Number.isInteger(p.id)||pids.has(p.id)||!String(p.name||'').trim())throw Error('選手マスタに重複・不正値があります。');
   if(p.excludeFromRanking!==undefined&&typeof p.excludeFromRanking!=='boolean')throw Error('順位外の設定が不正です。');
   pids.add(p.id);
  }
  const mids=new Set();
  for(const m of e.matches){
   if(typeof m.id!=='string'||mids.has(m.id))throw Error('試合IDの重複があります。');
   mids.add(m.id);
   const issue=validMatch(m,pids);
   if(issue)throw Error(`${e.name}: ${issue}`);
  }
  if(e.waitingPlayers!==undefined){
   if(!e.waitingPlayers||typeof e.waitingPlayers!=='object'||Array.isArray(e.waitingPlayers)){
    throw Error('対戦待ちデータが不正です。');
   }
   for(const [key,list] of Object.entries(e.waitingPlayers)){
    if(!eventIds.includes(key)||!Array.isArray(list)||list.some(id=>!Number.isInteger(id)||!pids.has(id))||new Set(list).size!==list.length){
     throw Error('対戦待ちに無効な選手番号があります。');
    }
   }
  }
  if(e.venue!==undefined&&typeof e.venue!=='string')throw Error('会場名が不正です。');
  e.venue=typeof e.venue==='string'?e.venue:DEFAULT_VENUE;
  e.dates=e.dates||{};
  for(const p of e.players){
   p.entries=Array.isArray(p.entries)?p.entries.filter(v=>eventIds.includes(v)):[];
  }
  ensureMatchNumbers(e);
  migrateReservedWaiting(e);
 }
 return x;
}
function fileLoad(){
 const input=document.createElement('input');
 input.type='file';
 input.accept='.json,application/json';
 input.onchange=async()=>{
  if(!input.files?.length)return;
  try{
   const raw=JSON.parse(await input.files[0].text());
   const imported=normalizeImport(raw);
   let count=0;
   for(const edition of imported.editions){
    if(data.editions.some(x=>x.id===edition.id)){
     if(!confirm(`「${edition.name}」が存在します。上書きしますか？（操作を取り消せません）`))continue;
     data.editions=data.editions.filter(x=>x.id!==edition.id);
    }
    data.editions.push(edition);
    data.activeEditionId=edition.id;
    count++;
   }
   if(count){
    save();render();notice(`${count}大会分のデータを取り込みました。`);
   }else{
    notice('取り込みは行われませんでした。');
   }
  }catch(e){
   alert('JSON取込エラー：'+e.message);
  }
 };
 input.click();
}
function toggleTestData(){
 if(data.activeEditionId===DEMO_EDITION_ID){
  if(!confirm('テストを終了して、元の大会データに戻りますか？\nテスト中に入力した内容は削除されます。'))return;
  const prior=data.demoReturnEditionId;
  data.editions=data.editions.filter(e=>e.id!==DEMO_EDITION_ID);
  data.activeEditionId=data.editions.some(e=>e.id===prior)?prior:data.editions[0]?.id;
  delete data.demoReturnEditionId;
  if(!data.activeEditionId){data=initial()}
  tab='players';activeEvent='day1';historySearch='';editingMatch=null;preselectedPair=null;
  save();render();notice('テストを終了し、元の大会データに戻りました。');
  return;
 }
 if(!confirm('テスト専用データとして選手30名・各大会300件（全1,800件）の試合結果をランダム生成します。\n既存の大会データは変更せず、テスト終了時に元のデータに戻ります。\n\nテストを開始しますか？'))return;
 const prior=ed().id;
 const demo=createDemoEdition();
 data.editions=data.editions.filter(e=>e.id!==DEMO_EDITION_ID);
 data.editions.push(demo);
 data.demoReturnEditionId=prior;
 data.activeEditionId=DEMO_EDITION_ID;
 tab='players';activeEvent='day1';historySearch='';editingMatch=null;preselectedPair=null;
 save();render();notice('テストデータ：選手30名・各大会300件（全1,800件）の試合結果を生成しました。');
}
function newEdition(){
 const name=prompt('新しい大会データの名称','BACKGAMMON CLASSIC 2027');
 if(!name?.trim())return;
 const id='edition-'+Date.now();
 data.editions.push({id,name:name.trim(),players:[],matches:[],dates:{}});
 data.activeEditionId=id;
 activeEvent='day1';
 $('header-event').value='day1';
 save();render();notice('大会データを作成しました。');
}
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
 case 'edit-match':{
  const m=ed().matches.find(x=>String(x.id)===String(id));if(!m)return;
  // Re-rendering the correction form replaces the history scroller. Remember
  // its position before replacement so editing an older match does not jump
  // the history back to the newest match. Keep page scroll on narrow screens.
  const historyPosition=$('history-results')?.scrollTop??0;
  const pageX=window.scrollX,pageY=window.scrollY;
  activeEvent=m.event;$('header-event').value=m.event;
  editingMatch=m.id;preselectedPair=null;tab='entry';render();
  const history=$('history-results');if(history)history.scrollTop=historyPosition;
  window.scrollTo(pageX,pageY);
  break;
 }
 case 'cancel-match':editingMatch=null;preselectedPair=null;render();break;
 case 'delete-match':if(!confirm('この試合結果を削除しますか？'))return;ed().matches=ed().matches.filter(m=>String(m.id)!==String(id));if(editingMatch===id)editingMatch=null;save();render();notice('試合結果を削除しました。');break;
 case 'backup':download(`beginner_${timestamp()}.json`,JSON.stringify({schema:1,activeEditionId:data.activeEditionId,editions:data.editions},null,2),'application/json');break;
 case 'load':fileLoad();break;
 case 'test':toggleTestData();break;
 case 'delete-all':{
  if(!confirm('【全削除】保存されているすべての大会データ・選手・試合結果・対戦斡旋を削除します。元に戻せません。必要な場合は、先にJSON出力でバックアップしてください。\n\n本当に全削除しますか？'))return;
  data=initial();tab='players';activeEvent='day1';historySearch='';editingMatch=null;preselectedPair=null;
  save();render();notice('すべての管理データを削除しました。');break;
 }
 case 'rename-edition':{const name=prompt('大会データの名称',ed().name);if(!name?.trim())return;ed().name=name.trim();save();render();break}
 case 'delete-edition':{if(data.editions.length===1){alert('最後の大会は削除できません。');return}if(!confirm(`「${ed().name}」の選手・試合データをすべて削除しますか？`))return;data.editions=data.editions.filter(e=>e.id!==data.activeEditionId);data.activeEditionId=data.editions[0].id;save();render();break}
 case 'print-all':$('print-area').innerHTML=reportHTML(activeEvent);window.print();break;
 case 'print-personal':$('print-area').innerHTML=personalReportHTML(activeEvent);window.print();break;
 }}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;editingMatch=null;render()}));
document.querySelectorAll('[data-header-action]').forEach(b=>b.addEventListener('click',()=>onAction(b.dataset.headerAction)));
renderHeaderEvent();
$('header-event').addEventListener('change',e=>{activeEvent=e.target.value;editingMatch=null;preselectedPair=null;historySearch='';render()});
$('app').addEventListener('submit',e=>{if(e.target.id==='match-form'){e.preventDefault();matchSave(e.target)}});
$('app').addEventListener('change',e=>{if(e.target.id==='edition-picker'){data.activeEditionId=e.target.value;activeEvent='day1';$('header-event').value='day1';editingMatch=null;save();render()}else if(e.target.id==='edition-name-input'){const name=e.target.value.trim();if(!name){e.target.value=ed().name;return}ed().name=name;save();render();notice('大会名を保存しました。')}else if(e.target.matches('[data-match-side]')){syncMatchPlayer(e.target);if(e.target.matches('input[data-match-side]')&&e.target.value!==''&&!isEventEntrant(ed(),activeEvent,Number(e.target.value))){const wrong=e.target.value;e.target.value='';syncMatchPlayer(e.target);notice(`#${wrong} は${evLabel(activeEvent)}に出場登録されていません。`);}}else if(['result','points'].includes(e.target.name)&&e.target.closest('#match-form')){updateSubmitEnabled(e.target.closest('#match-form'))}else if(e.target.id==='edition-venue-input'){ed().venue=e.target.value.trim();save();render()}else if(e.target.id==='edition-date-input'){const day=activeEvent==='overall'?'day3':activeEvent;ed().dates=ed().dates||{};ed().dates[day]=e.target.value;if(day==='day3')ed().dates.overall=e.target.value;save();render()}else if(e.target.matches('[data-roster-name]')){rosterNameChange(e.target)}else if(e.target.matches('[data-roster-kana]')){rosterKanaChange(e.target)}else if(e.target.matches('[data-roster-rank-excluded]')){rosterRankExclusionChange(e.target)}});
$('app').addEventListener('click',e=>{const rosterToggle=e.target.closest('[data-roster-event]');if(rosterToggle){rosterEventChange(rosterToggle);return}const win=e.target.closest('[data-winner-button]');if(win){const form=win.closest('#match-form');setWinner(form,form.dataset.winner===win.dataset.winnerButton?'':win.dataset.winnerButton);return}const draw=e.target.closest('[data-draw-button]');if(draw){const form=draw.closest('#match-form');setWinner(form,form.dataset.winner==='draw'?'':'draw');return}const b=e.target.closest('[data-action]');if(!b)return;if(b.dataset.action==='pick-pair'){
 const a=Number(b.dataset.a),c=Number(b.dataset.b);
 if(!unplayedPairs(ed(),activeEvent).some(p=>p.a===Math.min(a,c)&&p.b===Math.max(a,c))){notice('この組み合わせは斡旋できません。');render();return}
 if(!confirm(`${playerLabel(a)} と ${playerLabel(c)} の対戦を組みますか？`))return;
 if(!arrangeWaitingPair(ed(),activeEvent,a,c)){notice('この組み合わせは斡旋できません。');render();return}
 preselectedPair={a,b:c};editingMatch=null;save();render();notice('対戦を組みました。');$('match-form')?.scrollIntoView({behavior:'smooth',block:'nearest'});return
 }
 onAction(b.dataset.action,b.dataset.id)});
$('app').addEventListener('input',e=>{if(e.target.id==='history-filter'){historySearch=e.target.value;$('history-results').innerHTML=historyTable(resultsFor(activeEvent))}else if(e.target.matches('input[data-match-side]')){syncMatchPlayer(e.target)}else if(e.target.matches('[data-roster-name]')){rosterRowState(e.target.closest('[data-roster-id]'))}});
renderEditionPicker();render();
