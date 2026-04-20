const sampleData=[{name:'Liron Lea Asulin',hours:8},{name:'Yudit Yulia Sharabi',hours:5.5},{name:'dan',hours:9},{name:'Gilad Shabtai',hours:8},{name:'Viola Fae Fule',hours:6},{name:'Yegor Cherov',hours:6},{name:'Amit Givon',hours:3.5},{name:'David Attais',hours:6}];
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

// Storage key
const HISTORY_KEY='leadAllocatorHistory';

// Set today's date
function setTodayDate(){
 const today=new Date().toISOString().split('T')[0];
 allocationDateInput.value=today;
}

// Get the most recent saved day's people with their hours
function getLastSavedHours(){
 const history=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
 if(history.length===0) return null;
 // Sort by date descending and get the latest date
 history.sort((a,b)=>new Date(b.date)-new Date(a.date));
 const latestDate=history[0].date;
 // Get all entries for that date
 const latestEntries=history.filter(e=>e.date===latestDate);
 return latestEntries.map(e=>({name:e.name,hours:e.hours}));
}

// Initialize
setTodayDate();

// Reset total leads to 0 on every page load
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
 
 // Get existing history
 const history=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
 
 // Remove any existing entries for this date
 const filtered=history.filter(entry=>entry.date!==date);
 
 // Add new entries for this date
 rows.forEach(row=>{
  if(row.name.trim()){
   filtered.push({
    date,
    name:row.name,
    hours:row.hours,
    rawLeads:parseFloat(row.raw.toFixed(2)),
    baseLeads:row.base,
    remainder:parseFloat(row.remainder.toFixed(2)),
    extraLead:row.extra,
    finalLeads:row.final,
    totalLeadsForDay:totalLeads
   });
  }
 });
 
 localStorage.setItem(HISTORY_KEY,JSON.stringify(filtered));
 renderHistory();
 alert(`Day saved! ${date} allocation recorded.`);
}

function renderHistory(){
 const history=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
 historyBody.innerHTML='';
 
 if(history.length===0){
  historyBody.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--muted);">No history yet. Save a day to see it here.</td></tr>';
  return;
 }
 
 // Sort by date descending
 history.sort((a,b)=>new Date(b.date)-new Date(a.date));
 
 history.forEach((entry,idx)=>{
  const row=document.createElement('tr');
  row.innerHTML=`
   <td>${entry.date}</td>
   <td>${entry.name}</td>
   <td>${entry.hours}</td>
   <td><strong>${entry.finalLeads}</strong></td>
   <td><button class="remove-btn" onclick="deleteHistoryEntry(${idx})">Delete</button></td>
  `;
  historyBody.appendChild(row);
 });
}

function filterHistory(){
 const query=historySearch.value.toLowerCase();
 const rows=[...historyBody.querySelectorAll('tr')];
 rows.forEach(row=>{
  const text=row.textContent.toLowerCase();
  row.style.display=text.includes(query)?'':'none';
 });
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
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 URL.revokeObjectURL(url);
}

// On load: use last saved hours if available, otherwise fall back to sample data
const lastHours=getLastSavedHours();
if(lastHours && lastHours.length>0){
 tableBody.innerHTML='';
 lastHours.forEach(addRow);
 calculateAllocation();
} else {
 resetToSampleData();
}
renderHistory();
