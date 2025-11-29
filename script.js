// =====================================================
// STEPS – FETP Decision Aid (India)
// Front-end logic
// =====================================================

/* -----------------------------------------------------
   1. CONSTANTS AND PARAMETERS
----------------------------------------------------- */

// Mixed logit mean coefficients (preference space)
const MXL_COEFFS = {
  ascOptOut: -0.601, // ASC-Opt-out (vs B)
  costPerThousand: -0.005, // back-transformed mean marginal disutility per ₹1,000 / month
  program: {
    frontline: 0.0,
    intermediate: 0.220,
    advanced: 0.487
  },
  career: {
    certificate: 0.0,
    uni: 0.017,
    govpath: -0.122
  },
  mentor: {
    low: 0.0,
    med: 0.453,
    high: 0.640
  },
  delivery: {
    blended: 0.0,
    inperson: -0.232,
    online: -1.073
  },
  response: {
    d30: 0.0,
    d15: 0.546,
    d7: 0.610
  },
  // WTP in thousands of INR per trainee per month (from Table 4)
  wtp: {
    program: {
      intermediate: 47.06,
      advanced: 103.99
    },
    career: {
      uni: 3.69,
      govpath: -26.17
    },
    mentor: {
      med: 96.87,
      high: 136.79
    },
    delivery: {
      inperson: -49.56,
      online: -229.33
    },
    response: {
      d15: 116.70,
      d7: 130.46
    }
  }
};

// Latent Class Class 2 (“training supporters”) coefficients
const LC2_COEFFS = {
  ascOptOut: -2.543,
  costPerThousand: -0.001,
  program: {
    frontline: 0.0,
    intermediate: 0.087,
    advanced: 0.422
  },
  career: {
    certificate: 0.0,
    uni: -0.024,
    govpath: -0.123
  },
  mentor: {
    low: 0.0,
    med: 0.342,
    high: 0.486
  },
  delivery: {
    blended: 0.0,
    inperson: -0.017,
    online: -0.700
  },
  response: {
    d30: 0.0,
    d15: 0.317,
    d7: 0.504
  }
};

// Programme durations in months (consistent with your description)
const PROGRAM_DURATION = {
  frontline: 3,
  intermediate: 12, // could be 12–15, we use 12 as a conservative base
  advanced: 24
};

// Cost template base data: direct and indirect component magnitudes (used only for shares)
// Frontline (WHO, six cohorts) – values per cohort already provided
const COST_TEMPLATE_FRONTLINE_WHO = {
  // direct costs per cohort (INR)
  direct: {
    inCountryStaff: 1782451,
    officeEquipment: 33333,
    officeSoftware: 3333,
    facilities: 200000,
    materials: 5000,
    workshops: 890117,
    inCountryTravel: 5410417
  },
  indirect: {
    management: 1303560,
    officeMaintenance: 80000,
    inKindSalary: 415784,
    facilityUpgrades: 66667,
    equipmentDep: 33333,
    sharedServices: 166667,
    staffDevelopment: 16667,
    opportunityCost: 7006465
  }
};

// Intermediate (WHO/NIE/NCDC, overall; used for shares only)
const COST_TEMPLATE_INTERMEDIATE_ALL = {
  direct: {
    inCountryStaff: 24751500,
    otherStaff: 100000,
    officeEquipment: 1720000,
    officeSoftware: 7230000,
    facilities: 4595000,
    materials: 145000,
    workshops: 6899950,
    inCountryTravel: 152756875,
    internationalTravel: 34816125,
    otherDirect: 34882000
  },
  indirect: {
    management: 10396344,
    officeMaintenance: 240000,
    inKindSalary: 2500000,
    facilityUpgrades: 500000,
    equipmentDep: 100000,
    sharedServices: 500000,
    staffDevelopment: 200000,
    opportunityCost: 5707525
  }
};

// Advanced (NIE/NCDC, overall; used for shares only)
const COST_TEMPLATE_ADVANCED_ALL = {
  direct: {
    inCountryStaff: 27660000,
    officeEquipment: 3020000,
    officeSoftware: 5310000,
    facilities: 6375000,
    traineeAllowances: 25000000,
    traineeEquipment: 1000000,
    traineeSoftware: 500000,
    materials: 500000,
    workshops: 5441200,
    inCountryTravel: 107499500,
    internationalTravel: 83300000,
    otherDirect: 1231000
  },
  indirect: {
    management: 20000000,
    equipmentDep: 1000000,
    sharedServices: 1000000,
    staffDevelopment: 200000,
    opportunityCost: 0 // not reported
  }
};

// Utility function to convert template magnitudes to shares and opportunity cost share
function buildCostShares(template) {
  const directVals = Object.values(template.direct);
  const indirectVals = Object.values(template.indirect);
  const sumDirect = directVals.reduce((a, b) => a + b, 0);
  const sumIndirect = indirectVals.reduce((a, b) => a + b, 0);
  const total = sumDirect + sumIndirect;
  const opportunity = template.indirect.opportunityCost || 0;
  const oppShare = total > 0 ? opportunity / total : 0;

  const makeShares = (obj, excludeOpp) => {
    const res = {};
    const base = Object.entries(obj)
      .filter(([k]) => !(excludeOpp && k === "opportunityCost"))
      .reduce((a, [, v]) => a + v, 0);
    Object.entries(obj).forEach(([k, v]) => {
      if (excludeOpp && k === "opportunityCost") {
        res[k] = 0;
      } else {
        res[k] = base > 0 ? v / base : 0;
      }
    });
    return res;
  };

  const sharesWithOpp = {
    direct: {},
    indirect: {}
  };
  const sharesNoOpp = {
    direct: {},
    indirect: {}
  };

  Object.entries(template.direct).forEach(([k, v]) => {
    sharesWithOpp.direct[k] = sumDirect > 0 ? v / total : 0;
    sharesNoOpp.direct[k] = sumDirect > 0 ? v / (total - opportunity || 1) : 0;
  });

  Object.entries(template.indirect).forEach(([k, v]) => {
    if (k === "opportunityCost") {
      sharesWithOpp.indirect[k] = total > 0 ? v / total : 0;
      sharesNoOpp.indirect[k] = 0;
    } else {
      sharesWithOpp.indirect[k] = sumIndirect > 0 ? v / total : 0;
      sharesNoOpp.indirect[k] = sumIndirect > 0 ? v / (total - opportunity || 1) : 0;
    }
  });

  return {
    sharesWithOpp,
    sharesNoOpp,
    oppShare
  };
}

const COST_SHARES = {
  frontline_who: buildCostShares(COST_TEMPLATE_FRONTLINE_WHO),
  intermediate_all: buildCostShares(COST_TEMPLATE_INTERMEDIATE_ALL),
  advanced_all: buildCostShares(COST_TEMPLATE_ADVANCED_ALL)
};

// Default advanced settings
const DEFAULT_ADVANCED = {
  horizonYears: 5,
  frontlineOutbreaksPerGradPerYear: 0.3,
  intermediateOutbreaksPerGradPerYear: 0.5,
  advancedOutbreaksPerGradPerYear: 0.8,
  valuePerOutbreakINR: 30000000, // one substantial outbreak response ~ 30m INR
  valuePerGraduateINR: 800000, // additional value per graduate over the horizon
  exchangeRateINRperUSD: 83,
  currencyDisplay: "INR"
};

/* -----------------------------------------------------
   2. APP STATE
----------------------------------------------------- */

const appState = {
  config: {
    tier: "frontline",
    career: "certificate",
    mentor: "low",
    delivery: "blended",
    response: "d30",
    trainees: 20,
    cohorts: 10,
    costPerTraineeMonth: 165000,
    includeOpportunityCost: true,
    costTemplateKey: "frontline_who",
    preferenceModel: "mxl",
    scenarioName: "",
    scenarioTags: "",
    scenarioNotes: ""
  },
  advanced: { ...DEFAULT_ADVANCED },
  scenarios: [],
  lastResults: null,
  charts: {
    endorsementChart: null,
    costBenefitChart: null,
    natChart: null,
    sensChart: null
  },
  tourStep: 0
};

