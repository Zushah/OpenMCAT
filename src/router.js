export const ROUTE_TO_HASH = {
    landing: "/",
    generator: "/generate",
    practice: "/session",
    review: "/review",
    dashboard: "/dashboard",
    settings: "/settings",
    about: "/about"
};

const HASH_TO_ROUTE = Object.fromEntries(Object.entries(ROUTE_TO_HASH).map(([route, pathname]) => [pathname, route]));

const normalizePath = (input) => {
    if (!input) return "/";
    const value = String(input).trim();
    const pathOnly = value.split("?")[0].split("#")[0];
    if (!pathOnly) return "/";
    return pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
};

export const getRouteFromHash = (hash) => {
    const normalized = normalizePath(hash);
    return HASH_TO_ROUTE[normalized] ?? "landing";
};

export const setHashForRoute = (route) => {
    const target = ROUTE_TO_HASH[route] ?? ROUTE_TO_HASH.generator;
    if (location.pathname !== target) history.pushState({}, "", target);
};
