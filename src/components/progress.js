const cb = Chalkboard;

export const createProgressBar = (value, max, label = "Progress") => {
    const wrapper = document.createElement("div");
    wrapper.className = "progress-wrap";
    wrapper.setAttribute("role", "progressbar");
    wrapper.setAttribute("aria-label", label);
    wrapper.setAttribute("aria-valuemin", "0");
    wrapper.setAttribute("aria-valuemax", String(max));
    wrapper.setAttribute("aria-valuenow", String(value));
    const fill = document.createElement("div");
    fill.className = "progress-fill";
    fill.style.width = `${cb.numb.constrain((value / cb.stat.max([1, max])) * 100, [0, 100])}%`;
    wrapper.append(fill);
    return wrapper;
};
