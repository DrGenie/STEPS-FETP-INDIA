// script.js
/**************************************************************************
 * FETP India Decision Aid Tool
 * - Costs trimmed & dynamic
 * - Endorsement drives benefits & many costs
 * - Multi-cohort, multi-year, discounting
 * - PSA (Monte Carlo)
 * - Fixed-height charts to stop infinite scroll
 * - Detailed dynamic recommendations
 **************************************************************************/

document.addEventListener("DOMContentLoaded", ()=>{
  document.querySelectorAll(".tablink").forEach(btn=>{
    btn.addEventListener("click", function(){ openTab(this.getAttribute("data-tab"), this); });
  });
  openTab("introTab", document.querySelector(".tablink"));

  Chart.defaults.font.size = 14;
  Chart.defaults.color = "#243447";
});

/* -------- Tabs -------- */
function openTab(tabId, btn){
  document.querySelectorAll(".tabcontent").forEach(t=>t.style.display="none");
  document.querySelectorAll(".tablink").forEach(b=>{
    b.classList.remove("active"); b.setAttribute("aria-selected","false");
  });
  document.getElementById(tabId).style.display="block";
  btn.classList.add("active"); btn.setAttribute("aria-selected","true");

  if(tabId==='wtpTab') renderWTPChart();
  if(tabId==='endorseTab') renderEndorseChart();
  if(tabId==='costsTab') renderCostsBenefits();
}

/* -------- UI helpers -------- */
function updateCostDisplay(v){document.getElementById("costLabel").textContent=parseInt(v,10).toLocaleString();}
function updateCapDisplay(v){document.getElementById("capLabel").textContent=v;}
function updateStakeDisplay(v){document.getElementById("stakeLabel").textContent=v;}
function valRadio(name){const r=document.querySelector(`input[name="${name}"]:checked`);return r?r.value:null;}
function displayWarnings(arr){
  const box=document.getElementById("warnings");
  if(arr.length){box.innerHTML="<ul>"+arr.map(w=>`<li>${w}</li>`).join("")+"</ul>";box.style.display="block";}
  else{box.style.display="none";box.innerHTML="";}
}

/* -------- Coefficients (placeholder) -------- */
const COEFS={
  ASC:0.30,
  type_intermediate:0.28,
  type_advanced:0.48,
  dur_12:0.10,
  dur_24:0.18,
  focus_animal:0.14,
  focus_onehealth:0.36,
  mode_hybrid:0.12,
  mode_online:-0.32,
  resp_7:0.16,
  resp_3:0.30,
  resp_1:0.52,
  cost_perT_perM:-0.0000085
};

const WTP={
  type_intermediate:10000,
  type_advanced:20000,
  dur_12:5000,
  dur_24:8000,
  focus_animal:6000,
  focus_onehealth:13000,
  mode_hybrid:3000,
  mode_online:-6500,
  resp_7:4000,
  resp_3:9500,
  resp_1:16000
};

/* Trimmed cost blocks (₹/year) */
const BASE_COSTS={
  staff_local: 1200000,
  staff_consult: 400000,
  rent_utils: 350000,
  workshops: 450000,
  travel_in: 350000,
  other_direct: 150000,
  mgmt: 450000,
  maint: 120000,
  shared_utils: 120000,
  legal_fin: 80000,
  staff_dev: 150000
};
/* per trainee endorsed */
const PER_TRAINEE={
  allowance:30000,
  equip:12000,
  sw:2500,
  materials:2000,
  opp_cost:50000
};

const MULTIPLIERS={
  ptype:{frontline:1.0,intermediate:1.08,advanced:1.18},
  duration:{"6":1.0,"12":1.25,"24":1.7},
  mode_cost_adj:{inperson:1.0,hybrid:1.03,online:0.85},
  focus_cost_adj:{human:1.0,animal:1.04,onehealth:1.08},
  resp_cost_adj:{"14":1.0,"7":1.06,"3":1.12,"1":1.20}
};

