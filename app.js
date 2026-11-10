const $=s=>document.querySelector(s);
const DATA_VERSION='20261110-field-review2';
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={manifest:[],filtered:[],photo:null,call:0,region:null,zoom:100,rotation:0,chunks:new Map()};
const rawFields=[['商品名称','goodsName'],['规格','goodsSpec'],['数量','num'],['批准文号','approvalNo'],['厂家','manufacturer'],['批号','batchCode'],['生产日期','produceDate'],['有效期至','valDate'],['剂型','dosageForm'],['单位','unit'],['单价','price'],['金额','amount'],['产地','place']];
const truthFields=[['商品名称','common_name'],['规格','spec'],['数量','pack_qty'],['批准文号','approval_no'],['厂家','manufacturer'],['批号','batch_code'],['生产日期','produce_date'],['有效期至','val_date'],['剂型','dosage_form'],['单价','batch_price'],['金额','total_amount']];

function fieldGrid(item,fields){return `<div class="field-grid">${fields.map(([label,key])=>`<div class="field ${['商品名称','批准文号','厂家'].includes(label)?'full':''}"><span class="label">${label}</span><span class="value ${item?.[key]==null||item?.[key]===''?'blank':''}">${escapeHtml(item?.[key]??'—')}</span></div>`).join('')}</div>`}
function shortStore(s){return s.includes('华园东')?'白云华园东':s.includes('比邻')?'花都比邻':s.includes('叁悦')?'海珠叁悦':s}
function shortSupplier(s){return (s||'未识别供应商').replace(/^(广东|广州|河南|重庆|周口市|石家庄)/,'').replace(/(医药|药业|信息科技)?有限公司$/,'')}
function statusBadge(text,kind=''){return `<span class="badge ${kind}">${escapeHtml(text)}</span>`}

async function init(){
  try{
    const response=await fetch(`data/index.json?v=${DATA_VERSION}`);if(!response.ok)throw Error(`目录 HTTP ${response.status}`);
    state.manifest=await response.json();
    fillSelect('#storeFilter',[...new Set(state.manifest.map(x=>x.store))]);
    fillSelect('#supplierFilter',[...new Set(state.manifest.map(x=>x.supplier))]);
    $('#globalStatus').textContent=`${state.manifest.length} 张当前图片 · ${state.manifest.filter(x=>x.hasLog).length} 张有原始日志 · ${state.manifest.filter(x=>x.reviewedCount).length} 张完成独立逐字段核准`;
    for(const id of ['storeFilter','supplierFilter','productFilter'])$("#"+id).addEventListener(id==='productFilter'?'input':'change',applyFilters);
    $('#clearFilters').onclick=()=>{$('#storeFilter').value='';$('#supplierFilter').value='';$('#productFilter').value='';applyFilters()};
    $('#prevPhoto').onclick=()=>step(-1);$('#nextPhoto').onclick=()=>step(1);
    $('#callSelect').onchange=()=>{state.call=Number($('#callSelect').value);state.region=null;renderCall()};
    $('#overlayToggle').onchange=renderOverlay;
    $('#rotateButton').onclick=()=>{state.rotation=(state.rotation+90)%360;updateTransform()};
    $('#resetButton').onclick=()=>{state.rotation=0;state.zoom=100;$('#zoomRange').value=100;updateTransform()};
    $('#zoomRange').oninput=e=>{state.zoom=Number(e.target.value);updateTransform()};
    window.addEventListener('keydown',e=>{if(['INPUT','SELECT'].includes(document.activeElement?.tagName))return;if(e.key==='ArrowLeft')step(-1);if(e.key==='ArrowRight')step(1)});
    window.addEventListener('hashchange',()=>{const id=Number(location.hash.match(/photo=(\d+)/)?.[1]);if(id&&id!==state.photo?.id)selectPhoto(id,false)});
    applyFilters();
    const requested=Number(location.hash.match(/photo=(\d+)/)?.[1]);selectPhoto(requested&&state.manifest.some(x=>x.id===requested)?requested:state.filtered[0]?.id);
  }catch(error){$('#globalStatus').textContent=`加载失败：${error.message}`;$('#photoList').innerHTML=`<p class="empty">${escapeHtml(error.message)}</p>`}
}

