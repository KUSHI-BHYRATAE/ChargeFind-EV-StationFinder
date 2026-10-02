import csv
import math
from src.station import Station


def load_stations(filename):

    stations = []

    with open(
        filename,
        "r",
        encoding="utf-8-sig",
        newline=""
    ) as file:

        reader = csv.DictReader(file)

        for row in reader:

            try:

                station = Station(
                    station_id=row.get("station_id", ""),
                    name=row.get("name") or "Unnamed charging station",
                    latitude=row.get("latitude", 0),
                    longitude=row.get("longitude", 0),
                    address=row.get("address", ""),
                    city=row.get("city", ""),
                    connector_type=row.get(
                        "connector_type",
                        "Unknown"
                    ),
                    power_kw=row.get(
                        "power_kw",
                        0
                    ),
                    status=row.get(
                        "status",
                        "Unknown"
                    )
                )

                # Ignore invalid coordinates and non-finite values.
                if (
                    not math.isfinite(station.latitude)
                    or not math.isfinite(station.longitude)
                    or not -90 <= station.latitude <= 90
                    or not -180 <= station.longitude <= 180
                    or (station.latitude == 0 and station.longitude == 0)
                ):
                    continue

                stations.append(station)

            except (ValueError, TypeError):
                continue

    return stations