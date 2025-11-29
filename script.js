/* STEPS – FETP Scale Up Tool
 * Complete front end logic, using final MXL, WTP and LC Class 2 estimates.
 * All monetary calculations are in INR.
 */

/* ---------- DATA CONSTANTS ---------- */

// Mixed logit mean coefficients (preference space)
const MXL_COEFS = {
  ascOptOut: -0.601,
  tier: {
    frontline: 0.0,
    intermediate: 0.220,
    advanced: 0.487
  },
  career: {
    certificate: 0.0,
    university: 0.017,
    gov_pathway: -0.122
  },
  mentorship: {
    low: 0.0,
    medium: 0.453,
    high: 0.640
  },
  delivery: {
    blended: 0.0,
    inperson: -0.232,
    online: -1.073
  },
  response: {
    "30": 0.0,
    "15": 0.546,
    "7": 0.610
  },
  costPerThousand: -0.005 // back transformed mean cost coefficient
};

// WTP (thousand INR per trainee per month) from mixed logit
const MXL_WTP = {
  tier: {
    intermediate: 47.06,
    advanced: 103.99,
    frontline: 0
  },
  career: {
    certificate: 0,
    university: 3.69,
    gov_pathway: -26.17
  },
  mentorship: {
    low: 0,
    medium: 96.87,
    high: 136.79
  },
  delivery: {
    blended: 0,
    inperson: -49.56,
    online: -229.33
  },
  response: {
    "30": 0,
    "15": 116.70,
    "7": 130.46
  }
};

// Latent class Class 2 coefficients (training supporters)
const LC2_COEFS = {
  ascOptOut: -2.543,
  tier: {
    frontline: 0.0,
    intermediate: 0.087,
    advanced: 0.422
  },
  career: {
    certificate: 0.0,
    university: -0.024,
    gov_pathway: -0.123
  },
  mentorship: {
    low: 0.0,
    medium: 0.342,
    high: 0.486
  },
  delivery: {
    blended: 0.0,
    inperson: -0.017,
    online: -0.700
  },
  response: {
    "30": 0.0,
    "15": 0.317,
    "7": 0.504
  },
  costPerThousand: -0.001
};

// Latent class Class 2 WTP (thousand INR per trainee per month)
const LC2_WTP = {
  tier: {
    frontline: 0,
    intermediate: 63,
    advanced: 303
  },
  career: {
    certificate: 0,
    university: -18,
    gov_pathway: -88
  },
  mentorship: {
    low: 0,
    medium: 245,
    high: 349
  },
  delivery: {
    blended: 0,
    inperson: -12,
    online: -503
  },
  response: {
    "30": 0,
    "15": 228,
    "7": 362
  }
};

// Programme durations in months
const DURATION_MONTHS = {
  frontline: 3,
  intermediate: 12,
  advanced: 24
};

// Cost templates (shares of total per cohort)
const COST_TEMPLATES = {
  frontline: {
    WHO: {
      label: "Frontline - WHO template",
      // per cohort costs by component, from per cohort column
      components: {
        staffSalary: 1782451,
        otherSalary: 0,
        staffEquipment: 33333,
        staffSoftware: 3333,
        staffFacilities: 200000,
        traineeAllowances: 0,
        traineeEquipment: 0,
        traineeSoftware: 0,
        trainingMaterials: 5000,
        workshops: 890117,
        inCountryTravel: 5410417,
        intlTravel: 0,
        otherDirect: 0,
        management: 1303560,
        officeMaintenance: 80000,
        inKindSalary: 415784,
        facilityUpgrades: 66667,
        equipmentDep: 33333,
        sharedUtilities: 166667,
        professionalServices: 0,
        staffDev: 16667,
        opportunityCost: 7006465,
        otherIndirect: 0
      }
    }
  },
  intermediate: {
    WHO: {
      label: "Intermediate - WHO template",
      // Overall column from WHO rows only (interpreted as one cohort for shares)
      components: {
        staffSalary: 6571500,
        otherSalary: 0,
        staffEquipment: 200000,
        staffSoftware: 20000,
        staffFacilities: 600000,
        traineeAllowances: 0,
        traineeEquipment: 0,
        traineeSoftware: 0,
        trainingMaterials: 45000,
        workshops: 2280000,
        inCountryTravel: 11758000,
        intlTravel: 0,
        otherDirect: 34782000,
        management: 4396344,
        officeMaintenance: 240000,
        inKindSalary: 2500000,
        facilityUpgrades: 500000,
        equipmentDep: 100000,
        sharedUtilities: 500000,
        professionalServices: 0,
        staffDev: 100000,
        opportunityCost: 5707525,
        otherIndirect: 0
      }
    },
    NIE: {
      label: "Intermediate - NIE template",
      components: {
        staffSalary: 18180000,
        otherSalary: 0,
        staffEquipment: 1520000,
        staffSoftware: 7110000,
        staffFacilities: 3995000,
        traineeAllowances: 0,
        traineeEquipment: 0,
        traineeSoftware: 0,
        trainingMaterials: 0,
        workshops: 4119950,
        inCountryTravel: 138998875,
        intlTravel: 34816125,
        otherDirect: 0,
        management: 0,
        officeMaintenance: 0,
        inKindSalary: 0,
        facilityUpgrades: 0,
        equipmentDep: 0,
        sharedUtilities: 0,
        professionalServices: 0,
        staffDev: 0,
        opportunityCost: 0,
        otherIndirect: 0
      }
    },
    NCDC: {
      label: "Intermediate - NCDC template",
      components: {
        staffSalary: 0,
        otherSalary: 100000,
        staffEquipment: 0,
        staffSoftware: 100000,
        staffFacilities: 0,
        traineeAllowances: 0,
        traineeEquipment: 0,
        traineeSoftware: 0,
        trainingMaterials: 100000,
        workshops: 500000,
        inCountryTravel: 2000000,
        intlTravel: 0,
        otherDirect: 100000,
        management: 6000000,
        officeMaintenance: 0,
        inKindSalary: 0,
        facilityUpgrades: 0,
        equipmentDep: 0,
        sharedUtilities: 0,
        professionalServices: 0,
        staffDev: 100000,
        opportunityCost: 0,
        otherIndirect: 0
      }
    }
  },
  advanced: {
    NIE: {
      label: "Advanced - NIE template",
      components: {
        staffSalary: 15660000,
        otherSalary: 0,
        staffEquipment: 1020000,
        staffSoftware: 4310000,
        staffFacilities: 6375000,
        traineeAllowances: 0,
        traineeEquipment: 0,
        traineeSoftware: 0,
        trainingMaterials: 0,
        workshops: 2441200,
        inCountryTravel: 97499500,
        intlTravel: 83300000,
        otherDirect: 731000,
        management: 0,
        officeMaintenance: 0,
        inKindSalary: 0,
        facilityUpgrades: 0,
        equipmentDep: 1000000,
        sharedUtilities: 1000000,
        professionalServices: 0,
        staffDev: 200000,
        opportunityCost: 0,
        otherIndirect: 0
      }
    },
    NCDC: {
      label: "Advanced - NCDC template",
      components: {
        staffSalary: 12000000,
        otherSalary: 0,
        staffEquipment: 2000000,
        staffSoftware: 1000000,
        staffFacilities: 0,
        traineeAllowances: 25000000,
        traineeEquipment: 1000000,
        traineeSoftware: 500000,
        trainingMaterials: 500000,
        workshops: 3000000,
        inCountryTravel: 10000000,
        intlTravel: 0,
        otherDirect: 500000,
        management: 20000000,
        officeMaintenance: 0,
        inKindSalary: 0,
        facilityUpgrades: 0,
        equipmentDep: 0,
        sharedUtilities: 0,
        professionalServices: 0,
        staffDev: 0,
        opportunityCost: 0,
        otherIndirect: 0
      }
    }
  }
};

