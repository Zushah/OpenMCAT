export const MISTAKE_TYPES = [
    { id: "content_gap", label: "Content gap" },
    { id: "stem_misread", label: "Misread question stem" },
    { id: "choice_misread", label: "Misread answer choice" },
    { id: "passage_misread", label: "Misread passage" },
    { id: "data_misinterpretation", label: "Misinterpreted data" },
    { id: "time_pressure", label: "Time pressure" },
    { id: "math_error", label: "Math error" },
    { id: "reasoning_error", label: "Reasoning error" },
    { id: "changed_from_correct", label: "Changed from correct choice" },
    { id: "flawed_question", label: "Flawed question" },
    { id: "other", label: "Other" }
];

const mistakeTypeIds = new Set(MISTAKE_TYPES.map((type) => type.id));
const mistakeTypesById = new Map(MISTAKE_TYPES.map((type) => [type.id, type]));

export const isValidMistakeTypeId = (mistakeTypeId) => mistakeTypeIds.has(mistakeTypeId);

export const normalizeMistakeTypeIds = (mistakeTypeIds = []) => Array.from(new Set((Array.isArray(mistakeTypeIds) ? mistakeTypeIds : []).filter(isValidMistakeTypeId)));

export const getMistakeType = (mistakeTypeId) => mistakeTypesById.get(mistakeTypeId) ?? null;

export const getMistakeTypeLabel = (mistakeTypeId) => getMistakeType(mistakeTypeId)?.label ?? String(mistakeTypeId ?? "Unknown");
