/**************************************************************************
 * FETP India Decision Aid Tool
 * - Costs trimmed & dynamics (scaling by capacity, multipliers & endorsement)
 * - Benefits = WTP × endorsement × stakeholders
 * - QALY = capacity × endorsement × QALY/trainee
 **************************************************************************/

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".tablink").forEach(btn =>
    btn.addEventListener("click", function(){ openTab(this.getAttribute("data-tab"), this); })
  );
  openTab("introTab", document.querySelector(".tablink"));

  // Chart.js global defaults
  Chart.defaults.font.size = 14;
  Chart.defaults.color = "#243447";
});

/* -------- Tab switching -------- */
function openTab(tabId, btn){
  document.querySelectorAll(".tabcontent").forEach(tab=>tab.style.display="none");
  document.querySelectorAll(".tablink").forEach(b=>{
    b.classList.remove("active"); b.setAttribute("aria-selected","false");
  });
  document.getElementById(tabId).style.display="block";
  btn.classList.add("active"); btn.setAttribute("aria-selected","true");

  if(tabId==='wtpTab') renderWTPChart();
  if(tabId==='endorseTab') renderEndorseChart();
  if(tabId==='costsTab') renderCostsBenefits();
}

/* -------- Slider displays -------- */
function updateCostDisplay(v){ document.getElementById("costLabel").textContent = parseInt(v,10).toLocaleString(); }
function updateCapDisplay(v){ document.getElementById("capLabel").textContent = v; }
function updateStakeDisplay(v){ document.getElementById("stakeLabel").textContent = v; }

/* -------- Placeholder Coefficients -------- */
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

/* -------- Cost parameters (trimmed) -------- */
const BASE_COSTS = {
  staff_local:    9000000,   // 90 lakh
  staff_consult:  2500000,
  equip_office:    800000,
  sw_office:       300000,
  rent_utils:     1200000,
  workshops:      1200000,
  travel_in:      1800000,
  travel_int:      600000,
  other_direct:    500000,
  mgmt:           1500000,
  maint:           300000,
  inkind_salary:  1000000,
  facility_up:     500000,
  depreciation:    250000,
  shared_utils:    350000,
  legal_fin:       250000,
  staff_dev:       450000,
  other_indirect:  250000
};

const PER_TRAINEE = {
  allowance: 90000,
  equip:     25000,
  sw:         5000,
  materials:   4000,
  opp_cost: 100000
};

/* Multipliers */
const MULTIPLIERS = {
  ptype:        { frontline:1.0, intermediate:1.15, advanced:1.35 },
  duration:     { "6":1.0, "12":1.4, "24":2.0 },
  mode_cost_adj:{ inperson:1.0, hybrid:1.08, online:0.85 },
  focus_cost_adj:{ human:1.0, animal:1.08, onehealth:1.18 },
  resp_cost_adj:{ "14":1.0, "7":1.12, "3":1.22, "1":1.35 }
};

/* -------- Build scenario -------- */
function buildScenario(){
  const ptype = valRadio("ptype");
  const duration = valRadio("duration");
  const focus = valRadio("focus");
  const mode = valRadio("mode");
  const resp = valRadio("resp");
  const capacity = +document.getElementById("capSlider").value;
  const costPerTM = +document.getElementById("costSlider").value;
  const stakeholders = +document.getElementById("stakeSlider").value;

  if(!ptype || !duration || !focus || !mode || !resp){
    alert("Select a level for all categorical attributes.");
    return null;
  }

  const warn = [];
  if(mode==="online" && (ptype==="advanced" || focus==="onehealth")){
    warn.push("Fully online with Advanced/One Health may be unrealistic. Consider Hybrid/In-person.");
  }
  displayWarnings(warn);

  return {ptype, duration, focus, mode, resp, capacity, costPerTM, stakeholders};
}

function valRadio(name){
  const r=document.querySelector(`input[name="${name}"]:checked`);
  return r ? r.value : null;
}

function displayWarnings(arr){
  const box=document.getElementById("warnings");
  if(arr.length){
    box.innerHTML = "<ul>" + arr.map(w=>`<li>${w}</li>`).join("") + "</ul>";
    box.style.display="block";
  }else{
    box.style.display="none";
    box.innerHTML="";
  }
}

/* -------- Endorsement probability -------- */
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

/* -------- WTP -------- */
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
  // Aggregate over stakeholders & endorsement
  return tot * sc.stakeholders * endorseShare;
}