/* ---------- STATE ---------- */

let charts = {
  endorsement: null,
  costBenefit: null,
  sim: null,
  sensitivity: null
};

let savedScenarios = [];

/* ---------- HELPERS ---------- */

function formatINR(value) {
  if (isNaN(value)) return "INR 0";
  const rounded = Math.round(value);
  return "INR " + rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatPercent(p) {
  if (isNaN(p)) return "0 %";
  return p.toFixed(1) + " %";
}

function bound(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getDuration(tier) {
  return DURATION_MONTHS[tier] || 12;
}

function getCostTemplateOptions(tier) {
  const configs = COST_TEMPLATES[tier];
  return Object.entries(configs).map(([key, cfg]) => ({ key, label: cfg.label }));
}

function computeTemplateShares(tier, templateKey) {
  const cfg = COST_TEMPLATES[tier][templateKey];
  const comps = cfg.components;
  const total = Object.values(comps).reduce((s, v) => s + v, 0);
  const shares = {};
  Object.entries(comps).forEach(([k, v]) => {
    shares[k] = total > 0 ? v / total : 0;
  });
  return { label: cfg.label, shares };
}

/* ---------- MODEL CALCULATIONS ---------- */

function getModelConfig() {
  const tier = document.getElementById("programmeTier").value;
  const career = document.getElementById("careerIncentive").value;
  const mentorship = document.getElementById("mentorship").value;
  const delivery = document.getElementById("deliveryMode").value;
  const response = document.getElementById("responseTime").value;
  const model = document.getElementById("prefModel").value;
  const costPerTrainee = parseFloat(document.getElementById("costPerTrainee").value);
  const trainees = parseInt(document.getElementById("traineesPerCohort").value, 10);
  const cohorts = parseInt(document.getElementById("numCohorts").value, 10);
  const templateKey = document.getElementById("costTemplate").value;
  const oppCostOn = document.getElementById("oppCostToggle").classList.contains("on");
  return {
    tier,
    career,
    mentorship,
    delivery,
    response,
    model,
    costPerTrainee,
    trainees,
    cohorts,
    templateKey,
    oppCostOn
  };
}

function updateConfigSummary(cfg) {
  const tierLabel = {
    frontline: "Frontline (3 months)",
    intermediate: "Intermediate (12 months)",
    advanced: "Advanced (24 months)"
  }[cfg.tier];

  const mentorshipLabel = {
    low: "Low",
    medium: "Medium",
    high: "High"
  }[cfg.mentorship];

  const deliveryLabel = {
    blended: "Blended",
    inperson: "Fully in person",
    online: "Fully online"
  }[cfg.delivery];

  const responseLabel = {
    "30": "Within 30 days",
    "15": "Within 15 days",
    "7": "Within 7 days"
  }[cfg.response];

  const modelLabel = cfg.model === "mxl" ? "Average mixed logit" : "Supportive latent class group";

  const templateCfg = COST_TEMPLATES[cfg.tier][cfg.templateKey];
  const templateLabel = templateCfg ? templateCfg.label : "";

  document.getElementById("summaryTier").textContent = tierLabel;
  document.getElementById("summaryIncentive").textContent = cfg.career === "certificate"
    ? "Government and partner certificate"
    : cfg.career === "university"
      ? "University qualification"
      : "Government career pathway";
  document.getElementById("summaryMentorship").textContent = mentorshipLabel;
  document.getElementById("summaryDelivery").textContent = deliveryLabel;
  document.getElementById("summaryResponse").textContent = responseLabel;
  document.getElementById("summaryModel").textContent = modelLabel;
  document.getElementById("summaryTrainees").textContent = cfg.trainees;
  document.getElementById("summaryCohorts").textContent = cfg.cohorts;
  document.getElementById("summaryCostPerTrainee").textContent = formatINR(cfg.costPerTrainee);
  document.getElementById("summaryTemplate").textContent = templateLabel;
}

function getCoefficients(modelKey) {
  return modelKey === "mxl" ? MXL_COEFS : LC2_COEFS;
}

function getWtpTable(modelKey) {
  return modelKey === "mxl" ? MXL_WTP : LC2_WTP;
}

function computeNonCostUtility(cfg, coefs) {
  const uTier = coefs.tier[cfg.tier] || 0;
  const uCareer = coefs.career[cfg.career] || 0;
  const uMentor = coefs.mentorship[cfg.mentorship] || 0;
  const uDelivery = coefs.delivery[cfg.delivery] || 0;
  const uResponse = coefs.response[cfg.response] || 0;
  return uTier + uCareer + uMentor + uDelivery + uResponse;
}

function computeEndorsement(cfg) {
  const coefs = getCoefficients(cfg.model);
  const nonCostU = computeNonCostUtility(cfg, coefs);
  const costThousand = cfg.costPerTrainee / 1000;
  const vProgram = nonCostU + coefs.costPerThousand * costThousand;
  const vOpt = coefs.ascOptOut;
  const expProg = Math.exp(vProgram);
  const expOpt = Math.exp(vOpt);
  const endorse = expProg / (expProg + expOpt);
  return {
    endorse,
    optout: 1 - endorse,
    vProgram,
    vOpt
  };
}

function computeIndicativeWtpPerTraineePerMonth(cfg) {
  const wtp = getWtpTable(cfg.model);
  const tierVal = wtp.tier[cfg.tier] || 0;
  const careerVal = wtp.career[cfg.career] || 0;
  const mentorVal = wtp.mentorship[cfg.mentorship] || 0;
  const deliveryVal = wtp.delivery[cfg.delivery] || 0;
  const responseVal = wtp.response[cfg.response] || 0;
  const totalThousand = tierVal + careerVal + mentorVal + deliveryVal + responseVal;
  return totalThousand * 1000; // rupees per trainee per month
}

function computeCostsAndBenefits(cfg) {
  const endorseInfo = computeEndorsement(cfg);
  const endorse = endorseInfo.endorse;

  const durationMonths = getDuration(cfg.tier);
  const completionRate = parseFloat(document.getElementById("completionRate").value) / 100;
  const oppCostPerMonth = parseFloat(document.getElementById("oppCostPerMonth").value);

  const graduatesPerCohort = cfg.trainees * completionRate;
  const totalGraduates = graduatesPerCohort * cfg.cohorts;

  const programmeCostPerCohort =
    cfg.costPerTrainee * durationMonths * cfg.trainees;

  const oppCostPerCohort = cfg.oppCostOn
    ? oppCostPerMonth * durationMonths * cfg.trainees
    : 0;

  const totalCostPerCohort = programmeCostPerCohort + oppCostPerCohort;
  const totalCostAllCohorts = totalCostPerCohort * cfg.cohorts;

  const wtpPerTraineePerMonth = computeIndicativeWtpPerTraineePerMonth(cfg);
  const benefitPerCohort =
    wtpPerTraineePerMonth * durationMonths * graduatesPerCohort * endorse;
  const totalBenefitAllCohorts = benefitPerCohort * cfg.cohorts;

  const netBenefit = totalBenefitAllCohorts - totalCostAllCohorts;
  const bcr = totalCostAllCohorts > 0
    ? totalBenefitAllCohorts / totalCostAllCohorts
    : 0;

  const responsesPerGradPerYear =
    parseFloat(document.getElementById("multiplierResponses").value);
  const valuePerResponse =
    parseFloat(document.getElementById("valuePerResponse").value);

  const outbreakResponsesPerYear =
    totalGraduates * responsesPerGradPerYear * endorse;
  const epiBenefitPerYear = outbreakResponsesPerYear * valuePerResponse;

  return {
    endorse,
    optout: endorseInfo.optout,
    graduatesPerCohort,
    totalGraduates,
    durationMonths,
    programmeCostPerCohort,
    oppCostPerCohort,
    totalCostPerCohort,
    totalCostAllCohorts,
    wtpPerTraineePerMonth,
    benefitPerCohort,
    totalBenefitAllCohorts,
    netBenefit,
    bcr,
    outbreakResponsesPerYear,
    epiBenefitPerYear
  };
}

/* ---------- UI UPDATE FUNCTIONS ---------- */

function updateCostTemplateSelect() {
  const tier = document.getElementById("programmeTier").value;
  const select = document.getElementById("costTemplate");
  const options = getCostTemplateOptions(tier);
  select.innerHTML = "";
  options.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o.key;
    opt.textContent = o.label;
    select.appendChild(opt);
  });
}

