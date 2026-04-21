// ── ClickUp config ──────────────────────────────────────────────
const CLICKUP_LIST_IDS = ['901811520991', '901813385807'];
const CLICKUP_STATUSES = ['red hot', 'no response to offer'];

const SALESPERSON_MAP = {
  'Amit':    '107574161',
  'Viola':   '107574160',
  'Igor':    '107540368',
  'Yehudit': '107540366',
  'Gilad':   '107540365',
  'Dan':     '107540364',
  'Liron':   '107540362',
  'David':   '107540359',
};
// ────────────────────────────────────────────────────────────────

const sampleData=[{name:'Liron',hours:8},{name:'Yehudit',hours:5.5},{name:'Dan',hours:9},{name:'Gilad',hours:8},{name:'Viola',hours:6},{name:'Igor',hours:6},{name:'Amit',hours:3.5},{name:'David',hours:6}];
const tableBody=document.getElementById('tableBody');
const rowTemplate=document.getElementById('rowTemplate');
const totalLeadsInput=document.getElementById('totalLeads');
const allocationDateInput=document.getElementById('allocationDate');
const totalHoursEl=document.getElementById('totalHours');
const baseTotalEl=document.getElementById('baseTotal');
const extraTotalEl=document.getElementById('extraTotal');
const finalTotalEl=document.getElementById('finalTotal');
const summaryContent=document.getElementById('summaryContent');
const historyBody=document.getElementById('historyBody');
const historySearch=document.getElementById('historySearch');

const HISTORY_KEY='leadAllocatorHistory';
const API_KEY_STORAGE='clickupApiKey';

// ── Inject ClickUp UI into the page ─────────────────────────────
function injectClickUpUI(){
  // API key bar
  const apiBar=document.createElement('section');
  apiBar.className='card';
  apiBar.style.cssText='margin-top:28px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;';
  apiBar.innerHTML=`
    <label for="clickupApiKey" style="font-weight:600;white-space:nowrap;">ClickUp API Key</label>
    <input id="clickupApiKey" type="password" placeholder="pk_••••••••••••••••••••••" style="flex:1;min-width:220px;height:40px;padding:0 12px;border:1px solid var(--border);border-radius:12px;font-size:14px;" />
    <button id="saveApiKeyBtn" type="button">Save Key</button>
    <span id="apiKeyStatus" style="font-size:13px;color:var(--muted);"></span>
  `;

  // Allocate button + status
  const allocBar=document.createElement('section');
  allocBar.className='card';
  allocBar.style.cssText='margin-top:16px;';
  allocBar.innerHTML=`
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
      <button id="clickupAllocateBtn" type="button" style="background:var(--accent,#7b5cfa);color:#fff;">⚡ Fetch &amp; Allocate Leads in ClickUp</button>
      <span id="clickupStatus" style="font-size:13px;color:var(--muted);"></span>
    </div>
    <div id="clickupLog" style="margin-top:14px;font-size:13px;line-height:1.7;max-height:220px;overflow-y:auto;"></div>
  `;

  // Insert API key bar before the history section (last card)
  const historySec=document.querySelector('section.card:last-of-type');
  historySec.parentNode.insertBefore(apiBar,historySec);

  // Insert allocate button before the summary-grid section
  const summarySec=document.querySelector('section.summary-grid');
  summarySec.parentNode.insertBefore(allocBar,summarySec);

  // Wire up events
  document.getElementById('saveApiKeyBtn').addEventListener('click',saveApiKey);
  document.getElementById('clickupAllocateBtn').addEventListener('click',runClickUpAllocation);

  // Load saved key and show clear status indicator
  const saved=localStorage.getItem(API_KEY_STORAGE);
  if(saved){
    document.getElementById('clickupApiKey').value=saved;
    document.getElementById('apiKeyStatus').textContent='✓ API key found — ready to use';
    document.getElementById('apiKeyStatus').style.color='#22c55e';
  } else {
    document.getElementById('apiKeyStatus').textContent='⚠ No API key saved — paste your key and click Save';
    document.getElementById('apiKeyStatus').style.color='#f59e0b';
  }
}

function saveApiKey(){
  const key=document.getElementById('clickupApiKey').value.trim();
  if(!key){alert('Please enter your ClickUp API key.');return;}
  localStorage.setItem(API_KEY_STORAGE,key);
  const s=document.getElementById('apiKeyStatus');
  s.textContent='✓ API key saved — ready to use';
  s.style.color='#22c55e';
}