function fillSelect(selector,values){const select=$(selector);values.filter(Boolean).sort((a,b)=>a.localeCompare(b,'zh-CN')).forEach(value=>{const option=document.createElement('option');option.value=value;option.textContent=value;select.append(option)})}
function applyFilters(){const store=$('#storeFilter').value,supplier=$('#supplierFilter').value,q=$('#productFilter').value.trim().toLowerCase();state.filtered=state.manifest.filter(x=>(!store||x.store===store)&&(!supplier||x.supplier===supplier)&&(!q||String(x.id).includes(q)||x.names.some(n=>n.toLowerCase().includes(q))));$('#filterCount').textContent=`${state.filtered.length} / ${state.manifest.length} 张`;$('#railCount').textContent=state.filtered.length;renderList();if(state.filtered.length&&!state.filtered.some(x=>x.id===state.photo?.id))selectPhoto(state.filtered[0].id);if(!state.filtered.length){$('#photoList').innerHTML='<p class="empty">没有符合条件的图片</p>'}}
function renderList(){const list=$('#photoList');list.innerHTML=state.filtered.map(x=>`<button type="button" class="photo-card ${state.photo?.id===x.id?'active':''}" data-id="${x.id}"><span class="line1">#${x.id}<small>${escapeHtml(shortStore(x.store))}</small></span><span class="supplier">${escapeHtml(x.supplier||'供应商未识别')}</span><span class="minor">${x.hasLog?`豆包 ${x.rawCount} 项 · 最终 ${x.finalCount} 行`:'缺原始日志 · 最终 '+x.finalCount+' 行'}${x.missingCoords?` · <span class="warn">无框 ${x.missingCoords}</span>`:''}</span></button>`).join('');list.querySelectorAll('button[data-id]').forEach(b=>b.onclick=()=>selectPhoto(Number(b.dataset.id)))}
async function loadPhoto(meta){const key=meta.chunk;if(!state.chunks.has(key)){const response=await fetch(`data/chunks/${String(key).padStart(2,'0')}.json?v=${DATA_VERSION}`);if(!response.ok)throw Error(`图片数据 HTTP ${response.status}`);state.chunks.set(key,await response.json())}return state.chunks.get(key)[String(meta.id)]}
async function selectPhoto(id,updateHash=true){if(!id)return;const meta=state.manifest.find(x=>x.id===id);if(!meta)return;state.photo={id};renderList();$('#photoTitle').textContent=`图片 #${id}`;$('#photoMeta').textContent='正在读取四路证据…';try{const photo=await loadPhoto(meta);if(state.photo?.id!==id)return;state.photo=photo;state.call=0;state.region=null;state.zoom=100;state.rotation=0;$('#zoomRange').value=100;updateTransform();renderPhoto();renderList();if(updateHash)history.replaceState(null,'',`#photo=${id}`);document.querySelector('.photo-card.active')?.scrollIntoView({block:'nearest'})}catch(error){$('#photoMeta').textContent=`读取失败：${error.message}`}}
function step(direction){const index=state.filtered.findIndex(x=>x.id===state.photo?.id);const next=state.filtered[index+direction];if(next)selectPhoto(next.id)}
function updateTransform(){$('#imageStage').style.transform=`scale(${state.zoom/100}) rotate(${state.rotation}deg)`;$('#zoomValue').textContent=state.zoom+'%'}
function renderPhoto(){const p=state.photo;$('#photoTitle').textContent=`图片 #${p.id}`;$('#photoMeta').textContent=`${p.store} · ${p.supplier||'供应商未识别'} · ${p.time||''}`;$('#sourceBadges').innerHTML=statusBadge(p.evaluation==='否'?'非正向评价图':'正向随货单',p.evaluation==='否'?'warn':'good')+statusBadge(p.calls.length?`${p.calls.length} 次原始调用`:'缺导出日志',p.calls.length?'':'warn');$('#photoImage').src=p.image;$('#photoImage').onload=renderOverlay;$('#photoImage').onerror=()=>{$('#selectedRegion').textContent='图片文件加载失败，可尝试原图地址'};$('#callSelect').innerHTML=p.calls.map((c,i)=>`<option value="${i}">调用 ${i+1} · 豆包 ${c.llm?.items?.length||0} 项 · 火山 ${c.volcCode??'—'}</option>`).join('');$('#callSelect').hidden=p.calls.length<2;$('#auditNote').textContent=p.auditNote||'暂无逐图结论';renderCall();renderFinal();renderCodex();$('.results-scroll').scrollTop=0}
function currentCall(){return state.photo?.calls?.[state.call]}
function renderFinal(){const rows=state.photo?.finalRows||[];$('#finalCount').textContent=`${rows.length} 行`;$('#finalContent').innerHTML=rows.length?rows.map((row,i)=>`<div class="item-card"><div class="item-head"><span class="item-no">${i+1}</span><span class="item-name">${escapeHtml(row.common_name||'名称未填写')}</span></div>${fieldGrid(row,truthFields)}</div>`).join(''):'<p class="empty">最终没有留下入库行。</p>'}
function renderCall(){const call=currentCall();const p=state.photo;if(!p)return;$('#callSelect').value=String(state.call);if(!call){$('#doubaoContent').innerHTML='<p class="empty">本次导出中没有关联到豆包原始响应。这里不会用最终入库行冒充豆包结果。</p>';$('#ocrContent').innerHTML='<p class="empty">本次导出中没有关联到火山 OCR 原始坐标。</p>';$('#ocrCount').textContent='无原始日志';renderOverlay();return}
  const h=call.llm||{},items=h.items||[];$('#doubaoContent').innerHTML=`<div class="header-fields"><div>模型 <b>${escapeHtml(call.model||'—')}</b></div><div>商品项 <b>${items.length}</b></div><div>供应商 <b>${escapeHtml(h.supplierName||'—')}</b></div><div>单号 <b>${escapeHtml(h.billCode||'—')}</b></div><div>单据日期 <b>${escapeHtml(h.billDate||'—')}</b></div><div>发货日期 <b>${escapeHtml(h.shipDate||'—')}</b></div></div>${items.length?items.map((item,i)=>`<div class="item-card"><div class="item-head"><span class="item-no">${i+1}</span><span class="item-name">${escapeHtml(item.goodsName||'名称未返回')}</span></div>${fieldGrid(item,rawFields)}</div>`).join(''):'<p class="empty">豆包未返回商品项</p>'}`;
  $('#ocrCount').textContent=`${call.regions.length} 个文字块 · 返回码 ${call.volcCode??'—'}`;$('#ocrContent').innerHTML=`<p class="hint">下列四点坐标来自火山原始响应；点击文字块可在左侧原图定位。坐标按火山返回的原始数组顺序展示，单位为原图像素。</p><div class="ocr-list">${call.regions.length?call.regions.map(r=>`<div class="ocr-row" data-region="${r.id}"><span class="index">${r.id}</span><span class="text">${escapeHtml(r.text)}</span><span class="coords">${escapeHtml(r.polygon.map(pt=>pt.join(',')).join(' · '))}</span></div>`).join(''):'<div class="empty">无火山文字块；返回信息：'+escapeHtml(call.volcMessage||call.volcCode||'—')+'</div>'}</div>`;$('#ocrContent').querySelectorAll('[data-region]').forEach(el=>el.onclick=()=>selectRegion(Number(el.dataset.region)));renderOverlay()}
