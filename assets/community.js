/* ============================================================
   Contributions + feedback. Requires model.js.

   These pages are static — there is no server behind them. So:
     · contributions are stored in this browser and exported by
       the owner (CSV / JSON / email),
     · feedback is delivered by opening the visitor's own mail
       app with the message composed, addressed to INBOX.
   Both routes are stated plainly in the UI. Nothing here ever
   claims to have sent something it has not.

   Set an endpoint below to POST instead (Formspree, Apps
   Script, your own API) and the UI adapts on its own.
   ============================================================ */
const CONFIG={
  contributeEndpoint:"",  /* optional POST target for shelf outcomes */
  feedbackEndpoint:""     /* optional POST target for feedback; falls back to email */
};

/* Assembled at runtime rather than sitting in the markup as
   plain text — it keeps the address out of the reach of the
   simplest page scrapers without hiding it from anyone real. */
const INBOX=['ena.entico','gmail.com'].join('@');

const K_CONTRIB='stc.contributions.v1', K_FEED='stc.feedback.v1';
const STORE={
  ok:(function(){try{localStorage.setItem('stc.t','1');localStorage.removeItem('stc.t');return true}catch(e){return false}})(),
  get(k,d){try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}
};
function say(el,msg,kind){el.className='status show '+(kind||'info');el.innerHTML=msg;}
function hostOf(u){try{return new URL(u).host}catch(e){return 'the configured endpoint'}}
function mailto(subject,body){
  return 'mailto:'+encodeURIComponent(INBOX)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
}
async function copyText(t){
  try{await navigator.clipboard.writeText(t);return true}
  catch(e){
    const ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.opacity='0';
    document.body.appendChild(ta);ta.select();
    let ok=false;try{ok=document.execCommand('copy')}catch(e2){}
    ta.remove();return ok;
  }
}
function pick(name){const el=document.querySelector(`input[name="${name}"]:checked`);return el?el.value:'';}

const DID_LBL={kept:'Kept it',discounted:'Discounted',bundled:'Bundled',stopped:'Stopped reordering',nothing:'Nothing yet'};
const OUT_LBL={soldout:'Sold out',faster:'Moved faster',same:'No change',wasted:'Spoiled / written off',early:'Too early to tell'};
const OUT_GOOD={soldout:1,faster:1}, OUT_BAD={same:1,wasted:1};
const TOPIC_LBL={usefulness:'General feedback',"wrong-call":'A verdict felt wrong',bug:'Something is broken',idea:'Feature idea',other:'Something else'};

/* ---------- honest "where does this go" banners ---------- */
(function(){
  const cw=_('contrib-where'), cwt=_('contrib-where-txt');
  if(CONFIG.contributeEndpoint){
    cw.className='whereto live';
    cwt.innerHTML=`Entries are sent to <b>${esc(hostOf(CONFIG.contributeEndpoint))}</b> and also kept on this device so you keep your own copy.`;
  }else{
    cw.className='whereto local';
    cwt.innerHTML=STORE.ok
      ? `<b>Saved on this device — nothing is uploaded on its own.</b> Build your list over time, then export the CSV or use <i>Email it in</i> to send it over.`
      : `<b>This browser is blocking local storage,</b> so entries can't be kept between visits. You can still fill the form and email the entry in straight away.`;
  }
  const fw=_('fb-where'), fwt=_('fb-where-txt');
  if(CONFIG.feedbackEndpoint){
    fw.className='whereto live';
    fwt.innerHTML=`Messages go to <b>${esc(hostOf(CONFIG.feedbackEndpoint))}</b>.`;
  }else{
    fw.className='whereto live';
    fwt.innerHTML=`Sending opens your own email app with the message ready to go. <b>Nothing leaves this page until you press send there</b> — so you can see exactly what is being shared.`;
  }
})();

/* ---------- contribute ---------- */
_('c-cat').innerHTML=CAT_OPTS;
const CF={name:_('c-name'),cat:_('c-cat'),stale:_('c-stale'),weeks:_('c-weeks'),units:_('c-units'),
  stock:_('c-stock'),price:_('c-price'),cost:_('c-cost'),region:_('c-region'),type:_('c-type'),consent:_('c-consent')};
const cStatus=_('c-status');
function numOrNull(el){const v=el.value.trim();if(v==='')return null;const n=parseFloat(v);return isFinite(n)?n:null;}