/* -----------------------------------------------------
   3. UTILITY FUNCTIONS
----------------------------------------------------- */

function formatINR(value) {
  if (!isFinite(value)) return "–";
  const rounded = Math.round(value);
  return "INR " + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(rounded);
}

function formatINRAndUSD(value) {
  if (!isFinite(value)) return "–";
  const inr = formatINR(value);
  const usd = value / appState.advanced.exchangeRateINRperUSD;
  const usdStr = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(usd);
  return `${inr} (${usdStr})`;
}

function formatCurrency(value) {
  if (appState.advanced.currencyDisplay === "INR") {
    return formatINR(value);
  }
  return formatINRAndUSD(value);
}

function formatPercent(p) {
  if (!isFinite(p)) return "–";
  return p.toFixed(1) + "%";
}

function formatNumber(value) {
  if (!isFinite(value)) return "–";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(value));
}

function getDurationMonths(tier) {
  return PROGRAM_DURATION[tier] || 12;
}

// compute deterministic part of utility excluding cost
function computeNonCostUtility(model, config) {
  let u = 0;
  if (model === "mxl") {
    u += MXL_COEFFS.program[config.tier] || 0;
    u += MXL_COEFFS.career[config.career] || 0;
    u += MXL_COEFFS.mentor[config.mentor] || 0;
    u += MXL_COEFFS.delivery[config.delivery] || 0;
    u += MXL_COEFFS.response[config.response] || 0;
  } else {
    u += LC2_COEFFS.program[config.tier] || 0;
    u += LC2_COEFFS.career[config.career] || 0;
    u += LC2_COEFFS.mentor[config.mentor] || 0;
    u += LC2_COEFFS.delivery[config.delivery] || 0;
    u += LC2_COEFFS.response[config.response] || 0;
  }
  return u;
}

// compute WTP-based monthly benefit per trainee (INR)
function computeWtpBenefitPerTraineeMonth(config) {
  let wtpThousand = 0;

  // programme type
  if (config.tier === "intermediate") wtpThousand += MXL_COEFFS.wtp.program.intermediate;
  if (config.tier === "advanced") wtpThousand += MXL_COEFFS.wtp.program.advanced;

  // career incentives
  if (config.career === "uni") wtpThousand += MXL_COEFFS.wtp.career.uni;
  if (config.career === "govpath") wtpThousand += MXL_COEFFS.wtp.career.govpath;

  // mentorship
  if (config.mentor === "med") wtpThousand += MXL_COEFFS.wtp.mentor.med;
  if (config.mentor === "high") wtpThousand += MXL_COEFFS.wtp.mentor.high;

  // delivery
  if (config.delivery === "inperson") wtpThousand += MXL_COEFFS.wtp.delivery.inperson;
  if (config.delivery === "online") wtpThousand += MXL_COEFFS.wtp.delivery.online;

  // response
  if (config.response === "d15") wtpThousand += MXL_COEFFS.wtp.response.d15;
  if (config.response === "d7") wtpThousand += MXL_COEFFS.wtp.response.d7;

  // convert to INR
  return wtpThousand * 1000;
}

// compute endorsement, costs, benefits, etc.
function computeResults(configOverride) {
  const cfg = configOverride || appState.config;
  const prefModel = cfg.preferenceModel;
  const costThousand = cfg.costPerTraineeMonth / 1000;

  const nonCostU = computeNonCostUtility(prefModel, cfg);
  const costCoef = prefModel === "mxl" ? MXL_COEFFS.costPerThousand : LC2_COEFFS.costPerThousand;
  const ascOptOut = prefModel === "mxl" ? MXL_COEFFS.ascOptOut : LC2_COEFFS.ascOptOut;

  const V_program = nonCostU + costCoef * costThousand;
  const V_optout = ascOptOut;

  const expProg = Math.exp(V_program);
  const expOpt = Math.exp(V_optout);
  const endorseProb = expProg / (expProg + expOpt);
  const optOutProb = 1 - endorseProb;
  const utilityGap = V_program - V_optout;

  const durationMonths = getDurationMonths(cfg.tier);
  const directCostPerCohort =
    cfg.costPerTraineeMonth * cfg.trainees * durationMonths;

  // select cost shares
  const shareObj = COST_SHARES[cfg.costTemplateKey] || COST_SHARES.frontline_who;
  const oppShare = shareObj.oppShare || 0;
  let costPerCohort = directCostPerCohort;
  if (cfg.includeOpportunityCost && oppShare > 0 && oppShare < 0.99) {
    // interpret slider as direct cost; inflate to include opportunity cost
    costPerCohort = directCostPerCohort / (1 - oppShare);
  }

  const totalCostAllCohorts = costPerCohort * cfg.cohorts;

  // cost breakdown per cohort using shares
  const shares = cfg.includeOpportunityCost
    ? shareObj.sharesWithOpp
    : shareObj.sharesNoOpp;
  const costBreakdown = { direct: {}, indirect: {} };
  Object.entries(shares.direct).forEach(([k, s]) => {
    costBreakdown.direct[k] = costPerCohort * s;
  });
  Object.entries(shares.indirect).forEach(([k, s]) => {
    costBreakdown.indirect[k] = costPerCohort * s;
  });

  // epidemiological benefits
  const graduatesAllCohorts = cfg.trainees * cfg.cohorts;
  let outbreaksPerGradPerYear = 0.3;
  if (cfg.tier === "intermediate") outbreaksPerGradPerYear = appState.advanced.intermediateOutbreaksPerGradPerYear;
  else if (cfg.tier === "advanced") outbreaksPerGradPerYear = appState.advanced.advancedOutbreaksPerGradPerYear;
  else outbreaksPerGradPerYear = appState.advanced.frontlineOutbreaksPerGradPerYear;

  const outbreaksPerYear = graduatesAllCohorts * outbreaksPerGradPerYear;
  const outbreakBenefit =
    outbreaksPerYear *
    appState.advanced.horizonYears *
    appState.advanced.valuePerOutbreakINR;

  const graduateBenefit =
    graduatesAllCohorts * appState.advanced.valuePerGraduateINR;

  // WTP-based benefit (intangible)
  const wtpPerTraineeMonthINR = computeWtpBenefitPerTraineeMonth(cfg);
  const wtpBenefit =
    wtpPerTraineeMonthINR *
    cfg.trainees *
    durationMonths *
    cfg.cohorts;

  const totalBenefitAllCohorts = outbreakBenefit + graduateBenefit + wtpBenefit;
  const benefitPerCohort = totalBenefitAllCohorts / (cfg.cohorts || 1);

  const bcr = totalCostAllCohorts > 0 ? totalBenefitAllCohorts / totalCostAllCohorts : 0;
  const netBenefitAllCohorts = totalBenefitAllCohorts - totalCostAllCohorts;

  return {
    endorseProb,
    optOutProb,
    utilityGap,
    costPerCohort,
    totalCostAllCohorts,
    costBreakdown,
    graduatesAllCohorts,
    outbreaksPerYear,
    benefitPerCohort,
    totalBenefitAllCohorts,
    netBenefitAllCohorts,
    bcr,
    durationMonths
  };
}

/* -----------------------------------------------------
   4. DOM HOOKS
----------------------------------------------------- */

let elements = {};

