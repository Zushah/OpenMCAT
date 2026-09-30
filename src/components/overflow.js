const trackedWrappers = new WeakSet();

const updateWrapper = (wrapper) => {
    const overflowing = wrapper.scrollWidth - wrapper.clientWidth > 1;
    wrapper.classList.toggle("has-overflow", overflowing);
    wrapper.classList.toggle("is-scrolled-end", overflowing && wrapper.scrollLeft + wrapper.clientWidth >= wrapper.scrollWidth - 2);
};

export const enhanceScrollWrappers = (root = document) => {
    if (!root || typeof requestAnimationFrame !== "function") return;
    requestAnimationFrame(() => {
        root.querySelectorAll(".table-wrap").forEach((wrapper) => {
            updateWrapper(wrapper);
            if (trackedWrappers.has(wrapper)) return;
            trackedWrappers.add(wrapper);
            wrapper.addEventListener("scroll", () => updateWrapper(wrapper), { passive: true });
        });
    });
};
