import { Model } from "survey-core";
import { DefaultLight } from "survey-core/themes";
import "survey-core/survey-core.min.css";
import "survey-js-ui";

import "../styles.scss";

const SUMMARY_QUESTION_NAME = "program_summary_html";
const REPORTING_PAGE_NAME = "reporting";

const surveyTheme = {
  ...DefaultLight,
  cssVariables: {
    ...DefaultLight.cssVariables,
    "--sjs-primary-backcolor": "#18b394",
    "--sjs-primary-backcolor-dark": "#119a7f",
    "--sjs-primary-backcolor-light": "rgba(24, 179, 148, 0.12)",
    "--sjs-font-family": "Noto Sans, Open Sans, Segoe UI, Arial, sans-serif",
  },
};

const defaultLabels = {
  pageTitle: "Program of Examinations",
  kicker: "TU/e",
  heading: "Program of Examinations",
  year: "",
  ariaLabel: "Program form",
  reportingPageTitle: "Review and print",
};

export function mountProgramForm(config) {
  const labels = { ...defaultLabels, ...(config.labels ?? {}) };
  const surveyJson = prepareSurveyDefinition(config.surveySource, labels);
  const choiceLookup = config.createChoiceLookup(surveyJson);
  const survey = new Model(surveyJson);

  survey.applyTheme(surveyTheme);
  applyPageLabels(labels);
  setBrandAssets(config.logoUrl, config.logoType);

  survey.showQuestionNumbers = "off";
  survey.showCompleteButton = false;
  survey.showCompletePage = false;
  survey.checkErrorsMode = "onValueChanged";
  survey.focusFirstQuestionAutomatic = false;
  survey.widthMode = "responsive";

  let isSyncing = false;

  const syncSurveyState = () => {
    if (isSyncing) return;

    isSyncing = true;
    try {
      config.beforeCalculate?.(survey);
      const report = config.calculateReport(survey.data, choiceLookup);
      config.afterCalculate?.(survey, report, choiceLookup);
      const summaryHtml = config.renderSummary(report, survey.data, choiceLookup, labels);

      const ectsPanel = document.getElementById("ectsPanel");
      if (ectsPanel) {
        ectsPanel.innerHTML = config.renderEctsPanel(report, labels);
      }

      const summaryQuestion = survey.getQuestionByName(SUMMARY_QUESTION_NAME);
      if (summaryQuestion) {
        summaryQuestion.html = summaryHtml;
      }

      document.body.classList.toggle(
        "is-summary-page",
        survey.currentPage?.name === REPORTING_PAGE_NAME,
      );
      const isFirstPage = survey.currentPageNo === 0;
      if (survey.showTitle !== isFirstPage) {
        survey.showTitle = isFirstPage;
      }
      document.body.classList.toggle("is-first-survey-page", isFirstPage);
      syncPrintNavigationButton(survey, syncSurveyState);
    } finally {
      isSyncing = false;
    }
  };

  survey.onValidateQuestion.add((sender, options) => {
    config.validateQuestion?.(sender, options);
  });

  survey.onMatrixRowRemoving.add((sender, options) => {
    if (isSyncing) return;
    isSyncing = true;
    try {
      config.onMatrixRowRemoving?.(sender, options, choiceLookup);
    } finally {
      isSyncing = false;
    }
  });

  survey.onValueChanged.add(syncSurveyState);
  survey.onCurrentPageChanged.add(() => {
    queueMicrotask(syncSurveyState);
  });
  survey.onCompleting.add((sender, options) => {
    options.allow = false;
    const reportingPage = sender.getPageByName(REPORTING_PAGE_NAME);
    if (reportingPage) {
      sender.currentPage = reportingPage;
    }
    syncSurveyState();
  });

  document.addEventListener("click", (event) => {
    const printButton = event.target.closest("[data-print-report]");
    if (!printButton) return;

    event.preventDefault();
    syncSurveyState();
    window.print();
  });

  window.addEventListener("beforeprint", syncSurveyState);

  syncSurveyState();
  renderSurvey(survey, document.getElementById("surveyElement"));
  syncSurveyState();

  return survey;
}

function syncPrintNavigationButton(survey, refreshSummary) {
  queueMicrotask(() => {
    const surveyElement = document.getElementById("surveyElement");
    const existingButton = surveyElement?.querySelector("[data-print-navigation]");
    const previousButton = surveyElement?.querySelector(".sd-navigation__prev-btn");
    const isReportingPage = survey.currentPage?.name === REPORTING_PAGE_NAME;

    if (!isReportingPage || !previousButton) {
      existingButton?.remove();
      return;
    }

    const printButton = existingButton ?? document.createElement("button");
    printButton.type = "button";
    printButton.className = "sd-btn sd-btn--action print-button summary-navigation-print-button";
    printButton.dataset.printReport = "";
    printButton.dataset.printNavigation = "";
    printButton.textContent = "Print / Save as PDF";
    printButton.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      refreshSummary();
      window.print();
    };
    previousButton.insertAdjacentElement("afterend", printButton);
  });
}

function prepareSurveyDefinition(source, labels) {
  const surveyDefinition = cloneJson(source);
  surveyDefinition.showCompletePage = false;
  surveyDefinition.completedHtml = "";

  let reportingPage = surveyDefinition.pages.find(
    (page) => page.name === REPORTING_PAGE_NAME,
  );

  if (!reportingPage) {
    reportingPage = { name: REPORTING_PAGE_NAME };
    surveyDefinition.pages.push(reportingPage);
  }

  reportingPage.title = labels.reportingPageTitle;
  reportingPage.elements = [
    {
      type: "html",
      name: SUMMARY_QUESTION_NAME,
      html: '<article class="summary-report"><p>Preparing summary...</p></article>',
    },
  ];

  return surveyDefinition;
}

function cloneJson(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function renderSurvey(model, container) {
  if (!container) {
    throw new Error("Survey container was not found.");
  }

  if (typeof model.render !== "function") {
    throw new Error(
      "SurveyJS render method is unavailable. Check that survey-js-ui is installed.",
    );
  }

  model.render(container);
}

function applyPageLabels(labels) {
  document.title = labels.pageTitle;
  setText("appKicker", labels.kicker);
  setText("appTitle", labels.heading);
  setText("appYear", labels.year);

  const surveyShell = document.querySelector(".survey-shell");
  if (surveyShell) {
    surveyShell.setAttribute("aria-label", labels.ariaLabel);
  }
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = value;
  element.hidden = value === "";
}

function setBrandAssets(logoUrl, logoType = "image/jpeg") {
  const logo = document.getElementById("tueLogo");
  if (logo) {
    logo.hidden = !logoUrl;
    if (logoUrl) {
      logo.src = logoUrl;
      logo.addEventListener(
        "error",
        () => {
          logo.hidden = true;
        },
        { once: true },
      );
    }
  }

  if (!logoUrl) return;

  let favicon = document.querySelector("link[rel='icon']");
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    document.head.append(favicon);
  }

  favicon.type = logoType;
  favicon.href = logoUrl;
}
