const cb = Chalkboard;

export const computeMastery = ({ correct, attempts, averageTimeMs, targetTimeMs = 95000, alpha = 2, beta = 2 }) => {
    if (!attempts || attempts < 1) return { mastery: 0, smoothedAccuracy: 0.5, timingPenalty: 0, volumeMultiplier: 0 };
    const smoothedAccuracy = (correct + alpha) / (attempts + alpha + beta);
    const accuracyScore = smoothedAccuracy * 100;
    const volumeMultiplier = cb.numb.constrain(cb.real.sqrt(attempts / 20), [0, 1]);
    const timingPenalty = averageTimeMs > targetTimeMs ? cb.numb.constrain((averageTimeMs / targetTimeMs - 1) * 10, [0, 15]) : 0;
    const mastery = cb.numb.constrain(cb.numb.roundTo(accuracyScore * volumeMultiplier - timingPenalty, 1), [0, 100]);
    return { mastery, smoothedAccuracy, timingPenalty, volumeMultiplier };
}