function renderOverlay(){const svg=$('#ocrOverlay'),img=$('#photoImage'),call=currentCall();svg.replaceChildren();if(!call||!$('#overlayToggle').checked||!img.naturalWidth)return;svg.setAttribute('viewBox',`0 0 ${img.naturalWidth} ${img.naturalHeight}`);svg.setAttribute('preserveAspectRatio','none');for(const r of call.regions){const poly=document.createElementNS('http://www.w3.org/2000/svg','polygon');poly.setAttribute('points',r.polygon.map(pt=>pt.join(',')).join(' '));poly.setAttribute('class','ocr-polygon'+(state.region===r.id?' selected':''));poly.dataset.region=r.id;const title=document.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=`#${r.id} ${r.text}`;poly.append(title);poly.onclick=()=>selectRegion(r.id);svg.append(poly)}}
function selectRegion(id){state.region=id;const r=currentCall()?.regions.find(x=>x.id===id);$('#selectedRegion').textContent=r?`OCR #${id}：${r.text} · ${r.polygon.map(pt=>pt.join(',')).join(' / ')}`:'点击蓝色坐标框，可定位对应 OCR 文字';$('#ocrContent').querySelectorAll('.ocr-row').forEach(el=>el.classList.toggle('active',Number(el.dataset.region)===id));$('#ocrContent').querySelector(`.ocr-row[data-region="${id}"]`)?.scrollIntoView({block:'nearest'});renderOverlay()}
function renderCodex(){
  const c=state.photo.codex,manual=c.manualRows||[],reviewed=c.reviewedRows||[],vision=c.independentText||[];
  $('#codexBadge').textContent=reviewed.length?`${reviewed.length} 行按原图核准`:'尚无完整逐字段核准';
  let html='';
  if(reviewed.length){
    html+=reviewed.map(r=>{
      const model=state.photo.calls[0]?.llm?.items?.[r.row-1]||{};
      const comparisons=[['商品名称','goodsName','common_name'],['规格','goodsSpec','spec'],['厂家','manufacturer','manufacturer']];
      return `<div class="reviewed-row">
        <div class="reviewed-heading">原图商品行 ${escapeHtml(r.row)} · 独立核准</div>
        <div class="reviewed-errors">错误字段：${r.errorFields.map(escapeHtml).join('、')}</div>
        <table class="field-comparison"><thead><tr><th>字段</th><th>豆包返回</th><th>原图核准</th></tr></thead><tbody>${comparisons.map(([label,rawKey,truthKey])=>`<tr><th>${label}</th><td>${escapeHtml(model[rawKey]??'—')}</td><td>${escapeHtml(r.truth[truthKey])}${label==='规格'&&r.sourceSpec?`<small>原文片段：${escapeHtml(r.sourceSpec)}；末尾 / 是字段分隔符</small>`:''}</td></tr>`).join('')}</tbody></table>
        <div class="mini-heading">其余已核准字段</div>${fieldGrid(r.truth,truthFields)}
        <div class="reviewed-analysis"><strong>错误原因</strong><p>${escapeHtml(r.cause)}</p><strong>供应商专属提示词</strong><p>${escapeHtml(r.prompt)}</p><small>${escapeHtml(r.verification)}${r.referenceUrl?` <a href="${escapeHtml(r.referenceUrl)}" target="_blank" rel="noopener noreferrer">药学数据记录 ↗</a>`:''}</small></div>
      </div>`;
    }).join('');
  }else{
    html+='<p class="unreviewed-note">这张图还没有独立的完整逐字段核准结果。下方旧核对记录和机器文字稿不能当作正确商品字段。</p>';
  }
  if(manual.length){html+='<div class="mini-heading">既往逐行核对记录</div>'+manual.map((r,i)=>`<div class="manual-note ${r.judgment==='通过'?'':'fail'}"><strong>原图商品行 ${escapeHtml(r.sourceRow||i+1)} · ${escapeHtml(r.judgment||'待判')}</strong>${r.truth?`<div class="truth">${fieldGrid(r.truth,truthFields)}</div>`:`<span>${escapeHtml(r.errorTags||r.errorType||'核对了部分差异；未完整转录所有字段')}</span>`}<small>${escapeHtml(r.method||'')} ${r.outputRowId?'· 对应最终行 '+escapeHtml(r.outputRowId):''}</small></div>`).join('')}
  html+=`<div class="mini-heading">本机 OCR 文字稿 · ${vision.length} 块（未经逐字段核准）</div><div class="vision-list">${vision.length?vision.map(v=>`<span title="置信度 ${v.confidence}">${escapeHtml(v.text)}</span>`).join(''):'没有识别到文字'}</div>`;
  $('#codexContent').innerHTML=html;
}

init();
