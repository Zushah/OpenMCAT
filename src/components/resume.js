const createElement = (tag, className = "", text = "") => { const element = document.createElement(tag); if (className) element.className = className; if (text) element.textContent = text; return element; };

const formatSavedAt = (savedAt) => { const date = new Date(savedAt); return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date); };

export const createResumeCard = (info, actions) => {
    const card = createElement("section", "resume-card");
    card.setAttribute("aria-labelledby", "resume-card-heading");
    const copy = createElement("div", "resume-card-copy");
    const heading = createElement("h2", "", "Unfinished session");
    heading.id = "resume-card-heading";
    const title = createElement("p", "resume-card-body", info.title);
    const status = info.live ? "in progress" : `saved ${formatSavedAt(info.savedAt)}`.trim();
    const meta = createElement("p", "tiny resume-card-body", `${info.submitted} of ${info.total} submitted - ${status}. Starting a new session ends this one.`);
    copy.append(heading, title, meta);
    const row = createElement("div", "button-row resume-card-actions");
    const resume = createElement("button", "btn btn-primary", "Resume");
    resume.type = "button";
    resume.addEventListener("click", () => actions.resumeSession());
    const end = createElement("button", "btn btn-ghost", "End session");
    end.type = "button";
    end.addEventListener("click", () => actions.endInterruptedSession());
    row.append(resume, end);
    card.append(copy, row);
    return card;
};