function updateCostSliderLabel() {
  const slider = document.getElementById("costPerTrainee");
  const label = document.getElementById("costPerTraineeLabel");
  label.textContent = formatINR(parseFloat(slider.value));
}

function updateMetrics() {
  const cfg = getModelConfig();
  updateConfigSummary(cfg);
  const res = computeCostsAndBenefits(cfg);

  document.getElementById("metricEndorse").textContent =
    formatPercent(res.endorse * 100);
  document.getElementById("metricOptout").textContent =
    formatPercent(res.optout * 100);
  document.getElementById("metricGraduates").textContent =
    res.totalGraduates.toFixed(0);
  document.getElementById("metricOutbreaks").textContent =
    res.outbreakResponsesPerYear.toFixed(1);
  document.getElementById("metricBenefitPerCohort").textContent =
    formatINR(res.benefitPerCohort);
  document.getElementById("metricTotalCost").textContent =
    formatINR(res.totalCostAllCohorts);
  document.getElementById("metricTotalBenefit").textContent =
    formatINR(res.totalBenefitAllCohorts);
  document.getElementById("metricBcr").textContent =
    res.bcr.toFixed(2);
  document.getElementById("metricNetBenefit").textContent =
    formatINR(res.netBenefit);

  const headline = document.getElementById("headlineRecommendation");
  if (res.bcr > 1.1 && res.endorse > 0.6) {
    headline.textContent =
      "This configuration yields strong endorsement and benefits that exceed costs. It is a good candidate for national scale up, especially if funding can support the selected mentorship and response capacity.";
  } else if (res.bcr > 1 && res.endorse >= 0.4) {
    headline.textContent =
      "Benefits slightly exceed costs and endorsement is moderate. This configuration could be pursued where budgets allow, but consider strengthening mentorship or response targets to maximise returns.";
  } else {
    headline.textContent =
      "At current cost and design, both net benefits and endorsement are modest. Consider moving towards Intermediate or Advanced with stronger mentorship or reducing costs before scaling up.";
  }

  updateCharts(res);
  updateCostingDetails(cfg, res);
  updateSimulationCharts(cfg, res);
  updateAssumptionLog();
}

