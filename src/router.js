export const ROUTE_TO_HASH = {
    landing: "#/",
    generator: "#/generate",
    bank: "#/bank",
    practice: "#/session",
    review: "#/review",
    dashboard: "#/dashboard",
    settings: "#/settings",
    about: "#/about"
};

const HASH_TO_ROUTE = Object.fromEntries(Object.entries(ROUTE_TO_HASH).map(([route, hash]) => [hash.slice(1), route]));

const normalizeHash = (input) => {
    if (!input) return "/";
    const value = String(input).trim();
    const hash = value.startsWith("#") ? value.slice(1) : value;
    const pathOnly = hash.split("?")[0].split("#")[0];
    if (!pathOnly) return "/";
    return pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
};

export const isRouteHash = (hash) => {
    if (!hash) return true;
    const value = String(hash).trim();
    return value === "#" || value.startsWith("#/");
};

export const getRouteFromHash = (hash) => {
    const normalized = normalizeHash(hash);
    return HASH_TO_ROUTE[normalized] ?? "landing";
};

export const getHashParams = (hash) => {
    const value = String(hash ?? "").trim();
    const path = (value.startsWith("#") ? value.slice(1) : value).split("#")[0];
    const queryIndex = path.indexOf("?");
    return new URLSearchParams(queryIndex === -1 ? "" : path.slice(queryIndex + 1));
};

export const getSessionToken = (id) => String(id ?? "").replace(/^session_/, "");

export const matchesSessionToken = (id, token) => Boolean(token) && (id === token || id === `session_${token}`);

export const findSessionByToken = (token, sessions) => {
    if (!token || !Array.isArray(sessions)) return null;
    return sessions.find((session) => session?.id === token) ?? sessions.find((session) => session?.id === `session_${token}`) ?? null;
};

export const setHashForRoute = (route, params = null) => {
    const base = ROUTE_TO_HASH[route] ?? ROUTE_TO_HASH.generator;
    const query = params ? new URLSearchParams(params).toString() : "";
    const target = query ? `${base}?${query}` : base;
    if (location.hash !== target) history.pushState({}, "", target);
};
