// script.js
/**************************************************************************
 * FETP India Decision Aid Tool
 * - Placeholder coefficients for WTP & endorsement (update when DCE ready)
 * - Benefits = Total WTP (₹), Costs = detailed cost model
 * - BCR, Net Benefit, warnings, charts, scenario saving
 **************************************************************************/

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".tablink").forEach(btn =>
    btn.addEventListener("click", function(){ openTab(this.getAttribute("data-tab"), this); })
  );
  openTab("introTab", document.querySelector(".tablink"));
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

/* -------- Placeholder Coefficients --------
   Utility (endorsement) model: logit on endorsement yes/no
   U = β0 + β_type* + β_dur* + β_focus* + β_mode* + β_resp* + β_cost*cost
   (All β are placeholders.) */
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
  cost_perT_perM: -0.00001 // utility drop per ₹1 increase
};

/* Marginal WTP in ₹ (placeholder). Each is relative to the reference level. */
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

/* Cost components (₹ per year unless noted). Adjust these realistically as needed. */
const COST_COMPONENTS = [
  { major:"Direct", category:"Salary & Benefits", sub:"In-Country Program Staff", desc:"Local staff (faculty/secretariat) salaries & benefits", value: 18000000 },
  { major:"Direct", category:"Salary & Benefits", sub:"Other (consultants/advisors)", desc:"External consultants and advisors", value: 5000000 },
  { major:"Direct", category:"Equipment & Supplies", sub:"Office Equipment", desc:"Computers, projectors, printers, etc.", value: 1500000 },
  { major:"Direct", category:"Equipment & Supplies", sub:"Office Software", desc:"Software licenses (analysis, LMS, office)", value: 600000 },
  { major:"Direct", category:"Facilities", sub:"Rent & Utilities", desc:"Office rent, electricity, internet", value: 2400000 },
  { major:"Direct", category:"Trainee Support", sub:"Allowances", desc:"Stipends/scholarships", value_per_trainee: 150000 }, // /trainee/year
  { major:"Direct", category:"Trainee Support", sub:"Trainee Equipment", desc:"Laptops, dongles, etc.", value_per_trainee: 40000 },
  { major:"Direct", category:"Trainee Support", sub:"Trainee Software", desc:"Software for trainees", value_per_trainee: 8000 },
  { major:"Direct", category:"Training", sub:"Materials", desc:"Printing manuals/other resources", value_per_trainee: 5000 },
  { major:"Direct", category:"Training", sub:"Workshops & Seminars", desc:"Venue, catering, logistics", value: 2000000 },
  { major:"Direct", category:"Travel", sub:"In-Country Travel", desc:"Faculty/trainee travel & per diems", value: 3500000 },
  { major:"Direct", category:"Travel", sub:"International Travel", desc:"Conferences/outbreak assistance", value: 1200000 },
  { major:"Direct", category:"Other", sub:"Miscellaneous direct", desc:"Other direct programme expenses", value: 800000 },

  { major:"Indirect", category:"Administrative Support", sub:"Management & Oversight", desc:"Senior management salaries (shared)", value: 3000000 },
  { major:"Indirect", category:"Administrative Support", sub:"Office Maintenance", desc:"General office maintenance", value: 600000 },
  { major:"Indirect", category:"In-kind", sub:"Salary (trainers/mentors)", desc:"In-kind support not directly costed", value: 2000000 },
  { major:"Indirect", category:"Infrastructure", sub:"Facility Upgrades", desc:"Upgrading/maintaining training facilities", value: 1000000 },
  { major:"Indirect", category:"Infrastructure", sub:"Equipment Depreciation", desc:"Depreciation of high-value equipment", value: 500000 },
  { major:"Indirect", category:"Utilities", sub:"Shared Services", desc:"Security, cleaning, shared internet", value: 700000 },
  { major:"Indirect", category:"Professional Services", sub:"Legal & Financial", desc:"Auditing, compliance, contracts", value: 400000 },
  { major:"Indirect", category:"Training & Capacity", sub:"Staff Development", desc:"Upskilling non-trainee staff", value: 900000 },
  { major:"Indirect", category:"Opportunity cost", sub:"Trainee salary foregone", desc:"Income trainees could earn", value_per_trainee: 180000 },
  { major:"Indirect", category:"Other indirect", sub:"Miscellaneous indirect", desc:"Other indirect programme costs", value: 500000 }
];