function updateCharts(res) {
  const endorseCtx = document.getElementById("endorsementChart");
  const cbCtx = document.getElementById("costBenefitChart");

  if (charts.endorsement) charts.endorsement.destroy();
  if (charts.costBenefit) charts.costBenefit.destroy();

  charts.endorsement = new Chart(endorseCtx, {
    type: "bar",
    data: {
      labels: ["Endorse", "Opt out"],
      datasets: [{
        data: [res.endorse * 100, res.optout * 100]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ctx.parsed.y.toFixed(1) + " %"
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { callback: v => v + " %" }
        }
      }
    }
  });

  charts.costBenefit = new Chart(cbCtx, {
    type: "bar",
    data: {
      labels: ["Cost per cohort", "Benefit per cohort"],
      datasets: [{
        data: [res.totalCostPerCohort, res.benefitPerCohort]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => formatINR(ctx.parsed.y)
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: v => "₹" + (v / 1e6).toFixed(1) + "m"
          }
        }
      }
    }
  });
}

function updateCostingDetails(cfg, res) {
  const { label, shares } = computeTemplateShares(cfg.tier, cfg.templateKey);
  const container = document.getElementById("costComponentCards");
  container.innerHTML = "";
  document.getElementById("costTemplateName").textContent = label;
  document.getElementById("costPerCohortLabel").textContent =
    formatINR(res.totalCostPerCohort);

  const groups = [
    {
      title: "Staff salaries and benefits",
      keys: ["staffSalary", "otherSalary", "inKindSalary"]
    },
    {
      title: "Facilities and utilities",
      keys: ["staffFacilities", "officeMaintenance", "facilityUpgrades", "equipmentDep", "sharedUtilities"]
    },
    {
      title: "Equipment and software",
      keys: ["staffEquipment", "staffSoftware", "traineeEquipment", "traineeSoftware"]
    },
    {
      title: "Training and workshops",
      keys: ["trainingMaterials", "workshops", "staffDev"]
    },
    {
      title: "Travel",
      keys: ["inCountryTravel", "intlTravel"]
    },
    {
      title: "Trainee opportunity cost",
      keys: ["opportunityCost"]
    },
    {
      title: "Other direct and indirect",
      keys: ["otherDirect", "otherIndirect", "professionalServices"]
    }
  ];

  groups.forEach(group => {
    const share = group.keys.reduce((s, k) => s + (shares[k] || 0), 0);
    if (share <= 0.0001) return;
    const amount = res.totalCostPerCohort * share;
    const card = document.createElement("div");
    card.className = "cost-card";
    const pct = (share * 100).toFixed(1);
    card.innerHTML = `
      <h4>${group.title}</h4>
      <p><strong>${formatINR(amount)}</strong> per cohort</p>
      <p class="small">${pct} percent of total cohort cost</p>
    `;
    container.appendChild(card);
  });
}

