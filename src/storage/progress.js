const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const getSavedAtMs = (record) => { const savedAt = record?.progress?.savedAt; return typeof savedAt === "string" ? Date.parse(savedAt) : NaN; };

const getQuestions = (record) => Array.isArray(record?.generatedSession?.questions) ? record.generatedSession.questions : [];

const countSubmitted = (questions, questionStateById) => questions.filter((question) => questionStateById?.[question?.id]?.submitted === true).length;

export const isUsableSessionRecord = (record) => {
    if (!isObject(record) || !isObject(record.generatedSession) || !isObject(record.generatedSession.session) || !isObject(record.config)) return false;
    const questions = getQuestions(record);
    if (!questions.length || !isObject(record.questionStateById)) return false;
    return questions.every((question) => isObject(question) && typeof question.id === "string" && isObject(record.questionStateById[question.id]));
};

export const isResumableSession = (record) => isUsableSessionRecord(record) && !record.completedAt && Number.isFinite(getSavedAtMs(record));

export const isReviewableSession = (record) => isUsableSessionRecord(record) && Boolean(record.completedAt);

export const getMostRecentResumableSession = (sessions) => {
    if (!Array.isArray(sessions)) return null;
    let newest = null;
    sessions.forEach((record) => { if (isResumableSession(record) && (!newest || getSavedAtMs(record) > getSavedAtMs(newest))) newest = record; });
    return newest;
};

export const matchesReviewFilter = (questionState, filterId) => {
    if (filterId === "incorrect") return Boolean(questionState?.submitted) && !questionState?.isCorrect;
    if (filterId === "flagged") return Boolean(questionState?.flagged);
    return true;
};

export const getReviewStepTarget = ({ questions, questionStateById, filterId, currentIndex, delta }) => {
    const list = Array.isArray(questions) ? questions : [];
    const flooredIndex = Math.floor(Number(currentIndex));
    const current = Number.isFinite(flooredIndex) ? flooredIndex : 0;
    if (!list.length) return current;
    const visible = list.map((question, index) => index).filter((index) => matchesReviewFilter(questionStateById?.[list[index]?.id], filterId));
    if (!visible.length) return Math.min(Math.max(current, 0), list.length - 1);
    const isCurrentVisible = visible.includes(current);
    const next = visible.find((index) => index > current);
    const previous = visible.filter((index) => index < current).pop();
    if (delta < 0) return previous ?? (isCurrentVisible ? current : visible[0]);
    if (delta > 0 || !isCurrentVisible) return next ?? (isCurrentVisible ? current : visible[visible.length - 1]);
    return current;
};

export const hydrateActiveSession = (record) => {
    if (!isUsableSessionRecord(record)) return null;
    const lastQuestionIndex = getQuestions(record).length - 1;
    const savedIndex = Math.floor(Number(record.progress?.currentQuestionIndex));
    return {
        id: record.id,
        createdAt: record.createdAt ?? null,
        completedAt: record.completedAt ?? null,
        config: structuredClone(record.config),
        generatedSession: structuredClone(record.generatedSession),
        providerMeta: structuredClone(record.providerMeta ?? {}),
        currentQuestionIndex: Number.isFinite(savedIndex) ? Math.min(Math.max(savedIndex, 0), lastQuestionIndex) : 0,
        questionStateById: structuredClone(record.questionStateById),
        highlightRangesByTargetKey: structuredClone(record.highlightRangesByTargetKey ?? {}),
        hasReachedFinalQuestion: record.hasReachedFinalQuestion === true,
        navigationOpen: false,
        navigationFilter: "all",
        finalReviewOpen: false,
        reviewFilter: "all",
        viewQuestionIndex: 0
    };
};

export const buildCompletionPatch = (sessionLike, completedAt) => {
    const questions = getQuestions(sessionLike);
    const records = questions.map((question) => sessionLike?.questionStateById?.[question?.id]);
    const submitted = records.filter((item) => item?.submitted).length;
    const flagged = records.filter((item) => item?.flagged).length;
    return {
        completedAt,
        questionStateById: structuredClone(sessionLike?.questionStateById ?? {}),
        highlightRangesByTargetKey: structuredClone(sessionLike?.highlightRangesByTargetKey ?? {}),
        hasReachedFinalQuestion: sessionLike?.hasReachedFinalQuestion === true,
        summary: {
            submitted,
            incomplete: records.length - submitted,
            flagged,
            total: records.length
        }
    };
};

export const getResumableInfo = (state) => {
    const active = state?.activeSession;
    const live = Boolean(active) && !active.completedAt;
    const source = live ? active : getMostRecentResumableSession(state?.analytics?.sessions ?? []);
    if (!source) return null;
    const questions = getQuestions(source);
    return {
        live,
        id: source.id,
        title: source.generatedSession?.session?.title ?? "Practice session",
        sectionId: source.generatedSession?.session?.sectionId ?? source.config?.sectionId ?? null,
        submitted: countSubmitted(questions, source.questionStateById),
        total: questions.length,
        savedAt: live ? null : source.progress.savedAt
    };
};
