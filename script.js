// script.js
/**************************************************************************
 * FETP India Decision Aid Tool
 * Costs realistic & dynamic (capacity, cohorts, horizon, discounting, endorsement)
 * Benefits & QALYs scaled by endorsement
 * PSA (Monte Carlo) added
 **************************************************************************/

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".tablink").forEach(btn =>
    btn.addEventListener("click", function(){ openTab(this.getAttribute("data-tab"), this); })
  );
  openTab("introTab", document.querySelector(".tablink"));

  Chart.defaults.font.size = 14;
  Chart.defaults.color = "#243447";
});

/* ---------- Tabs ---------- */
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

/* ---------- Inputs UI ---------- */
function updateCostDisplay(v){ document.getElementById("costLabel").textContent = parseInt(v,10).toLocaleString(); }
function updateCapDisplay(v){ document.getElementById("capLabel").textContent = v; }
function updateStakeDisplay(v){ document.getElementById("stakeLabel").textContent = v; }
function valRadio(name){
  const r=document.querySelector(`input[name="${name}"]:checked`);
  return r ? r.value : null;
}

/* ---------- Coefficients (placeholders) ---------- */
const COEFS = {
  ASC: 0.2,
  type_intermediate: 0.35,
  type_advanced: 0.55,
  dur_12: 0.15,
  dur_24: 0.22,
  focus_animal: 0.18,
  focus_onehealth: 0.42,
  mode_hybrid: 0.12,
  mode_online: -0.40,
  resp_7: 0.20,
  resp_3: 0.35,
  resp_1: 0.60,
  cost_perT_perM: -0.00001
};

const WTP = {
  type_intermediate: 12000,
  type_advanced: 22000,
  dur_12: 6000,
  dur_24: 9000,
  focus_animal: 7000,
  focus_onehealth: 15000,
  mode_hybrid: 4000,
  mode_online: -8000,
  resp_7: 5000,
  resp_3: 11000,
  resp_1: 18000
};

/* ---------- Costs (trimmed) ---------- */
const BASE_COSTS = {
  staff_local:    4000000,
  staff_consult:  1200000,
  equip_office:    500000,
  sw_office:       200000,
  rent_utils:      800000,
  workshops:       900000,
  travel_in:       900000,
  travel_int:      300000,
  other_direct:    300000,
  mgmt:            900000,
  maint:           200000,
  inkind_salary:   500000,
  facility_up:     300000,
  depreciation:    150000,
  shared_utils:    200000,
  legal_fin:       150000,
  staff_dev:       250000,
  other_indirect:  150000
};

const PER_TRAINEE = {
  allowance: 60000,
  equip:     20000,
  sw:         4000,
  materials:   3000,
  opp_cost:  80000
};

/* Multipliers */
const MULTIPLIERS = {
  ptype:        { frontline:1.0, intermediate:1.12, advanced:1.28 },
  duration:     { "6":1.0, "12":1.35, "24":1.9 },
  mode_cost_adj:{ inperson:1.0, hybrid:1.05, online:0.85 },
  focus_cost_adj:{ human:1.0, animal:1.05, onehealth:1.12 },
  resp_cost_adj:{ "14":1.0, "7":1.1, "3":1.18, "1":1.3 }
};

function buildScenario(){
  const ptype = valRadio("ptype");
  const duration = valRadio("duration");
  const focus = valRadio("focus");
  const mode = valRadio("mode");
  const resp = valRadio("resp");
  const capacity = +document.getElementById("capSlider").value;
  const costPerTM = +document.getElementById("costSlider").value;
  const stakeholders = +document.getElementById("stakeSlider").value;
  const cohortsYear = +document.getElementById("cohortsYear").value;
  const yearsHorizon = +document.getElementById("yearsHorizon").value;
  const discRate = (+document.getElementById("discRate").value)/100;

  if(!ptype || !duration || !focus || !mode || !resp){
    alert("Select a level for all categorical attributes.");
    return null;
  }
  const warn=[];
  if(mode==="online" && (ptype==="advanced"||focus==="onehealth")){
    warn.push("Online + Advanced/One Health may be unrealistic, consider Hybrid/In-person.");
  }
  displayWarnings(warn);

  return {ptype,duration,focus,mode,resp,capacity,costPerTM,stakeholders,cohortsYear,yearsHorizon,discRate};
}

function displayWarnings(arr){
  const box=document.getElementById("warnings");
  if(arr.length){
    box.innerHTML="<ul>"+arr.map(w=>`<li>${w}</li>`).join("")+"</ul>";
    box.style.display="block";
  }else{box.style.display="none";box.innerHTML="";}
}