function updateSimulationCharts(cfg, res) {
  const simGrad = document.getElementById("simGraduates");
  const simCost = document.getElementById("simTotalCost");
  const simBenefit = document.getElementById("simTotalBenefit");
  const simNB = document.getElementById("simNetBenefit");
  const simOutbreaks = document.getElementById("simOutbreaks");

  simGrad.textContent = res.totalGraduates.toFixed(0);
  simCost.textContent = formatINR(res.totalCostAllCohorts);
  simBenefit.textContent = formatINR(res.totalBenefitAllCohorts);
  simNB.textContent = formatINR(res.netBenefit);
  simOutbreaks.textContent = res.outbreakResponsesPerYear.toFixed(1);

  const simCtx = document.getElementById("simChart");
  const sensCtx = document.getElementById("sensitivityChart");

  if (charts.sim) charts.sim.destroy();
  if (charts.sensitivity) charts.sensitivity.destroy();

  charts.sim = new Chart(simCtx, {
    type: "bar",
    data: {
      labels: ["Total cost", "Total benefit", "Net benefit"],
      datasets: [{
        data: [res.totalCostAllCohorts, res.totalBenefitAllCohorts, res.netBenefit]
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: v => "₹" + (v / 1e9).toFixed(2) + "b"
          }
        }
      }
    }
  });

  const lowCost = res.totalCostAllCohorts * 0.8;
  const highCost = res.totalCostAllCohorts * 1.2;
  const bcrLow = lowCost > 0 ? res.totalBenefitAllCohorts / lowCost : 0;
  const bcrHigh = highCost > 0 ? res.totalBenefitAllCohorts / highCost : 0;

  charts.sensitivity = new Chart(sensCtx, {
    type: "line",
    data: {
      labels: ["−20 percent cost", "Current", "+20 percent cost"],
      datasets: [{
        data: [bcrLow, res.bcr, bcrHigh],
        tension: 0.2
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: v => v.toFixed(2) }
        }
      }
    }
  });
}

function updateAssumptionLog() {
  const responses = parseFloat(document.getElementById("multiplierResponses").value);
  const valResp = parseFloat(document.getElementById("valuePerResponse").value);
  const compRate = parseFloat(document.getElementById("completionRate").value);
  const exRate = parseFloat(document.getElementById("exchangeRate").value);
  const oppCost = parseFloat(document.getElementById("oppCostPerMonth").value);

  const now = new Date();
  const stamp = now.toISOString().slice(0, 19).replace("T", " ");

  const text = [
    "Assumption snapshot " + stamp,
    "Outbreak responses per graduate per year: " + responses,
    "Economic value per response (INR): " + valResp.toLocaleString("en-IN"),
    "Completion rate (%): " + compRate,
    "INR to USD exchange rate: " + exRate,
    "Opportunity cost per trainee per month (INR): " + oppCost.toLocaleString("en-IN")
  ].join("\n");

  document.getElementById("assumptionLog").textContent = text;
}

/* ---------- SAVED SCENARIOS ---------- */

function saveCurrentScenario() {
  const cfg = getModelConfig();
  const res = computeCostsAndBenefits(cfg);
  const name = document.getElementById("scenarioName").value.trim() || "Scenario " + (savedScenarios.length + 1);
  const tags = document.getElementById("scenarioTags").value.trim();
  const notes = document.getElementById("scenarioNotes").value.trim();

  const scenario = {
    id: Date.now(),
    name,
    tags,
    notes,
    cfg,
    res,
    shortlisted: false
  };
  savedScenarios.push(scenario);
  renderSavedScenarios();
}

function renderSavedScenarios() {
  const tbody = document.querySelector("#savedScenariosTable tbody");
  tbody.innerHTML = "";
  savedScenarios.forEach(sc => {
    const tr = document.createElement("tr");
    const endorsePct = formatPercent(sc.res.endorse * 100);
    tr.innerHTML = `
      <td><input type="checkbox" data-scenario-id="${sc.id}" class="shortlist-checkbox"${sc.shortlisted ? " checked" : ""}></td>
      <td>${sc.name}</td>
      <td>${sc.tags}</td>
      <td>${sc.cfg.tier}</td>
      <td>${sc.cfg.mentorship}</td>
      <td>${sc.cfg.cohorts}</td>
      <td>${endorsePct}</td>
      <td>${sc.res.bcr.toFixed(2)}</td>
      <td>${formatINR(sc.res.totalCostAllCohorts)}</td>
      <td>${formatINR(sc.res.totalBenefitAllCohorts)}</td>
      <td>${sc.notes}</td>
    `;
    tbody.appendChild(tr);
  });
  renderShortlistGrid();
  attachShortlistHandlers();
}

function attachShortlistHandlers() {
  const boxes = document.querySelectorAll(".shortlist-checkbox");
  boxes.forEach(box => {
    box.addEventListener("change", () => {
      const id = parseInt(box.getAttribute("data-scenario-id"), 10);
      const selected = boxes;
      const currentlyShortlisted = savedScenarios.filter(s => s.shortlisted).length;
      if (box.checked && currentlyShortlisted >= 5) {
        box.checked = false;
        return;
      }
      savedScenarios = savedScenarios.map(s =>
        s.id === id ? { ...s, shortlisted: box.checked } : s
      );
      renderShortlistGrid();
    });
  });
}