/* -------- Build scenario -------- */
function buildScenario(){
  const ptype=valRadio("ptype");
  const duration=valRadio("duration");
  const focus=valRadio("focus");
  const mode=valRadio("mode");
  const resp=valRadio("resp");
  const capacity=+document.getElementById("capSlider").value;
  const costPerTM=+document.getElementById("costSlider").value;
  const stakeholders=+document.getElementById("stakeSlider").value;
  const cohortsYear=+document.getElementById("cohortsYear").value;
  const yearsHorizon=+document.getElementById("yearsHorizon").value;
  const discRate=(+document.getElementById("discRate").value)/100;

  if(!ptype||!duration||!focus||!mode||!resp){
    alert("Select all categorical attributes.");
    return null;
  }
  const warn=[];
  if(mode==="online"&&(ptype==="advanced"||focus==="onehealth")) warn.push("Online + Advanced/OneHealth may reduce field learning—consider Hybrid/In-person.");
  displayWarnings(warn);

  return {ptype,duration,focus,mode,resp,capacity,costPerTM,stakeholders,cohortsYear,yearsHorizon,discRate};
}

/* -------- Core calcs -------- */
function endorsementProb(sc){
  let U=COEFS.ASC;
  if(sc.ptype==="intermediate")U+=COEFS.type_intermediate;
  if(sc.ptype==="advanced")U+=COEFS.type_advanced;
  if(sc.duration==="12")U+=COEFS.dur_12;
  if(sc.duration==="24")U+=COEFS.dur_24;
  if(sc.focus==="animal")U+=COEFS.focus_animal;
  if(sc.focus==="onehealth")U+=COEFS.focus_onehealth;
  if(sc.mode==="hybrid")U+=COEFS.mode_hybrid;
  if(sc.mode==="online")U+=COEFS.mode_online;
  if(sc.resp==="7")U+=COEFS.resp_7;
  if(sc.resp==="3")U+=COEFS.resp_3;
  if(sc.resp==="1")U+=COEFS.resp_1;
  U+=COEFS.cost_perT_perM*sc.costPerTM;
  return Math.exp(U)/(1+Math.exp(U));
}

function scenarioWTP(sc,eShare){
  let tot=0;
  if(sc.ptype==="intermediate")tot+=WTP.type_intermediate;
  if(sc.ptype==="advanced")tot+=WTP.type_advanced;
  if(sc.duration==="12")tot+=WTP.dur_12;
  if(sc.duration==="24")tot+=WTP.dur_24;
  if(sc.focus==="animal")tot+=WTP.focus_animal;
  if(sc.focus==="onehealth")tot+=WTP.focus_onehealth;
  if(sc.mode==="hybrid")tot+=WTP.mode_hybrid;
  if(sc.mode==="online")tot+=WTP.mode_online;
  if(sc.resp==="7")tot+=WTP.resp_7;
  if(sc.resp==="3")tot+=WTP.resp_3;
  if(sc.resp==="1")tot+=WTP.resp_1;
  return tot*sc.stakeholders*eShare;
}

function scenarioCost(sc,eShare){
  const mT=MULTIPLIERS.ptype[sc.ptype];
  const mD=MULTIPLIERS.duration[sc.duration];
  const mMo=MULTIPLIERS.mode_cost_adj[sc.mode];
  const mF=MULTIPLIERS.focus_cost_adj[sc.focus];
  const mR=MULTIPLIERS.resp_cost_adj[sc.resp];
  const mult=mT*mD*mMo*mF*mR;

  const yrs=sc.yearsHorizon, r=sc.discRate, coh=sc.cohortsYear;
  let pv=0;
  for(let t=0;t<yrs;t++){
    let fixed=0;
    Object.values(BASE_COSTS).forEach(v=>fixed+=v);
    fixed*=mult;

    const endorsed=sc.capacity*eShare*coh;
    let perT=0;
    Object.values(PER_TRAINEE).forEach(v=>perT+=v);
    perT*=endorsed*mT*mD*mF;

    const moh=sc.costPerTM*(sc.duration/12)*sc.capacity*coh;

    const yearCost=fixed+perT+moh;
    pv+=yearCost/Math.pow(1+r,t);
  }
  return pv;
}

function scenarioQALY(sc,eShare,qalyPerT){
  const yrs=sc.yearsHorizon, r=sc.discRate, coh=sc.cohortsYear;
  let pv=0;
  for(let t=0;t<yrs;t++){
    const q=sc.capacity*coh*eShare*qalyPerT;
    pv+=q/Math.pow(1+r,t);
  }
  return pv;
}