/* -------- Costs -------- */
function scenarioCost(sc, endorseShare){
  const mType  = MULTIPLIERS.ptype[sc.ptype];
  const mDur   = MULTIPLIERS.duration[sc.duration];
  const mMode  = MULTIPLIERS.mode_cost_adj[sc.mode];
  const mFocus = MULTIPLIERS.focus_cost_adj[sc.focus];
  const mResp  = MULTIPLIERS.resp_cost_adj[sc.resp];

  const overallMult = mType * mDur * mMode * mFocus * mResp;

  // Fixed blocks (not scaled by endorsement)
  let fixed = 0;
  Object.values(BASE_COSTS).forEach(v=> fixed += v);
  fixed *= overallMult;

  // Per trainee blocks – scale by endorsed trainees
  const endorsedTrainees = sc.capacity * endorseShare;
  let perT = 0;
  Object.values(PER_TRAINEE).forEach(v=> perT += v);
  perT *= endorsedTrainees * mType * mDur * mFocus; // still scale by some multipliers

  // MoH training cost slider (assume paid for all enrolled, not only endorsed)
  const moh = sc.costPerTM * (+sc.duration) * sc.capacity;

  return fixed + perT + moh;
}

/* -------- QALY -------- */
function scenarioQALY(sc, endorseShare, qalyPerTrainee){
  return sc.capacity * endorseShare * qalyPerTrainee;
}