function renderShortlistGrid() {
  const grid = document.getElementById("shortlistGrid");
  grid.innerHTML = "";
  const selected = savedScenarios.filter(s => s.shortlisted);
  selected.forEach(sc => {
    const div = document.createElement("div");
    div.className = "shortlist-card";
    const tagsHtml = sc.tags
      ? sc.tags.split(";").map(t => t.trim()).filter(Boolean).map(t => `<span class="tag-pill">${t}</span>`).join(" ")
      : "";
    div.innerHTML = `
      <h4>${sc.name}</h4>
      <p><strong>Tier:</strong> ${sc.cfg.tier}, <strong>Mentorship:</strong> ${sc.cfg.mentorship}</p>
      <p><strong>Cohorts:</strong> ${sc.cfg.cohorts}, <strong>Endorsement:</strong> ${formatPercent(sc.res.endorse * 100)}</p>
      <p><strong>BCR:</strong> ${sc.res.bcr.toFixed(2)}</p>
      <p><strong>Total cost:</strong> ${formatINR(sc.res.totalCostAllCohorts)}</p>
      <p><strong>Total benefit:</strong> ${formatINR(sc.res.totalBenefitAllCohorts)}</p>
      <p>${tagsHtml}</p>
    `;
    grid.appendChild(div);
  });
}

/* ---------- EXCEL AND PDF EXPORT ---------- */

function downloadScenariosExcel() {
  if (savedScenarios.length === 0) return;
  const rows = savedScenarios.map(sc => ({
    Name: sc.name,
    Tier: sc.cfg.tier,
    Mentorship: sc.cfg.mentorship,
    Delivery: sc.cfg.delivery,
    Response: sc.cfg.response,
    Trainees_per_cohort: sc.cfg.trainees,
    Cohorts: sc.cfg.cohorts,
    Cost_per_trainee_per_month_INR: sc.cfg.costPerTrainee,
    Endorsement_percent: (sc.res.endorse * 100).toFixed(1),
    BCR: sc.res.bcr.toFixed(2),
    Total_cost_INR: sc.res.totalCostAllCohorts,
    Total_benefit_INR: sc.res.totalBenefitAllCohorts,
    Net_benefit_INR: sc.res.netBenefit,
    Tags: sc.tags,
    Notes: sc.notes
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "STEPS scenarios");
  XLSX.writeFile(wb, "steps_fetp_scenarios.xlsx");
}

async function downloadPolicyBriefPdf() {
  if (savedScenarios.length === 0) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: "p",
    unit: "pt",
    format: "a4"
  });

  const marginLeft = 50;
  let y = 60;

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(14);
  doc.text("STEPS FETP scale up brief – India", marginLeft, y);
  y += 20;

  doc.setFontSize(11);
  doc.setFont("Helvetica", "normal");
  doc.text("This brief summarises Field Epidemiology Training Program (FETP) configurations evaluated with STEPS.", marginLeft, y);
  y += 14;
  doc.text("Results combine discrete choice experiment evidence on stakeholder preferences with costing assumptions.", marginLeft, y);
  y += 14;
  doc.text("Lead contact: Mesfin Genie, PhD, Newcastle Business School, The University of Newcastle, Australia.", marginLeft, y);
  y += 14;
  doc.text("Email: mesfin.genie@newcastle.edu.au", marginLeft, y);
  y += 22;

  const scenariosToPrint = savedScenarios.filter(s => s.shortlisted).length > 0
    ? savedScenarios.filter(s => s.shortlisted)
    : savedScenarios;

  scenariosToPrint.forEach((sc, index) => {
    if (y > 740) {
      doc.addPage();
      y = 60;
    }

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.text((index + 1) + ". " + sc.name, marginLeft, y);
    y += 14;

    doc.setFont("Helvetica", "normal");
    const endorsement = (sc.res.endorse * 100).toFixed(1);
    const bcr = sc.res.bcr.toFixed(2);

    const line1 = "Tier: " + sc.cfg.tier + ", mentorship: " + sc.cfg.mentorship +
      ", delivery: " + sc.cfg.delivery + ", response: " + sc.cfg.response + ".";
    const line2 = "Cohorts: " + sc.cfg.cohorts + ", trainees per cohort: " + sc.cfg.trainees +
      ", cost per trainee per month: INR " + sc.cfg.costPerTrainee.toLocaleString("en-IN") + ".";
    const line3 = "Endorsement is about " + endorsement + " percent, with a benefit cost ratio of " + bcr + ".";
    const line4 = "Total cost is " + formatINR(sc.res.totalCostAllCohorts) +
      " and total indicative benefit is " + formatINR(sc.res.totalBenefitAllCohorts) + ".";

    doc.setFontSize(11);
    [line1, line2, line3, line4].forEach(t => {
      const split = doc.splitTextToSize(t, 500);
      doc.text(split, marginLeft, y);
      y += split.length * 13;
    });

    let recommendation;
    if (sc.res.bcr > 1.1 && sc.res.endorse > 0.6) {
      recommendation = "This configuration is attractive for scale up. It combines strong stakeholder endorsement with benefits that exceed costs. It is a good candidate for priority investment if financing is available.";
    } else if (sc.res.bcr > 1 && sc.res.endorse >= 0.4) {
      recommendation = "This configuration is broadly favourable. Benefits slightly exceed costs and endorsement is moderate. It may be suitable for phased expansion or targeted use in priority states.";
    } else {
      recommendation = "At current cost and design this configuration is not attractive. Either endorsement is low or costs dominate benefits. Consider strengthening mentorship, improving response targets or reducing costs before adopting at scale.";
    }

    y += 4;
    const recSplit = doc.splitTextToSize("Headline recommendation: " + recommendation, 500);
    doc.text(recSplit, marginLeft, y);
    y += recSplit.length * 13 + 6;

    if (sc.tags) {
      const tagsText = "Stakeholder tags: " + sc.tags;
      const tagSplit = doc.splitTextToSize(tagsText, 500);
      doc.text(tagSplit, marginLeft, y);
      y += tagSplit.length * 13 + 4;
    }

    if (sc.notes) {
      const notesText = "Scenario notes: " + sc.notes;
      const noteSplit = doc.splitTextToSize(notesText, 500);
      doc.text(noteSplit, marginLeft, y);
      y += noteSplit.length * 13 + 6;
    }

    y += 4;
  });

  y += 10;
  if (y > 740) {
    doc.addPage();
    y = 60;
  }

  doc.setFontSize(11);
  doc.setFont("Helvetica", "bold");
  doc.text("Methods summary", marginLeft, y);
  y += 14;
  doc.setFont("Helvetica", "normal");

  const methodsText = [
    "Endorsement probabilities are derived from a mixed logit model and a two class latent class model of stakeholder preferences for FETP design in India.",
    "Cost per trainee per month enters utility through a lognormal cost coefficient that ensures negative marginal utility of cost.",
    "Willingness to pay estimates in thousand rupees per trainee per month are used to translate attribute levels into indicative benefits.",
    "Programme costs are built from cost per trainee per month, duration, number of trainees and the chosen cost template, with an optional opportunity cost for trainee salaries.",
    "All values are indicative and intended for scenario comparison. Detailed assumptions are documented in the STEPS Advanced and methods tab."
  ];

  methodsText.forEach(t => {
    const split = doc.splitTextToSize(t, 500);
    doc.text(split, marginLeft, y);
    y += split.length * 13;
  });

  doc.save("steps_fetp_policy_brief.pdf");
}