/* -------- Calculate and modal -------- */
function calculateAll(){
  const sc=buildScenario(); if(!sc)return;
  const eShare=endorsementProb(sc); const ePct=eShare*100;
  const w=scenarioWTP(sc,eShare);
  const c=scenarioCost(sc,eShare);
  const bcr=w/c;
  const net=w-c;
  const rec=buildRecommendation(sc,ePct,bcr,net);

  document.getElementById("modalResults").innerHTML=`
    <h4>Results</h4>
    <p><strong>Endorsement:</strong> ${ePct.toFixed(1)}%</p>
    <p><strong>Total WTP:</strong> ₹${formatINR(w)}</p>
    <p><strong>Total Cost (PV):</strong> ₹${formatINR(c)}</p>
    <p><strong>BCR:</strong> ${bcr.toFixed(2)}</p>
    <p><strong>Net Benefit:</strong> ₹${formatINR(net)}</p>
    <p>${rec}</p>`;
  openModal();

  renderWTPChart();
  renderEndorseChart(sc);
  renderCostsBenefits(sc,ePct,w,c,bcr,net,eShare);
}

/* -------- Dynamic detailed recommendation -------- */
function buildRecommendation(sc,ePct,bcr,net){
  const msgs=[];
  // Overall status
  if(ePct>=70 && bcr>=1 && net>0) msgs.push("Overall strong scenario: high endorsement and positive net benefit.");
  if(ePct<45) msgs.push("Raise endorsement: shorten duration (6–12m), add in‑person mentorship, or improve outbreak response speed.");
  if(bcr<1 || net<0) msgs.push("Costs exceed benefits. Trim allowances/equipment, reduce fixed overheads, or increase stakeholder base.");
  // Attribute-specific
  if(sc.mode==="online" && (sc.ptype==="advanced"||sc.focus==="onehealth"))
    msgs.push("Switch from fully online to hybrid to maintain field exposure for advanced/One Health content.");
  if(sc.duration==="24") msgs.push("24 months inflates costs; consider 12 months plus refresher modules.");
  if(sc.resp==="14") msgs.push("Improving response capacity to 7 or 3 days boosts perceived value at modest extra cost.");
  if(sc.ptype==="frontline" && ePct>=60 && bcr<1) msgs.push("Frontline type may still need targeted marketing to donors; increase stakeholder coverage (slider) to lift WTP.");
  if(sc.costPerTM>70000) msgs.push("₹/Trainee/Month is high. Consider blended financing or cost sharing with states to lower MoH burden.");

  return "Recommendations: " + msgs.join(" ");
}

/* -------- Charts -------- */
let wtpChart=null, endorseChart=null, combinedChart=null, qalyChart=null, psaBCRChart=null, psaICERChart=null;
const PUB_COLORS=["#2a76d2","#009688","#f39c12","#e74c3c","#7f8c8d","#8e44ad","#27ae60","#d35400","#16a085","#c0392b"];

function renderWTPChart(){
  const ctx=document.getElementById("wtpChartMain").getContext("2d");
  if(wtpChart) wtpChart.destroy();
  const labels=Object.keys(WTP).map(k=>k.replace(/_/g," "));
  const vals=Object.values(WTP);
  wtpChart=new Chart(ctx,{
    type:"bar",
    data:{labels,datasets:[{label:"Marginal WTP (₹)",data:vals,backgroundColor:PUB_COLORS.slice(0,vals.length),borderColor:"#243447",borderWidth:1}]},
    options:{responsive:true,maintainAspectRatio:false,
      scales:{y:{beginAtZero:true}},
      plugins:{legend:{display:false},title:{display:true,text:"Marginal WTP (₹)",font:{size:18,weight:'600'}}}}
  });
}