function getApiKey(){
  return (document.getElementById('clickupApiKey').value.trim()) || localStorage.getItem(API_KEY_STORAGE)||'';
}

// ── ClickUp API helpers ──────────────────────────────────────────
async function fetchUnassignedLeads(apiKey){
  const leads=[];
  for(const listId of CLICKUP_LIST_IDS){
    let page=0;
    while(true){
      const url=`https://api.clickup.com/api/v2/list/${listId}/task?page=${page}&include_closed=false`;
      const res=await fetch(url,{headers:{'Authorization':apiKey,'Content-Type':'application/json'}});
      if(!res.ok) throw new Error(`ClickUp API error for list ${listId}: ${res.status} ${res.statusText}`);
      const data=await res.json();
      const tasks=data.tasks||[];
      tasks.forEach(task=>{
        const statusMatch=CLICKUP_STATUSES.includes((task.status?.status||'').toLowerCase().trim());
        const unassigned=!task.assignees||task.assignees.length===0;
        if(statusMatch&&unassigned) leads.push({id:task.id,name:task.name,status:task.status?.status,listId});
      });
      if(data.last_page) break;
      page++;
    }
  }
  return leads;
}

async function assignTask(apiKey,taskId,userId){
  const res=await fetch(`https://api.clickup.com/api/v2/task/${taskId}`,{
    method:'PUT',
    headers:{'Authorization':apiKey,'Content-Type':'application/json'},
    body:JSON.stringify({assignees:{add:[parseInt(userId,10)]}}),
  });
  if(!res.ok) throw new Error(`Failed to assign task ${taskId}: ${res.status}`);
}

// ── Main allocation runner ───────────────────────────────────────
async function runClickUpAllocation(){
  const apiKey=getApiKey();
  if(!apiKey){alert('Please enter and save your ClickUp API key first.');return;}

  const statusEl=document.getElementById('clickupStatus');
  const logEl=document.getElementById('clickupLog');
  const btn=document.getElementById('clickupAllocateBtn');

  btn.disabled=true;
  logEl.innerHTML='';
  statusEl.textContent='Fetching unassigned leads…';

  try{
    // 1. Fetch leads
    const leads=await fetchUnassignedLeads(apiKey);
    if(leads.length===0){
      statusEl.textContent='';
      logEl.innerHTML='<p style="color:var(--muted)">No unassigned Red Hot / No Response to Offer leads found.</p>';
      btn.disabled=false;
      return;
    }

    log(logEl,`Found <strong>${leads.length}</strong> unassigned lead(s). Calculating allocation…`);

    // 2. Auto-set total leads to match what was found, then recalculate
    totalLeadsInput.value=leads.length;
    const rows=calculateAllocation();
    if(!rows){throw new Error('Could not calculate allocation. Check that hours are entered.');}

    // 3. Build assignment queue: repeat each name finalLeads times
    const queue=[];
    rows.forEach(p=>{
      if(p.final>0 && SALESPERSON_MAP[p.name]){
        for(let i=0;i<p.final;i++) queue.push({name:p.name,userId:SALESPERSON_MAP[p.name]});
      }
    });

    if(queue.length===0){throw new Error('No salespeople matched. Check names match: '+Object.keys(SALESPERSON_MAP).join(', '));}

    // 4. Shuffle leads so assignment isn't always top-of-list biased
    const shuffled=leads.sort(()=>Math.random()-0.5);

    // 5. Assign leads — cycle through queue if more leads than queue slots
    let assigned=0;
    const breakdown={};
    for(let i=0;i<shuffled.length;i++){
      const {name,userId}=queue[i%queue.length];
      await assignTask(apiKey,shuffled[i].id,userId);
      breakdown[name]=(breakdown[name]||0)+1;
      assigned++;
      statusEl.textContent=`Assigning… ${assigned}/${shuffled.length}`;
    }

    // 6. Log results
    log(logEl,`<strong>✓ Done! ${assigned} lead(s) assigned.</strong>`);
    Object.entries(breakdown).sort((a,b)=>b[1]-a[1]).forEach(([name,count])=>{
      log(logEl,`&nbsp;&nbsp;• ${name}: ${count} lead(s)`);
    });
    statusEl.textContent=`✓ ${assigned} leads assigned successfully`;

  }catch(err){
    statusEl.textContent='';
    logEl.innerHTML+=`<p style="color:#e55;">❌ Error: ${err.message}</p>`;
    console.error(err);
  }

  btn.disabled=false;
}