/* ---------- WHAT WOULD IT TAKE SOLVER ---------- */

function solveForEndorsementTarget() {
  const cfg = getModelConfig();
  const target = parseFloat(document.getElementById("targetEndorsement").value) / 100;
  if (isNaN(target) || target <= 0 || target >= 0.99) return;

  const coefs = getCoefficients(cfg.model);
  const nonCostU = computeNonCostUtility(cfg, coefs);
  const logitTarget = Math.log(target / (1 - target));
  const costThousand = (logitTarget - nonCostU + coefs.ascOptOut) / coefs.costPerThousand;

  const minThousand = 75;
  const maxThousand = 400;
  let newCost = costThousand * 1000;
  let note = "";

  if (costThousand < minThousand || costThousand > maxThousand) {
    newCost = bound(costThousand, minThousand, maxThousand) * 1000;
    note = "The target endorsement cannot be reached by adjusting only cost within the experimental range. The slider has been set to the nearest feasible value.";
  } else {
    note = "The cost slider has been updated to the level needed to reach the target endorsement under current assumptions.";
  }

  document.getElementById("costPerTrainee").value = Math.round(newCost / 5000) * 5000;
  updateCostSliderLabel();
  updateMetrics();
  document.getElementById("whatItTakesNote").textContent = note;
}

function solveForBcrTarget() {
  const cfg = getModelConfig();
  const targetBcr = parseFloat(document.getElementById("targetBcr").value);
  if (isNaN(targetBcr) || targetBcr <= 0) return;

  const evalAtCost = cost => {
    const tmpCfg = { ...cfg, costPerTrainee: cost };
    const res = computeCostsAndBenefits(tmpCfg);
    return { bcr: res.bcr, cost };
  };

  let low = 75000;
  let high = 400000;
  let mid;
  let best = evalAtCost(cfg.costPerTrainee);

  for (let i = 0; i < 25; i++) {
    mid = (low + high) / 2;
    const resMid = evalAtCost(mid);
    best = resMid;
    if (resMid.bcr > targetBcr) {
      // higher cost tends to reduce BCR, so we move towards lower cost
      high = mid;
    } else {
      low = mid;
    }
  }

  const note = (best.cost === low || best.cost === high)
    ? "The cost required for this target BCR lies outside the experimental range. The slider has been set to the nearest feasible value."
    : "The cost slider has been updated to a level that approximates the target BCR under current assumptions.";

  document.getElementById("costPerTrainee").value = Math.round(best.cost / 5000) * 5000;
  updateCostSliderLabel();
  updateMetrics();
  document.getElementById("whatItTakesNote").textContent = note;
}

/* ---------- MODAL HANDLING ---------- */