function readContribForm(requireConsent){
  const stale=numOrNull(CF.stale), weeks=numOrNull(CF.weeks), units=numOrNull(CF.units);
  const did=pick('c-did'), out=pick('c-out');
  [CF.stale,CF.weeks,CF.units].forEach(el=>el.classList.remove('bad'));
  const missing=[];
  if(stale===null||stale<0){missing.push('weeks since it last sold');CF.stale.classList.add('bad');}
  if(weeks===null||weeks<1){missing.push('weeks you’ve been selling it');CF.weeks.classList.add('bad');}
  if(units===null||units<0){missing.push('units sold');CF.units.classList.add('bad');}
  if(!did)missing.push('what you decided');
  if(!out)missing.push('how it turned out');
  if(missing.length){say(cStatus,'Kulang pa — still need: '+missing.join(', ')+'.','err');return null;}
  if(requireConsent&&!CF.consent.checked){say(cStatus,'Tick the box below so we know it’s alright to use this entry.','err');return null;}
  const p=predict({weeks_since_last:stale,weeks:weeks,units:units});
  return{
    id:'c_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),
    ts:new Date().toISOString(),
    name:CF.name.value.trim(), category:CF.cat.value,
    weeks_since_last:stale, weeks:weeks, units:units,
    stocked:numOrNull(CF.stock), price:numOrNull(CF.price), cost:numOrNull(CF.cost),
    decision:did, outcome:out, region:CF.region.value, store_type:CF.type.value,
    model_prob:Math.round(p*1000)/1000, model_reading:band(p).label,
    app_said:p>=0.55?'keep':'rescue-or-cut', sent:false
  };
}
function contribText(r){
  return `Shelf outcome\n`+
    `Product: ${r.name||'(unnamed)'}\nCategory: ${r.category||'(none)'}\n`+
    `Weeks since last sold: ${r.weeks_since_last}\nWeeks selling: ${r.weeks}\nUnits sold: ${r.units}\n`+
    `Units stocked: ${r.stocked==null?'(not given)':r.stocked}\nPrice: ${r.price==null?'(not given)':r.price}\nCost: ${r.cost==null?'(not given)':r.cost}\n`+
    `Decision: ${DID_LBL[r.decision]||r.decision}\nOutcome: ${OUT_LBL[r.outcome]||r.outcome}\n`+
    `Region: ${r.region||'(not given)'}\nStore type: ${r.store_type||'(not given)'}\n`+
    `App predicted: ${r.model_reading} (${Math.round(r.model_prob*100)}%) → ${r.app_said}\nLogged: ${r.ts}\n`;
}

_('contrib-form').addEventListener('submit',async e=>{
  e.preventDefault();
  const rec=readContribForm(true); if(!rec)return;
  const all=STORE.get(K_CONTRIB,[]); all.unshift(rec);
  const saved=STORE.set(K_CONTRIB,all);
  if(CONFIG.contributeEndpoint){
    say(cStatus,'Sending…','info');
    try{
      const r=await fetch(CONFIG.contributeEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(rec)});
      if(!r.ok)throw new Error('HTTP '+r.status);
      rec.sent=true; STORE.set(K_CONTRIB,all);
      say(cStatus,'<b>Salamat!</b> Entry sent and kept in your own list.','ok');
    }catch(err){
      say(cStatus,'<b>Saved on this device,</b> but the upload failed ('+esc(err.message)+'). It stays in your list — try <i>Send all</i> later, or export the CSV.','info');
    }
  }else if(saved){
    say(cStatus,'<b>Salamat!</b> Logged on this device. Nothing was uploaded — use <i>Email it in</i> or export the CSV when you want to send it over.','ok');
  }else{
    say(cStatus,'<b>Couldn’t save it</b> — this browser is blocking local storage. Use <i>Email it in</i> now, or the entry will be lost when you leave.','err');
  }
  renderLedger();
  _('contrib-form').reset();
  document.querySelectorAll('#c-did input,#c-out input').forEach(i=>i.checked=false);
});

_('c-mail').addEventListener('click',()=>{
  const rec=readContribForm(false); if(!rec)return;
  location.href=mailto('Shelf Temp Check — shelf outcome: '+(rec.name||'unnamed product'),contribText(rec));
  say(cStatus,'Your email app should be opening with the entry ready. Nothing is sent until you press send there.','ok');
});

