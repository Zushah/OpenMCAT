const cb = Chalkboard;

const safeNumber = (value, fallback = 0) => { const number = Number(value); return Number.isFinite(number) ? number : fallback; };

const round = (num, places = 0.01) => {
    const rounded = cb.numb.roundTo(safeNumber(num), safeNumber(places));
    const str = Math.abs(safeNumber(places)).toString().toLowerCase();
    let decimalPlaces = 0;
    if (str.includes("e-")) {
        const [coefficient, exponent] = str.split("e-");
        const coefficientDecimals = coefficient.split(".")[1]?.length ?? 0;
        decimalPlaces = Number(exponent) + coefficientDecimals;
    } else if (!str.includes("e+")) decimalPlaces = str.split(".")[1]?.length ?? 0;
    return Number(rounded.toFixed(decimalPlaces));
};

export const computeMastery = ({ correct, attempts, averageTimeMs, targetTimeMs = 95000, alpha = 2, beta = 2 }) => {
    if (!attempts || attempts < 1) return { mastery: 0, smoothedAccuracy: 0.5, timingPenalty: 0, volumeMultiplier: 0 };
    const smoothedAccuracy = (correct + alpha) / (attempts + alpha + beta);
    const accuracyScore = smoothedAccuracy * 100;
    const volumeMultiplier = cb.numb.constrain(cb.real.sqrt(attempts / 20), [0, 1]);
    const timingPenalty = averageTimeMs > targetTimeMs ? cb.numb.constrain((averageTimeMs / targetTimeMs - 1) * 10, [0, 15]) : 0;
    const mastery = cb.numb.constrain(round(accuracyScore * volumeMultiplier - timingPenalty, 0.01), [0, 100]);
    return { mastery, smoothedAccuracy, timingPenalty, volumeMultiplier };
}