function openResultsModal() {
  const cfg = getModelConfig();
  const res = computeCostsAndBenefits(cfg);
  const container = document.getElementById("modalScenarioSummary");
  const templateCfg = COST_TEMPLATES[cfg.tier][cfg.templateKey];

  const endorsementText = formatPercent(res.endorse * 100);
  const optoutText = formatPercent(res.optout * 100);

  const bcrClass = res.bcr >= 1 ? "highlight-positive" : "highlight-negative";
  const nbClass = res.netBenefit >= 0 ? "highlight-positive" : "highlight-negative";

  container.innerHTML = `
    <div class="modal-summary-grid">
      <div>
        <h3>Configuration</h3>
        <p><strong>Tier:</strong> ${cfg.tier}</p>
        <p><strong>Career incentive:</strong> ${cfg.career}</p>
        <p><strong>Mentorship:</strong> ${cfg.mentorship}</p>
        <p><strong>Delivery mode:</strong> ${cfg.delivery}</p>
        <p><strong>Response time:</strong> ${cfg.response} days</p>
        <p><strong>Preference model:</strong> ${cfg.model === "mxl" ? "Average mixed logit" : "Supportive latent class group"}</p>
        <p><strong>Trainees per cohort:</strong> ${cfg.trainees}</p>
        <p><strong>Cohorts:</strong> ${cfg.cohorts}</p>
        <p><strong>Cost per trainee per month:</strong> ${formatINR(cfg.costPerTrainee)}</p>
        <p><strong>Cost template:</strong> ${templateCfg ? templateCfg.label : ""}</p>
      </div>
      <div>
        <h3>Headline results</h3>
        <p><strong>Endorse FETP:</strong> ${endorsementText}</p>
        <p><strong>Choose opt out:</strong> ${optoutText}</p>
        <p><strong>Graduates (all cohorts):</strong> ${res.totalGraduates.toFixed(0)}</p>
        <p><strong>Outbreak responses per year:</strong> ${res.outbreakResponsesPerYear.toFixed(1)}</p>
        <p><strong>Total cost:</strong> ${formatINR(res.totalCostAllCohorts)}</p>
        <p><strong>Total benefit:</strong> ${formatINR(res.totalBenefitAllCohorts)}</p>
        <p><strong>Benefit cost ratio:</strong> <span class="${bcrClass}">${res.bcr.toFixed(2)}</span></p>
        <p><strong>Net benefit:</strong> <span class="${nbClass}">${formatINR(res.netBenefit)}</span></p>
      </div>
    </div>
  `;

  document.getElementById("resultsModal").classList.remove("hidden");
}

function closeResultsModal() {
  document.getElementById("resultsModal").classList.add("hidden");
}

function openTourModal() {
  document.getElementById("tourModal").classList.remove("hidden");
}

function closeTourModal() {
  document.getElementById("tourModal").classList.add("hidden");
}

/* ---------- TAB HANDLING ---------- */

function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });
  document.querySelectorAll(".tab-section").forEach(sec => {
    sec.classList.toggle("active", sec.id === "tab-" + tabName);
  });
}

/* ---------- INIT ---------- */

document.addEventListener("DOMContentLoaded", () => {
  // Initialise cost template options based on default tier
  updateCostTemplateSelect();
  updateCostSliderLabel();

  // Set default toggle state
  const oppToggle = document.getElementById("oppCostToggle");
  oppToggle.classList.add("on");

  // Tab clicks
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.tab);
    });
  });

  // Configuration listeners
  document.getElementById("programmeTier").addEventListener("change", () => {
    updateCostTemplateSelect();
    updateMetrics();
  });
  document.getElementById("careerIncentive").addEventListener("change", updateMetrics);
  document.getElementById("mentorship").addEventListener("change", updateMetrics);
  document.getElementById("deliveryMode").addEventListener("change", updateMetrics);
  document.getElementById("responseTime").addEventListener("change", updateMetrics);
  document.getElementById("prefModel").addEventListener("change", updateMetrics);
  document.getElementById("costTemplate").addEventListener("change", updateMetrics);
  document.getElementById("traineesPerCohort").addEventListener("input", updateMetrics);
  document.getElementById("numCohorts").addEventListener("input", updateMetrics);
  document.getElementById("costPerTrainee").addEventListener("input", () => {
    updateCostSliderLabel();
    updateMetrics();
  });

  oppToggle.addEventListener("click", () => {
    oppToggle.classList.toggle("on");
    if (oppToggle.classList.contains("on")) {
      oppToggle.textContent = "On";
    } else {
      oppToggle.textContent = "Off";
    }
    updateMetrics();
  });

  // Apply and view results
  document.getElementById("applyConfigBtn").addEventListener("click", updateMetrics);
  document.getElementById("viewResultsBtn").addEventListener("click", () => {
    updateMetrics();
    openResultsModal();
  });

  // What would it take
  document.getElementById("solveEndorsementBtn").addEventListener("click", solveForEndorsementTarget);
  document.getElementById("solveBcrBtn").addEventListener("click", solveForBcrTarget);

  // Saved scenarios
  document.getElementById("saveScenarioBtn").addEventListener("click", saveCurrentScenario);
  document.getElementById("downloadExcelBtn").addEventListener("click", downloadScenariosExcel);
  document.getElementById("downloadPdfBtn").addEventListener("click", downloadPolicyBriefPdf);

  // Modals
  document.getElementById("closeResultsModal").addEventListener("click", closeResultsModal);
  document.getElementById("resultsModal").addEventListener("click", e => {
    if (e.target.id === "resultsModal") closeResultsModal();
  });

  document.getElementById("startTourBtn").addEventListener("click", openTourModal);
  document.getElementById("closeTourModal").addEventListener("click", closeTourModal);
  document.getElementById("tourModal").addEventListener("click", e => {
    if (e.target.id === "tourModal") closeTourModal();
  });

  // Advanced settings
  ["multiplierResponses", "valuePerResponse", "completionRate", "exchangeRate", "oppCostPerMonth"].forEach(id => {
    document.getElementById(id).addEventListener("input", () => {
      updateAssumptionLog();
      updateMetrics();
    });
  });

  // Initial metric calculation
  updateMetrics();
  switchTab("intro");
});