function log(el,html){
  const p=document.createElement('p');
  p.innerHTML=html;
  el.appendChild(p);
  el.scrollTop=el.scrollHeight;
}

// ── Existing app code ────────────────────────────────────────────
function setTodayDate(){
  const today=new Date().toISOString().split('T')[0];
  allocationDateInput.value=today;
}

function getLastSavedHours(){
  const history=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
  if(history.length===0) return null;
  history.sort((a,b)=>new Date(b.date)-new Date(a.date));
  const latestDate=history[0].date;
  return history.filter(e=>e.date===latestDate).map(e=>({name:e.name,hours:e.hours}));
}

setTodayDate();
totalLeadsInput.value=0;

document.getElementById('addRowBtn').addEventListener('click',()=>addRow({name:'',hours:''}));
document.getElementById('calculateBtn').addEventListener('click',saveDay);
document.getElementById('resetBtn').addEventListener('click',resetToSampleData);
document.getElementById('downloadBtn').addEventListener('click',downloadAllHistory);
totalLeadsInput.addEventListener('input',calculateAllocation);
historySearch.addEventListener('input',filterHistory);

function addRow(person){
  const fragment=rowTemplate.content.cloneNode(true);
  const row=fragment.querySelector('tr');
  row.querySelector('.name-input').value=person.name??'';
  row.querySelector('.hours-input').value=person.hours??'';
  row.querySelector('.hours-input').addEventListener('input',calculateAllocation);
  row.querySelector('.name-input').addEventListener('input',calculateAllocation);
  row.querySelector('.remove-btn').addEventListener('click',()=>{row.remove();calculateAllocation();});
  tableBody.appendChild(row);
}

function getRows(){return [...tableBody.querySelectorAll('tr')];}

function calculateAllocation(){
  const totalLeads=Math.max(0,parseInt(totalLeadsInput.value||'0',10)||0);
  const rows=getRows().map((row,index)=>({row,name:row.querySelector('.name-input').value.trim()||`Person ${index+1}`,hours:Math.max(0,parseFloat(row.querySelector('.hours-input').value||'0')||0),raw:0,base:0,remainder:0,extra:0,final:0}));
  const totalHours=rows.reduce((sum,p)=>sum+p.hours,0);
  if(totalHours===0||rows.length===0){rows.forEach(updateRowDisplay);updateTotals(0,0,0,0);summaryContent.innerHTML='<p class="warn">Enter hours to calculate the split.</p>';return;}
  rows.forEach(p=>{p.raw=(p.hours/totalHours)*totalLeads;p.base=Math.floor(p.raw);p.remainder=p.raw-p.base;});
  let baseTotal=rows.reduce((sum,p)=>sum+p.base,0);
  let leftovers=totalLeads-baseTotal;
  rows.map((person,originalIndex)=>({person,originalIndex})).sort((a,b)=>{
    if(b.person.remainder!==a.person.remainder)return b.person.remainder-a.person.remainder;
    if(b.person.hours!==a.person.hours)return b.person.hours-a.person.hours;
    return a.originalIndex-b.originalIndex;
  }).forEach((item,idx)=>{item.person.extra=idx<leftovers?1:0;});
  rows.forEach(p=>{p.final=p.base+p.extra;updateRowDisplay(p);});
  const extraTotal=rows.reduce((sum,p)=>sum+p.extra,0);
  const finalTotal=rows.reduce((sum,p)=>sum+p.final,0);
  updateTotals(totalHours,baseTotal,extraTotal,finalTotal);
  renderSummary(rows,totalLeads,totalHours,leftovers,finalTotal);
  return rows;
}

function updateRowDisplay(person){
  person.row.querySelector('.raw-leads').textContent=person.raw.toFixed(2);
  person.row.querySelector('.base-leads').textContent=person.base;
  person.row.querySelector('.remainder').textContent=person.remainder.toFixed(2);
  person.row.querySelector('.extra-lead').textContent=person.extra;
  person.row.querySelector('.final-leads').textContent=person.final;
}