function renderEndorseChart(sc=null){
  const canvas=document.getElementById("endorseChart"); if(!canvas)return;
  const ctx=canvas.getContext("2d");
  if(endorseChart) endorseChart.destroy();
  const s=sc||buildScenario(); if(!s)return;
  const p=endorsementProb(s)*100;
  endorseChart=new Chart(ctx,{
    type:"doughnut",
    data:{labels:["Endorse","Not Endorse"],datasets:[{data:[p,100-p],backgroundColor:[PUB_COLORS[0],"#cccccc"],borderColor:"#fff",borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{title:{display:true,text:`Predicted Endorsement: ${p.toFixed(1)}%`,font:{size:18,weight:'600'}},
               tooltip:{callbacks:{label:(c)=>`${c.label}: ${c.parsed.toFixed(1)}%`}}}}
  });
}

function renderCostsBenefits(sc=null,ePct=null,w=null,c=null,bcr=null,net=null,eShare=null){
  const container=document.getElementById("costsBenefitsResults"); if(!container)return;
  const s=sc||buildScenario(); if(!s)return;
  const es=eShare!==null?eShare:endorsementProb(s);
  const e=ePct!==null?ePct:es*100;
  const W=w!==null?w:scenarioWTP(s,es);
  const C=c!==null?c:scenarioCost(s,es);
  const B=bcr!==null?bcr:W/C;
  const N=net!==null?net:W-C;

  container.innerHTML=`
    <div class="calculation-info">
      <p><strong>Endorsement:</strong> ${e.toFixed(1)}%</p>
      <p><strong>Total WTP:</strong> ₹${formatINR(W)}</p>
      <p><strong>Total Cost (PV):</strong> ₹${formatINR(C)}</p>
      <p><strong>BCR:</strong> ${B.toFixed(2)} ${B<1?'<span style="color:#e74c3c">(BCR &lt; 1)</span>':''}</p>
      <p><strong>Net Benefit:</strong> ₹${formatINR(N)}</p>
    </div>
    <div class="chart-box fixed-height"><canvas id="combinedChart"></canvas></div>
  `;

  const listDiv=document.getElementById("detailedCostBreakdown"); listDiv.innerHTML="";
  const mT=MULTIPLIERS.ptype[s.ptype],mD=MULTIPLIERS.duration[s.duration],
        mMo=MULTIPLIERS.mode_cost_adj[s.mode],mF=MULTIPLIERS.focus_cost_adj[s.focus],
        mR=MULTIPLIERS.resp_cost_adj[s.resp];
  const mult=mT*mD*mMo*mF*mR;
  const endorsedT=s.capacity*es*s.cohortsYear;

  Object.entries(BASE_COSTS).forEach(([k,v])=>{
    addCostCard(listDiv,k,v*mult,"Fixed");
  });
  Object.entries(PER_TRAINEE).forEach(([k,v])=>{
    addCostCard(listDiv,k,v*endorsedT*mT*mD*mF,"Per trainee");
  });
  const moh=s.costPerTM*(s.duration/12)*s.capacity*s.cohortsYear;
  addCostCard(listDiv,"MoH Training Cost (slider)",moh,"Per trainee");

  const ctx=document.getElementById("combinedChart").getContext("2d");
  if(combinedChart) combinedChart.destroy();
  combinedChart=new Chart(ctx,{
    type:"bar",
    data:{labels:["Total Cost","Total WTP","Net Benefit"],datasets:[{label:"₹",data:[C,W,N],backgroundColor:[PUB_COLORS[3],PUB_COLORS[1],PUB_COLORS[2]],borderColor:"#243447",borderWidth:1}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},title:{display:true,text:"Cost–Benefit Summary (₹)",font:{size:18,weight:'600'}}},
      scales:{y:{beginAtZero:true}}}
  });
}

function addCostCard(container,title,val,type){
  const div=document.createElement("div");
  div.className="cost-card";
  div.innerHTML=`<h4>${title.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}</h4><p>${type} component</p><p><strong>₹ ${formatINR(val)}</strong></p>`;
  container.appendChild(div);
}

function toggleCostBreakdown(){
  const el=document.getElementById("detailedCostBreakdown");
  el.style.display=(el.style.display==="none"||el.style.display==="")?"flex":"none";
}

/* -------- QALY -------- */
function renderQALY(){
  const sc=buildScenario(); if(!sc)return;
  const eShare=endorsementProb(sc);
  const qalyPerT=parseFloat(document.getElementById("qalyPerTrainee").value);
  const threshold=+document.getElementById("threshold").value;

  const cost=scenarioCost(sc,eShare);
  const qaly=scenarioQALY(sc,eShare,qalyPerT);
  const icer=cost/qaly;

  const div=document.getElementById("qalyResults");
  div.innerHTML=`
    <div class="calculation-info">
      <p><strong>Total QALYs (PV):</strong> ${qaly.toFixed(2)}</p>
      <p><strong>Total Cost (PV):</strong> ₹${formatINR(cost)}</p>
      <p><strong>ICER:</strong> ₹${formatINR(icer)} / QALY</p>
      <p><strong>Threshold:</strong> ₹${formatINR(threshold)} → ${icer<=threshold?'<span style="color:#27ae60">Cost‑effective</span>':'<span style="color:#e74c3c">Not cost‑effective</span>'}</p>
    </div>
  `;

  const ctx=document.getElementById("qalyChart").getContext("2d");
  if(qalyChart) qalyChart.destroy();
  qalyChart=new Chart(ctx,{
    type:"bar",
    data:{labels:["ICER","Threshold"],datasets:[{label:"₹/QALY",data:[icer,threshold],backgroundColor:[PUB_COLORS[0],PUB_COLORS[4]],borderColor:"#243447",borderWidth:1}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},title:{display:true,text:"ICER vs Threshold",font:{size:18,weight:'600'}}},
      scales:{y:{beginAtZero:true}}}
  });
}

