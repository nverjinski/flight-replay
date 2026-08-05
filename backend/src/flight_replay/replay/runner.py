import asyncio
import httpx
from pathlib import Path
from flight_replay.readers import iter_normalized
from flight_replay.replay.timing import delay_seconds
from flight_replay.replay.payload import record_to_ingest_point


async def run_replay(
    path: Path,
    *,
    base_url: str,
    flight_id: str | None,
    speed: float,

)-> None:
    """Replay a flight from a normalized telemetry stream."""
    url_base = base_url.rstrip('/')
    sem = asyncio.Semaphore(1) # 1 = fully serial; try 2-4 later

    async with httpx.AsyncClient(timeout=30.0) as client:
        prev_elapsed: int | None = None
        posted = 0

        for record in iter_normalized(path):
            resolved_id = flight_id or record.flight_id
            url = f"{url_base}/flights/{resolved_id}/telemetry"

            if prev_elapsed is not None:
                delay = delay_seconds(prev_elapsed, record.elapsed_ms, speed=speed)
                if delay > 0:
                    await asyncio.sleep(delay)

            payload = {"points": [record_to_ingest_point(record)]}

            async with sem:
                response = await client.post(url, json=payload)
                response.raise_for_status()

            prev_elapsed = record.elapsed_ms
            posted += 1
        
            
        print(f"Posted {posted} points to {resolved_id}")



