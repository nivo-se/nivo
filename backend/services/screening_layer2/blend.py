"""Blend Stage 1 deterministic score (0–100) with Layer 2 fit signal."""


def blend_score(
    stage1: float,
    is_fit: bool,
    fit_confidence: float,
    w_stage1: float,
    w_layer2: float,
) -> float:
    """
    stage1_norm = clamp(stage1, 0, 100) / 100
    layer2_signal = clamp(fit_confidence, 0, 1) * (1.0 if is_fit else 0.15)
    return 100 * (w_stage1 * stage1_norm + w_layer2 * layer2_signal) / (w_stage1 + w_layer2)
    """
    s1 = max(0.0, min(100.0, stage1)) / 100.0
    l2 = max(0.0, min(1.0, fit_confidence)) * (1.0 if is_fit else 0.15)
    wsum = w_stage1 + w_layer2
    if wsum <= 0:
        return 100.0 * s1
    return 100.0 * ((w_stage1 * s1 + w_layer2 * l2) / wsum)
