// script.js
/* ===================================================
   STEPS FETP India Decision Aid
   Accessible, policy ready, scenario focused script
   =================================================== */

(function () {
    "use strict";

    /* ===========================
       Global constants and state
       =========================== */

    const APP_VERSION = "1.3.2";
    const MODEL_VERSION = "MXL-2025-12";

    const STORAGE_KEYS = {
        THEME: "steps_theme",
        SCENARIOS: "steps_scenarios",
        ASSUMPTIONS: "steps_assumptions",
        LAST_STATE: "steps_last_state"
    };

    // Mixed logit coefficients from the preference study
    const MXL_COEFS = {
        ascProgram: 0.168,
        ascOptOut: -0.601,
        tier: {
            frontline: 0.0,
            intermediate: 0.220,
            advanced: 0.487
        },
        career: {
            certificate: 0.0,
            uniqual: 0.017,
            career_path: -0.122
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
            30: 0.0,
            15: 0.546,
            7: 0.900
        },
        // simple cost coefficient for illustrative WTP scaling
        costPerLakh: -0.15
    };

    const DEFAULT_ASSUMPTION_SETS = {
        "mohfw-baseline": {
            id: "mohfw-baseline",
            label: "MoHFW baseline assumptions",
            discountRate: 0.03,
            outbreakValue: 30000000000,
            opportunityCostShare: 0.2,
            note: "Reference set aligned with indicative MoHFW style baselines."
        },
        "wb-downside": {
            id: "wb-downside",
            label: "World Bank conservative downside",
            discountRate: 0.05,
            outbreakValue: 20000000000,
            opportunityCostShare: 0.25,
            note: "For cautious tests of benefit cost robustness."
        },
        "wb-upside": {
            id: "wb-upside",
            label: "World Bank optimistic upside",
            discountRate: 0.03,
            outbreakValue: 50000000000,
            opportunityCostShare: 0.15,
            note: "For ambitious planning scenarios with higher value per response."
        }
    };

    const DEFAULT_CONFIG = {
        scenarioId: "baseline-1",
        scenarioName: "Baseline scale up",
        assumptionSetId: "mohfw-baseline",
        traineesPerCohort: 25,
        numberOfCohorts: 4,
        planningHorizonYears: 5,
        endorsementRate: 0.8,
        completionRate: 0.9,
        responseDays: 7,
        tier: "frontline",
        costPerTraineeInr: 400000
    };

    const POLICY_PRESETS = {
        baseline: {
            label: "Baseline roll out",
            description: "Programme similar to current expectations with moderate scale up.",
            configOverrides: {
                traineesPerCohort: 25,
                numberOfCohorts: 4,
                planningHorizonYears: 5,
                tier: "frontline",
                costPerTraineeInr: 400000
            },
            assumptionSetId: "mohfw-baseline"
        },
        scale_up: {
            label: "Ambitious scale up",
            description: "Larger cohorts and more cohorts over the horizon to expand capacity quickly.",
            configOverrides: {
                traineesPerCohort: 35,
                numberOfCohorts: 6,
                planningHorizonYears: 5,
                tier: "intermediate",
                costPerTraineeInr: 500000
            },
            assumptionSetId: "wb-upside"
        },
        budget_cap: {
            label: "Budget constrained roll out",
            description: "Restricts total trainees while preserving advanced tier benefits.",
            configOverrides: {
                traineesPerCohort: 20,
                numberOfCohorts: 3,
                planningHorizonYears: 5,
                tier: "advanced",
                costPerTraineeInr: 450000
            },
            assumptionSetId: "wb-downside"
        }
    };

    const STATE = {
        config: { ...DEFAULT_CONFIG },
        assumptionSets: { ...DEFAULT_ASSUMPTION_SETS },
        scenarios: [],
        charts: {},
        currentTabId: "aboutTab"
    };

    /* ===========================
       Utility helpers
       =========================== */

    function parseNumber(value, fallback) {
        const num = typeof value === "number" ? value : parseFloat(String(value).replace(/,/g, ""));
        return Number.isFinite(num) ? num : fallback;
    }

    function clamp(value, min, max) {
        const v = parseNumber(value, min);
        if (!Number.isFinite(v)) return min;
        if (v < min) return min;
        if (v > max) return max;
        return v;
    }

    function formatNumber(value, decimals) {
        const v = parseNumber(value, 0);
        return v.toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    function formatPercent(value, decimals) {
        const v = parseNumber(value, 0);
        return (v * 100).toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }) + " %";
    }

    function getNowIso() {
        return new Date().toISOString();
    }

    function safeQuerySelector(selector) {
        try {
            return document.querySelector(selector);
        } catch (e) {
            return null;
        }
    }

    function safeQuerySelectorAll(selector) {
        try {
            return Array.from(document.querySelectorAll(selector));
        } catch (e) {
            return [];
        }
    }

    function setText(selectors, value) {
        const list = Array.isArray(selectors) ? selectors : [selectors];
        for (let i = 0; i < list.length; i++) {
            const el = safeQuerySelector(list[i]);
            if (el) {
                el.textContent = value;
                return;
            }
        }
    }

    /* ===========================
       Toast notifications
       =========================== */

    function ensureToastContainer() {
        let container = document.querySelector(".toast-container");
        if (!container) {
            container = document.createElement("div");
            container.className = "toast-container";
            container.setAttribute("aria-live", "polite");
            container.setAttribute("aria-atomic", "true");
            document.body.appendChild(container);
        }
        return container;
    }

    function showToast(message, type) {
        const container = ensureToastContainer();
        const toast = document.createElement("div");
        toast.className = "toast";
        if (type === "success") toast.classList.add("toast-success");
        if (type === "warning") toast.classList.add("toast-warning");
        if (type === "error") toast.classList.add("toast-error");

        const msgSpan = document.createElement("span");
        msgSpan.textContent = message;

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "icon-button";
        closeBtn.setAttribute("aria-label", "Dismiss notification");
        closeBtn.innerHTML = "×";

        closeBtn.addEventListener("click", function () {
            if (toast.parentElement === container) {
                container.removeChild(toast);
            }
        });

        toast.appendChild(msgSpan);
        toast.appendChild(closeBtn);
        container.appendChild(toast);

        setTimeout(function () {
            if (toast.parentElement === container) {
                container.removeChild(toast);
            }
        }, 5000);
    }

    /* ===========================
       Tooltip system
       =========================== */

    let globalTooltipEl = null;

    function ensureGlobalTooltip() {
        if (globalTooltipEl) return globalTooltipEl;
        globalTooltipEl = document.querySelector(".global-tooltip");
        if (!globalTooltipEl) {
            globalTooltipEl = document.createElement("div");
            globalTooltipEl.className = "global-tooltip";
            globalTooltipEl.innerHTML = '<div class="tooltip-title"></div><div class="tooltip-body"></div>';
            document.body.appendChild(globalTooltipEl);
        }
        return globalTooltipEl;
    }

    function showTooltipForTarget(target) {
        const title = target.getAttribute("data-tooltip-title");
        const body = target.getAttribute("data-tooltip-body");
        if (!title && !body) return;

        const tooltip = ensureGlobalTooltip();
        const titleEl = tooltip.querySelector(".tooltip-title");
        const bodyEl = tooltip.querySelector(".tooltip-body");

        if (titleEl) titleEl.textContent = title || "";
        if (bodyEl) bodyEl.textContent = body || "";

        tooltip.classList.add("visible");

        const rect = target.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        let top = rect.bottom + 8 + window.scrollY;
        let left = rect.left + window.scrollX;

        if (left + tooltipRect.width > window.scrollX + window.innerWidth - 12) {
            left = window.scrollX + window.innerWidth - tooltipRect.width - 12;
        }
        if (left < 8) left = 8;

        if (top + tooltipRect.height > window.scrollY + window.innerHeight - 8) {
            top = rect.top + window.scrollY - tooltipRect.height - 8;
        }
        if (top < 8) top = rect.bottom + 8 + window.scrollY;

        tooltip.style.top = top + "px";
        tooltip.style.left = left + "px";
    }

    function hideTooltip() {
        if (!globalTooltipEl) return;
        globalTooltipEl.classList.remove("visible");
    }

    function initTooltips() {
        const triggers = safeQuerySelectorAll(".tooltip-trigger");
        if (!triggers.length) return;

        function handlerEnter() {
            showTooltipForTarget(this);
        }
        function handlerLeave() {
            hideTooltip();
        }

        triggers.forEach(function (el) {
            el.addEventListener("mouseenter", handlerEnter);
            el.addEventListener("mouseleave", handlerLeave);
            el.addEventListener("focus", handlerEnter);
            el.addEventListener("blur", handlerLeave);
        });
    }

    /* ===========================
       Theme management
       =========================== */

    function applyTheme(themeName) {
        const body = document.body;
        if (body) {
            body.setAttribute("data-theme", themeName);
        }
        try {
            localStorage.setItem(STORAGE_KEYS.THEME, themeName);
        } catch (e) { }

        const pills = safeQuerySelectorAll(".pill-toggle[data-theme-name]");
        pills.forEach(function (pill) {
            if (pill.getAttribute("data-theme-name") === themeName) {
                pill.classList.add("active");
                pill.setAttribute("aria-pressed", "true");
            } else {
                pill.classList.remove("active");
                pill.setAttribute("aria-pressed", "false");
            }
        });
    }

    function initThemePills() {
        let storedTheme = null;
        try {
            storedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
        } catch (e) {
            storedTheme = null;
        }
        const body = document.body;
        const currentTheme = storedTheme || (body ? body.getAttribute("data-theme") : null) || "worldbank-light";
        applyTheme(currentTheme);

        const pills = safeQuerySelectorAll(".pill-toggle[data-theme-name]");
        pills.forEach(function (pill) {
            pill.addEventListener("click", function () {
                const themeName = pill.getAttribute("data-theme-name");
                if (themeName) {
                    applyTheme(themeName);
                    showToast("Theme updated to " + pill.textContent.trim(), "success");
                }
            });
        });
    }

    /* ===========================
       Tabs and keyboard navigation
       =========================== */

    function setActiveTab(tabId) {
        STATE.currentTabId = tabId;

        const tabs = safeQuerySelectorAll(".tabcontent");
        tabs.forEach(function (tab) {
            if (tab.id === tabId) {
                tab.classList.add("active");
                tab.removeAttribute("hidden");
            } else {
                tab.classList.remove("active");
                tab.setAttribute("hidden", "true");
            }
        });

        const tabButtons = safeQuerySelectorAll(".tablink");
        tabButtons.forEach(function (btn) {
            const target = btn.getAttribute("data-tab");
            const isActive = target === tabId;
            btn.classList.toggle("active", isActive);
            btn.setAttribute("aria-selected", isActive ? "true" : "false");
            btn.setAttribute("tabindex", isActive ? "0" : "-1");
        });
    }

    function handleTabKeydown(event, tabButtons) {
        const key = event.key;
        if (["ArrowLeft", "ArrowRight", "Home", "End"].indexOf(key) === -1) return;

        event.preventDefault();
        const currentIndex = tabButtons.indexOf(event.currentTarget);
        let newIndex = currentIndex;

        if (key === "ArrowLeft") {
            newIndex = currentIndex > 0 ? currentIndex - 1 : tabButtons.length - 1;
        } else if (key === "ArrowRight") {
            newIndex = currentIndex < tabButtons.length - 1 ? currentIndex + 1 : 0;
        } else if (key === "Home") {
            newIndex = 0;
        } else if (key === "End") {
            newIndex = tabButtons.length - 1;
        }

        const newBtn = tabButtons[newIndex];
        if (newBtn) {
            newBtn.focus();
            newBtn.click();
        }
    }

    function initTabs() {
        const tabButtons = safeQuerySelectorAll(".tablink");
        if (!tabButtons.length) return;

        tabButtons.forEach(function (btn) {
            const tabId = btn.getAttribute("data-tab");
            btn.setAttribute("role", "tab");
            btn.setAttribute("aria-controls", tabId);
            btn.setAttribute("tabindex", "-1");
            btn.addEventListener("click", function () {
                setActiveTab(tabId);
            });
            btn.addEventListener("keydown", function (event) {
                handleTabKeydown(event, tabButtons);
            });
        });

        const tabLists = safeQuerySelectorAll('[role="tablist"]');
        tabLists.forEach(function (list) {
            list.setAttribute("aria-orientation", "horizontal");
        });

        const activeBtn = tabButtons.find(function (b) { return b.classList.contains("active"); }) || tabButtons[0];
        if (activeBtn) {
            const tabId = activeBtn.getAttribute("data-tab");
            setActiveTab(tabId);
        }
    }

    /* ===========================
       Config and settings reading
       =========================== */

    function readConfigFromUI() {
        const cfg = { ...STATE.config };

        const nameEl = safeQuerySelector("#input-scenario-name");
        const idEl = safeQuerySelector("#input-scenario-id");
        const asEl = safeQuerySelector("#input-assumption-set-id");
        const tierEl = safeQuerySelector("#input-tier");
        const traineesEl = safeQuerySelector("#input-trainees-per-cohort");
        const cohortsEl = safeQuerySelector("#input-number-of-cohorts");
        const horizonEl = safeQuerySelector("#input-planning-horizon");
        const endEl = safeQuerySelector("#input-endorsement-rate");
        const compEl = safeQuerySelector("#input-completion-rate");
        const costSliderEl = safeQuerySelector("#input-cost-per-trainee");
        const respEl = safeQuerySelector("#input-response-days");

        if (nameEl && nameEl.value.trim()) cfg.scenarioName = nameEl.value.trim();
        if (idEl && idEl.value.trim()) cfg.scenarioId = idEl.value.trim();
        if (asEl && asEl.value) cfg.assumptionSetId = asEl.value;
        if (tierEl && tierEl.value) cfg.tier = tierEl.value;

        if (traineesEl) {
            const v = clamp(traineesEl.value, 1, 500);
            cfg.traineesPerCohort = v;
            traineesEl.value = v;
        }
        if (cohortsEl) {
            const v = clamp(cohortsEl.value, 1, 200);
            cfg.numberOfCohorts = v;
            cohortsEl.value = v;
        }
        if (horizonEl) {
            const v = clamp(horizonEl.value, 1, 30);
            cfg.planningHorizonYears = v;
            horizonEl.value = v;
        }
        if (endEl) {
            const v = clamp(endEl.value, 0, 1);
            cfg.endorsementRate = v;
            endEl.value = v;
        }
        if (compEl) {
            const v = clamp(compEl.value, 0, 1);
            cfg.completionRate = v;
            compEl.value = v;
        }
        if (costSliderEl) {
            const v = clamp(costSliderEl.value, 100000, 800000);
            cfg.costPerTraineeInr = v;
            costSliderEl.value = v;
            updateCostSliderLabel(v);
        }

        if (respEl) {
            const v = parseInt(respEl.value, 10);
            cfg.responseDays = Number.isFinite(v) ? v : 7;
            respEl.value = "7";
        } else {
            cfg.responseDays = cfg.responseDays || 7;
        }

        if (!cfg.scenarioId) {
            cfg.scenarioId = "sc-" + Date.now().toString(36);
            if (idEl) idEl.value = cfg.scenarioId;
        }

        STATE.config = cfg;
        return cfg;
    }

    function writeConfigToUI(cfg) {
        const config = cfg || STATE.config;

        const nameEl = safeQuerySelector("#input-scenario-name");
        const idEl = safeQuerySelector("#input-scenario-id");
        const asEl = safeQuerySelector("#input-assumption-set-id");
        const tierEl = safeQuerySelector("#input-tier");
        const traineesEl = safeQuerySelector("#input-trainees-per-cohort");
        const cohortsEl = safeQuerySelector("#input-number-of-cohorts");
        const horizonEl = safeQuerySelector("#input-planning-horizon");
        const endEl = safeQuerySelector("#input-endorsement-rate");
        const compEl = safeQuerySelector("#input-completion-rate");
        const costSliderEl = safeQuerySelector("#input-cost-per-trainee");
        const respEl = safeQuerySelector("#input-response-days");

        if (nameEl) nameEl.value = config.scenarioName || "";
        if (idEl) idEl.value = config.scenarioId || "";
        if (asEl) asEl.value = config.assumptionSetId || "mohfw-baseline";
        if (tierEl) tierEl.value = config.tier || "frontline";
        if (traineesEl) traineesEl.value = config.traineesPerCohort;
        if (cohortsEl) cohortsEl.value = config.numberOfCohorts;
        if (horizonEl) horizonEl.value = config.planningHorizonYears;
        if (endEl) endEl.value = config.endorsementRate;
        if (compEl) compEl.value = config.completionRate;
        if (costSliderEl) {
            costSliderEl.value = config.costPerTraineeInr;
            updateCostSliderLabel(config.costPerTraineeInr);
        }
        if (respEl) respEl.value = String(config.responseDays || 7);
    }

    function readAssumptionsFromUI() {
        const currentId = STATE.config.assumptionSetId || "mohfw-baseline";
        const base = STATE.assumptionSets[currentId] || DEFAULT_ASSUMPTION_SETS["mohfw-baseline"];
        const assumptions = { ...base };

        const discountEl = safeQuerySelector("#settings-discount-rate");
        const outbreakEl = safeQuerySelector("#settings-outbreak-value");
        const oppEl = safeQuerySelector("#settings-opp-cost-share");

        if (discountEl) {
            assumptions.discountRate = clamp(discountEl.value, 0, 0.2);
            discountEl.value = assumptions.discountRate;
        }
        if (outbreakEl) {
            assumptions.outbreakValue = clamp(outbreakEl.value, 0, 100000000000);
            outbreakEl.value = assumptions.outbreakValue;
        }
        if (oppEl) {
            assumptions.opportunityCostShare = clamp(oppEl.value, 0, 1);
            oppEl.value = assumptions.opportunityCostShare;
        }

        assumptions.id = currentId;
        STATE.assumptionSets[currentId] = assumptions;
        return assumptions;
    }

    function writeAssumptionsToUI(assumptions) {
        const a = assumptions || readAssumptionsFromUI();
        const discountEl = safeQuerySelector("#settings-discount-rate");
        const outbreakEl = safeQuerySelector("#settings-outbreak-value");
        const oppEl = safeQuerySelector("#settings-opp-cost-share");
        const presetSelect = safeQuerySelector("#settings-assumption-preset");

        if (discountEl) discountEl.value = a.discountRate;
        if (outbreakEl) outbreakEl.value = a.outbreakValue;
        if (oppEl) oppEl.value = a.opportunityCostShare;
        if (presetSelect) presetSelect.value = a.id;
    }

    function initSettingsForm() {
        const presetSelect = safeQuerySelector("#settings-assumption-preset");
        if (presetSelect) {
            presetSelect.innerHTML = "";
            Object.values(STATE.assumptionSets).forEach(function (set) {
                const opt = document.createElement("option");
                opt.value = set.id;
                opt.textContent = set.label;
                presetSelect.appendChild(opt);
            });
            presetSelect.addEventListener("change", function () {
                const id = presetSelect.value;
                if (STATE.assumptionSets[id]) {
                    STATE.config.assumptionSetId = id;
                    writeAssumptionsToUI(STATE.assumptionSets[id]);
                    recalculateAndRender();
                    appendSettingsLog("Switched assumption set to " + STATE.assumptionSets[id].label + ".");
                    showToast("Assumption set applied", "success");
                }
            });
        }

        writeAssumptionsToUI();

        const applyBtn = safeQuerySelector("#btn-apply-settings");
        if (applyBtn) {
            applyBtn.addEventListener("click", function () {
                const assumptions = readAssumptionsFromUI();
                recalculateAndRender();
                appendSettingsLog("Updated assumption values for set \"" + (assumptions.label || assumptions.id) + "\".");
                showToast("Settings applied and log updated", "success");
            });
        }
    }

    function appendSettingsLog(message) {
        const logArea = safeQuerySelector("#settings-log");
        const timestamp = new Date().toLocaleString();
        const line = "[" + timestamp + "] " + message;
        if (logArea) {
            logArea.value = (logArea.value ? logArea.value + "\n" : "") + line;
            logArea.scrollTop = logArea.scrollHeight;
        }
    }

    /* ===========================
       MXL utility and endorsement
       =========================== */

    function computeProgrammeUtility(config) {
        const tier = config.tier || "frontline";

        const uTier = MXL_COEFS.tier[tier] || 0;
        const uCareer = MXL_COEFS.career.uniqual;
        const uMentor = MXL_COEFS.mentorship.high;
        const uDelivery = MXL_COEFS.delivery.blended;
        const uResponse = MXL_COEFS.response[config.responseDays] || 0;

        const costLakh = (config.costPerTraineeInr || 0) / 100000;
        const uCost = (MXL_COEFS.costPerLakh || 0) * costLakh;

        const uProgramme = MXL_COEFS.ascProgram + uTier + uCareer + uMentor + uDelivery + uResponse + uCost;
        const uOptOut = MXL_COEFS.ascOptOut;

        const maxU = Math.max(uProgramme, uOptOut, 0);
        const eProg = Math.exp(uProgramme - maxU);
        const eOpt = Math.exp(uOptOut - maxU);
        const eNone = Math.exp(0 - maxU);

        const denom = eProg + eOpt + eNone;
        const pProgramme = denom > 0 ? eProg / denom : 0.5;
        const pOptOut = denom > 0 ? eOpt / denom : 0.25;
        const pNone = denom > 0 ? eNone / denom : 0.25;

        return {
            pProgramme: pProgramme,
            pOptOut: pOptOut,
            pNone: pNone,
            utilityProgramme: uProgramme,
            utilityOptOut: uOptOut
        };
    }

    /* ===========================
       Calculation logic
       =========================== */

    function presentValueAnnuity(flow, rate, years) {
        const r = Math.max(0, parseNumber(rate, 0));
        const n = Math.max(1, parseInt(years, 10) || 1);
        if (r === 0) return flow * n;
        const factor = (1 - Math.pow(1 + r, -n)) / r;
        return flow * factor;
    }

    function computeScenarioIndicators(config, assumptions) {
        const traineesPerCohort = clamp(config.traineesPerCohort, 1, 500);
        const numberOfCohorts = clamp(config.numberOfCohorts, 1, 200);
        const horizon = clamp(config.planningHorizonYears, 1, 30);
        const completionRate = clamp(config.completionRate, 0, 1);

        const mxl = computeProgrammeUtility(config);
        const endorsementRate = mxl.pProgramme;

        const traineesPerYear = traineesPerCohort * numberOfCohorts;
        const totalTrainees = traineesPerYear * horizon;
        const graduatesTotal = totalTrainees * completionRate;
        const graduatesEndorsed = graduatesTotal * endorsementRate;

        const baseOutbreakResponsesPerGraduatePerYear = 0.25;
        const responseDays = config.responseDays || 7;
        const scaleResponse = responseDays === 7 ? 1.0 : responseDays === 15 ? 0.8 : 0.6;

        const outbreakResponsesPerYear = graduatesEndorsed * baseOutbreakResponsesPerGraduatePerYear * scaleResponse;
        const outbreakResponsesPerCohortPerYear = outbreakResponsesPerYear / Math.max(1, numberOfCohorts);

        const costPerTrainee = config.costPerTraineeInr || 400000;
        const oppShare = assumptions.opportunityCostShare;
        const directCostsPV = presentValueAnnuity(costPerTrainee * traineesPerYear, assumptions.discountRate, horizon);
        const opportunityCostPV = directCostsPV * oppShare;
        const totalCostPV = directCostsPV + opportunityCostPV;

        const benefitFlow = outbreakResponsesPerYear * assumptions.outbreakValue;
        const totalBenefitPV = presentValueAnnuity(benefitFlow, assumptions.discountRate, horizon);
        const npv = totalBenefitPV - totalCostPV;
        const bcr = totalCostPV > 0 ? totalBenefitPV / totalCostPV : null;

        return {
            traineesPerYear: traineesPerYear,
            totalTrainees: totalTrainees,
            graduatesTotal: graduatesTotal,
            graduatesEndorsed: graduatesEndorsed,
            outbreakResponsesPerYear: outbreakResponsesPerYear,
            outbreakResponsesPerCohortPerYear: outbreakResponsesPerCohortPerYear,
            totalCostPV: totalCostPV,
            directCostsPV: directCostsPV,
            opportunityCostPV: opportunityCostPV,
            totalBenefitPV: totalBenefitPV,
            npv: npv,
            bcr: bcr,
            endorsementRate: endorsementRate,
            completionRate: completionRate,
            responseDays: responseDays,
            horizon: horizon,
            assumptionSetId: assumptions.id
        };
    }

    /* ===========================
       Rendering functions
       =========================== */

    function renderHeadlineIndicators(indicators) {
        setText(["#summary-endorsement"], formatPercent(indicators.endorsementRate, 1));
        setText(["#summary-bcr"], indicators.bcr != null ? formatNumber(indicators.bcr, 2) : "n/a");
        setText(["#summary-npv"], formatNumber(indicators.npv, 0));
        setText(["#summary-trainees"], formatNumber(indicators.totalTrainees, 0));

        const hintBcr = safeQuerySelector("#hint-bcr");
        if (hintBcr) {
            if (indicators.bcr != null && indicators.bcr > 1) {
                hintBcr.textContent = "Value above 1 suggests benefits exceed economic costs.";
            } else if (indicators.bcr != null) {
                hintBcr.textContent = "Value below 1 suggests costs exceed measured monetary benefits.";
            } else {
                hintBcr.textContent = "Benefit cost ratio is not available for this configuration.";
            }
        }

        const hintEndorsement = safeQuerySelector("#hint-endorsement");
        if (hintEndorsement) {
            if (indicators.endorsementRate >= 0.7) {
                hintEndorsement.textContent = "Above 70 percent typically indicates strong support in the preference study context.";
            } else if (indicators.endorsementRate >= 0.5) {
                hintEndorsement.textContent = "Between 50 and 70 percent indicates moderate endorsement in the preference study context.";
            } else {
                hintEndorsement.textContent = "Below 50 percent suggests limited endorsement and potential acceptability concerns.";
            }
        }
    }

    function renderConfigSummary(config, indicators, assumptions) {
        setText(["#summary-config-trainees-per-cohort"], formatNumber(config.traineesPerCohort, 0));
        setText(["#summary-config-number-of-cohorts"], formatNumber(config.numberOfCohorts, 0));
        setText(["#summary-config-horizon-years"], formatNumber(config.planningHorizonYears, 0));
        setText(["#summary-config-endorsement"], formatPercent(indicators.endorsementRate, 1));
        setText(["#summary-config-completion"], formatPercent(indicators.completionRate, 1));

        const assumptionEl = safeQuerySelector("#summary-assumption-label");
        if (assumptionEl && assumptions) {
            assumptionEl.textContent = assumptions.label || assumptions.id;
        }

        setText(["#summary-cost-direct"], formatNumber(indicators.directCostsPV, 0));
        setText(["#summary-cost-opportunity"], formatNumber(indicators.opportunityCostPV, 0));
        setText(["#summary-cost-total"], formatNumber(indicators.totalCostPV, 0));
        setText(["#summary-benefit-pv"], formatNumber(indicators.totalBenefitPV, 0));
    }

    function renderNationalSummary(config, indicators) {
        setText(["#national-graduates"], formatNumber(indicators.graduatesTotal, 0));
        const totalOutbreaks = indicators.outbreakResponsesPerYear * config.planningHorizonYears;
        setText(["#national-outbreaks"], formatNumber(totalOutbreaks, 0));
        setText(["#national-label-horizon"], formatNumber(config.planningHorizonYears, 0));
    }

    function renderScenarioTable() {
        const tableBody = safeQuerySelector("#scenario-table tbody");
        if (!tableBody) return;

        tableBody.innerHTML = "";
        if (!STATE.scenarios.length) return;

        STATE.scenarios.forEach(function (sc, index) {
            const tr = document.createElement("tr");

            function td(text) {
                const el = document.createElement("td");
                el.textContent = text;
                return el;
            }

            tr.appendChild(td(String(index + 1)));
            tr.appendChild(td(sc.name));
            tr.appendChild(td(sc.id));
            tr.appendChild(td(sc.assumptionLabel || sc.assumptionSetId));
            tr.appendChild(td(sc.indicators.bcr != null ? formatNumber(sc.indicators.bcr, 2) : "n/a"));
            tr.appendChild(td(formatNumber(sc.indicators.npv, 0)));

            const tdActions = document.createElement("td");
            const loadBtn = document.createElement("button");
            loadBtn.type = "button";
            loadBtn.className = "btn-ghost small-btn";
            loadBtn.textContent = "Load";
            loadBtn.addEventListener("click", function () {
                STATE.config = { ...sc.config };
                writeConfigToUI(STATE.config);
                STATE.config.assumptionSetId = sc.assumptionSetId;
                writeAssumptionsToUI(STATE.assumptionSets[sc.assumptionSetId] || DEFAULT_ASSUMPTION_SETS["mohfw-baseline"]);
                recalculateAndRender();
                showToast('Scenario "' + sc.name + '" loaded into configuration', "success");
            });
            tdActions.appendChild(loadBtn);
            tr.appendChild(tdActions);

            tableBody.appendChild(tr);
        });
    }

    function renderDiagnostics(config, assumptions, indicators) {
        const diagnosticsEl = safeQuerySelector("#diagnosticsContent");
        if (!diagnosticsEl) return;

        const payload = {
            timestamp: getNowIso(),
            appVersion: APP_VERSION,
            modelVersion: MODEL_VERSION,
            config: config,
            assumptions: assumptions,
            indicators: indicators
        };

        diagnosticsEl.textContent = JSON.stringify(payload, null, 2);
    }

    /* ===========================
       Charts
       =========================== */

    function renderSimpleCharts(config, indicators) {
        if (typeof window === "undefined" || typeof window.Chart === "undefined") {
            return;
        }

        const chartMap = [
            { canvasId: "chart-costs", type: "bar" },
            { canvasId: "chart-benefits", type: "bar" },
            { canvasId: "chart-outbreaks", type: "bar" }
        ];

        chartMap.forEach(function (info) {
            const canvas = safeQuerySelector("#" + info.canvasId);
            if (!canvas || !canvas.getContext) return;

            if (STATE.charts[info.canvasId]) {
                STATE.charts[info.canvasId].destroy();
            }

            let chart = null;

            if (info.canvasId === "chart-costs") {
                chart = new Chart(canvas.getContext("2d"), {
                    type: "bar",
                    data: {
                        labels: ["Direct costs", "Opportunity cost"],
                        datasets: [{
                            label: "Present value (INR)",
                            data: [indicators.directCostsPV, indicators.opportunityCostPV]
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            y: {
                                ticks: {
                                    callback: function (value) { return value / 1e6 + "m"; }
                                }
                            }
                        }
                    }
                });
            } else if (info.canvasId === "chart-benefits") {
                chart = new Chart(canvas.getContext("2d"), {
                    type: "bar",
                    data: {
                        labels: ["Benefits", "Costs"],
                        datasets: [{
                            label: "Present value (INR)",
                            data: [indicators.totalBenefitPV, indicators.totalCostPV]
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            y: {
                                ticks: {
                                    callback: function (value) { return value / 1e6 + "m"; }
                                }
                            }
                        }
                    }
                });
            } else if (info.canvasId === "chart-outbreaks") {
                chart = new Chart(canvas.getContext("2d"), {
                    type: "bar",
                    data: {
                        labels: ["Per year", "Per cohort per year"],
                        datasets: [{
                            label: "Outbreak responses",
                            data: [indicators.outbreakResponsesPerYear, indicators.outbreakResponsesPerCohortPerYear]
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { display: false }
                        }
                    }
                });
            }

            STATE.charts[info.canvasId] = chart;
        });

        setText("#chart-costs-summary",
            "Direct training and opportunity costs sum to about " +
            formatNumber(indicators.totalCostPV, 0) +
            " in present value terms.");

        setText("#chart-benefits-summary",
            "Present value of outbreak response benefits is about " +
            formatNumber(indicators.totalBenefitPV, 0) +
            ", yielding a benefit cost ratio of " +
            (indicators.bcr != null ? formatNumber(indicators.bcr, 2) : "n/a") + ".");

        setText("#chart-outbreaks-summary",
            "Graduates deliver roughly " +
            formatNumber(indicators.outbreakResponsesPerYear, 1) +
            " outbreak responses per year, or " +
            formatNumber(indicators.outbreakResponsesPerCohortPerYear, 2) +
            " per cohort per year over the planning horizon.");
    }

    /* ===========================
       Scenario management
       =========================== */

    function addScenarioFromCurrentConfig() {
        const config = { ...STATE.config };
        const assumptions = readAssumptionsFromUI();
        const indicators = computeScenarioIndicators(config, assumptions);

        const scenario = {
            id: config.scenarioId || ("sc-" + Date.now().toString(36)),
            name: config.scenarioName || ("Scenario " + (STATE.scenarios.length + 1)),
            createdAt: getNowIso(),
            assumptionSetId: assumptions.id,
            assumptionLabel: assumptions.label,
            config: config,
            indicators: indicators
        };

        const existingIndex = STATE.scenarios.findIndex(function (s) { return s.id === scenario.id; });
        if (existingIndex >= 0) {
            STATE.scenarios[existingIndex] = scenario;
        } else {
            STATE.scenarios.push(scenario);
        }
        persistState();
        renderScenarioTable();
    }

    function initScenarioControls() {
        const saveBtn = safeQuerySelector("#btn-save-scenario");
        const newBtn = safeQuerySelector("#btn-new-scenario");

        if (saveBtn) {
            saveBtn.addEventListener("click", function () {
                readConfigFromUI();
                addScenarioFromCurrentConfig();
                showToast("Scenario saved to library", "success");
            });
        }

        if (newBtn) {
            newBtn.addEventListener("click", function () {
                const newId = "sc-" + Date.now().toString(36);
                STATE.config = { ...DEFAULT_CONFIG, scenarioId: newId, scenarioName: "New scenario" };
                writeConfigToUI(STATE.config);
                recalculateAndRender();
                showToast("New blank scenario created. Adjust inputs and save when ready.", "success");
            });
        }
    }

    /* ===========================
       Policy question presets
       =========================== */

    function initPolicyPresets() {
        const select = safeQuerySelector("#policy-question-select");
        const applyBtn = safeQuerySelector("#btn-apply-policy");
        if (!select || !applyBtn) return;

        applyBtn.addEventListener("click", function () {
            const key = select.value;
            const preset = POLICY_PRESETS[key];
            if (!preset) {
                showToast("Preset not found for selection", "warning");
                return;
            }
            const cfg = { ...STATE.config, ...preset.configOverrides };
            cfg.assumptionSetId = preset.assumptionSetId;
            STATE.config = cfg;
            writeConfigToUI(cfg);
            writeAssumptionsToUI(STATE.assumptionSets[cfg.assumptionSetId] || DEFAULT_ASSUMPTION_SETS["mohfw-baseline"]);
            recalculateAndRender();
            showToast("Policy preset applied: " + preset.label, "success");
        });
    }

    /* ===========================
       Copilot integration
       =========================== */

    function buildCopilotPrompt(config, assumptions, indicators) {
        const scenarioMeta = {
            scenarioId: config.scenarioId,
            scenarioName: config.scenarioName,
            assumptionSetId: assumptions.id,
            assumptionSetLabel: assumptions.label,
            appVersion: APP_VERSION,
            modelVersion: MODEL_VERSION,
            generatedAt: getNowIso()
        };

        const scenarioInputs = {
            traineesPerCohort: config.traineesPerCohort,
            numberOfCohorts: config.numberOfCohorts,
            planningHorizonYears: config.planningHorizonYears,
            endorsementRate: indicators.endorsementRate,
            completionRate: indicators.completionRate,
            responseDays: config.responseDays,
            tier: config.tier,
            costPerTraineeInr: config.costPerTraineeInr
        };

        const scenarioOutputs = {
            totalTrainees: indicators.totalTrainees,
            totalGraduates: indicators.graduatesTotal,
            endorsedGraduates: indicators.graduatesEndorsed,
            outbreakResponsesPerYear: indicators.outbreakResponsesPerYear,
            outbreakResponsesPerCohortPerYear: indicators.outbreakResponsesPerCohortPerYear,
            directCostsPV: indicators.directCostsPV,
            opportunityCostPV: indicators.opportunityCostPV,
            totalCostPV: indicators.totalCostPV,
            totalBenefitPV: indicators.totalBenefitPV,
            npv: indicators.npv,
            bcr: indicators.bcr
        };

        const methodAssumptions = {
            discountRate: assumptions.discountRate,
            outbreakValue: assumptions.outbreakValue,
            opportunityCostShare: assumptions.opportunityCostShare
        };

        const jsonPayload = {
            meta: scenarioMeta,
            inputs: scenarioInputs,
            outputs: scenarioOutputs,
            assumptions: methodAssumptions
        };

        const policyPrompt =
            "You are preparing a concise policy briefing note for senior officials in the Ministry of Health and partners.\n\n" +
            "You receive a JSON block that summarises a training investment scenario for the Field Epidemiology Training Program in India. " +
            "The JSON includes the scenario inputs, present value costs and benefits, outbreak responses, endorsement levels, and key assumptions.\n\n" +
            "Tasks:\n" +
            "1. Read and interpret the JSON carefully.\n" +
            "2. Produce a briefing of 3 to 5 pages, structured with clear headings: Executive summary, Scenario description, Economic results, " +
            "Public health impact, Assumptions and uncertainty, and Policy implications.\n" +
            "3. Include at least two small tables: one for key inputs and one for main economic indicators (BCR, NPV, total benefits, total costs).\n" +
            "4. Interpret the benefit cost ratio and net present value in plain language for decision makers, including what a BCR above or below 1 means.\n" +
            "5. Highlight caveats, including uncertainty around outbreak value and opportunity cost assumptions.\n" +
            "6. Close with 3 to 5 concrete practical recommendations that an official could act on.\n\n" +
            "Use a neutral, technical tone suitable for World Bank or WHO reporting.\n\n" +
            "Below is the JSON:\n\n" +
            JSON.stringify(jsonPayload, null, 2);

        return policyPrompt;
    }

    function renderCopilotPrompt(config, assumptions, indicators) {
        const outputEl = safeQuerySelector("#copilot-prompt-output");
        if (!outputEl) return;

        const prompt = buildCopilotPrompt(config, assumptions, indicators);
        outputEl.textContent = prompt;
    }

    function initCopilotControls() {
        const generateBtn = safeQuerySelector("#btn-generate-copilot");
        const copyBtn = safeQuerySelector("#btn-copy-copilot");

        if (generateBtn) {
            generateBtn.addEventListener("click", function () {
                const config = readConfigFromUI();
                const assumptions = readAssumptionsFromUI();
                const indicators = computeScenarioIndicators(config, assumptions);
                renderCopilotPrompt(config, assumptions, indicators);
                showToast("Copilot prompt prepared. Copy and paste into Microsoft Copilot.", "success");
            });
        }

        if (copyBtn) {
            copyBtn.addEventListener("click", function () {
                const outputEl = safeQuerySelector("#copilot-prompt-output");
                if (!outputEl) return;
                const text = outputEl.textContent || outputEl.value || "";
                if (!text.trim()) {
                    showToast("Nothing to copy. Generate the Copilot prompt first.", "warning");
                    return;
                }
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(function () {
                        showToast("Prompt copied to clipboard", "success");
                    }).catch(function () {
                        showToast("Copy failed. Select the text and copy manually.", "warning");
                    });
                } else {
                    showToast("Clipboard not available. Select the text and copy manually.", "warning");
                }
            });
        }
    }

    /* ===========================
       Persist and restore state
       =========================== */

    function persistState() {
        try {
            localStorage.setItem(STORAGE_KEYS.SCENARIOS, JSON.stringify(STATE.scenarios));
            localStorage.setItem(STORAGE_KEYS.ASSUMPTIONS, JSON.stringify(STATE.assumptionSets));
            localStorage.setItem(STORAGE_KEYS.LAST_STATE, JSON.stringify({
                config: STATE.config
            }));
        } catch (e) { }
    }

    function restoreState() {
        try {
            const scenariosRaw = localStorage.getItem(STORAGE_KEYS.SCENARIOS);
            if (scenariosRaw) {
                const parsed = JSON.parse(scenariosRaw);
                if (Array.isArray(parsed)) {
                    STATE.scenarios = parsed;
                }
            }

            const assumptionsRaw = localStorage.getItem(STORAGE_KEYS.ASSUMPTIONS);
            if (assumptionsRaw) {
                const parsed = JSON.parse(assumptionsRaw);
                if (parsed && typeof parsed === "object") {
                    STATE.assumptionSets = { ...DEFAULT_ASSUMPTION_SETS, ...parsed };
                }
            }

            const lastRaw = localStorage.getItem(STORAGE_KEYS.LAST_STATE);
            if (lastRaw) {
                const parsed = JSON.parse(lastRaw);
                if (parsed && parsed.config) {
                    STATE.config = { ...DEFAULT_CONFIG, ...parsed.config };
                }
            }
        } catch (e) {
            STATE.config = { ...DEFAULT_CONFIG };
            STATE.scenarios = [];
            STATE.assumptionSets = { ...DEFAULT_ASSUMPTION_SETS };
        }
    }

    /* ===========================
       Config events and validation
       =========================== */

    function updateCostSliderLabel(value) {
        const label = safeQuerySelector("#cost-per-trainee-label");
        if (!label) return;
        const v = parseNumber(value, 0);
        label.textContent = v.toLocaleString(undefined, {
            maximumFractionDigits: 0
        });
    }

    function initConfigForm() {
        writeConfigToUI(STATE.config);

        const applyBtn = safeQuerySelector("#btn-apply-values");
        const resetBtn = safeQuerySelector("#btn-reset-config");
        const costSliderEl = safeQuerySelector("#input-cost-per-trainee");

        if (applyBtn) {
            applyBtn.addEventListener("click", function () {
                recalculateAndRender();
                showToast("Configuration applied and indicators updated", "success");
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener("click", function () {
                STATE.config = { ...DEFAULT_CONFIG };
                writeConfigToUI(STATE.config);
                recalculateAndRender();
                showToast("Configuration reset to baseline", "success");
            });
        }

        if (costSliderEl) {
            costSliderEl.addEventListener("input", function () {
                updateCostSliderLabel(costSliderEl.value);
            });
        }

        const configInputs = safeQuerySelectorAll("#configTab input, #configTab select");
        configInputs.forEach(function (el) {
            el.addEventListener("change", function () {
                readConfigFromUI();
            });
        });
    }

    function recalculateAndRender() {
        try {
            const config = readConfigFromUI();
            const assumptions = readAssumptionsFromUI();
            const indicators = computeScenarioIndicators(config, assumptions);
            renderHeadlineIndicators(indicators);
            renderConfigSummary(config, indicators, assumptions);
            renderNationalSummary(config, indicators);
            renderSimpleCharts(config, indicators);
            renderScenarioTable();
            renderDiagnostics(config, assumptions, indicators);
            renderCopilotPrompt(config, assumptions, indicators);
            persistState();
        } catch (e) {
            showToast("An error occurred while updating the scenario. Please check the console.", "error");
            console.error(e);
        }
    }

    /* ===========================
       Init
       =========================== */

    document.addEventListener("DOMContentLoaded", function () {
        const versionValueEl = document.querySelector(".version-value");
        if (versionValueEl) {
            versionValueEl.textContent = "App " + APP_VERSION + " · Model " + MODEL_VERSION;
        }

        restoreState();
        initTabs();
        initThemePills();
        initTooltips();
        initConfigForm();
        initSettingsForm();
        initScenarioControls();
        initPolicyPresets();
        initCopilotControls();
        recalculateAndRender();
    });
})();