/* ---------- the local ledger ---------- */
function renderLedger(){
  const all=STORE.get(K_CONTRIB,[]);
  _('led-count').textContent=all.length;
  _('led-count-lbl').textContent=all.length===1?'outcome logged':'outcomes logged';
  _('led-empty').style.display=all.length?'none':'block';
  _('led-send').style.display=(CONFIG.contributeEndpoint&&all.some(r=>!r.sent))?'':'none';
  _('led-blurb').textContent=all.length
    ? 'Your running list. Export it as CSV any time — it opens straight in Excel.'
    : 'Nothing logged yet. Anything you add stays in this browser until you send it — so you can build the list over weeks and send it in one go.';

  const judged=all.filter(r=>OUT_GOOD[r.outcome]||OUT_BAD[r.outcome]);
  const ag=_('led-agree');
  if(judged.length>=3){
    const hits=judged.filter(r=>(r.app_said==='keep')===!!OUT_GOOD[r.outcome]).length;
    const pct=Math.round(hits/judged.length*100);
    ag.style.display='';
    ag.innerHTML=`On the <b>${judged.length}</b> entries with a real outcome, the app’s call matched what happened <b>${hits}</b> times — <b>${pct}%</b>. ${pct>=70?'It’s reading your shelf well.':pct>=45?'Middling on your shelf — the gap is exactly what the dataset needs.':'It’s misreading your shelf, which is the most useful thing you can report.'} <span style="color:var(--muted)">A rough personal check on a handful of products — not a measured accuracy score.</span>`;
  }else ag.style.display='none';

  _('led-entries').innerHTML=all.map(r=>{
    const g=OUT_GOOD[r.outcome]?'out-good':OUT_BAD[r.outcome]?'out-bad':'';
    const d=new Date(r.ts);
    return `<div class="entry">
      <div class="meta">
        <div class="nm">${esc(r.name||'(unnamed product)')}</div>
        <div class="dt">${d.toLocaleDateString()} · ${r.weeks_since_last}w quiet · ${r.units} sold in ${r.weeks}w · app read ${esc(r.model_reading)} ${Math.round(r.model_prob*100)}%${r.sent?' · sent':''}</div>
        <div class="tags">
          ${r.category?`<span class="t">${esc(r.category)}</span>`:''}
          <span class="t did">${esc(DID_LBL[r.decision]||r.decision)}</span>
          <span class="t ${g}">${esc(OUT_LBL[r.outcome]||r.outcome)}</span>
        </div>
      </div>
      <button class="del" data-id="${r.id}" title="Remove this entry" aria-label="Remove entry">&times;</button>
    </div>`;
  }).join('');
}
_('led-entries').addEventListener('click',e=>{
  const b=e.target.closest('.del');if(!b)return;
  STORE.set(K_CONTRIB,STORE.get(K_CONTRIB,[]).filter(r=>r.id!==b.dataset.id));
  renderLedger(); say(_('led-status'),'Entry removed.','info');
});

const CSV_COLS=['ts','name','category','weeks_since_last','weeks','units','stocked','price','cost',
  'decision','outcome','region','store_type','model_prob','model_reading','app_said'];
function csvCell(v){if(v==null)return'';const s=String(v);return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
_('led-csv').addEventListener('click',()=>{
  const all=STORE.get(K_CONTRIB,[]);
  if(!all.length){say(_('led-status'),'Nothing to export yet.','err');return;}
  const csv=[CSV_COLS.join(',')].concat(all.map(r=>CSV_COLS.map(c=>csvCell(r[c])).join(','))).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download='shelf-temp-check-contributions.csv';
  document.body.appendChild(a);a.click();a.remove();
  say(_('led-status'),`Exported <b>${all.length}</b> entr${all.length===1?'y':'ies'}. Attach it to an email to <b>${esc(INBOX)}</b> if you'd like it in the dataset.`,'ok');
});
_('led-json').addEventListener('click',async()=>{
  const all=STORE.get(K_CONTRIB,[]);
  if(!all.length){say(_('led-status'),'Nothing to copy yet.','err');return;}
  const ok=await copyText(JSON.stringify(all,null,2));
  say(_('led-status'),ok?'Copied to your clipboard as JSON.':'Couldn’t reach the clipboard — try Export CSV instead.',ok?'ok':'err');
});
_('led-clear').addEventListener('click',()=>{
  const all=STORE.get(K_CONTRIB,[]);
  if(!all.length){say(_('led-status'),'Nothing to clear.','info');return;}
  if(!confirm('Delete all '+all.length+' saved entries from this device? Export them first if you want a copy.'))return;
  STORE.set(K_CONTRIB,[]);renderLedger();say(_('led-status'),'All entries deleted from this device.','info');
});
_('led-send').addEventListener('click',async()=>{
  const all=STORE.get(K_CONTRIB,[]), pend=all.filter(r=>!r.sent);
  if(!pend.length){say(_('led-status'),'Everything has been sent already.','info');return;}
  say(_('led-status'),'Sending '+pend.length+'…','info');
  let ok=0,fail=0;
  for(const r of pend){
    try{
      const res=await fetch(CONFIG.contributeEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(r)});
      if(!res.ok)throw new Error('HTTP '+res.status);
      r.sent=true;ok++;
    }catch(e){fail++;}
  }
  STORE.set(K_CONTRIB,all);renderLedger();
  say(_('led-status'),`Sent <b>${ok}</b>${fail?`, <b>${fail}</b> failed and stayed in your list`:''}.`,fail?'info':'ok');
});
renderLedger();

