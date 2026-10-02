import csv
import math
import threading
import time
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from src.data_loader import load_stations
from src.kd_tree import KDTree


ROOT = Path(__file__).resolve().parent
DATASET = ROOT / "data" / "india_ev_stations.csv"
if not DATASET.is_file() or DATASET.stat().st_size == 0:
    raise RuntimeError(f"ChargeFind dataset is missing or empty: {DATASET}")

STATIONS = load_stations(str(DATASET))
TREE = KDTree(STATIONS)
SEARCH_LOCK = threading.Lock()


def _optional_int(value: str | None) -> int | None:
    if not value:
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _optional_float(value: str | None) -> float | None:
    if not value:
        return None
    try:
        parsed = float(value)
        return parsed if math.isfinite(parsed) else None
    except (TypeError, ValueError):
        return None


def _optional_bool(value: str | None) -> bool | None:
    if value is None or not value.strip():
        return None
    normalized = value.strip().lower()
    if normalized in {"true", "1", "yes"}:
        return True
    if normalized in {"false", "0", "no"}:
        return False
    return None


with DATASET.open("r", encoding="utf-8-sig", newline="") as csv_file:
    DATA_ROWS = list(csv.DictReader(csv_file))


def _station_record(row: dict[str, str]) -> dict[str, Any]:
    return {
        "stationId": row.get("station_id") or "",
        "name": row.get("name") or "Unnamed charging station",
        "city": row.get("city") or "",
        "stateProvince": row.get("state_province") or "",
        "latitude": float(row["latitude"]),
        "longitude": float(row["longitude"]),
        "ports": _optional_int(row.get("ports")),
        "powerKw": _optional_float(row.get("power_kw")),
        "powerClass": row.get("power_class") or None,
        "fastDc": _optional_bool(row.get("is_fast_dc")),
        # The supplied dataset has no connector-type or live-availability fields.
        "connectorType": None,
        "availability": None,
    }


RECORDS = [_station_record(row) for row in DATA_ROWS]
RECORDS_BY_ID = {record["stationId"]: record for record in RECORDS}


class SearchInput(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    k: int = Field(ge=1, le=10)


app = FastAPI(title="ChargeFind Spatial API", version="1.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/overview")
def overview() -> dict[str, Any]:
    cities = {record["city"].strip().lower() for record in RECORDS if record["city"].strip()}
    states = {
        record["stateProvince"].strip().lower()
        for record in RECORDS
        if record["stateProvince"].strip()
    }
    return {
        "stationCount": len(STATIONS),
        "cityCount": len(cities),
        "stateCount": len(states),
        "datasetName": "india_ev_stations.csv",
        "unavailableFields": ["Connector type", "Live availability"],
    }


@app.get("/stations/overview")
def station_overview() -> dict[str, Any]:
    cities = {
        (record["city"].strip().casefold(), record["stateProvince"].strip().casefold())
        for record in RECORDS
        if record["city"].strip()
    }
    return {
        "dataReady": bool(STATIONS),
        "stationsIndexed": len(STATIONS),
        "citiesIndexed": len(cities),
        "algorithm": "2D KD-Tree + Haversine",
        "dataset": DATASET.name,
    }


@app.get("/stations/cities")
def city_suggestions(
    q: str | None = Query(default=None, max_length=100),
) -> list[dict[str, Any]]:
    normalized_query = (q or "").strip().casefold()
    grouped: dict[tuple[str, str], dict[str, Any]] = {}

    for record in RECORDS:
        city = record["city"].strip()
        if not city:
            continue
        state = record["stateProvince"].strip()
        key = (city.casefold(), state.casefold())
        if normalized_query and normalized_query not in city.casefold():
            continue

        city_data = grouped.setdefault(
            key,
            {
                "name": city,
                "stateProvince": state or None,
                "latitudeTotal": 0.0,
                "longitudeTotal": 0.0,
                "stationCount": 0,
            },
        )
        city_data["latitudeTotal"] += record["latitude"]
        city_data["longitudeTotal"] += record["longitude"]
        city_data["stationCount"] += 1

    suggestions = []
    for city_data in grouped.values():
        count = city_data["stationCount"]
        suggestions.append(
            {
                "name": city_data["name"],
                "stateProvince": city_data["stateProvince"],
                "latitude": city_data["latitudeTotal"] / count,
                "longitude": city_data["longitudeTotal"] / count,
                "stationCount": count,
            }
        )

    suggestions.sort(
        key=lambda item: (
            -item["stationCount"],
            item["name"].casefold(),
            (item["stateProvince"] or "").casefold(),
        )
    )
    limit = 25 if normalized_query else 20
    return suggestions[:limit]


@app.get("/stations/nearest")
def nearest_stations(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    k: int = Query(ge=1, le=10),
) -> dict[str, Any]:
    if not STATIONS:
        raise HTTPException(status_code=503, detail="Station data is unavailable.")

    started_at = time.perf_counter()
    with SEARCH_LOCK:
        nearest = TREE.nearest_neighbors(
            latitude,
            longitude,
            k=min(k, len(STATIONS)),
        )
        nodes_visited = TREE.nodes_visited
        branches_pruned = TREE.nodes_pruned
        search_time_ms = (time.perf_counter() - started_at) * 1000

    results = []
    for distance, station in nearest:
        record = RECORDS_BY_ID.get(str(station.station_id))
        if record is None:
            continue
        results.append({**record, "distanceKm": distance})

    return {
        "stations": results,
        "resultCount": len(results),
        "stationsIndexed": len(STATIONS),
        "nodesVisited": nodes_visited,
        "branchesPruned": branches_pruned,
        "searchTimeMs": search_time_ms,
    }


@app.get("/stations")
def stations() -> dict[str, Any]:
    return {"stations": RECORDS, "count": len(RECORDS)}


@app.post("/search")
def search(query: SearchInput) -> dict[str, Any]:
    start = time.perf_counter()
    with SEARCH_LOCK:
        nearest = TREE.nearest_neighbors(
            query.latitude,
            query.longitude,
            k=min(query.k, len(STATIONS)),
        )
        nodes_visited = TREE.nodes_visited
        branches_pruned = TREE.nodes_pruned
        elapsed_ms = (time.perf_counter() - start) * 1000

    results = []
    for rank, (distance, station) in enumerate(nearest, start=1):
        record = RECORDS_BY_ID.get(str(station.station_id))
        if record is None:
            continue
        results.append({**record, "distanceKm": distance, "rank": rank})

    return {
        "latitude": query.latitude,
        "longitude": query.longitude,
        "requestedK": query.k,
        "results": results,
        "analytics": {
            "nodesVisited": nodes_visited,
            "branchesPruned": branches_pruned,
            "searchTimeMs": elapsed_ms,
        },
    }