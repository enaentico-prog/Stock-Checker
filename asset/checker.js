/* ============================================================
   The checker — single-product reading + batch table + CSV.
   Requires model.js (DATA, predict, band, CAT_OPTS, peso, _).
   ============================================================ */

_('tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.id===b.dataset.t));});

_('cat').innerHTML=CAT_OPTS;
_('cat').value = AFF['Baked Bread/buns/rolls']?'Baked Bread/buns/rolls':(CATS.filter(c=>LIFT[c]!==undefined).sort((a,b)=>LIFT[b]-LIFT[a])[0]||'');

/* The call, laid out: KEEP → PUSH → CUT, with the live one lit. */
function triageBar(state){
  const on=k=>state===k?` on-${k}`:'';
  return `<div class="triage-bar">
    <div class="tb${on('keep')}">KEEP<small>Leave it alone</small></div>
    <div class="tb${on('push')}">PUSH<small>Give it a nudge</small></div>
    <div class="tb${on('cut')}">CUT<small>Stop reordering</small></div>
  </div>`;
}

function rescueBlock(c,fin){
  const lift=(c&&LIFT[c]!==undefined)?LIFT[c]:null;
  const partners=(c&&AFF[c])?AFF[c]:null;
  const top=partners?partners[0]:null;
  const discClass=lift===null?'unknown':lift>=1.4?'strong':lift>=1.2?'some':'weak';
  const responsive=(discClass==='strong'||discClass==='some');
  let dp=null;
  if(fin&&fin.price>0&&fin.price>fin.cost&&lift){
    const newPrice=fin.price*0.85, newMargin=newPrice-fin.cost;
    const oldWk=fin.rate*(fin.price-fin.cost), newWk=fin.rate*lift*newMargin;
    dp={belowCost:newMargin<=0, delta:newWk-oldWk};
  }
  const discountOK = dp ? (!dp.belowCost && dp.delta>0) : null;
  let plays=[];
  if(responsive&&discountOK!==false){
    const note = discountOK===true ? ` At your margin, a ~15% cut still <b>adds about ${peso(dp.delta)}/week</b> in profit — worth doing.` : '';
    plays.push({k:'discount',t:(discClass==='strong'?'Cut the price':'Try a small discount'),g:(discClass==='strong'?'it responds well':'it responds a little'),
      d:`${cap(c)} sells about <b>${lift.toFixed(1)}×</b> more units when discounted${discClass==='some'?' (modestly)':''} — a price cut is a real lever.${note}`});
  }
  if(top&&top.pct>=8)plays.push({k:'bundle',t:`Bundle it with ${low(top.cat)}`,g:'ride the habit',
    d:`Shoppers who buy ${low(c)} grab ${low(top.cat)} <b>${top.pct}%</b> of the time — a combo deal lets that habit pull it along.`});
  if(plays.length===0)plays.push({k:'retire',t:'Stop reordering it',g:'free up the cash',
    d:`${cap(c)||'This product'}${(responsive&&discountOK===false)?' responds to discounts, but not profitably at your margin,':' barely responds to discounts'} and has no strong pairing partner${fin?`. It earns only about ${peso(fin.margin*fin.rate)}/week in margin${fin.frozen>0?`, with about <b>${peso(fin.frozen)}</b> of cash frozen in unsold stock`:''}`:''}. The honest move is to stop reordering — that cash could be buying a winner.`});
  const primary=plays[0];
  const cutting = primary.k==='retire';
  let h=triageBar(cutting?'cut':'push');
  h+=`<div class="playlabel">${cutting?'The call':'What to do'}</div>`;
  h+=`<div class="rp ${primary.k}"><div class="rp-h">${cutting?'Cut':'Push'} — ${primary.t}<span class="gloss">${primary.g}</span></div><p>${primary.d}</p></div>`;
  if(plays.length>1)h+=`<p class="sub" style="margin-top:12px">Also worth a try:</p>`+plays.slice(1).map(pl=>`<div class="rp2"><b>${pl.t}</b> <span style="color:var(--muted);font-size:12px">(${pl.g})</span> — ${pl.d}</div>`).join('');
  if(responsive&&discountOK===false){
    h+=`<div class="warn"><b>Don't discount this one.</b> ${cap(c)} does respond to price cuts, but at your margin a 15% cut would ${dp.belowCost?'sell you <b>below cost</b>':`lose about <b>${peso(-dp.delta)}/week</b>`} — the extra volume doesn't cover the margin you'd give up.`+((top&&top.pct>=8)?` Pair it instead.`:'')+`</div>`;
  } else if(discClass==='weak'){
    h+=`<div class="warn"><b>Don't discount this one.</b> ${cap(c)} barely responds to price cuts (about ${lift.toFixed(1)}×) — you'd give up margin for almost no extra sales.`+((top&&top.pct>=8)?` Pair it instead.`:'')+`</div>`;
  }
  if(discClass==='unknown')h+=`<p class="note">Pick a category above to get discount vs bundle advice.</p>`;
  return h;
}

const IN={stale:_('stale'),weeks:_('weeks'),units:_('units'),stock:_('stock'),cat:_('cat'),price:_('price'),cost:_('cost')};
function renderCheck(){
  const stale=+IN.stale.value,weeks=+IN.weeks.value;
  const units=Math.max(0,parseInt(IN.units.value)||0),stock=Math.max(0,parseInt(IN.stock.value)||0);
  _('stale-v').textContent=stale;_('weeks-v').textContent=weeks;
  const p=predict({weeks_since_last:stale,weeks,units}),b=band(p),pct=Math.round(p*100);
  const hh=150*p;_('merc').setAttribute('y',(10+150-hh).toFixed(1));_('merc').setAttribute('height',hh.toFixed(1));
  _('merc').setAttribute('fill',b.col);_('bulb').setAttribute('fill',b.col);
  _('verdict').innerHTML='<small>Reading</small>'+b.label+'<em>'+b.en+'</em>';
  _('pbig').textContent=pct+'% chance it keeps selling';
  const received=stock, rate=weeks>0?units/weeks:0;
  let str=null;
  if(received>0){str=Math.round(units/received*100);
    if(str>100){_('str').innerHTML='<span class="badge b-warm">check numbers</span>';}
    else{const scls=str>=70?'b-good':str>=40?'b-warm':'b-bad';
      _('str').innerHTML=`<span class="badge ${scls}">${str}%</span>`;}
    _('str-chip').style.display='';}
  else _('str-chip').style.display='none';
  const price=parseFloat(IN.price.value)||0, cost=parseFloat(IN.cost.value)||0;
  let margin=null;
  if(price>0&&price>cost){margin=price-cost;const mpct=margin/price;
    const mcls=mpct>=0.20?'b-good':mpct>=0.10?'b-warm':'b-bad';
    _('margin').innerHTML=`<span class="badge ${mcls}">${peso(margin)} (${Math.round(mpct*100)}%)</span>`;_('margin-chip').style.display='';}
  else _('margin-chip').style.display='none';
  const rem0=Math.max(0,received-units);
  if(received>0&&cost>0){_('frozen').innerHTML=peso(rem0*cost);_('frozen-chip').style.display='';}
  else _('frozen-chip').style.display='none';
  const fin=(margin!==null)?{price,cost,margin,rate,units,frozen:(cost>0?rem0*cost:0)}:null;
  const remaining=Math.max(0,received-units);
  if(received>0&&remaining===0){_('reorder').textContent='sold out';_('reorder-chip').style.display='';}
  else if(remaining>0&&rate>0){const wk=remaining/rate;_('reorder').textContent=wk<1?'under a week':Math.round(wk)+' wks';_('reorder-chip').style.display='';}
  else _('reorder-chip').style.display='none';
  const w=[];
  w.push(stale<=6?`Still selling recently (${stale} wks ago) — the strongest good sign.`:stale<=15?`A little quiet lately (${stale} wks since a sale).`:`Gone quiet — ${stale} weeks with no sale is the biggest red flag.`);
  w.push(weeks>=8?`Sold steadily across ${weeks} weeks — it has a rhythm.`:`Only sold in ${weeks} week${weeks>1?'s':''} so far — thin track record.`);
  w.push(units>=25?`Healthy volume — ${units} units sold.`:`Low volume so far — only ${units} units sold.`);
  if(str!==null)w.push(str>100?`Units sold (${units}) is more than units stocked (${received}) — double-check those two, or add restocks into the stocked figure.`:str>=70?`Sell-through ${str}% — strong, most of what you stocked has sold.`:str>=40?`Sell-through ${str}% — middling, a good chunk is still on the shelf.`:`Sell-through ${str}% — low, most of what you stocked hasn't sold.`);
  if(margin!==null)w.push(`Earns about ${peso(margin*rate)}/week in margin (${units} sold × ${peso(margin)}).`);
  _('why').innerHTML=w.map(t=>`<li>${t}</li>`).join('');
  if(p>=0.55)_('check-rescue').innerHTML=triageBar('keep')+
    `<div class="playlabel">The call</div>`+
    `<div class="rp keep"><div class="rp-h">Keep it<span class="gloss">no action needed</span></div><p>This one looks fine. Keep it on the shelf and reorder as usual. When a product starts slipping, the push-or-cut advice shows up right here.</p></div>`;
  else _('check-rescue').innerHTML=rescueBlock(IN.cat.value,fin);
}
Object.values(IN).forEach(el=>el.addEventListener('input',renderCheck));

/* ---- batch ---- */
const seed=[["Canned mushrooms","Mushrooms",22,3,6],["Chili sauce","Condiments",6,14,40],["","",0,1,1]];
function makeRow(name="",cat="",stale=8,weeks=8,units=15){
  const div=document.createElement('div');div.className='srow';
  div.innerHTML=`<input type="text" placeholder="product name" value="${esc(name)}">
    <select class="rowcat">${CAT_OPTS}</select>
    <input type="number" min="0" value="${stale}"><input type="number" min="1" value="${weeks}">
    <input type="number" min="0" value="${units}"><span class="res"></span>
    <button class="xbtn" title="remove">×</button>`;
  if(cat)div.querySelector('.rowcat').value=cat;
  const nums=div.querySelectorAll('input[type=number]');
  const score=()=>{const st=+nums[0].value||0,wk=+nums[1].value||1,un=+nums[2].value||0;
    div.querySelector('.res').innerHTML=badgeFor(predict({weeks_since_last:st,weeks:wk,units:un}));updateSummary();};
  div.querySelectorAll('input').forEach(i=>i.addEventListener('input',score));
  div.querySelector('.xbtn').addEventListener('click',()=>{div.remove();updateSummary();});
  _('rows').appendChild(div);score();
}
function updateSummary(){
  const rows=[..._('rows').children];let cut=0,keep=0;
  rows.forEach(r=>{const ins=r.querySelectorAll('input[type=number]');
    const p=predict({weeks_since_last:+ins[0].value||0,weeks:+ins[1].value||1,units:+ins[2].value||0});
    if(p<0.5)cut++;else keep++;});
  _('batch-summary').innerHTML=`Out of <b>${rows.length}</b> products: <b>${cut}</b> read as likely to drop, <b>${keep}</b> worth keeping. Run any of them through <b>Check a product</b> to see whether to push it or cut it.`;
}
_('addrow').addEventListener('click',()=>makeRow("","",4,8,15));
seed.forEach(s=>makeRow(...s));
renderCheck();

/* ---- CSV bulk upload ---- */
(function(){
  var HEAD=["Product","Category","Weeks since last sold","Weeks selling","Units sold"];
  function msg(t,warn){var e=_('upload-msg');if(!e)return;e.innerHTML=t;e.className=warn?'upl-warn':'upl-ok';}
  function setMode(up){_('mode-type').classList.toggle('on',!up);_('mode-upload').classList.toggle('on',up);_('upload-panel').style.display=up?'block':'none';}
  var mt=_('mode-type'),mu=_('mode-upload');
  if(mt&&mu){mt.addEventListener('click',function(){setMode(false);});mu.addEventListener('click',function(){setMode(true);});}
  var dl=_('dl-template');
  if(dl)dl.addEventListener('click',function(){
    var csv=[HEAD.join(","),"Canned mushrooms,Mushrooms,22,3,6","Chili sauce,Condiments,6,14,40"].join("\n");
    var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download='lihukai-template.csv';document.body.appendChild(a);a.click();a.remove();
  });
  function parseLine(line){var o=[],c="",q=false;for(var i=0;i<line.length;i++){var ch=line[i];
    if(q){if(ch=='"'){if(line[i+1]=='"'){c+='"';i++;}else q=false;}else c+=ch;}
    else{if(ch=='"')q=true;else if(ch==','){o.push(c);c="";}else c+=ch;}}o.push(c);
    return o.map(function(s){return s.trim();});}
  function load(text){
    var lines=text.replace(/\r/g,'').split('\n').filter(function(l){return l.trim().length;});
    if(lines.length<2){msg('That file looks empty — download the template and add a couple of rows.',true);return;}
    var head=parseLine(lines[0]).map(function(h){return h.toLowerCase();});
    var idx={name:head.findIndex(function(h){return h.indexOf('product')>=0;}),
      cat:head.findIndex(function(h){return h.indexOf('categ')>=0;}),
      stale:head.findIndex(function(h){return h.indexOf('since')>=0;}),
      weeks:head.findIndex(function(h){return h.indexOf('selling')>=0;}),
      units:head.findIndex(function(h){return h.indexOf('unit')>=0;})};
    var miss=['name','stale','weeks','units'].filter(function(k){return idx[k]<0;});
    if(miss.length){msg('Could not find the right columns — please use the template. Missing: '+miss.join(', '),true);return;}
    _('rows').innerHTML='';
    var ok=0,bad=[];
    lines.slice(1).forEach(function(ln,i){var r=parseLine(ln);
      if(!r.some(function(x){return x;}))return;
      var name=(idx.name>=0?r[idx.name]:'')||'';
      var st=parseFloat(r[idx.stale]),wk=parseFloat(r[idx.weeks]),un=parseFloat(r[idx.units]);
      if([st,wk,un].some(function(v){return isNaN(v);})){bad.push(i+2);return;}
      makeRow(name,(idx.cat>=0?r[idx.cat]:''),Math.max(0,st),Math.max(1,wk),Math.max(0,un));ok++;});
    var m='Loaded <b>'+ok+'</b> product'+(ok==1?'':'s')+' into the table below.';
    if(bad.length)m+=' Skipped row'+(bad.length>1?'s':'')+' '+bad.join(', ')+' — the numbers there did not look right.';
    msg(m,bad.length>0);updateSummary();
  }
  var fi=_('csv-file'),dz=_('dropzone');
  function handle(f){if(!f)return;var r=new FileReader();r.onload=function(){load(r.result);};r.readAsText(f);}
  if(fi)fi.addEventListener('change',function(e){handle(e.target.files[0]);});
  if(dz){['dragover','dragenter'].forEach(function(ev){dz.addEventListener(ev,function(e){e.preventDefault();dz.classList.add('drag');});});
    ['dragleave'].forEach(function(ev){dz.addEventListener(ev,function(e){e.preventDefault();dz.classList.remove('drag');});});
    dz.addEventListener('drop',function(e){e.preventDefault();dz.classList.remove('drag');handle(e.dataTransfer.files[0]);});}
})();