/* ---------- feedback: rating + message ---------- */
const RATE_LBL={1:'Hindi nakatulong',2:'Konti lang',3:'Okay naman',4:'Nakatulong',5:'Sobrang gamit'};
(function buildStars(){
  const wrap=_('fb-rating');
  let h='';
  for(let i=1;i<=5;i++){
    h+=`<label data-v="${i}" title="${i} — ${RATE_LBL[i]}">
      <input type="radio" name="fb-rate" value="${i}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path class="star-f" d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.45l-5.8 3.05 1.1-6.47L2.6 9.45l6.5-.95L12 2.6Z"/></svg>
      <span class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">${i} out of 5 — ${RATE_LBL[i]}</span>
    </label>`;
  }
  h+=`<span class="rating-out" id="fb-rate-out">walang rating pa</span>`;
  wrap.innerHTML=h;
  const labels=[...wrap.querySelectorAll('label')];
  function paint(v){
    labels.forEach(l=>l.classList.toggle('lit',+l.dataset.v<=v));
    _('fb-rate-out').textContent=v?`${v}/5 — ${RATE_LBL[v]}`:'walang rating pa';
  }
  wrap.addEventListener('change',()=>paint(+pick('fb-rate')||0));
  labels.forEach(l=>{
    l.addEventListener('mouseenter',()=>paint(+l.dataset.v));
    l.addEventListener('mouseleave',()=>paint(+pick('fb-rate')||0));
  });
})();

const fbStatus=_('fb-status');
function fbPayload(){
  return{
    ts:new Date().toISOString(),
    rating:pick('fb-rate'),
    topic:pick('fb-topic'),
    name:_('fb-name').value.trim(),
    email:_('fb-email').value.trim(),
    message:_('fb-msg').value.trim(),
    page:location.href
  };
}
function fbText(p){
  return `Shelf Temp Check — feedback\n\n`+
    `Usefulness: ${p.rating?p.rating+'/5 ('+RATE_LBL[p.rating]+')':'(not rated)'}\n`+
    `Topic: ${TOPIC_LBL[p.topic]||p.topic}\n`+
    `Name: ${p.name||'(not given)'}\n`+
    `Reply to: ${p.email||'(not given)'}\n`+
    `Sent: ${p.ts}\nFrom: ${p.page}\n\n`+
    `--- Message ---\n${p.message}\n`;
}
function fbValid(p){
  const m=_('fb-msg');m.classList.remove('bad');
  const e=_('fb-email');e.classList.remove('bad');
  if(!p.rating&&p.message.length<5){say(fbStatus,'Give it a rating, or write a line or two — either one is enough to send.','err');return false}
  if(p.message.length&&p.message.length<5){m.classList.add('bad');say(fbStatus,'Add a bit more detail to the message first.','err');return false}
  if(p.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)){e.classList.add('bad');say(fbStatus,'That email doesn’t look right — fix it, or leave it blank.','err');return false}
  return true;
}
_('fb-form').addEventListener('submit',async e=>{
  e.preventDefault();
  const p=fbPayload();
  if(!fbValid(p))return;
  const log=STORE.get(K_FEED,[]);log.unshift(p);STORE.set(K_FEED,log);
  const subj='Shelf Temp Check feedback'+(p.rating?` — ${p.rating}/5`:'')+` — ${TOPIC_LBL[p.topic]||p.topic}`;

  if(CONFIG.feedbackEndpoint){
    say(fbStatus,'Sending…','info');
    try{
      const r=await fetch(CONFIG.feedbackEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});
      if(!r.ok)throw new Error('HTTP '+r.status);
      say(fbStatus,'<b>Salamat!</b> Message sent. If you left an email we’ll get back to you.','ok');
      _('fb-form').reset();
    }catch(err){
      say(fbStatus,'<b>That didn’t send</b> ('+esc(err.message)+'). Your message is saved on this device — use <i>Copy my message</i> and send it another way.','err');
    }
  }else{
    location.href=mailto(subj,fbText(p));
    say(fbStatus,`Your email app should be opening with the message ready for <b>${esc(INBOX)}</b>. <b>Nothing is sent until you press send there.</b> If nothing opened, use <i>Copy my message</i> and paste it into an email instead.`,'ok');
  }
});
_('fb-copy').addEventListener('click',async()=>{
  const p=fbPayload();
  if(!p.message&&!p.rating){say(fbStatus,'Write the message or pick a rating first, then copy it.','err');return}
  const ok=await copyText(fbText(p));
  say(fbStatus,ok?`Copied to your clipboard. Send it to <b>${esc(INBOX)}</b>.`:'Couldn’t reach the clipboard — select the text and copy it manually.',ok?'ok':'err');
});