function cacheElements() {
  elements = {
    // tabs
    tabButtons: document.querySelectorAll(".tab-button"),
    tabSections: document.querySelectorAll(".tab-section"),

    // config
    tierSelect: document.getElementById("tierSelect"),
    careerSelect: document.getElementById("careerSelect"),
    mentorSelect: document.getElementById("mentorSelect"),
    deliverySelect: document.getElementById("deliverySelect"),
    responseSelect: document.getElementById("responseSelect"),
    traineesInput: document.getElementById("traineesInput"),
    cohortsInput: document.getElementById("cohortsInput"),
    costSlider: document.getElementById("costSlider"),
    costSliderLabel: document.getElementById("costSliderLabel"),
    oppCostToggle: document.getElementById("oppCostToggle"),
    costTemplateSelect: document.getElementById("costTemplateSelect"),
    prefModelSelect: document.getElementById("prefModelSelect"),
    scenarioNameInput: document.getElementById("scenarioNameInput"),
    scenarioTagsInput: document.getElementById("scenarioTagsInput"),
    scenarioNotesInput: document.getElementById("scenarioNotesInput"),
    applyConfigBtn: document.getElementById("applyConfigBtn"),
    viewResultsBtn: document.getElementById("viewResultsBtn"),
    saveScenarioBtn: document.getElementById("saveScenarioBtn"),
    targetEndorseInput: document.getElementById("targetEndorseInput"),
    targetBcrInput: document.getElementById("targetBcrInput"),
    solveEndorseBtn: document.getElementById("solveEndorseBtn"),
    solveBcrBtn: document.getElementById("solveBcrBtn"),

    // config summary
    sumTier: document.getElementById("sumTier"),
    sumCareer: document.getElementById("sumCareer"),
    sumMentor: document.getElementById("sumMentor"),
    sumDelivery: document.getElementById("sumDelivery"),
    sumResponse: document.getElementById("sumResponse"),
    sumPref: document.getElementById("sumPref"),
    sumTrainees: document.getElementById("sumTrainees"),
    sumCohorts: document.getElementById("sumCohorts"),
    sumCost: document.getElementById("sumCost"),
    sumTemplate: document.getElementById("sumTemplate"),
    sumOppCost: document.getElementById("sumOppCost"),
    sumEndorse: document.getElementById("sumEndorse"),
    headlineRec: document.getElementById("headlineRec"),

    snapEndorse: document.getElementById("snapEndorse"),
    snapBcr: document.getElementById("snapBcr"),
    snapTotalCost: document.getElementById("snapTotalCost"),
    snapTotalBenefit: document.getElementById("snapTotalBenefit"),

    // results tab
    resGraduates: document.getElementById("resGraduates"),
    resOutbreaksPerYear: document.getElementById("resOutbreaksPerYear"),
    resBenefitPerCohort: document.getElementById("resBenefitPerCohort"),
    resCostPerCohort: document.getElementById("resCostPerCohort"),
    resNetBenefit: document.getElementById("resNetBenefit"),
    resBcr: document.getElementById("resBcr"),
    resEndorse: document.getElementById("resEndorse"),
    resOptOut: document.getElementById("resOptOut"),
    resUtilityGap: document.getElementById("resUtilityGap"),

    endorsementChart: document.getElementById("endorsementChart"),
    costBenefitChart: document.getElementById("costBenefitChart"),

    // saved scenarios
    showShortlistOnly: document.getElementById("showShortlistOnly"),
    scenariosBody: document.getElementById("scenariosBody"),
    shortlistGrid: document.getElementById("shortlistGrid"),
    generateBriefingBtn: document.getElementById("generateBriefingBtn"),
    copyBriefingBtn: document.getElementById("copyBriefingBtn"),
    briefingText: document.getElementById("briefingText"),
    downloadExcelBtn: document.getElementById("downloadExcelBtn"),
    downloadPdfBtn: document.getElementById("downloadPdfBtn"),

    // national & sensitivity
    natGraduates: document.getElementById("natGraduates"),
    natTotalCost: document.getElementById("natTotalCost"),
    natTotalBenefit: document.getElementById("natTotalBenefit"),
    natBcr: document.getElementById("natBcr"),
    natChart: document.getElementById("natChart"),
    sensChart: document.getElementById("sensChart"),

    // advanced
    advHorizonInput: document.getElementById("advHorizonInput"),
    advFrontlineOutbreaks: document.getElementById("advFrontlineOutbreaks"),
    advIntermediateOutbreaks: document.getElementById("advIntermediateOutbreaks"),
    advAdvancedOutbreaks: document.getElementById("advAdvancedOutbreaks"),
    advValuePerOutbreak: document.getElementById("advValuePerOutbreak"),
    advValuePerGraduate: document.getElementById("advValuePerGraduate"),
    advExchangeRate: document.getElementById("advExchangeRate"),
    currencyDisplaySelect: document.getElementById("currencyDisplaySelect"),
    resetAdvancedBtn: document.getElementById("resetAdvancedBtn"),
    assumptionLog: document.getElementById("assumptionLog"),
    techSummary: document.getElementById("techSummary"),
    openTechWindowBtn: document.getElementById("openTechWindowBtn"),

    // about
    restartTourBtn: document.getElementById("restartTourBtn"),

    // modal
    resultsModal: document.getElementById("resultsModal"),
    closeResultsModal: document.getElementById("closeResultsModal"),
    modalCloseBtn: document.getElementById("modalCloseBtn"),
    modalScenarioTitle: document.getElementById("modalScenarioTitle"),
    modalConfigList: document.getElementById("modalConfigList"),
    modalNumbersList: document.getElementById("modalNumbersList"),
    modalHeadline: document.getElementById("modalHeadline"),
    modalNarrative: document.getElementById("modalNarrative"),
    modalSaveScenarioBtn: document.getElementById("modalSaveScenarioBtn"),

    // tour
    tourOverlay: document.getElementById("tourOverlay"),
    tourTitle: document.getElementById("tourTitle"),
    tourText: document.getElementById("tourText"),
    tourSkipBtn: document.getElementById("tourSkipBtn"),
    tourNextBtn: document.getElementById("tourNextBtn")
  };
}

/* -----------------------------------------------------
   5. TAB HANDLING
----------------------------------------------------- */

function setupTabs() {
  elements.tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      elements.tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      elements.tabSections.forEach((sec) => {
        if (sec.id === tabId) sec.classList.add("active");
        else sec.classList.remove("active");
      });
    });
  });
}

/* -----------------------------------------------------
   6. CONFIGURATION UPDATE AND SUMMARY
----------------------------------------------------- */

function updateConfigFromInputs() {
  const cfg = appState.config;
  cfg.tier = elements.tierSelect.value;
  cfg.career = elements.careerSelect.value;
  cfg.mentor = elements.mentorSelect.value;
  cfg.delivery = elements.deliverySelect.value;
  cfg.response = elements.responseSelect.value;
  cfg.trainees = Number(elements.traineesInput.value) || 0;
  cfg.cohorts = Number(elements.cohortsInput.value) || 0;
  cfg.costPerTraineeMonth = Number(elements.costSlider.value) || 0;
  cfg.includeOpportunityCost = elements.oppCostToggle.checked;
  cfg.costTemplateKey = elements.costTemplateSelect.value;
  cfg.preferenceModel = elements.prefModelSelect.value;
  cfg.scenarioName = elements.scenarioNameInput.value.trim();
  cfg.scenarioTags = elements.scenarioTagsInput.value.trim();
  cfg.scenarioNotes = elements.scenarioNotesInput.value.trim();
  updateCostSliderLabel();
}

function updateCostSliderLabel() {
  if (!elements.costSliderLabel) return;
  const value = Number(elements.costSlider.value) || 0;
  elements.costSliderLabel.textContent =
    "Current value: " + formatINR(value) + " per trainee per month";
}

function labelTier(tier) {
  if (tier === "frontline") return "Frontline (3 months)";
  if (tier === "intermediate") return "Intermediate (12–15 months)";
  if (tier === "advanced") return "Advanced (24 months)";
  return tier;
}

function labelCareer(career) {
  if (career === "certificate") return "Government and partner certificate";
  if (career === "uni") return "University qualification";
  if (career === "govpath") return "Government career pathway";
  return career;
}

function labelMentor(m) {
  if (m === "low") return "Low";
  if (m === "med") return "Medium";
  if (m === "high") return "High";
  return m;
}

function labelDelivery(d) {
  if (d === "blended") return "Blended";
  if (d === "inperson") return "Fully in-person";
  if (d === "online") return "Fully online";
  return d;
}

function labelResponse(r) {
  if (r === "d30") return "Within 30 days";
  if (r === "d15") return "Within 15 days";
  if (r === "d7") return "Within 7 days";
  return r;
}

function labelPrefModel(m) {
  if (m === "mxl") return "Average mixed logit";
  if (m === "lc2") return "Supportive group (latent class 2)";
  return m;
}

function labelTemplate(key) {
  if (key === "frontline_who") return "Frontline – WHO template (6 cohorts)";
  if (key === "intermediate_all") return "Intermediate – combined WHO/NIE/NCDC";
  if (key === "advanced_all") return "Advanced – combined NIE/NCDC";
  return key;
}

