from src.max_heap import MaxHeap


class SearchEngine:

    def __init__(self, stations, kd_tree):

        self.stations = stations
        self.kd_tree = kd_tree

    def search(
        self,
        latitude,
        longitude,
        k=5,
        min_power=0,
        city=None
    ):

        # Get spatial candidates
        candidates = self.kd_tree.nearest_neighbors(
            latitude,
            longitude,
            k=min(
                len(self.stations),
                max(k * 10, 50)
            )
        )

        filtered = []

        for distance, station in candidates:

            # City filter
            if city:

                if station.city.lower() != city.lower():
                    continue

            # Power filter
            if station.power_kw < min_power:
                continue

            filtered.append(
                (distance, station)
            )

        # ----------------------------------
        # MAX HEAP RANKING
        # ----------------------------------

        heap = MaxHeap()

        for distance, station in filtered:

            # Higher score = better station
            #
            # Nearby stations get higher score.
            # Higher power gets a small bonus.

            score = (
                1000 / (distance + 0.1)
                +
                station.power_kw * 0.5
            )

            heap.push(
                (score, distance, station)
            )

        results = []

        while heap.size() > 0:

            item = heap.pop()

            results.append(item)

        # Max heap returns highest score first
        return results[:k]