/* ---------- Core calculations ---------- */
function endorsementProb(sc){
  let U = COEFS.ASC;
  if(sc.ptype==="intermediate") U+=COEFS.type_intermediate;
  if(sc.ptype==="advanced") U+=COEFS.type_advanced;
  if(sc.duration==="12") U+=COEFS.dur_12;
  if(sc.duration==="24") U+=COEFS.dur_24;
  if(sc.focus==="animal") U+=COEFS.focus_animal;
  if(sc.focus==="onehealth") U+=COEFS.focus_onehealth;
  if(sc.mode==="hybrid") U+=COEFS.mode_hybrid;
  if(sc.mode==="online") U+=COEFS.mode_online;
  if(sc.resp==="7") U+=COEFS.resp_7;
  if(sc.resp==="3") U+=COEFS.resp_3;
  if(sc.resp==="1") U+=COEFS.resp_1;
  U += COEFS.cost_perT_perM * sc.costPerTM;
  return Math.exp(U)/(1+Math.exp(U));
}

function scenarioWTP(sc, endorseShare){
  let tot = 0;
  if(sc.ptype==="intermediate") tot+=WTP.type_intermediate;
  if(sc.ptype==="advanced") tot+=WTP.type_advanced;
  if(sc.duration==="12") tot+=WTP.dur_12;
  if(sc.duration==="24") tot+=WTP.dur_24;
  if(sc.focus==="animal") tot+=WTP.focus_animal;
  if(sc.focus==="onehealth") tot+=WTP.focus_onehealth;
  if(sc.mode==="hybrid") tot+=WTP.mode_hybrid;
  if(sc.mode==="online") tot+=WTP.mode_online;
  if(sc.resp==="7") tot+=WTP.resp_7;
  if(sc.resp==="3") tot+=WTP.resp_3;
  if(sc.resp==="1") tot+=WTP.resp_1;
  return tot * sc.stakeholders * endorseShare;
}

function scenarioCost(sc, endorseShare){
  const mType  = MULTIPLIERS.ptype[sc.ptype];
  const mDur   = MULTIPLIERS.duration[sc.duration];
  const mMode  = MULTIPLIERS.mode_cost_adj[sc.mode];
  const mFocus = MULTIPLIERS.focus_cost_adj[sc.focus];
  const mResp  = MULTIPLIERS.resp_cost_adj[sc.resp];
  const overallMult = mType*mDur*mMode*mFocus*mResp;

  const yrs = sc.yearsHorizon;
  const r   = sc.discRate;
  const cohorts = sc.cohortsYear;

  let pvCost = 0;
  for(let t=0;t<yrs;t++){
    // fixed each year
    let fixed=0;
    Object.values(BASE_COSTS).forEach(v=>fixed+=v);
    fixed*=overallMult;

    // per trainee per cohort (endorsed trainees only)
    const endorsedTraineesYear = sc.capacity*endorseShare*cohorts;
    let perT=0;
    Object.values(PER_TRAINEE).forEach(v=>perT+=v);
    perT*=endorsedTraineesYear*mType*mDur*mFocus;

    // MoH slider cost for all trainees (enrolled)
    const moh = sc.costPerTM*(+sc.duration/12)*sc.capacity*cohorts; // convert months to years fraction

    const yearCost = fixed + perT + moh;
    pvCost += yearCost / Math.pow(1+r,t);
  }
  return pvCost;
}

function scenarioQALY(sc, endorseShare, qalyPerTrainee){
  const yrs=sc.yearsHorizon, r=sc.discRate, cohorts=sc.cohortsYear;
  let pvQ=0;
  for(let t=0;t<yrs;t++){
    const q = sc.capacity*cohorts*endorseShare*qalyPerTrainee;
    pvQ += q/Math.pow(1+r,t);
  }
  return pvQ;
}

/* ---------- Calculate & modal ---------- */
function calculateAll(){
  const sc = buildScenario(); if(!sc) return;

  const endorseShare = endorsementProb(sc);
  const endorsePct = endorseShare*100;

  const totalWTP = scenarioWTP(sc, endorseShare);
  const totalCost = scenarioCost(sc, endorseShare);
  const bcr = totalWTP/totalCost;
  const net = totalWTP-totalCost;

  const rec = recommendation(sc, endorsePct, bcr);

  document.getElementById("modalResults").innerHTML = `
    <h4>Results</h4>
    <p><strong>Endorsement:</strong> ${endorsePct.toFixed(1)}%</p>
    <p><strong>Total WTP:</strong> ₹${formatINR(totalWTP)}</p>
    <p><strong>Total Cost (PV):</strong> ₹${formatINR(totalCost)}</p>
    <p><strong>BCR (WTP/Cost):</strong> ${bcr.toFixed(2)}</p>
    <p><strong>Net Benefit:</strong> ₹${formatINR(net)}</p>
    <p>${rec}</p>`;
  openModal();

  renderWTPChart(sc);
  renderEndorseChart(sc);
  renderCostsBenefits(sc, endorsePct, totalWTP, totalCost, bcr, net, endorseShare);
}