/* -------- PSA -------- */
function runPSA(){
  const sc=buildScenario(); if(!sc) return;
  const seCost=+document.getElementById("seCost").value/100;
  const seWTP=+document.getElementById("seWTP").value/100;
  const seEnd=+document.getElementById("seEndorse").value/100;
  const iters=+document.getElementById("iterations").value;
  const qalyPerT=parseFloat(document.getElementById("qalyPerTrainee").value);
  const threshold=+document.getElementById("threshold").value;

  const eMean=endorsementProb(sc);
  const wMean=scenarioWTP(sc,eMean);
  const cMean=scenarioCost(sc,eMean);
  const qMean=scenarioQALY(sc,eMean,qalyPerT);

  const BCR=[],ICER=[],NB=[];
  for(let i=0;i<iters;i++){
    const e = truncNormal(eMean,eMean*seEnd,0.01,0.99);
    const w = truncNormal(wMean,wMean*seWTP,1,Infinity);
    const c = truncNormal(cMean,cMean*seCost,1,Infinity);
    const q = truncNormal(qMean,qMean*seCost,0.0001,Infinity);
    BCR.push(w/c);
    NB.push(w-c);
    ICER.push(c/q);
  }

  const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
  const ci=a=>{
    const arr=[...a].sort((x,y)=>x-y);
    return [arr[Math.floor(0.025*arr.length)],arr[Math.floor(0.975*arr.length)]];
  };
  const [bL,bU]=ci(BCR),[iL,iU]=ci(ICER);

  document.getElementById("psaResults").innerHTML=`
    <div class="calculation-info">
      <p><strong>BCR mean:</strong> ${mean(BCR).toFixed(2)} (95% CI ${bL.toFixed(2)}–${bU.toFixed(2)})</p>
      <p><strong>ICER mean:</strong> ₹${formatINR(mean(ICER))} (95% CI ₹${formatINR(iL)}–₹${formatINR(iU)})</p>
      <p><strong>P(BCR&gt;1):</strong> ${(BCR.filter(x=>x>1).length/iters*100).toFixed(1)}%</p>
      <p><strong>P(ICER&lt;Threshold):</strong> ${(ICER.filter(x=>x<threshold).length/iters*100).toFixed(1)}%</p>
    </div>
  `;

  renderHistogram("psaBCR",BCR,"BCR",PUB_COLORS[1]);
  renderHistogram("psaICER",ICER,"ICER (₹/QALY)",PUB_COLORS[3]);
}

function truncNormal(mean,sd,min,max){
  let x;
  do{x=mean+sd*randn_bm();}while(x<min||x>max);
  return x;
}
function randn_bm(){
  let u=0,v=0;
  while(u===0)u=Math.random();
  while(v===0)v=Math.random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}