/* -------- Build scenario from inputs -------- */
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
    warn.push("Fully online with Advanced or One Health focus may be unrealistic. Consider Hybrid/In-person.");
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

/* -------- Total WTP -------- */
function scenarioWTP(sc){
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
  // Multiply by stakeholders to get aggregate
  return tot * sc.stakeholders;
}

/* -------- Costs -------- */
function scenarioCost(sc){
  // Split components into per trainee and fixed
  let total = 0;
  COST_COMPONENTS.forEach(c=>{
    if(typeof c.value_per_trainee!=="undefined"){
      total += c.value_per_trainee * sc.capacity;
    }else{
      total += c.value;
    }
  });
  // Add MoH training cost: costPerTM * months * capacity
  total += sc.costPerTM * (+sc.duration) * sc.capacity;
  return total;
}

/* -------- Calculate & populate -------- */
function calculateAll(){
  const sc = buildScenario();
  if(!sc) return;

  const endorse = endorsementProb(sc)*100;
  const totalWTP = scenarioWTP(sc);
  const totalCost = scenarioCost(sc);
  const bcr = totalWTP/totalCost;
  const net = totalWTP-totalCost;

  // Modal
  const rec = recommendation(sc, endorse, bcr);
  document.getElementById("modalResults").innerHTML = `
    <h4>Results</h4>
    <p><strong>Endorsement:</strong> ${endorse.toFixed(1)}%</p>
    <p><strong>Total WTP:</strong> ₹${formatINR(totalWTP)}</p>
    <p><strong>Total Cost:</strong> ₹${formatINR(totalCost)}</p>
    <p><strong>BCR:</strong> ${bcr.toFixed(2)}</p>
    <p><strong>Net Benefit:</strong> ₹${formatINR(net)}</p>
    <p>${rec}</p>`;
  openModal();

  // Update charts/tabs content
  renderWTPChart(sc);
  renderEndorseChart(sc);
  renderCostsBenefits(sc, endorse, totalWTP, totalCost, bcr, net);
}

/* -------- Recommendation text -------- */
function recommendation(sc, endorse, bcr){
  if(endorse>=70 && bcr>=1) return "High endorsement and value-for-money. Configuration is strong.";
  let r="Consider adjustments: ";
  if(endorse<50) r+="boost practical components or shorten duration; ";
  if(bcr<1) r+="reduce costly features or target higher response capacity to raise WTP; ";
  if(sc.mode==="online" && (sc.ptype==="advanced"||sc.focus==="onehealth")) r+="switch from fully online to hybrid/in-person; ";
  return r;
}

/* -------- Charts -------- */
let wtpChart=null, endorseChart=null, combinedChart=null;

function renderWTPChart(sc=null){
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
        borderWidth:1
      }]
    },
    options:{
      responsive:true,
      scales:{y:{beginAtZero:true}},
      plugins:{legend:{display:false},title:{display:true,text:"Marginal WTP (₹)"}}
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
      datasets:[{data:[p,100-p]}]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{
        title:{display:true,text:`Predicted Endorsement: ${p.toFixed(1)}%`},
        tooltip:{callbacks:{label:(c)=>`${c.label}: ${c.parsed.toFixed(1)}%`}}
      }
    }
  });
}

