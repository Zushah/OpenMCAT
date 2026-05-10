import { manualJsonProvider } from "./manual.js";
import { mockProvider } from "./mock.js";

const providers = [
    mockProvider,
    manualJsonProvider
];

const providersById = Object.fromEntries(providers.map((provider) => [provider.id, provider]));

export const getProviders = () => providers;

export const getProvider = (providerId) => providersById[providerId] ?? null;
