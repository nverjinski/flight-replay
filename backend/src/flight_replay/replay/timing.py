"""Wall-clock pacing for telemetry replay."""

def delay_seconds(
    prev_elapsed_ms: int,
    next_elapsed_ms: int,
    *,
    speed: float,
) -> float:
    """
    How long to wait (real seconds) before sending the next point.

    Flight advances (next - prev) ms of simulated time.
    At speed=10, that interval is 10× shorter on the wall clock.

    Not sleep(1): spacing comes from the data.
    """

    if speed < 0:
        raise ValueError("speed must be non-negative")
    delta_ms = max(0, next_elapsed_ms - prev_elapsed_ms)
    return (delta_ms / 1000.0) / speed