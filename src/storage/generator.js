import { DEFAULT_CONFIG, QUESTION_COUNT_LIMITS, REVIEW_MODES, TIMING_MODES } from "../data/defaults.js";
import { DIFFICULTIES, QUESTION_FORMATS, SECTIONS, getSkillsForSection, getTopicsBySection } from "../data/taxonomy.js";

export const GENERATOR_OPTIONS_KEY = "openmcat_generator_options_v1";

const STORAGE_VERSION = 1;
const SECTION_IDS = new Set(SECTIONS.map((section) => section.id));
const DIFFICULTY_IDS = new Set(DIFFICULTIES.map((difficulty) => difficulty.id));
const FORMAT_IDS = new Set(QUESTION_FORMATS.map((format) => format.id));
const TIMING_MODE_IDS = new Set(TIMING_MODES.map((mode) => mode.id));
const REVIEW_MODE_IDS = new Set(REVIEW_MODES.map((mode) => mode.id));

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const clampInteger = (value, fallback, min, max) => {
    if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return fallback;
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, Math.round(number)));
};

const normalizeIds = (value, validIds, fallback = []) => {
    const source = Array.isArray(value) ? value : fallback;
    return Array.from(new Set(source.filter((id) => typeof id === "string" && validIds.has(id))));
};

export const normalizeGeneratorConfig = (config) => {
    const source = isObject(config) ? config : {};
    const sectionIsValid = SECTION_IDS.has(source.sectionId);
    const sectionId = sectionIsValid ? source.sectionId : DEFAULT_CONFIG.sectionId;
    const topicIds = new Set(getTopicsBySection(sectionId).map((topic) => topic.id));
    const skillIds = new Set(getSkillsForSection(sectionId).map((skill) => skill.id));
    const fallbackTopics = sectionId === DEFAULT_CONFIG.sectionId ? DEFAULT_CONFIG.topicIds : getTopicsBySection(sectionId).slice(0, 1).map((topic) => topic.id);
    const sourceTopics = sectionIsValid ? source.topicIds : DEFAULT_CONFIG.topicIds;
    const normalizedTopics = normalizeIds(sourceTopics, topicIds, fallbackTopics);
    const normalizedSkills = normalizeIds(source.skillIds, skillIds, DEFAULT_CONFIG.skillIds);
    const fallbackSkills = normalizeIds(DEFAULT_CONFIG.skillIds, skillIds, Array.from(skillIds));
    const timingMode = TIMING_MODE_IDS.has(source.timingMode) ? source.timingMode : DEFAULT_CONFIG.timingMode;
    return {
        sectionId,
        topicIds: Array.isArray(sourceTopics) && sourceTopics.length > 0 && normalizedTopics.length === 0 ? fallbackTopics : normalizedTopics,
        skillIds: normalizedSkills.length ? normalizedSkills : Array.isArray(source.skillIds) && source.skillIds.length === 0 ? Array.from(skillIds) : fallbackSkills,
        difficulty: DIFFICULTY_IDS.has(source.difficulty) ? source.difficulty : DEFAULT_CONFIG.difficulty,
        questionFormat: FORMAT_IDS.has(source.questionFormat) ? source.questionFormat : DEFAULT_CONFIG.questionFormat,
        questionCount: clampInteger(source.questionCount, DEFAULT_CONFIG.questionCount, QUESTION_COUNT_LIMITS.min, QUESTION_COUNT_LIMITS.max),
        timingMode,
        secondsPerQuestion: timingMode === "timed" ? clampInteger(source.secondsPerQuestion, 95, 30, 240) : null,
        reviewMode: REVIEW_MODE_IDS.has(source.reviewMode) ? source.reviewMode : DEFAULT_CONFIG.reviewMode
    };
};

const normalizeTopicIdsBySection = (value) => {
    if (!isObject(value)) return {};
    return Object.fromEntries(SECTIONS.flatMap((section) => {
        if (!Array.isArray(value[section.id])) return [];
        const validIds = new Set(getTopicsBySection(section.id).map((topic) => topic.id));
        const normalizedIds = normalizeIds(value[section.id], validIds);
        if (value[section.id].length > 0 && normalizedIds.length === 0) return [];
        return [[section.id, normalizedIds]];
    }));
};

const makeStoredOptions = (config, topicIdsBySection = {}) => {
    const normalizedConfig = normalizeGeneratorConfig(config);
    const normalizedTopics = normalizeTopicIdsBySection(topicIdsBySection);
    normalizedTopics[normalizedConfig.sectionId] = normalizedConfig.topicIds.slice();
    return {
        version: STORAGE_VERSION,
        config: normalizedConfig,
        topicIdsBySection: normalizedTopics
    };
};

const getDefaultOptions = () => makeStoredOptions(DEFAULT_CONFIG);

export const loadGeneratorOptions = () => {
    if (typeof localStorage === "undefined") return getDefaultOptions();
    try {
        const raw = localStorage.getItem(GENERATOR_OPTIONS_KEY);
        if (!raw) return getDefaultOptions();
        const parsed = JSON.parse(raw);
        if (!isObject(parsed) || parsed.version !== STORAGE_VERSION || !isObject(parsed.config)) return getDefaultOptions();
        return makeStoredOptions(parsed.config, parsed.topicIdsBySection);
    } catch (error) { console.warn("OpenMCAT: failed to load generator options so using defaults.", error); return getDefaultOptions(); }
};

export const saveGeneratorOptions = (config, topicIdsBySection = {}) => {
    const stored = makeStoredOptions(config, topicIdsBySection);
    if (typeof localStorage !== "undefined") {
        try { localStorage.setItem(GENERATOR_OPTIONS_KEY, JSON.stringify(stored)); }
        catch (error) { console.warn("OpenMCAT: failed to remember generator options.", error); }
    }
    return stored;
};