function buildHeadline(results) {
  const endorse = results.endorseProb * 100;
  const bcr = results.bcr;
  const tier = appState.config.tier;
  const mentor = appState.config.mentor;

  if (!isFinite(bcr) || !isFinite(endorse)) {
    return "Results cannot be interpreted because benefit or cost is zero. Please check the configuration and advanced settings.";
  }

  if (bcr < 1 && endorse < 50) {
    return "At current cost and design, both net benefits and stakeholder endorsement are modest. It is advisable to improve programme design or reduce costs before scaling up.";
  }

  if (bcr >= 1 && endorse < 50) {
    return "Benefits appear to exceed costs on current assumptions, but predicted endorsement is limited. Consider design changes that respond more strongly to stakeholder preferences, for example moving to higher mentorship intensity or faster response capacity.";
  }

  if (bcr < 1 && endorse >= 50) {
    return "Stakeholder endorsement is relatively strong, but benefits do not yet exceed costs. This configuration may be attractive politically, but will require cost control or additional evidence on benefits before adoption at scale.";
  }

  // bcr >= 1 and endorse >= 50
  if (tier === "advanced" && mentor === "high") {
    return "This advanced, high-mentorship configuration shows both strong endorsement and favourable benefit–cost performance. It is a strong candidate for priority scaling under current assumptions.";
  }
  return "This configuration combines acceptable endorsement with a benefit–cost ratio above one. It is a reasonable candidate for scale-up, subject to budget constraints and implementation capacity.";
}

function updateConfigSummary() {
  const cfg = appState.config;
  const results = appState.lastResults || computeResults(cfg);
  appState.lastResults = results;

  elements.sumTier.textContent = labelTier(cfg.tier);
  elements.sumCareer.textContent = labelCareer(cfg.career);
  elements.sumMentor.textContent = labelMentor(cfg.mentor);
  elements.sumDelivery.textContent = labelDelivery(cfg.delivery);
  elements.sumResponse.textContent = labelResponse(cfg.response);
  elements.sumPref.textContent = labelPrefModel(cfg.preferenceModel);
  elements.sumTrainees.textContent = String(cfg.trainees);
  elements.sumCohorts.textContent = String(cfg.cohorts);
  elements.sumCost.textContent = formatCurrency(cfg.costPerTraineeMonth);
  elements.sumTemplate.textContent = labelTemplate(cfg.costTemplateKey);
  elements.sumOppCost.textContent = cfg.includeOpportunityCost ? "Yes" : "No";
  elements.sumEndorse.textContent = formatPercent(results.endorseProb * 100);

  const headline = buildHeadline(results);
  elements.headlineRec.textContent = headline;

  elements.snapEndorse.textContent = formatPercent(results.endorseProb * 100);
  elements.snapBcr.textContent = results.bcr.toFixed(2);
  elements.snapTotalCost.textContent = formatCurrency(results.totalCostAllCohorts);
  elements.snapTotalBenefit.textContent = formatCurrency(results.totalBenefitAllCohorts);
}

/* -----------------------------------------------------
   7. RESULTS TAB UPDATE
----------------------------------------------------- */

function updateResultsTab() {
  const res = appState.lastResults || computeResults(appState.config);
  appState.lastResults = res;

  elements.resGraduates.textContent = formatNumber(res.graduatesAllCohorts);
  elements.resOutbreaksPerYear.textContent = formatNumber(res.outbreaksPerYear);
  elements.resBenefitPerCohort.textContent = formatCurrency(res.benefitPerCohort);
  elements.resCostPerCohort.textContent = formatCurrency(res.costPerCohort);
  elements.resNetBenefit.textContent = formatCurrency(res.netBenefitAllCohorts);
  elements.resBcr.textContent = res.bcr.toFixed(2);
  elements.resEndorse.textContent = formatPercent(res.endorseProb * 100);
  elements.resOptOut.textContent = formatPercent(res.optOutProb * 100);
  elements.resUtilityGap.textContent = res.utilityGap.toFixed(2);

  updateCharts(res);
  updateNationalTab(res);
  updateSensitivityChart(res);
}

function updateCharts(res) {
  const cfg = appState.config;
  const labels = [
    formatINR(0.8 * cfg.costPerTraineeMonth),
    formatINR(cfg.costPerTraineeMonth),
    formatINR(1.2 * cfg.costPerTraineeMonth)
  ];
  const endorsePoints = [];

  [0.8, 1.0, 1.2].forEach((mult) => {
    const tempCfg = { ...cfg, costPerTraineeMonth: cfg.costPerTraineeMonth * mult };
    endorsePoints.push(computeResults(tempCfg).endorseProb * 100);
  });

  if (!appState.charts.endorsementChart) {
    appState.charts.endorsementChart = new Chart(elements.endorsementChart, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Endorsement (%)",
            data: endorsePoints,
            tension: 0.25
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true, max: 100 }
        }
      }
    });
  } else {
    const c = appState.charts.endorsementChart;
    c.data.labels = labels;
    c.data.datasets[0].data = endorsePoints;
    c.update();
  }

  const costData = [res.costPerCohort, res.benefitPerCohort];
  if (!appState.charts.costBenefitChart) {
    appState.charts.costBenefitChart = new Chart(elements.costBenefitChart, {
      type: "bar",
      data: {
        labels: ["Cost per cohort", "Benefit per cohort"],
        datasets: [
          {
            label: "INR",
            data: costData
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  } else {
    const c2 = appState.charts.costBenefitChart;
    c2.data.datasets[0].data = costData;
    c2.update();
  }
}

/* -----------------------------------------------------
   8. NATIONAL & SENSITIVITY
----------------------------------------------------- */

function updateNationalTab(res) {
  const cfg = appState.config;
  elements.natGraduates.textContent = formatNumber(res.graduatesAllCohorts);
  elements.natTotalCost.textContent = formatCurrency(res.totalCostAllCohorts);
  elements.natTotalBenefit.textContent = formatCurrency(res.totalBenefitAllCohorts);
  elements.natBcr.textContent = res.bcr.toFixed(2);

  const labels = ["Total graduates", "Total cost", "Total benefit"];
  const data = [
    res.graduatesAllCohorts,
    res.totalCostAllCohorts,
    res.totalBenefitAllCohorts
  ];

  if (!appState.charts.natChart) {
    appState.charts.natChart = new Chart(elements.natChart, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "National metrics (graduates, INR)",
            data
          }
        ]
      },
      options: {
        responsive: true,
        indexAxis: "y",
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { beginAtZero: true }
        }
      }
    });
  } else {
    const c = appState.charts.natChart;
    c.data.datasets[0].data = data;
    c.update();
  }
}