/* ---------- Recommendation ---------- */
function recommendation(sc, endorsePct, bcr){
  let r=[];
  if(endorsePct>=75 && bcr>=1.1) return "Strong configuration: high endorsement and positive BCR. Proceed to implementation and refine cost lines.";
  if(endorsePct<50) r.push("Increase in-person/field components or shorten duration to raise endorsement.");
  if(bcr<1) r.push("Reduce per‑trainee costs (allowances/equipment) or adjust capacity; alternatively, target faster response capacity to lift WTP.");
  if(sc.mode==="online" && (sc.ptype==="advanced"||sc.focus==="onehealth")) r.push("Shift from fully online to hybrid to maintain practical exposure.");
  if(sc.duration==="24") r.push("24-month duration is costly; test 12-month with modular refreshers.");
  if(sc.resp==="14") r.push("Improving response capacity (e.g., 7 days) may raise WTP without large cost jumps.");
  return "Recommendations: " + r.join(" ");
}

/* ---------- Charts ---------- */
let wtpChart=null, endorseChart=null, combinedChart=null, qalyChart=null, psaBCRChart=null, psaICERChart=null;
const PUB_COLORS=["#2a76d2","#009688","#f39c12","#e74c3c","#7f8c8d","#8e44ad","#27ae60","#d35400","#16a085","#c0392b"];

function renderWTPChart(){
  const ctx=document.getElementById("wtpChartMain").getContext("2d");
  if(wtpChart) wtpChart.destroy();
  const labels=Object.keys(WTP).map(k=>k.replace(/_/g," "));
  const dataVals=Object.values(WTP);
  wtpChart=new Chart(ctx,{
    type:'bar',
    data:{labels,datasets:[{label:"Marginal WTP (₹)",data:dataVals,backgroundColor:PUB_COLORS.slice(0,dataVals.length),borderColor:"#243447",borderWidth:1}]},
    options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true}},
      plugins:{legend:{display:false},title:{display:true,text:"Marginal WTP (₹)",font:{size:18,weight:'600'}}}}
  });
}

