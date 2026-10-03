from src.haversine import haversine_distance
import math


class KDNode:

    def __init__(self, station, axis):

        self.station = station
        self.axis = axis

        self.left = None
        self.right = None


class KDTree:

    def __init__(self, stations):

        self.stations = stations

        self.nodes_visited = 0
        self.nodes_pruned = 0

        # Keep original list unchanged
        stations_copy = list(stations)

        self.root = self._build_tree(
            stations_copy,
            0
        )

    # --------------------------------------
    # BUILD KD TREE
    # --------------------------------------

    def _build_tree(
        self,
        stations,
        depth
    ):

        if not stations:
            return None

        axis = depth % 2

        if axis == 0:

            stations.sort(
                key=lambda s: s.latitude
            )

        else:

            stations.sort(
                key=lambda s: s.longitude
            )

        median = len(stations) // 2

        node = KDNode(
            stations[median],
            axis
        )

        node.left = self._build_tree(
            stations[:median],
            depth + 1
        )

        node.right = self._build_tree(
            stations[median + 1:],
            depth + 1
        )

        return node

    # --------------------------------------
    # K NEAREST NEIGHBOURS
    # --------------------------------------

    def nearest_neighbors(
        self,
        latitude,
        longitude,
        k=5,
        predicate=None,
        max_distance_km=None
    ):

        self.nodes_visited = 0
        self.nodes_pruned = 0

        results = []

        self._search(
            self.root,
            latitude,
            longitude,
            k,
            results,
            predicate,
            max_distance_km
        )

        results.sort(
            key=lambda x: x[0]
        )

        return results[:k]

    # --------------------------------------
    # RECURSIVE SEARCH
    # --------------------------------------

    def _search(
        self,
        node,
        latitude,
        longitude,
        k,
        results,
        predicate=None,
        max_distance_km=None
    ):

        if node is None:
            return

        self.nodes_visited += 1

        station = node.station

        distance = haversine_distance(
            latitude,
            longitude,
            station.latitude,
            station.longitude
        )

        within_max_distance = (
            max_distance_km is None or distance <= max_distance_km
        )
        matches_predicate = predicate is None or predicate(station)
        if within_max_distance and matches_predicate:
            results.append(
                (distance, station)
            )

            # Keep only the nearest matching candidates.
            results.sort(
                key=lambda x: x[0]
            )

            if len(results) > k:
                results.pop()

        # Determine splitting dimension
        if node.axis == 0:

            difference = (
                latitude -
                station.latitude
            )

        else:

            difference = (
                longitude -
                station.longitude
            )

        # Search closer side first
        if difference < 0:

            first = node.left
            second = node.right

        else:

            first = node.right
            second = node.left

        self._search(
            first,
            latitude,
            longitude,
            k,
            results,
            predicate,
            max_distance_km
        )

        # ----------------------------------
        # PRUNING
        # ----------------------------------

        # Use a conservative great-circle lower bound to the splitting plane.
        # Approximate degree-to-km conversions can overestimate this bound and
        # incorrectly prune a branch, especially when longitude wraps at ±180°.
        if node.axis == 0:
            plane_distance_km = (
                6371.0 * math.radians(abs(difference))
            )
        else:
            if difference < 0:
                far_min_longitude = station.longitude
                far_max_longitude = 180.0
            else:
                far_min_longitude = -180.0
                far_max_longitude = station.longitude

            roots = (
                longitude - 360.0,
                longitude - 180.0,
                longitude,
                longitude + 180.0,
                longitude + 360.0,
            )
            if any(
                far_min_longitude <= root <= far_max_longitude
                for root in roots
            ):
                minimum_sine = 0.0
            else:
                minimum_sine = min(
                    abs(
                        math.sin(
                            math.radians(boundary_longitude - longitude)
                        )
                    )
                    for boundary_longitude in (
                        far_min_longitude,
                        far_max_longitude,
                    )
                )

            cross_track = (
                math.cos(math.radians(latitude)) * minimum_sine
            )
            plane_distance_km = 6371.0 * math.asin(
                min(1.0, max(0.0, cross_track))
            )

        worst_distance = (
            results[-1][0] if len(results) >= k else float("inf")
        )
        if max_distance_km is not None:
            worst_distance = min(worst_distance, max_distance_km)

        if plane_distance_km <= worst_distance:
            self._search(
                second,
                latitude,
                longitude,
                k,
                results,
                predicate,
                max_distance_km
            )
        else:
            self.nodes_pruned += 1