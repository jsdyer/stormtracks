"""Refresh derived, non-commercial storm-window comparisons from CHS IWLS."""
import json
from datetime import datetime, timedelta, timezone
from math import isfinite
from pathlib import Path
from time import sleep
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "web/data/harbours.json"
SERVICE = "https://api-iwls.dfo-mpo.gc.ca/api/v1/stations"
STATIONS = (
    ("00491", "Bedford Institute, NS", "5cebf1e23d0f4a073c4bbfac"),
    ("01700", "Charlottetown, PEI", "5cebf1e33d0f4a073c4bc21f"),
    ("00490", "Halifax, NS", '5cebf1df3d0f4a073c4bbcbb'),
)
EVENTS = (
    ("2022257N16312", "Fiona", "2022-09-23"),
    ("2019236N10314", "Dorian", "2019-09-07"),
)


def series(station, code, start, end):
    params = urlencode({"time-series-code": code, "from": start, "to": end})
    request = Request(f"{SERVICE}/{station}/data?{params}", headers={"Accept": "application/json"})
    with urlopen(request, timeout=45) as response:
        rows = json.load(response)
    sleep(0.45)
    if not isinstance(rows, list):
        raise ValueError(f"Unexpected CHS response for {station}/{code}")
    return rows


def residuals(times, observations, predictions):
    def values(rows, good_only):
        output = {}
        for row in rows:
            if good_only and str(row.get("qcFlagCode")) != "1":
                continue
            value = row.get("value")
            if isinstance(value, (float, int)) and isfinite(value):
                instant = row["eventDate"]
                if instant in output and output[instant] != value:
                    raise ValueError(f"Conflicting station readings at {instant}")
                output[instant] = value
        return output
    actual = values(observations, True)
    tide = values(predictions, False)
    return [round(actual[t] - tide[t], 3) if t in actual and t in tide else None for t in times]


def main():
    current = json.loads(TARGET.read_text())["storms"] if TARGET.exists() else {}
    results = {}
    for storm, name, start in EVENTS:
        first = datetime.fromisoformat(start).replace(tzinfo=timezone.utc)
        times = [(first + timedelta(minutes=15*i)).strftime("%Y-%m-%dT%H:%M:%SZ") for i in range(193)]
        stations = []
        for code, label, station in STATIONS:
            observed = series(station, "wlo", times[0], times[-1])
            predicted = series(station, "wlp", times[0], times[-1])
            differences = residuals(times, observed, predicted)
            matched = sum(x is not None for x in differences)
            previous = next((s for s in current.get(storm, {}).get("stations", []) if s["code"] == code), None)
            if not predicted or (previous and any(v is not None for v in previous["differences"]) and not matched):
                raise ValueError(f"Lost available CHS coverage for {code}, {name}")
            stations.append({"code": code, "label": label, "differences": differences})
        if not any(any(v is not None for v in s["differences"]) for s in stations):
            raise ValueError(f"No matched readings for {name}")
        results[storm] = {"label": name, "start": times[0], "end": times[-1], "stations": stations}
    output = {"retrieved": datetime.now(timezone.utc).date().isoformat(), "storms": results}
    temporary = TARGET.with_suffix(".tmp")
    temporary.write_text(json.dumps(output, separators=(",", ":")) + "\n")
    temporary.replace(TARGET)


if __name__ == "__main__":
    main()