function updateTotals(totalHours,baseTotal,extraTotal,finalTotal){
  totalHoursEl.textContent=formatNumber(totalHours);
  baseTotalEl.textContent=baseTotal;
  extraTotalEl.textContent=extraTotal;
  finalTotalEl.textContent=finalTotal;
}

function renderSummary(rows,totalLeads,totalHours,leftovers,finalTotal){
  const sorted=[...rows].sort((a,b)=>b.final-a.final||b.hours-a.hours);
  const top=sorted.slice(0,3).map(p=>`${p.name}: ${p.final}`).join(' · ');
  const valid=finalTotal===totalLeads;
  summaryContent.innerHTML=`<p><strong>Date:</strong> ${allocationDateInput.value}</p><p><strong>Total Leads:</strong> ${totalLeads}</p><p><strong>Total Hours:</strong> ${formatNumber(totalHours)}</p><p><strong>Leftover Leads Assigned:</strong> ${leftovers}</p><p><strong>Top Allocations:</strong> ${top||'—'}</p><p class="${valid?'good':'warn'}">${valid?'✓ Final lead count matches total leads.':'✗ Final lead count does not match total leads.'}</p>`;
}

function saveDay(){
  const date=allocationDateInput.value;
  if(!date){alert('Please select a date.');return;}
  const rows=calculateAllocation();
  const totalLeads=parseInt(totalLeadsInput.value||'0',10)||0;
  const history=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
  const filtered=history.filter(entry=>entry.date!==date);
  rows.forEach(row=>{
    if(row.name.trim()){
      filtered.push({date,name:row.name,hours:row.hours,rawLeads:parseFloat(row.raw.toFixed(2)),baseLeads:row.base,remainder:parseFloat(row.remainder.toFixed(2)),extraLead:row.extra,finalLeads:row.final,totalLeadsForDay:totalLeads});
    }
  });
  localStorage.setItem(HISTORY_KEY,JSON.stringify(filtered));
  renderHistory();
  alert(`Day saved! ${date} allocation recorded.`);
}

function renderHistory(){
  const history=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
  historyBody.innerHTML='';
  if(history.length===0){historyBody.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--muted);">No history yet. Save a day to see it here.</td></tr>';return;}
  history.sort((a,b)=>new Date(b.date)-new Date(a.date));
  history.forEach((entry,idx)=>{
    const row=document.createElement('tr');
    row.innerHTML=`<td>${entry.date}</td><td>${entry.name}</td><td>${entry.hours}</td><td><strong>${entry.finalLeads}</strong></td><td><button class="remove-btn" onclick="deleteHistoryEntry(${idx})">Delete</button></td>`;
    historyBody.appendChild(row);
  });
}

function filterHistory(){
  const query=historySearch.value.toLowerCase();
  [...historyBody.querySelectorAll('tr')].forEach(row=>{row.style.display=row.textContent.toLowerCase().includes(query)?'':'none';});
}

function deleteHistoryEntry(idx){
  if(!confirm('Delete this entry?'))return;
  const history=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
  history.splice(idx,1);
  localStorage.setItem(HISTORY_KEY,JSON.stringify(history));
  renderHistory();
}

function resetToSampleData(){tableBody.innerHTML='';sampleData.forEach(addRow);calculateAllocation();}

function formatNumber(value){return Number.isInteger(value)?String(value):value.toFixed(1);}

function downloadAllHistory(){
  const history=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
  if(history.length===0){alert('No history to download.');return;}
  const headers=['Date','Name','Hours','Raw Leads','Base Leads','Remainder','Extra Lead','Final Leads','Total Leads for Day'];
  const lines=[headers.join(','),...history.map(e=>[e.date,e.name,e.hours,e.rawLeads,e.baseLeads,e.remainder,e.extraLead,e.finalLeads,e.totalLeadsForDay].map(v=>`"${String(v).replaceAll('"','""')}"`).join(','))];
  const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;
  link.download=`lead-allocation-history-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);link.click();document.body.removeChild(link);URL.revokeObjectURL(url);
}

// ── Boot ─────────────────────────────────────────────────────────
injectClickUpUI();

const lastHours=getLastSavedHours();
if(lastHours&&lastHours.length>0){tableBody.innerHTML='';lastHours.forEach(addRow);calculateAllocation();}
else{resetToSampleData();}
renderHistory();