/* -------- Calculate All -------- */
function calculateAll(){
  const sc = buildScenario();
  if(!sc) return;

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
    <p><strong>Total Cost:</strong> ₹${formatINR(totalCost)}</p>
    <p><strong>BCR (WTP/Cost):</strong> ${bcr.toFixed(2)}</p>
    <p><strong>Net Benefit:</strong> ₹${formatINR(net)}</p>
    <p>${rec}</p>`;
  openModal();

  renderWTPChart(sc);
  renderEndorseChart(sc);
  renderCostsBenefits(sc, endorsePct, totalWTP, totalCost, bcr, net, endorseShare);
}

/* -------- Recommendation -------- */
function recommendation(sc, endorsePct, bcr){
  if(endorsePct>=70 && bcr>=1) return "High endorsement and positive BCR. Strong case.";
  let r="Consider: ";
  if(endorsePct<50) r+="boost practical exposure or shorten duration; ";
  if(bcr<1) r+="trim per-trainee costs or increase response speed to raise WTP; ";
  if(sc.mode==="online" && (sc.ptype==="advanced"||sc.focus==="onehealth")) r+="switch from fully online to hybrid/in-person; ";
  return r;
}

/* -------- Charts -------- */
let wtpChart=null, endorseChart=null, combinedChart=null, qalyChart=null;
const PUB_COLORS = ["#2a76d2","#009688","#f39c12","#e74c3c","#7f8c8d","#8e44ad","#27ae60","#d35400","#16a085","#c0392b"];

function renderWTPChart(){
  const ctx = document.getElementById("wtpChartMain").getContext("2d");
  if(wtpChart) wtpChart.destroy();

  const labels = Object.keys(WTP).map(k=>k.replace(/_/g," "));
  const dataVals = Object.values(WTP);

  wtpChart = new Chart(ctx,{
    type:'bar',
    data:{
      labels,
      datasets:[{
        label:"Marginal WTP (₹)",
        data:dataVals,
        backgroundColor: PUB_COLORS.slice(0,dataVals.length),
        borderColor: "#243447",
        borderWidth:1
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      scales:{y:{beginAtZero:true}},
      plugins:{
        legend:{display:false},
        title:{display:true,text:"Marginal WTP (₹)",font:{size:18,weight:'600'}}
      }
    }
  });
}

function renderEndorseChart(sc=null){
  const canvas = document.getElementById("endorseChart");
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  if(endorseChart) endorseChart.destroy();

  const scenario = sc || buildScenario();
  if(!scenario) return;

  const p = endorsementProb(scenario)*100;
  endorseChart = new Chart(ctx,{
    type:"doughnut",
    data:{
      labels:["Endorse","Not Endorse"],
      datasets:[{
        data:[p,100-p],
        backgroundColor:[PUB_COLORS[0], "#cccccc"],
        borderColor:"#ffffff",
        borderWidth:2
      }]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{
        title:{display:true,text:`Predicted Endorsement: ${p.toFixed(1)}%`,font:{size:18,weight:'600'}},
        tooltip:{callbacks:{label:(c)=>`${c.label}: ${c.parsed.toFixed(1)}%`}}
      }
    }
  });
}

function renderCostsBenefits(sc=null, endorsePct=null, totWTP=null, totCost=null, bcr=null, net=null, endorseShare=null){
  const container = document.getElementById("costsBenefitsResults");
  if(!container) return;

  const s = sc || buildScenario();
  if(!s) return;

  const eShare = endorseShare!==null?endorseShare:endorsementProb(s);
  const e = endorsePct!==null?endorsePct:eShare*100;
  const w = totWTP!==null?totWTP:scenarioWTP(s,eShare);
  const c = totCost!==null?totCost:scenarioCost(s,eShare);
  const b = bcr!==null?bcr:(w/c);
  const n = net!==null?net:(w-c);

  container.innerHTML = `
    <div class="calculation-info">
      <p><strong>Endorsement:</strong> ${e.toFixed(1)}%</p>
      <p><strong>Total WTP:</strong> ₹${formatINR(w)}</p>
      <p><strong>Total Cost:</strong> ₹${formatINR(c)}</p>
      <p><strong>BCR:</strong> ${b.toFixed(2)} ${b<1?'<span style="color:#e74c3c">(BCR &lt; 1)</span>':''}</p>
      <p><strong>Net Benefit:</strong> ₹${formatINR(n)}</p>
    </div>
    <div><canvas id="combinedChart"></canvas></div>
  `;

  // Cost breakdown
  const listDiv = document.getElementById("detailedCostBreakdown");
  listDiv.innerHTML = "";
  const mType  = MULTIPLIERS.ptype[s.ptype];
  const mDur   = MULTIPLIERS.duration[s.duration];
  const mMode  = MULTIPLIERS.mode_cost_adj[s.mode];
  const mFocus = MULTIPLIERS.focus_cost_adj[s.focus];
  const mResp  = MULTIPLIERS.resp_cost_adj[s.resp];
  const overallMult = mType*mDur*mMode*mFocus*mResp;
  const endorsedTrainees = s.capacity * eShare;

  // Fixed components
  Object.entries(BASE_COSTS).forEach(([key,val])=>{
    const calc = val*overallMult;
    addCostCard(listDiv, key, calc, false);
  });
  // Per trainee (endorsed)
  Object.entries(PER_TRAINEE).forEach(([key,val])=>{
    const calc = val*endorsedTrainees*mType*mDur*mFocus;
    addCostCard(listDiv, key, calc, true);
  });
  // MoH cost slider (all trainees)
  const moh = s.costPerTM * (+s.duration) * s.capacity;
  addCostCard(listDiv, "moh_training_cost", moh, true, "MoH Training Cost (slider)");

  // Combined chart
  const ctx = document.getElementById("combinedChart").getContext("2d");
  if(combinedChart) combinedChart.destroy();
  combinedChart = new Chart(ctx,{
    type:'bar',
    data:{
      labels:["Total Cost","Total WTP","Net Benefit"],
      datasets:[{
        label:"₹",
        data:[c,w,n],
        backgroundColor:[PUB_COLORS[3],PUB_COLORS[1],PUB_COLORS[2]],
        borderColor:"#243447",
        borderWidth:1
      }]
    },
    options:{
      responsive:true,
      plugins:{
        legend:{display:false},
        title:{display:true,text:"Cost–Benefit Summary (₹)",font:{size:18,weight:'600'}}
      },
      scales:{y:{beginAtZero:true}}
    }
  });
}

function addCostCard(container, key, val, perT, labelOverride){
  const nice = key.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
  const card=document.createElement("div");
  card.className="cost-card";
  card.innerHTML = `<h4>${labelOverride||nice}</h4>
                    <p>${perT?"Per trainee component":"Fixed component"}</p>
                    <p><strong>₹ ${formatINR(val)}</strong></p>`;
  container.appendChild(card);
}

function toggleCostBreakdown(){
  const el=document.getElementById("detailedCostBreakdown");
  el.style.display = (el.style.display==="none"||el.style.display==="") ? "flex":"none";
}

/* -------- QALY Tab -------- */
function renderQALY(){
  const sc = buildScenario();
  if(!sc) return;

  const endorseShare = endorsementProb(sc);
  const qalyPerTrainee = parseFloat(document.getElementById("qalyPerTrainee").value);
  const threshold = +document.getElementById("threshold").value;

  const totalCost = scenarioCost(sc, endorseShare);
  const totalQALY = scenarioQALY(sc, endorseShare, qalyPerTrainee);
  const icer = totalCost/totalQALY;

  const div=document.getElementById("qalyResults");
  div.innerHTML = `
    <div class="calculation-info">
      <p><strong>Total QALYs:</strong> ${totalQALY.toFixed(2)}</p>
      <p><strong>Total Cost:</strong> ₹${formatINR(totalCost)}</p>
      <p><strong>ICER:</strong> ₹${formatINR(icer)} per QALY</p>
      <p><strong>Threshold:</strong> ₹${formatINR(threshold)} / QALY – ${icer<=threshold?'<span style="color:#27ae60">Cost-effective</span>':'<span style="color:#e74c3c">Not cost-effective</span>'}</p>
    </div>
  `;

  const ctx=document.getElementById("qalyChart").getContext("2d");
  if(qalyChart) qalyChart.destroy();
  qalyChart=new Chart(ctx,{
    type:"bar",
    data:{
      labels:["ICER","Threshold"],
      datasets:[{
        label:"₹/QALY",
        data:[icer,threshold],
        backgroundColor:[PUB_COLORS[0],PUB_COLORS[4]],
        borderColor:"#243447",
        borderWidth:1
      }]
    },
    options:{
      responsive:true,
      plugins:{
        legend:{display:false},
        title:{display:true,text:"ICER vs Threshold",font:{size:18,weight:'600'}}
      },
      scales:{y:{beginAtZero:true}}
    }
  });
}

/* -------- Scenario storage -------- */
let savedScenarios=[];
function saveScenario(){
  const sc = buildScenario();
  if(!sc) return;

  const endorseShare = endorsementProb(sc);
  const endorse = endorseShare*100;
  const totalWTP = scenarioWTP(sc, endorseShare);
  const totalCost = scenarioCost(sc, endorseShare);
  const bcr = totalWTP/totalCost;
  const net = totalWTP-totalCost;

  const qalyPerTrainee = parseFloat(document.getElementById("qalyPerTrainee").value || "0.03");
  const totalQALY = scenarioQALY(sc, endorseShare, qalyPerTrainee);
  const icer = totalCost/totalQALY;

  const obj = {...sc, endorse, totalWTP, totalCost, bcr, net, icer, name:`Scenario ${savedScenarios.length+1}`};
  savedScenarios.push(obj);
  appendScenarioRow(obj);
  alert(`Saved ${obj.name}.`);
}

function appendScenarioRow(s){
  const tbody=document.querySelector("#scenarioTable tbody");
  const tr=document.createElement("tr");
  const cols=["name","ptype","duration","focus","mode","resp","capacity","costPerTM","stakeholders",
              "endorse","totalWTP","totalCost","bcr","net","icer"];
  cols.forEach(c=>{
    const td=document.createElement("td");
    let val=s[c];
    if(["totalWTP","totalCost","net","costPerTM","icer"].includes(c)) val="₹"+formatINR(val);
    if(c==="bcr") val=s[c].toFixed(2);
    if(c==="endorse") val=s[c].toFixed(1)+"%";
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

  savedScenarios.forEach((s,i)=>{
    if(y>275){doc.addPage();y=15;}
    doc.setFontSize(12);
    doc.text(`${s.name}`,15,y); y+=5;
    const lines=[
      `Type:${s.ptype} Dur:${s.duration}m Focus:${s.focus} Mode:${s.mode} Resp:${s.resp}d`,
      `Cap:${s.capacity} ₹/T/M:${formatINR(s.costPerTM)} Stakeh:${s.stakeholders}`,
      `Endorse:${s.endorse.toFixed(1)}%  WTP:₹${formatINR(s.totalWTP)}  Cost:₹${formatINR(s.totalCost)}`,
      `BCR:${s.bcr.toFixed(2)}  Net:₹${formatINR(s.net)}  ICER:₹${formatINR(s.icer)}/QALY`
    ];
    lines.forEach(t=>{doc.text(t,15,y);y+=5;});
    y+=3;
  });
  doc.save("FETP_Scenarios.pdf");
}

/* -------- Modal -------- */
function openModal(){ document.getElementById("resultModal").style.display="block"; }
function closeModal(){ document.getElementById("resultModal").style.display="none"; }

/* -------- Helpers -------- */
function formatINR(num){
  return Math.round(num).toString().replace(/\B(?=(\d{2})+(?!\d))/g, ",");
}