function renderHistogram(canvasId,data,label,color){
  const ctx=document.getElementById(canvasId).getContext("2d");
  if(canvasId==="psaBCR"&&psaBCRChart) psaBCRChart.destroy();
  if(canvasId==="psaICER"&&psaICERChart) psaICERChart.destroy();

  const bins=20;
  const min=Math.min(...data),max=Math.max(...data);
  const width=(max-min)/bins||1;
  const counts=new Array(bins).fill(0);
  data.forEach(v=>{
    let idx=Math.floor((v-min)/width);
    if(idx>=bins)idx=bins-1;
    counts[idx]++;
  });
  const labels=[];
  for(let i=0;i<bins;i++) labels.push((min+i*width).toFixed(2));

  const chart=new Chart(ctx,{
    type:"bar",
    data:{labels,datasets:[{label,data:counts,backgroundColor:color,borderColor:"#243447",borderWidth:1}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},title:{display:true,text:`${label} Distribution`,font:{size:16,weight:'600'}}},
      scales:{y:{beginAtZero:true}}}
  });
  if(canvasId==="psaBCR") psaBCRChart=chart; else psaICERChart=chart;
}

/* -------- Save / Export -------- */
let savedScenarios=[];
function saveScenario(){
  const sc=buildScenario(); if(!sc)return;
  const eShare=endorsementProb(sc),e=eShare*100;
  const w=scenarioWTP(sc,eShare);
  const c=scenarioCost(sc,eShare);
  const b=w/c, n=w-c;
  const qpt=parseFloat(document.getElementById("qalyPerTrainee").value||"0.03");
  const q=scenarioQALY(sc,eShare,qpt);
  const icer=c/q;

  const obj={...sc,endorse:e,totalWTP:w,totalCost:c,bcr:b,net:n,icer, name:`Scenario ${savedScenarios.length+1}`};
  savedScenarios.push(obj);
  appendScenarioRow(obj);
  alert(`Saved ${obj.name}.`);
}

function appendScenarioRow(s){
  const tbody=document.querySelector("#scenarioTable tbody");
  const tr=document.createElement("tr");
  const cols=["name","ptype","duration","focus","mode","resp","capacity","costPerTM","stakeholders","cohortsYear","yearsHorizon","discRate","endorse","totalWTP","totalCost","bcr","net","icer"];
  cols.forEach(c=>{
    const td=document.createElement("td");
    let v=s[c];
    if(["totalWTP","totalCost","net","costPerTM","icer"].includes(c)) v="₹"+formatINR(v);
    if(c==="bcr") v=s[c].toFixed(2);
    if(c==="endorse") v=s[c].toFixed(1)+"%";
    if(c==="discRate") v=(s[c]*100).toFixed(1)+"%";
    td.textContent=v;
    tr.appendChild(td);
  });
  tbody.appendChild(tr);
}

function exportPDF(){
  if(savedScenarios.length===0){alert("No scenarios saved.");return;}
  const { jsPDF } = window.jspdf;
  const doc=new jsPDF({unit:"mm",format:"a4"});
  const pw=doc.internal.pageSize.getWidth();
  let y=15;
  doc.setFontSize(16);
  doc.text("FETP India – Scenario Comparison",pw/2,y,{align:"center"});
  y+=8;
  savedScenarios.forEach(s=>{
    if(y>275){doc.addPage();y=15;}
    doc.setFontSize(12);
    doc.text(`${s.name}`,15,y);y+=5;
    const lines=[
      `Type:${s.ptype} Dur:${s.duration}m Focus:${s.focus} Mode:${s.mode} Resp:${s.resp}d`,
      `Cap:${s.capacity} Coh/yr:${s.cohortsYear} Years:${s.yearsHorizon} Disc:${(s.discRate*100).toFixed(1)}%`,
      `₹/T/M:${formatINR(s.costPerTM)} Stakeholders:${s.stakeholders}`,
      `Endorse:${s.endorse.toFixed(1)}%  WTP:₹${formatINR(s.totalWTP)}  Cost:₹${formatINR(s.totalCost)}`,
      `BCR:${s.bcr.toFixed(2)}  Net:₹${formatINR(s.net)}  ICER:₹${formatINR(s.icer)}/QALY`
    ];
    lines.forEach(t=>{doc.text(t,15,y);y+=5;});
    y+=3;
  });
  doc.save("FETP_Scenarios.pdf");
}

/* -------- Modal & helpers -------- */
function openModal(){document.getElementById("resultModal").style.display="block";}
function closeModal(){document.getElementById("resultModal").style.display="none";}
function formatINR(num){return Math.round(num).toString().replace(/\B(?=(\d{2})+(?!\d))/g,",");}