function renderCostsBenefits(sc=null, endorse=null, totWTP=null, totCost=null, bcr=null, net=null){
  const container = document.getElementById("costsBenefitsResults");
  if(!container) return;

  const s = sc || buildScenario();
  if(!s) return;

  const e = endorse!==null?endorse:(endorsementProb(s)*100);
  const w = totWTP!==null?totWTP:scenarioWTP(s);
  const c = totCost!==null?totCost:scenarioCost(s);
  const b = bcr!==null?bcr:(w/c);
  const n = net!==null?net:(w-c);

  container.innerHTML = `
    <div class="calculation-info">
      <p><strong>Endorsement:</strong> ${e.toFixed(1)}%</p>
      <p><strong>Total WTP:</strong> ₹${formatINR(w)}</p>
      <p><strong>Total Cost:</strong> ₹${formatINR(c)}</p>
      <p><strong>BCR:</strong> ${b.toFixed(2)} ${b<1?'<span style="color:#dc3545">(BCR < 1)</span>':''}</p>
      <p><strong>Net Benefit:</strong> ₹${formatINR(n)}</p>
    </div>
    <div><canvas id="combinedChart"></canvas></div>
  `;

  // Fill cost breakdown list
  const listDiv = document.getElementById("detailedCostBreakdown");
  listDiv.innerHTML = "";
  COST_COMPONENTS.forEach(item=>{
    const val = typeof item.value_per_trainee!=="undefined"
      ? item.value_per_trainee*s.capacity
      : item.value;
    const el = document.createElement("div");
    el.className="cost-card";
    el.innerHTML = `<h4>${item.category} – ${item.sub}</h4>
                    <p><strong>${item.major}</strong></p>
                    <p>${item.desc}</p>
                    <p><strong>₹ ${formatINR(val)}</strong></p>`;
    listDiv.appendChild(el);
  });

  const ctx = document.getElementById("combinedChart").getContext("2d");
  if(combinedChart) combinedChart.destroy();
  combinedChart = new Chart(ctx,{
    type:'bar',
    data:{
      labels:["Total Cost","Total WTP","Net Benefit"],
      datasets:[{
        label:"₹",
        data:[c,w,n],
        borderWidth:1
      }]
    },
    options:{
      responsive:true,
      plugins:{legend:{display:false},title:{display:true,text:"Cost–Benefit Summary"}},
      scales:{y:{beginAtZero:true}}
    }
  });
}

function toggleCostBreakdown(){
  const el=document.getElementById("detailedCostBreakdown");
  el.style.display = (el.style.display==="none"||el.style.display==="") ? "flex":"none";
}

/* -------- Scenario storage -------- */
let savedScenarios=[];
function saveScenario(){
  const sc = buildScenario();
  if(!sc) return;

  const endorse = endorsementProb(sc)*100;
  const totalWTP = scenarioWTP(sc);
  const totalCost = scenarioCost(sc);
  const bcr = totalWTP/totalCost;
  const net = totalWTP-totalCost;

  const obj = {...sc, endorse, totalWTP, totalCost, bcr, net, name:`Scenario ${savedScenarios.length+1}`};
  savedScenarios.push(obj);
  appendScenarioRow(obj);
  alert(`Saved ${obj.name}.`);
}

function appendScenarioRow(s){
  const tbody=document.querySelector("#scenarioTable tbody");
  const tr=document.createElement("tr");
  const cols=["name","ptype","duration","focus","mode","resp","capacity","costPerTM","stakeholders",
              "endorse","totalWTP","totalCost","bcr","net"];
  cols.forEach(c=>{
    const td=document.createElement("td");
    let val=s[c];
    if(["totalWTP","totalCost","net","costPerTM"].includes(c)) val="₹"+formatINR(val);
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
      `Type: ${s.ptype}, Duration: ${s.duration}m, Focus: ${s.focus}, Mode: ${s.mode}`,
      `Resp: ${s.resp}d, Capacity: ${s.capacity}, ₹/T/M: ${formatINR(s.costPerTM)}, Stakeholders: ${s.stakeholders}`,
      `Endorse: ${s.endorse.toFixed(1)}%, Total WTP: ₹${formatINR(s.totalWTP)}, Total Cost: ₹${formatINR(s.totalCost)}`,
      `BCR: ${s.bcr.toFixed(2)}, Net Benefit: ₹${formatINR(s.net)}`
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
