import { state } from "./app.js";
import { createActions } from "./events.js";
import { getRouteFromHash } from "./router.js";
import { renderAboutView } from "./views/about.js";
import { renderDashboardView } from "./views/dashboard.js";
import { renderGeneratorView } from "./views/generator.js";
import { renderLandingView } from "./views/landing.js";
import { renderPracticeView, updatePracticeTimerElement } from "./views/practice.js";
import { renderReviewView } from "./views/review.js";
import { renderSettingsView } from "./views/settings.js";

const mainElement = document.getElementById("main-content");

const resolveThemeValue = (theme) => {
    if (theme === "light") return "light";
    if (theme === "dark") return "dark";
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
};

const applyTheme = (theme = "system", reducedMotion = "system") => {
    const html = document.documentElement;
    html.setAttribute("data-theme", resolveThemeValue(theme));
    const shouldReduce = reducedMotion === "on" || (reducedMotion === "system" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    html.dataset.reduceMotion = shouldReduce ? "true" : "false";
};

const updateActiveNav = (route) => {
    const activeRoute = route === "practice" || route === "review" ? "generator" : route;
    const links = document.querySelectorAll(".nav-links a[data-route]");
    links.forEach((link) => {
        const routeId = link.getAttribute("data-route");
        if (routeId === activeRoute) link.classList.add("is-active"); else link.classList.remove("is-active");
    });
};

const render = () => {
    updateActiveNav(state.route);
    mainElement.replaceChildren();
    let view;
    if (state.route === "landing") view = renderLandingView(actions);
    else if (state.route === "generator") view = renderGeneratorView(state, actions);
    else if (state.route === "practice") view = renderPracticeView(state, actions, Date.now());
    else if (state.route === "review") view = renderReviewView(state, actions);
    else if (state.route === "dashboard") view = renderDashboardView(state, actions);
    else if (state.route === "settings") view = renderSettingsView(state, actions);
    else view = renderAboutView();
    mainElement.append(view);
};

const actions = createActions({ render, applyTheme });

const handleRouteFromLocation = () => {
    state.route = getRouteFromHash(location.pathname || "/");
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
            const key = event.key.toLowerCase();
            if (["a", "b", "c", "d"].includes(key)) {
                actions.selectChoice(key.toUpperCase());
                event.preventDefault();
            } else if (key === "enter") {
                const question = state.activeSession.generatedSession.questions[state.activeSession.currentQuestionIndex];
                const questionState = state.activeSession.questionStateById[question.id];
                if (questionState.submitted) actions.nextQuestion(); else actions.submitAnswer();
                event.preventDefault();
            } else if (key === "f") {
                actions.flagCurrentQuestion();
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

window.addEventListener("popstate", () => {
    handleRouteFromLocation();
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    render();
});

window.addEventListener("storage", () => {
    if (state.route === "dashboard") actions.refreshAnalytics().then(render);
});

handleRouteFromLocation();
setupNavHandlers();
setupKeyboardShortcuts();
actions.initApp();

setInterval(() => {
    if (state.route === "practice" && state.activeSession) {
        const timerElement = document.getElementById("practice-live-timer");
        updatePracticeTimerElement(timerElement, Date.now());
    }
}, 1000);
