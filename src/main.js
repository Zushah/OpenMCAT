import { state } from "./app.js";
import { createActions } from "./events.js";
import { getHashParams, getRouteFromHash, isRouteHash, matchesSessionToken } from "./router.js";
import { destroyCharts, setChartAnimationEnabled } from "./components/charts.js";
import { enhanceScrollWrappers } from "./components/overflow.js";
import { subscribeToDataChanges } from "./storage/db.js";
import { renderAboutView } from "./views/about.js";
import { renderDashboardView } from "./views/dashboard.js";
import { renderGeneratorView } from "./views/generator.js";
import { renderLandingView } from "./views/landing.js";
import { renderPracticeView, updatePracticeTimerElement, updatePracticeTotalTimerElement } from "./views/practice.js";
import { renderQuestionBankView } from "./views/bank.js";
import { renderReviewView } from "./views/review.js";
import { renderSettingsView } from "./views/settings.js";
import { renderStorageErrorView } from "./views/dberror.js";

const mainElement = document.getElementById("main-content");

const THEME_OPTIONS = new Set(["system", "dark", "light"]);
const systemThemeQuery = window.matchMedia("(prefers-color-scheme: light)");
const dashboardPhoneQuery = window.matchMedia("(max-width: 640px)");

const normalizeTheme = (theme) => THEME_OPTIONS.has(theme) ? theme : "system";

const applyTheme = (theme = "system") => { document.documentElement.setAttribute("data-theme", normalizeTheme(theme)); };

const updateActiveNav = (route) => {
    const activeRoute = route === "practice" || route === "review" || route === "bank" ? "generator" : route;
    const nav = document.querySelector(".nav-links");
    const links = document.querySelectorAll(".nav-links a[data-route]");
    let activeLink = null;
    links.forEach((link) => {
        const routeId = link.getAttribute("data-route");
        if (routeId === activeRoute) {
            link.classList.add("is-active");
            link.setAttribute("aria-current", "page");
            activeLink = link;
        } else {
            link.classList.remove("is-active");
            link.removeAttribute("aria-current");
        }
    });
    if (nav && activeLink && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = Math.max(0, activeLink.offsetLeft - (nav.clientWidth - activeLink.offsetWidth) / 2);
};

let lastRenderedRoute = null;

const captureScrollPositions = () => new Map(Array.from(mainElement.querySelectorAll("[data-scroll-key]")).map((element) => [element.dataset.scrollKey, { top: element.scrollTop, left: element.scrollLeft }]));

const restoreScrollPositions = (positions) => {
    if (!positions.size) return;
    mainElement.querySelectorAll("[data-scroll-key]").forEach((element) => {
        const position = positions.get(element.dataset.scrollKey);
        if (!position) return;
        element.scrollTop = position.top;
        element.scrollLeft = position.left;
    });
};

const render = () => {
    const routeKey = state.storageError ? "error" : state.route;
    const routeChanged = routeKey !== lastRenderedRoute;
    lastRenderedRoute = routeKey;
    destroyCharts();
    setChartAnimationEnabled(routeChanged);
    document.body.dataset.route = routeKey;
    updateActiveNav(state.route);
    const scrollPositions = routeChanged ? new Map() : captureScrollPositions();
    mainElement.replaceChildren();
    if (routeChanged) {
        mainElement.classList.remove("is-entering");
        void mainElement.offsetWidth;
        mainElement.classList.add("is-entering");
    }
    let view;
    if (state.storageError) view = renderStorageErrorView(state.storageError, actions);
    else if (state.route === "landing") view = renderLandingView(actions);
    else if (state.route === "generator") view = renderGeneratorView(state, actions);
    else if (state.route === "bank") view = renderQuestionBankView(state, actions);
    else if (state.route === "practice") view = renderPracticeView(state, actions, Date.now());
    else if (state.route === "review") view = renderReviewView(state, actions);
    else if (state.route === "dashboard") view = renderDashboardView(state, actions);
    else if (state.route === "settings") view = renderSettingsView(state, actions);
    else view = renderAboutView();
    mainElement.append(view);
    restoreScrollPositions(scrollPositions);
    enhanceScrollWrappers(mainElement);
    actions.refreshVisibleBackupDataSize();
};

const actions = createActions({ render, applyTheme });

const handleRouteFromLocation = () => {
    if (!isRouteHash(location.hash)) return false;
    const nextRoute = getRouteFromHash(location.hash || "#/");
    const reviewToken = nextRoute === "review" ? getHashParams(location.hash).get("session") : null;
    const reviewSessionChanged = Boolean(reviewToken) && !(state.activeSession?.completedAt && matchesSessionToken(state.activeSession.id, reviewToken));
    if (state.route === nextRoute && !reviewSessionChanged) return false;
    if (nextRoute !== "dashboard") { state.dashboard.aiAnalysisOpen = false; state.dashboard.backupReminderOpen = false; }
    if (nextRoute !== "settings") state.settingsDataConfirmation = null;
    actions.syncTimerForRouteChange(state.route, nextRoute);
    state.route = nextRoute;
    return true;
};

const handleBrowserRouteChange = async () => {
    if (!handleRouteFromLocation()) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    if (state.route === "dashboard") actions.maybeOpenDashboardBackupReminder();
    if (state.route === "review") await actions.openReviewFromHash();
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
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.repeat) return;
        if (event.isComposing || typeof event.key !== "string") return;
        if (shouldIgnoreShortcut(event.target)) return;
        if (event.shiftKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) return;
        if (event.key === "Enter" && event.target instanceof HTMLElement && event.target.closest("button, a[href], summary")) return;
        if (state.route === "practice" && state.activeSession && !state.activeSession.completedAt) {
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

mainElement.addEventListener("toggle", () => enhanceScrollWrappers(mainElement), true);
let scrollWrapperResizeFrame = 0;
window.addEventListener("resize", () => {
    cancelAnimationFrame(scrollWrapperResizeFrame);
    scrollWrapperResizeFrame = requestAnimationFrame(() => { enhanceScrollWrappers(mainElement); updateActiveNav(state.route); });
});

window.addEventListener("popstate", handleBrowserRouteChange);
window.addEventListener("hashchange", handleBrowserRouteChange);

const refreshExternalData = () => {
    if (state.route === "dashboard" || state.route === "settings") actions.refreshAnalytics().then(render);
    if (state.route === "bank") actions.refreshQuestionBank();
};
window.addEventListener("storage", refreshExternalData);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") actions.flushProgressSave(); });
window.addEventListener("pagehide", () => { actions.flushProgressSave(); });
subscribeToDataChanges(() => { if (state.route === "settings") state.settingsDataConfirmation = null; refreshExternalData(); });

handleRouteFromLocation();
setupNavHandlers();
setupKeyboardShortcuts();
const handleSystemThemeChange = () => { if (state.settings.theme !== "system") return; applyTheme(state.settings.theme); render(); };
if (typeof systemThemeQuery.addEventListener === "function") systemThemeQuery.addEventListener("change", handleSystemThemeChange);
else systemThemeQuery.addListener(handleSystemThemeChange);
const handleDashboardPhoneBreakpointChange = () => { if (state.route === "dashboard") render(); };
if (typeof dashboardPhoneQuery.addEventListener === "function") dashboardPhoneQuery.addEventListener("change", handleDashboardPhoneBreakpointChange);
else dashboardPhoneQuery.addListener(handleDashboardPhoneBreakpointChange);
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