function renderEndorseChart(sc=null){
  const canvas=document.getElementById("endorseChart"); if(!canvas) return;
  const ctx=canvas.getContext("2d");
  if(endorseChart) endorseChart.destroy();
  const scenario=sc||buildScenario(); if(!scenario) return;
  const p=endorsementProb(scenario)*100;
  endorseChart=new Chart(ctx,{
    type:"doughnut",
    data:{labels:["Endorse","Not Endorse"],datasets:[{data:[p,100-p],backgroundColor:[PUB_COLORS[0],"#cccccc"],borderColor:"#ffffff",borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{title:{display:true,text:`Predicted Endorsement: ${p.toFixed(1)}%`,font:{size:18,weight:'600'}},
               tooltip:{callbacks:{label:(c)=>`${c.label}: ${c.parsed.toFixed(1)}%`}}}}
  });
}

function renderCostsBenefits(sc=null, endorsePct=null, totWTP=null, totCost=null, bcr=null, net=null, endorseShare=null){
  const container=document.getElementById("costsBenefitsResults"); if(!container) return;
  const s=sc||buildScenario(); if(!s) return;

  const eShare=endorseShare!==null?endorseShare:endorsementProb(s);
  const e=endorsePct!==null?endorsePct:eShare*100;
  const w=totWTP!==null?totWTP:scenarioWTP(s,eShare);
  const c=totCost!==null?totCost:scenarioCost(s,eShare);
  const b=bcr!==null?bcr:(w/c);
  const n=net!==null?net:(w-c);

  container.innerHTML=`
    <div class="calculation-info">
      <p><strong>Endorsement:</strong> ${e.toFixed(1)}%</p>
      <p><strong>Total WTP:</strong> ₹${formatINR(w)}</p>
      <p><strong>Total Cost (PV):</strong> ₹${formatINR(c)}</p>
      <p><strong>BCR:</strong> ${b.toFixed(2)} ${b<1?'<span style="color:#e74c3c">(BCR &lt; 1)</span>':''}</p>
      <p><strong>Net Benefit:</strong> ₹${formatINR(n)}</p>
    </div>
    <div><canvas id="combinedChart"></canvas></div>
  `;

  // Breakdown
  const listDiv=document.getElementById("detailedCostBreakdown"); listDiv.innerHTML="";
  const mType=MULTIPLIERS.ptype[s.ptype], mDur=MULTIPLIERS.duration[s.duration],
        mMode=MULTIPLIERS.mode_cost_adj[s.mode], mFocus=MULTIPLIERS.focus_cost_adj[s.focus],
        mResp=MULTIPLIERS.resp_cost_adj[s.resp];
  const overallMult=mType*mDur*mMode*mFocus*mResp;
  const endorsedTrainees = s.capacity*eShare*s.cohortsYear;

  Object.entries(BASE_COSTS).forEach(([k,v])=>{
    addCostCard(listDiv,k,v*overallMult,"Fixed");
  });
  Object.entries(PER_TRAINEE).forEach(([k,v])=>{
    addCostCard(listDiv,k,v*endorsedTrainees*mType*mDur*mFocus,"Per trainee");
  });
  const moh = s.costPerTM*(+s.duration/12)*s.capacity*s.cohortsYear;
  addCostCard(listDiv,"moh_training_cost",moh,"Per trainee","MoH Training Cost (slider)");

  const ctx=document.getElementById("combinedChart").getContext("2d");
  if(combinedChart) combinedChart.destroy();
  combinedChart=new Chart(ctx,{
    type:'bar',
    data:{labels:["Total Cost","Total WTP","Net Benefit"],datasets:[{label:"₹",data:[c,w,n],backgroundColor:[PUB_COLORS[3],PUB_COLORS[1],PUB_COLORS[2]],borderColor:"#243447",borderWidth:1}]},
    options:{responsive:true,plugins:{legend:{display:false},title:{display:true,text:"Cost–Benefit Summary (₹)",font:{size:18,weight:'600'}}},scales:{y:{beginAtZero:true}}}
  });
}

function addCostCard(container,key,val,type,labelOverride){
  const nice=labelOverride||key.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
  const div=document.createElement("div");
  div.className="cost-card";
  div.innerHTML=`<h4>${nice}</h4><p>${type} component</p><p><strong>₹ ${formatINR(val)}</strong></p>`;
  container.appendChild(div);
}

function toggleCostBreakdown(){
  const el=document.getElementById("detailedCostBreakdown");
  el.style.display=(el.style.display==="none"||el.style.display==="")?"flex":"none";
}

/* ---------- QALY ---------- */
function renderQALY(){
  const sc=buildScenario(); if(!sc) return;
  const endorseShare=endorsementProb(sc);
  const qalyPerTrainee=parseFloat(document.getElementById("qalyPerTrainee").value);
  const threshold=+document.getElementById("threshold").value;

  const cost=scenarioCost(sc,endorseShare);
  const qaly=scenarioQALY(sc,endorseShare,qalyPerTrainee);
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
    options:{responsive:true,plugins:{legend:{display:false},title:{display:true,text:"ICER vs Threshold",font:{size:18,weight:'600'}}},scales:{y:{beginAtZero:true}}}
  });
}

/* ---------- PSA ---------- */
function runPSA(){
  const sc=buildScenario(); if(!sc) return;
  const seCost=+document.getElementById("seCost").value/100;
  const seWTP=+document.getElementById("seWTP").value/100;
  const seEnd=+document.getElementById("seEndorse").value/100;
  const iters=+document.getElementById("iterations").value;
  const qalyPerTrainee=parseFloat(document.getElementById("qalyPerTrainee").value);
  const threshold=+document.getElementById("threshold").value;

  const endorseMean=endorsementProb(sc);
  const wMean=scenarioWTP(sc,endorseMean);
  const cMean=scenarioCost(sc,endorseMean);
  const qMean=scenarioQALY(sc,endorseMean,qalyPerTrainee);

  const BCR=[], ICER=[], NB=[];
  for(let i=0;i<iters;i++){
    const e = truncNormal(endorseMean, endorseMean*seEnd, 0.01, 0.99);
    const w = truncNormal(wMean, wMean*seWTP, 1, Infinity);
    const c = truncNormal(cMean, cMean*seCost, 1, Infinity);
    const q = truncNormal(qMean, qMean*seCost, 0.0001, Infinity); // reuse seCost for QALY var if unknown
    BCR.push(w/c);
    NB.push(w-c);
    ICER.push(c/q);
  }

  const psaDiv=document.getElementById("psaResults");
  const mean=(arr)=>arr.reduce((a,b)=>a+b,0)/arr.length;
  const ci=(arr)=>{arr=[...arr].sort((a,b)=>a-b);return [arr[Math.floor(0.025*arr.length)],arr[Math.floor(0.975*arr.length)]];}
  const [bcrL,bcrU]=ci(BCR),[icerL,icerU]=ci(ICER);

  psaDiv.innerHTML=`
    <div class="calculation-info">
      <p><strong>BCR mean:</strong> ${mean(BCR).toFixed(2)} (95% CI ${bcrL.toFixed(2)}–${bcrU.toFixed(2)})</p>
      <p><strong>ICER mean:</strong> ₹${formatINR(mean(ICER))} (95% CI ₹${formatINR(icerL)}–₹${formatINR(icerU)})</p>
      <p><strong>Prob(BCR&gt;1):</strong> ${(BCR.filter(x=>x>1).length/iters*100).toFixed(1)}%</p>
      <p><strong>Prob(ICER&lt;Threshold):</strong> ${(ICER.filter(x=>x<threshold).length/iters*100).toFixed(1)}%</p>
    </div>
  `;

  // Histograms
  renderHistogram("psaBCR", BCR, "BCR", PUB_COLORS[1]);
  renderHistogram("psaICER", ICER, "ICER (₹/QALY)", PUB_COLORS[3]);
}