function updateSensitivityChart(res) {
  const cfg = appState.config;
  const baseCost = cfg.costPerTraineeMonth;
  const baseValueOutbreak = appState.advanced.valuePerOutbreakINR;

  const costMultipliers = [0.8, 1.0, 1.2];
  const valueMultipliers = [0.8, 1.0, 1.2];

  const labels = [];
  const bcrValues = [];

  costMultipliers.forEach((cMult) => {
    valueMultipliers.forEach((vMult) => {
      const tempCfg = { ...cfg, costPerTraineeMonth: baseCost * cMult };
      const tempAdv = { ...appState.advanced };
      tempAdv.valuePerOutbreakINR = baseValueOutbreak * vMult;
      const original = appState.advanced;
      appState.advanced = tempAdv;
      const r = computeResults(tempCfg);
      appState.advanced = original;

      labels.push(`Cost x${cMult.toFixed(1)}, value x${vMult.toFixed(1)}`);
      bcrValues.push(r.bcr);
    });
  });

  if (!appState.charts.sensChart) {
    appState.charts.sensChart = new Chart(elements.sensChart, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Benefit–cost ratio",
            data: bcrValues
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  } else {
    const c = appState.charts.sensChart;
    c.data.labels = labels;
    c.data.datasets[0].data = bcrValues;
    c.update();
  }
}

/* -----------------------------------------------------
   9. ADVANCED SETTINGS
----------------------------------------------------- */

function loadAdvancedIntoInputs() {
  elements.advHorizonInput.value = appState.advanced.horizonYears;
  elements.advFrontlineOutbreaks.value =
    appState.advanced.frontlineOutbreaksPerGradPerYear;
  elements.advIntermediateOutbreaks.value =
    appState.advanced.intermediateOutbreaksPerGradPerYear;
  elements.advAdvancedOutbreaks.value =
    appState.advanced.advancedOutbreaksPerGradPerYear;
  elements.advValuePerOutbreak.value = appState.advanced.valuePerOutbreakINR;
  elements.advValuePerGraduate.value = appState.advanced.valuePerGraduateINR;
  elements.advExchangeRate.value = appState.advanced.exchangeRateINRperUSD;
  elements.currencyDisplaySelect.value = appState.advanced.currencyDisplay;
  updateAssumptionLog();
}

function updateAdvancedFromInputs() {
  appState.advanced.horizonYears = Number(elements.advHorizonInput.value) || DEFAULT_ADVANCED.horizonYears;
  appState.advanced.frontlineOutbreaksPerGradPerYear =
    Number(elements.advFrontlineOutbreaks.value) ||
    DEFAULT_ADVANCED.frontlineOutbreaksPerGradPerYear;
  appState.advanced.intermediateOutbreaksPerGradPerYear =
    Number(elements.advIntermediateOutbreaks.value) ||
    DEFAULT_ADVANCED.intermediateOutbreaksPerGradPerYear;
  appState.advanced.advancedOutbreaksPerGradPerYear =
    Number(elements.advAdvancedOutbreaks.value) ||
    DEFAULT_ADVANCED.advancedOutbreaksPerGradPerYear;
  appState.advanced.valuePerOutbreakINR =
    Number(elements.advValuePerOutbreak.value) ||
    DEFAULT_ADVANCED.valuePerOutbreakINR;
  appState.advanced.valuePerGraduateINR =
    Number(elements.advValuePerGraduate.value) ||
    DEFAULT_ADVANCED.valuePerGraduateINR;
  appState.advanced.exchangeRateINRperUSD =
    Number(elements.advExchangeRate.value) ||
    DEFAULT_ADVANCED.exchangeRateINRperUSD;
  appState.advanced.currencyDisplay = elements.currencyDisplaySelect.value;
  updateAssumptionLog();
  // refresh all major views because currency display and benefits changed
  const res = computeResults(appState.config);
  appState.lastResults = res;
  updateConfigSummary();
  updateResultsTab();
  renderScenariosTable();
}

function resetAdvancedSettings() {
  appState.advanced = { ...DEFAULT_ADVANCED };
  loadAdvancedIntoInputs();
  const res = computeResults(appState.config);
  appState.lastResults = res;
  updateConfigSummary();
  updateResultsTab();
  renderScenariosTable();
}

function updateAssumptionLog() {
  const a = appState.advanced;
  const cfg = appState.config;
  const now = new Date().toISOString();
  const logLines = [
    `STEPS assumption log – ${now}`,
    "",
    `Planning horizon (years): ${a.horizonYears}`,
    `Outbreak responses per graduate per year:`,
    `  Frontline:     ${a.frontlineOutbreaksPerGradPerYear}`,
    `  Intermediate:  ${a.intermediateOutbreaksPerGradPerYear}`,
    `  Advanced:      ${a.advancedOutbreaksPerGradPerYear}`,
    "",
    `Value per outbreak response (INR): ${formatINR(a.valuePerOutbreakINR)}`,
    `Value per FETP graduate (INR):      ${formatINR(a.valuePerGraduateINR)}`,
    "",
    `Exchange rate (INR per USD): ${a.exchangeRateINRperUSD}`,
    `Currency display mode:      ${a.currencyDisplay}`,
    "",
    `Current configuration snapshot:`,
    `  Tier:            ${labelTier(cfg.tier)}`,
    `  Mentorship:      ${labelMentor(cfg.mentor)}`,
    `  Delivery:        ${labelDelivery(cfg.delivery)}`,
    `  Response time:   ${labelResponse(cfg.response)}`,
    `  Trainees/cohort: ${cfg.trainees}`,
    `  Number of cohorts: ${cfg.cohorts}`,
    `  Cost/trainee/month: ${formatINR(cfg.costPerTraineeMonth)}`,
    `  Include opportunity cost: ${cfg.includeOpportunityCost ? "Yes" : "No"}`,
    `  Preference model: ${labelPrefModel(cfg.preferenceModel)}`
  ];
  elements.assumptionLog.textContent = logLines.join("\n");
}

/* -----------------------------------------------------
   10. SCENARIOS SAVE / TABLE / BRIEFING
----------------------------------------------------- */

function saveCurrentScenario() {
  const cfg = { ...appState.config };
  const res = appState.lastResults || computeResults(cfg);
  appState.lastResults = res;

  const scenarioId = Date.now().toString();
  const nameFallback =
    cfg.scenarioName ||
    `${labelTier(cfg.tier)}, ${labelMentor(cfg.mentor)}, ${cfg.cohorts} cohorts`;

  appState.scenarios.push({
    id: scenarioId,
    name: nameFallback,
    cfg,
    res,
    tags: cfg.scenarioTags,
    notes: cfg.scenarioNotes,
    shortlisted: false,
    selected: false
  });

  renderScenariosTable();
  alert("Scenario saved.");
}

function renderScenariosTable() {
  const tbody = elements.scenariosBody;
  tbody.innerHTML = "";
  const showShortlistOnly = elements.showShortlistOnly.checked;

  appState.scenarios.forEach((sc) => {
    if (showShortlistOnly && !sc.shortlisted) return;

    const tr = document.createElement("tr");

    // shortlist checkbox
    const tdShort = document.createElement("td");
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = sc.shortlisted;
    chk.addEventListener("change", () => {
      sc.shortlisted = chk.checked;
      renderShortlistGrid();
    });
    tdShort.appendChild(chk);
    tr.appendChild(tdShort);

    const tdName = document.createElement("td");
    const cbSel = document.createElement("input");
    cbSel.type = "checkbox";
    cbSel.checked = sc.selected;
    cbSel.style.marginRight = "4px";
    cbSel.addEventListener("change", () => {
      sc.selected = cbSel.checked;
    });
    tdName.appendChild(cbSel);
    tdName.append(sc.name);
    tr.appendChild(tdName);

    const tdTier = document.createElement("td");
    tdTier.textContent = labelTier(sc.cfg.tier);
    tr.appendChild(tdTier);

    const tdMentor = document.createElement("td");
    tdMentor.textContent = labelMentor(sc.cfg.mentor);
    tr.appendChild(tdMentor);

    const tdResp = document.createElement("td");
    tdResp.textContent = labelResponse(sc.cfg.response);
    tr.appendChild(tdResp);

    const tdCost = document.createElement("td");
    tdCost.textContent = formatCurrency(sc.cfg.costPerTraineeMonth);
    tr.appendChild(tdCost);

    const tdEnd = document.createElement("td");
    tdEnd.textContent = formatPercent(sc.res.endorseProb * 100);
    tr.appendChild(tdEnd);

    const tdBcr = document.createElement("td");
    tdBcr.textContent = sc.res.bcr.toFixed(2);
    tr.appendChild(tdBcr);

    const tdTotCost = document.createElement("td");
    tdTotCost.textContent = formatCurrency(sc.res.totalCostAllCohorts);
    tr.appendChild(tdTotCost);

    const tdTotBen = document.createElement("td");
    tdTotBen.textContent = formatCurrency(sc.res.totalBenefitAllCohorts);
    tr.appendChild(tdTotBen);

    const tdTags = document.createElement("td");
    if (sc.tags) {
      sc.tags.split(";").forEach((tagRaw) => {
        const tag = tagRaw.trim();
        if (!tag) return;
        const span = document.createElement("span");
        span.className = "tag-pill";
        span.textContent = tag;
        tdTags.appendChild(span);
      });
    }
    tr.appendChild(tdTags);

    const tdActions = document.createElement("td");
    const loadBtn = document.createElement("button");
    loadBtn.className = "btn btn-ghost";
    loadBtn.textContent = "Load";
    loadBtn.addEventListener("click", () => {
      appState.config = { ...sc.cfg };
      applyConfigToInputs();
      const resNew = computeResults(appState.config);
      appState.lastResults = resNew;
      updateConfigSummary();
      updateResultsTab();
      alert("Scenario loaded into configuration.");
    });
    tdActions.appendChild(loadBtn);

    tbody.appendChild(tr);
  });

  renderShortlistGrid();
}

function renderShortlistGrid() {
  const container = elements.shortlistGrid;
  container.innerHTML = "";
  const shortlisted = appState.scenarios.filter((s) => s.shortlisted);
  shortlisted.forEach((sc) => {
    const div = document.createElement("div");
    div.className = "shortlist-card";
    div.innerHTML = `
      <h4>${sc.name}</h4>
      <div><strong>Tier:</strong> ${labelTier(sc.cfg.tier)}</div>
      <div><strong>Mentorship:</strong> ${labelMentor(sc.cfg.mentor)}</div>
      <div><strong>Response:</strong> ${labelResponse(sc.cfg.response)}</div>
      <div><strong>Endorsement:</strong> ${formatPercent(sc.res.endorseProb * 100)}</div>
      <div><strong>BCR:</strong> ${sc.res.bcr.toFixed(2)}</div>
      <div><strong>Total cost:</strong> ${formatCurrency(sc.res.totalCostAllCohorts)}</div>
      <div><strong>Total benefit:</strong> ${formatCurrency(sc.res.totalBenefitAllCohorts)}</div>
    `;
    container.appendChild(div);
  });
}

function generateBriefingText() {
  const selected = appState.scenarios.filter((s) => s.selected);
  if (selected.length === 0) {
    elements.briefingText.value =
      "No scenarios are selected. Tick the checkboxes in the Name column to include scenarios.";
    return;
  }

  const lines = [];
  selected.forEach((sc, idx) => {
    const cfg = sc.cfg;
    const res = sc.res;
    lines.push(`Scenario ${idx + 1}: ${sc.name}`);
    lines.push(
      `Tier: ${labelTier(cfg.tier)}; mentorship: ${labelMentor(
        cfg.mentor
      )}; delivery: ${labelDelivery(cfg.delivery)}; response time: ${labelResponse(
        cfg.response
      )}.`
    );
    lines.push(
      `Each cohort trains ${cfg.trainees} fellows over ${getDurationMonths(
        cfg.tier
      )} months, with ${cfg.cohorts} planned cohorts in total.`
    );
    lines.push(
      `The model predicts an endorsement rate of about ${formatPercent(
        res.endorseProb * 100
      )}, a benefit–cost ratio of ${res.bcr.toFixed(2)}, total economic costs of ${formatCurrency(
        res.totalCostAllCohorts
      )} and total benefits of ${formatCurrency(res.totalBenefitAllCohorts)}.`
    );
    if (res.bcr >= 1 && res.endorseProb * 100 >= 50) {
      lines.push(
        `Under current assumptions, this configuration appears attractive both financially and in terms of stakeholder support, and could be prioritised for scale-up subject to budget space and implementation capacity.`
      );
    } else if (res.bcr < 1 && res.endorseProb * 100 >= 50) {
      lines.push(
        `Stakeholder support is relatively strong but estimated benefits do not yet exceed costs. The scenario may still be acceptable if budget is available, but it would benefit from cost reduction or stronger evidence on benefits.`
      );
    } else if (res.bcr >= 1 && res.endorseProb * 100 < 50) {
      lines.push(
        `Benefits appear to exceed costs but stakeholder endorsement is limited, suggesting that design improvements (for example in mentorship or response capacity) may be needed to secure broad support.`
      );
    } else {
      lines.push(
        `Both the benefit–cost ratio and the predicted endorsement are modest. This configuration is unlikely to be a priority without substantial re-design or changes in assumptions.`
      );
    }
    if (sc.tags) {
      lines.push(`Stakeholder tags: ${sc.tags}.`);
    }
    if (sc.notes) {
      lines.push(`Notes: ${sc.notes}.`);
    }
    lines.push("");
  });

  elements.briefingText.value = lines.join("\n");
}

function copyBriefingToClipboard() {
  elements.briefingText.select();
  document.execCommand("copy");
  alert("Briefing text copied to clipboard.");
}

/* -----------------------------------------------------
   11. EXCEL AND PDF EXPORT
----------------------------------------------------- */

function downloadScenariosExcel() {
  if (appState.scenarios.length === 0) {
    alert("No scenarios to export.");
    return;
  }
  const rows = appState.scenarios.map((sc) => ({
    Name: sc.name,
    Tier: labelTier(sc.cfg.tier),
    Mentorship: labelMentor(sc.cfg.mentor),
    Delivery: labelDelivery(sc.cfg.delivery),
    Response: labelResponse(sc.cfg.response),
    Trainees_per_cohort: sc.cfg.trainees,
    Number_of_cohorts: sc.cfg.cohorts,
    Cost_per_trainee_per_month_INR: sc.cfg.costPerTraineeMonth,
    Include_opportunity_cost: sc.cfg.includeOpportunityCost ? "Yes" : "No",
    Endorsement_percent: (sc.res.endorseProb * 100).toFixed(1),
    BCR: sc.res.bcr.toFixed(2),
    Total_cost_INR: sc.res.totalCostAllCohorts,
    Total_benefit_INR: sc.res.totalBenefitAllCohorts,
    Net_benefit_INR: sc.res.netBenefitAllCohorts,
    Tags: sc.tags,
    Notes: sc.notes
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "STEPS scenarios");
  XLSX.writeFile(workbook, "STEPS_FETP_scenarios.xlsx");
}

// Policy brief PDF – using jsPDF with conservative formatting
function downloadPolicyBriefPdf() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const marginLeft = 15;
  const marginTop = 15;
  const maxWidth = 180;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);

  doc.text("STEPS FETP scale-up policy brief – India", marginLeft, marginTop);
  doc.setFontSize(10);
  doc.text(
    "This brief summarises Field Epidemiology Training Program (FETP) configurations evaluated with STEPS.",
    marginLeft,
    marginTop + 6
  );
  doc.text(
    "Results combine discrete choice experiment evidence on stakeholder preferences with costing and simple",
    marginLeft,
    marginTop + 11
  );
  doc.text(
    "epidemiological multipliers for the selected scenarios.",
    marginLeft,
    marginTop + 16
  );

  let y = marginTop + 24;

  const selected = appState.scenarios.filter((s) => s.selected);
  const scenariosForPdf = selected.length > 0 ? selected : appState.scenarios;

  if (scenariosForPdf.length === 0) {
    doc.text("No scenarios saved in the tool.", marginLeft, y);
  } else {
    scenariosForPdf.forEach((sc, idx) => {
      if (y > 260) {
        doc.addPage();
        y = marginTop;
        doc.setFontSize(10);
      }
      doc.setFontSize(11);
      doc.text(`Scenario ${idx + 1}: ${sc.name}`, marginLeft, y);
      y += 6;
      doc.setFontSize(9);

      const cfg = sc.cfg;
      const res = sc.res;
      const duration = getDurationMonths(cfg.tier);

      const paragraph = [
        `Configuration: ${labelTier(cfg.tier)}, ${labelMentor(cfg.mentor)} mentorship, ${labelDelivery(
          cfg.delivery
        )}, response within ${labelResponse(cfg.response)}.`,
        `Each cohort trains ${cfg.trainees} fellows over ${duration} months, with ${cfg.cohorts} cohorts planned.`,
        `Predicted endorsement is about ${(res.endorseProb * 100).toFixed(
          1
        )} percent and the benefit–cost ratio is ${res.bcr.toFixed(2)}.`,
        `Total economic costs are approximately ${formatINR(
          res.totalCostAllCohorts
        )}, and total benefits are around ${formatINR(res.totalBenefitAllCohorts)}.`,
        res.bcr >= 1 && res.endorseProb * 100 >= 50
          ? `Under current assumptions, this configuration appears to be a strong candidate for priority scale-up, subject to budget space and implementation capacity.`
          : res.bcr < 1 && res.endorseProb * 100 >= 50
          ? `Stakeholder support is relatively strong but estimated benefits do not yet exceed costs. Cost reduction or stronger evidence on benefits would help strengthen the case for this option.`
          : res.bcr >= 1 && res.endorseProb * 100 < 50
          ? `Benefits appear to exceed costs but endorsement remains modest. Design changes that increase acceptability, such as strengthening mentorship or response capacity, could improve this scenario.`
          : `Both benefit–cost performance and stakeholder endorsement are modest. This configuration is unlikely to be a priority without substantial redesign.`
      ];

      const textBlock = doc.splitTextToSize(paragraph.join(" "), maxWidth);
      textBlock.forEach((line) => {
        if (y > 280) {
          doc.addPage();
          y = marginTop;
          doc.setFontSize(9);
        }
        doc.text(line, marginLeft, y);
        y += 5;
      });

      if (sc.tags) {
        const t = "Stakeholder tags: " + sc.tags;
        const lines = doc.splitTextToSize(t, maxWidth);
        lines.forEach((line) => {
          if (y > 280) {
            doc.addPage();
            y = marginTop;
            doc.setFontSize(9);
          }
          doc.text(line, marginLeft, y);
          y += 5;
        });
      }

      if (sc.notes) {
        const t = "Notes: " + sc.notes;
        const lines = doc.splitTextToSize(t, maxWidth);
        lines.forEach((line) => {
          if (y > 280) {
            doc.addPage();
            y = marginTop;
            doc.setFontSize(9);
          }
          doc.text(line, marginLeft, y);
          y += 5;
        });
      }

      y += 4;
    });
  }

  if (y > 260) {
    doc.addPage();
    y = marginTop;
  }
  doc.setFontSize(9);
  doc.text(
    "Prepared using STEPS by Mesfin Genie, PhD, Newcastle Business School, The University of Newcastle, Australia.",
    marginLeft,
    y
  );
  y += 5;
  doc.text("For questions, contact mesfin.genie@newcastle.edu.au", marginLeft, y);

  doc.save("STEPS_FETP_policy_brief.pdf");
}

/* -----------------------------------------------------
   12. RESULTS MODAL
----------------------------------------------------- */

function openResultsModal() {
  const cfg = appState.config;
  const res = appState.lastResults || computeResults(cfg);
  appState.lastResults = res;

  elements.modalScenarioTitle.textContent =
    cfg.scenarioName ||
    `${labelTier(cfg.tier)}, ${labelMentor(cfg.mentor)}, ${cfg.cohorts} cohorts`;

  elements.modalConfigList.innerHTML = "";
  const configItems = [
    `Programme tier: ${labelTier(cfg.tier)}`,
    `Career incentive: ${labelCareer(cfg.career)}`,
    `Mentorship: ${labelMentor(cfg.mentor)}`,
    `Delivery mode: ${labelDelivery(cfg.delivery)}`,
    `Response time: ${labelResponse(cfg.response)}`,
    `Preference model: ${labelPrefModel(cfg.preferenceModel)}`,
    `Trainees per cohort: ${cfg.trainees}`,
    `Number of cohorts: ${cfg.cohorts}`,
    `Cost per trainee per month: ${formatCurrency(cfg.costPerTraineeMonth)}`,
    `Cost template: ${labelTemplate(cfg.costTemplateKey)}`,
    `Include opportunity cost: ${cfg.includeOpportunityCost ? "Yes" : "No"}`
  ];
  configItems.forEach((txt) => {
    const li = document.createElement("li");
    li.textContent = txt;
    elements.modalConfigList.appendChild(li);
  });

  elements.modalNumbersList.innerHTML = "";
  const numbersItems = [
    `Endorsement (programme vs opt-out): ${formatPercent(
      res.endorseProb * 100
    )}`,
    `Opt-out: ${formatPercent(res.optOutProb * 100)}`,
    `FETP graduates (all cohorts): ${formatNumber(res.graduatesAllCohorts)}`,
    `Estimated outbreak responses per year: ${formatNumber(
      res.outbreaksPerYear
    )}`,
    `Total economic cost (all cohorts): ${formatCurrency(
      res.totalCostAllCohorts
    )}`,
    `Total benefit (all cohorts): ${formatCurrency(
      res.totalBenefitAllCohorts
    )}`,
    `Benefit–cost ratio: ${res.bcr.toFixed(2)}`,
    `Net benefit (all cohorts): ${formatCurrency(res.netBenefitAllCohorts)}`
  ];
  numbersItems.forEach((txt) => {
    const li = document.createElement("li");
    li.textContent = txt;
    elements.modalNumbersList.appendChild(li);
  });

  const headline = buildHeadline(res);
  elements.modalHeadline.textContent = headline;

  let narrative;
  if (res.bcr >= 1 && res.endorseProb * 100 >= 50) {
    narrative =
      "Under current assumptions, this configuration yields benefits that exceed costs and secures majority stakeholder endorsement. It is a strong candidate for inclusion in a national scale-up strategy. Discussion should focus on operational feasibility, mentor capacity, and how quickly cohorts can be rolled out across states.";
  } else if (res.bcr < 1 && res.endorseProb * 100 >= 50) {
    narrative =
      "Stakeholders respond positively to this design, but the current cost assumptions imply that benefits do not yet exceed costs. Options include reducing unit costs, focusing this configuration on priority states, or combining it with other tiers to create a balanced portfolio.";
  } else if (res.bcr >= 1 && res.endorseProb * 100 < 50) {
    narrative =
      "From a benefit–cost perspective this configuration performs acceptably, but predicted endorsement is limited. It may be suitable for more technical audiences, but broader buy-in may require adjustments to mentorship, incentives or delivery mode to better reflect expressed preferences.";
  } else {
    narrative =
      "Both stakeholder endorsement and benefit–cost performance are modest. This configuration should be treated as a reference point rather than a candidate for scale-up, unless assumptions are substantially revised in the Advanced settings.";
  }
  elements.modalNarrative.textContent = narrative;

  elements.resultsModal.classList.remove("hidden");
  elements.resultsModal.style.display = "block";
}

function closeResultsModal() {
  elements.resultsModal.classList.add("hidden");
  elements.resultsModal.style.display = "none";
}

/* -----------------------------------------------------
   13. WHAT-WOULD-IT-TAKE SOLVERS
----------------------------------------------------- */

function solveForTargetEndorsement() {
  const target = Number(elements.targetEndorseInput.value);
  if (!isFinite(target) || target <= 0 || target >= 100) {
    alert("Please enter a target endorsement between 5 and 95 percent.");
    return;
  }
  const cfg = appState.config;
  const prefModel = cfg.preferenceModel;
  const nonCostU = computeNonCostUtility(prefModel, cfg);
  const costCoef = prefModel === "mxl" ? MXL_COEFFS.costPerThousand : LC2_COEFFS.costPerThousand;
  const ascOptOut = prefModel === "mxl" ? MXL_COEFFS.ascOptOut : LC2_COEFFS.ascOptOut;

  const p = target / 100;
  const logit = Math.log(p / (1 - p));
  const costThousand =
    (logit - nonCostU + ascOptOut) / costCoef; // note costCoef is negative

  const cost = costThousand * 1000;
  const bounded = Math.min(400000, Math.max(75000, cost));

  if (!isFinite(cost) || costThousand <= 0) {
    alert("The target endorsement cannot be reached by adjusting only cost under current assumptions.");
    return;
  }

  if (bounded !== cost) {
    alert(
      "The cost required for this target lies outside the experimental range. The slider has been set to the nearest feasible value."
    );
  }

  elements.costSlider.value = bounded;
  updateCostSliderLabel();
  updateConfigFromInputs();
  const res = computeResults(appState.config);
  appState.lastResults = res;
  updateConfigSummary();
  updateResultsTab();
}

function solveForTargetBcr() {
  const target = Number(elements.targetBcrInput.value);
  if (!isFinite(target) || target <= 0) {
    alert("Please enter a positive target benefit–cost ratio.");
    return;
  }
  const cfg = appState.config;
  const res = appState.lastResults || computeResults(cfg);
  if (res.totalCostAllCohorts <= 0 || res.totalBenefitAllCohorts <= 0) {
    alert("Cannot solve for BCR because current benefit or cost is zero.");
    return;
  }
  const currentBcr = res.bcr;
  const currentCost = cfg.costPerTraineeMonth;
  const factor = currentBcr / target;
  const newCost = currentCost * factor;
  const bounded = Math.min(400000, Math.max(75000, newCost));

  if (bounded !== newCost) {
    alert(
      "The cost required for this target BCR lies outside the experimental range. The slider has been set to the nearest feasible value."
    );
  }

  elements.costSlider.value = bounded;
  updateCostSliderLabel();
  updateConfigFromInputs();
  const res2 = computeResults(appState.config);
  appState.lastResults = res2;
  updateConfigSummary();
  updateResultsTab();
}

/* -----------------------------------------------------
   14. MICRO TOUR
----------------------------------------------------- */

const TOUR_STEPS = [
  {
    title: "Welcome to STEPS",
    text: "STEPS combines discrete choice experiment evidence and costing to help you explore FETP scale-up options for India."
  },
  {
    title: "Configuration tab",
    text: "In Configuration you select programme tier, mentorship, response time, cost and number of cohorts, then apply the configuration and view results."
  },
  {
    title: "Results and national view",
    text: "The Results and National & sensitivity tabs show endorsement, costs, benefits and simple national scaling, including charts for quick discussion."
  },
  {
    title: "Saved scenarios and advanced settings",
    text: "Saved scenarios let you build a portfolio of options. Advanced & methods contains adjustable assumptions and the technical appendix."
  }
];

function startTour(reset) {
  if (!reset && localStorage.getItem("steps-tour-done") === "yes") return;
  appState.tourStep = 0;
  showTourStep();
  elements.tourOverlay.classList.remove("hidden");
  elements.tourOverlay.style.display = "block";
}

function showTourStep() {
  const step = TOUR_STEPS[appState.tourStep];
  if (!step) {
    endTour();
    return;
  }
  elements.tourTitle.textContent = step.title;
  elements.tourText.textContent = step.text;
}

function nextTourStep() {
  appState.tourStep += 1;
  if (appState.tourStep >= TOUR_STEPS.length) {
    endTour();
  } else {
    showTourStep();
  }
}

function endTour() {
  localStorage.setItem("steps-tour-done", "yes");
  elements.tourOverlay.classList.add("hidden");
  elements.tourOverlay.style.display = "none";
}

/* -----------------------------------------------------
   15. APPLY CONFIG TO INPUTS
----------------------------------------------------- */

function applyConfigToInputs() {
  const cfg = appState.config;
  elements.tierSelect.value = cfg.tier;
  elements.careerSelect.value = cfg.career;
  elements.mentorSelect.value = cfg.mentor;
  elements.deliverySelect.value = cfg.delivery;
  elements.responseSelect.value = cfg.response;
  elements.traineesInput.value = cfg.trainees;
  elements.cohortsInput.value = cfg.cohorts;
  elements.costSlider.value = cfg.costPerTraineeMonth;
  elements.oppCostToggle.checked = cfg.includeOpportunityCost;
  elements.costTemplateSelect.value = cfg.costTemplateKey;
  elements.prefModelSelect.value = cfg.preferenceModel;
  elements.scenarioNameInput.value = cfg.scenarioName;
  elements.scenarioTagsInput.value = cfg.scenarioTags;
  elements.scenarioNotesInput.value = cfg.scenarioNotes;
  updateCostSliderLabel();
}

/* -----------------------------------------------------
   16. TECH APPENDIX WINDOW
----------------------------------------------------- */

function openTechAppendixWindow() {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write("<html><head><title>STEPS technical appendix</title>");
  win.document.write(
    '<style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:16px;max-width:800px;margin:0 auto;line-height:1.5}h1,h2,h3{margin-top:1rem}pre{background:#111827;color:#e5e7eb;padding:8px;border-radius:6px;font-size:0.8rem;overflow:auto}</style>'
  );
  win.document.write("</head><body>");
  win.document.write("<h1>STEPS – technical appendix</h1>");
  win.document.write(
    "<p>This appendix summarises the main equations and assumptions used in the STEPS decision aid. It is intended for technical readers who wish to understand how the tool links discrete choice experiment (DCE) results, costing data and epidemiological multipliers.</p>"
  );
  win.document.write(elements.techSummary.innerHTML);
  win.document.write(
    "<p>Prepared by Mesfin Genie, PhD, Newcastle Business School, The University of Newcastle, Australia.</p>"
  );
  win.document.write("</body></html>");
  win.document.close();
}

/* -----------------------------------------------------
   17. EVENT LISTENERS SETUP
----------------------------------------------------- */

function setupEventListeners() {
  // config inputs
  [
    elements.tierSelect,
    elements.careerSelect,
    elements.mentorSelect,
    elements.deliverySelect,
    elements.responseSelect,
    elements.traineesInput,
    elements.cohortsInput,
    elements.costSlider,
    elements.oppCostToggle,
    elements.costTemplateSelect,
    elements.prefModelSelect,
    elements.scenarioNameInput,
    elements.scenarioTagsInput,
    elements.scenarioNotesInput
  ].forEach((el) => {
    if (!el) return;
    const evt = el === elements.costSlider ? "input" : "change";
    el.addEventListener(evt, () => {
      updateConfigFromInputs();
      const res = computeResults(appState.config);
      appState.lastResults = res;
      updateConfigSummary();
    });
  });

  elements.applyConfigBtn.addEventListener("click", () => {
    updateConfigFromInputs();
    const res = computeResults(appState.config);
    appState.lastResults = res;
    updateConfigSummary();
    updateResultsTab();
    alert("Configuration applied and results updated.");
  });

  elements.viewResultsBtn.addEventListener("click", () => {
    updateConfigFromInputs();
    const res = computeResults(appState.config);
    appState.lastResults = res;
    updateConfigSummary();
    updateResultsTab();
    openResultsModal();
  });

  elements.saveScenarioBtn.addEventListener("click", saveCurrentScenario);
  elements.showShortlistOnly.addEventListener("change", renderScenariosTable);
  elements.generateBriefingBtn.addEventListener("click", generateBriefingText);
  elements.copyBriefingBtn.addEventListener("click", copyBriefingToClipboard);
  elements.downloadExcelBtn.addEventListener("click", downloadScenariosExcel);
  elements.downloadPdfBtn.addEventListener("click", downloadPolicyBriefPdf);

  elements.solveEndorseBtn.addEventListener("click", solveForTargetEndorsement);
  elements.solveBcrBtn.addEventListener("click", solveForTargetBcr);

  // advanced
  [
    elements.advHorizonInput,
    elements.advFrontlineOutbreaks,
    elements.advIntermediateOutbreaks,
    elements.advAdvancedOutbreaks,
    elements.advValuePerOutbreak,
    elements.advValuePerGraduate,
    elements.advExchangeRate,
    elements.currencyDisplaySelect
  ].forEach((el) => {
    el.addEventListener("change", updateAdvancedFromInputs);
  });

  elements.resetAdvancedBtn.addEventListener("click", resetAdvancedSettings);
  elements.openTechWindowBtn.addEventListener("click", openTechAppendixWindow);

  // modal
  elements.closeResultsModal.addEventListener("click", closeResultsModal);
  elements.modalCloseBtn.addEventListener("click", closeResultsModal);
  elements.modalSaveScenarioBtn.addEventListener("click", () => {
    saveCurrentScenario();
    closeResultsModal();
  });

  // tour
  elements.tourSkipBtn.addEventListener("click", endTour);
  elements.tourNextBtn.addEventListener("click", nextTourStep);
  elements.restartTourBtn.addEventListener("click", () => startTour(true));
}

/* -----------------------------------------------------
   18. INITIALISATION
----------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  setupTabs();
  setupEventListeners();
  applyConfigToInputs();
  loadAdvancedIntoInputs();
  const res = computeResults(appState.config);
  appState.lastResults = res;
  updateConfigSummary();
  updateResultsTab();
  renderScenariosTable();
  startTour(false);
});
