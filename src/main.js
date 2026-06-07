import { state } from "./app.js";
import { createActions } from "./events.js";
import { getRouteFromHash, isRouteHash } from "./router.js";
import { destroyDashboardCharts } from "./components/charts.js";
import { renderAboutView } from "./views/about.js";
import { renderDashboardView } from "./views/dashboard.js";
import { renderGeneratorView } from "./views/generator.js";
import { renderLandingView } from "./views/landing.js";
import { renderPracticeView, updatePracticeTimerElement, updatePracticeTotalTimerElement } from "./views/practice.js";
import { renderQuestionBankView } from "./views/bank.js";
import { renderReviewView } from "./views/review.js";
import { renderSettingsView } from "./views/settings.js";

const mainElement = document.getElementById("main-content");

const THEME_OPTIONS = new Set(["system", "dark", "light"]);
const systemThemeQuery = window.matchMedia("(prefers-color-scheme: light)");

const normalizeTheme = (theme) => THEME_OPTIONS.has(theme) ? theme : "system";

const applyTheme = (theme = "system") => {
    document.documentElement.setAttribute("data-theme", normalizeTheme(theme));
};

const updateActiveNav = (route) => {
    const activeRoute = route === "practice" || route === "review" || route === "bank" ? "generator" : route;
    const links = document.querySelectorAll(".nav-links a[data-route]");
    links.forEach((link) => {
        const routeId = link.getAttribute("data-route");
        if (routeId === activeRoute) link.classList.add("is-active"); else link.classList.remove("is-active");
    });
};

const render = () => {
    destroyDashboardCharts();
    updateActiveNav(state.route);
    mainElement.replaceChildren();
    let view;
    if (state.route === "landing") view = renderLandingView(actions);
    else if (state.route === "generator") view = renderGeneratorView(state, actions);
    else if (state.route === "bank") view = renderQuestionBankView(state, actions);
    else if (state.route === "practice") view = renderPracticeView(state, actions, Date.now());
    else if (state.route === "review") view = renderReviewView(state, actions);
    else if (state.route === "dashboard") view = renderDashboardView(state, actions);
    else if (state.route === "settings") view = renderSettingsView(state, actions);
    else view = renderAboutView();
    mainElement.append(view);
};

const actions = createActions({ render, applyTheme });

const handleRouteFromLocation = () => {
    if (!isRouteHash(location.hash)) return false;
    const nextRoute = getRouteFromHash(location.hash || "#/");
    if (state.route === nextRoute) return false;
    state.route = nextRoute;
    return true;
};

const handleBrowserRouteChange = () => {
    if (!handleRouteFromLocation()) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    render();
    if (state.route === "bank") actions.refreshQuestionBank();
};

const shouldIgnoreShortcut = (target) => {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
};

const setupKeyboardShortcuts = () => {
    window.addEventListener("keydown", (event) => {
        if (shouldIgnoreShortcut(event.target)) return;
        if (state.route === "practice" && state.activeSession) {
            if (state.activeSession.navigationOpen || state.activeSession.finalReviewOpen) {
                if (event.key === "Escape") {
                    actions.closePracticePanel();
                    event.preventDefault();
                }
                return;
            }
            const key = event.key.toLowerCase();
            const questionCount = state.activeSession.generatedSession?.questions?.length ?? 0;
            const hasReachedReviewPoint = state.activeSession.hasReachedFinalQuestion === true || (questionCount > 0 && state.activeSession.currentQuestionIndex + 1 >= questionCount);
            if (["a", "b", "c", "d"].includes(key)) {
                actions.selectChoice(key.toUpperCase());
                event.preventDefault();
            } else if (key === "enter") {
                actions.submitAnswer();
                event.preventDefault();
            } else if (event.key === "ArrowRight") {
                actions.nextQuestion();
                event.preventDefault();
            } else if (event.key === "ArrowLeft") {
                actions.previousQuestion();
                event.preventDefault();
            } else if (key === "h") {
                actions.toggleHighlightFromSelection();
                event.preventDefault();
            } else if (key === "f") {
                actions.flagCurrentQuestion();
                event.preventDefault();
            } else if (key === "n" && !hasReachedReviewPoint) {
                actions.openNavigationPanel();
                event.preventDefault();
            } else if (key === "r" && hasReachedReviewPoint) {
                actions.openFinalReviewPanel();
                event.preventDefault();
            }
        }
        if (state.route === "review" && state.activeSession) {
            if (event.key === "ArrowLeft") {
                actions.setReviewQuestionIndex((state.activeSession.viewQuestionIndex ?? 0) - 1);
                event.preventDefault();
            } else if (event.key === "ArrowRight") {
                actions.setReviewQuestionIndex((state.activeSession.viewQuestionIndex ?? 0) + 1);
                event.preventDefault();
            }
        }
    });
};

const setupNavHandlers = () => {
    const navLinks = document.querySelectorAll(".nav-links a[data-route]");
    navLinks.forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            const route = link.getAttribute("data-route");
            actions.navigate(route);
            document.getElementById("main-content")?.focus({ preventScroll: true });
        });
    });
};

window.addEventListener("popstate", handleBrowserRouteChange);
window.addEventListener("hashchange", handleBrowserRouteChange);

window.addEventListener("storage", () => { if (state.route === "dashboard") actions.refreshAnalytics().then(render); if (state.route === "bank") actions.refreshQuestionBank(); });

handleRouteFromLocation();
setupNavHandlers();
setupKeyboardShortcuts();
const handleSystemThemeChange = () => {
    if (state.settings.theme !== "system") return;
    applyTheme(state.settings.theme);
    render();
};
if (typeof systemThemeQuery.addEventListener === "function") systemThemeQuery.addEventListener("change", handleSystemThemeChange);
else systemThemeQuery.addListener(handleSystemThemeChange);
actions.initApp();

setInterval(() => {
    if (state.route === "practice" && state.activeSession) {
        const nowMs = Date.now();
        const totalTimerElement = document.getElementById("practice-total-timer");
        const timerElement = document.getElementById("practice-live-timer");
        updatePracticeTotalTimerElement(totalTimerElement, nowMs);
        updatePracticeTimerElement(timerElement, nowMs);
    }
}, 1000);