function truncNormal(mean, sd, min, max){
  let x;
  do{ x = mean + sd*randn_bm(); }while(x<min||x>max);
  return x;
}
function randn_bm(){
  let u=0,v=0;
  while(u===0)u=Math.random();
  while(v===0)v=Math.random();
  return Math.sqrt(-2.0*Math.log(u))*Math.cos(2.0*Math.PI*v);
}

function renderHistogram(canvasId, data, label, color){
  const ctx=document.getElementById(canvasId).getContext("2d");
  if(canvasId==="psaBCR" && psaBCRChart) psaBCRChart.destroy();
  if(canvasId==="psaICER" && psaICERChart) psaICERChart.destroy();

  // simple bins
  const bins=20;
  const min=Math.min(...data), max=Math.max(...data);
  const width=(max-min)/bins;
  const counts=new Array(bins).fill(0);
  data.forEach(v=>{
    let idx=Math.floor((v-min)/width);
    if(idx>=bins) idx=bins-1;
    counts[idx]++;
  });
  const labels=[];
  for(let i=0;i<bins;i++){
    labels.push((min+i*width).toFixed(2));
  }
  const chart=new Chart(ctx,{
    type:"bar",
    data:{labels,datasets:[{label, data:counts, backgroundColor:color, borderColor:"#243447", borderWidth:1}]},
    options:{responsive:true,plugins:{legend:{display:false},title:{display:true,text:`${label} Distribution`,font:{size:16,weight:'600'}}},
             scales:{y:{beginAtZero:true}}}
  });
  if(canvasId==="psaBCR") psaBCRChart=chart; else psaICERChart=chart;
}

/* ---------- Save / Export ---------- */
let savedScenarios=[];
function saveScenario(){
  const sc=buildScenario(); if(!sc) return;
  const eShare=endorsementProb(sc); const e=eShare*100;
  const w=scenarioWTP(sc,eShare);
  const c=scenarioCost(sc,eShare);
  const b=w/c; const n=w-c;
  const qpt=parseFloat(document.getElementById("qalyPerTrainee").value||"0.03");
  const q=scenarioQALY(sc,eShare,qpt);
  const icer=c/q;
  const obj={...sc,endorse:e,totalWTP:w,totalCost:c,bcr:b,net:n,icer:icer,name:`Scenario ${savedScenarios.length+1}`};
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
    let val=s[c];
    if(["totalWTP","totalCost","net","costPerTM","icer"].includes(c)) val="₹"+formatINR(val);
    if(c==="bcr") val=s[c].toFixed(2);
    if(c==="endorse") val=s[c].toFixed(1)+"%";
    if(c==="discRate") val=(s[c]*100).toFixed(1)+"%";
    td.textContent=val;
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
  doc.text("FETP India – Scenario Comparison", pw/2, y, {align:"center"});
  y+=8;
  savedScenarios.forEach(s=>{
    if(y>275){doc.addPage();y=15;}
    doc.setFontSize(12);
    doc.text(`${s.name}`,15,y); y+=5;
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

/* ---------- Modal & helpers ---------- */
function openModal(){ document.getElementById("resultModal").style.display="block"; }
function closeModal(){ document.getElementById("resultModal").style.display="none"; }

function formatINR(num){ return Math.round(num).toString().replace(/\B(?=(\d{2})+(?!\d))/g, ","); }
