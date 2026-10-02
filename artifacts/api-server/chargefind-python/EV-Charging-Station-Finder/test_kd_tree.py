from src.data_loader import load_stations
from src.kd_tree import KDTree
from src.haversine import haversine_distance
import time


# ==========================================
# LOAD DATASET
# ==========================================

stations = load_stations(
    "data/india_ev_stations.csv"
)

print("Total stations loaded:", len(stations))


# ==========================================
# QUERY LOCATION - CHENNAI
# ==========================================

latitude = 13.0827
longitude = 80.2707

k = 5


# ==========================================
# 1. BRUTE FORCE SEARCH
# ==========================================

start_time = time.perf_counter()

brute_force_results = []

for station in stations:

    distance = haversine_distance(
        latitude,
        longitude,
        station.latitude,
        station.longitude
    )

    brute_force_results.append(
        (distance, station)
    )


brute_force_results.sort(
    key=lambda x: x[0]
)

brute_force_results = brute_force_results[:k]

brute_force_time = (
    time.perf_counter() - start_time
)


# ==========================================
# 2. KD-TREE SEARCH
# ==========================================

tree = KDTree(stations)

start_time = time.perf_counter()

kd_results = tree.nearest_neighbors(
    latitude,
    longitude,
    k=k
)

kd_tree_time = (
    time.perf_counter() - start_time
)


# ==========================================
# DISPLAY BRUTE FORCE RESULTS
# ==========================================

print("\n==============================")
print("BRUTE FORCE RESULTS")
print("==============================")

for i, (distance, station) in enumerate(
    brute_force_results,
    start=1
):

    print(
        f"{i}. {station.name}"
    )

    print(
        f"   City: {station.city}"
    )

    print(
        f"   Distance: {distance:.2f} km"
    )

    print(
        f"   Power: {station.power_kw} kW"
    )


# ==========================================
# DISPLAY KD-TREE RESULTS
# ==========================================

print("\n==============================")
print("KD-TREE RESULTS")
print("==============================")

for i, (distance, station) in enumerate(
    kd_results,
    start=1
):

    print(
        f"{i}. {station.name}"
    )

    print(
        f"   City: {station.city}"
    )

    print(
        f"   Distance: {distance:.2f} km"
    )

    print(
        f"   Power: {station.power_kw} kW"
    )


# ==========================================
# CHECK WHETHER RESULTS MATCH
# ==========================================

brute_names = [
    station.name
    for distance, station in brute_force_results
]

kd_names = [
    station.name
    for distance, station in kd_results
]


results_match = (
    brute_names == kd_names
)


# ==========================================
# PERFORMANCE COMPARISON
# ==========================================

print("\n==============================")
print("PERFORMANCE COMPARISON")
print("==============================")

print(
    f"Dataset size: {len(stations)} stations"
)

print(
    f"Brute Force stations checked: "
    f"{len(stations)}"
)

print(
    f"KD-Tree nodes visited: "
    f"{tree.nodes_visited}"
)

print(
    f"KD-Tree branches pruned: "
    f"{tree.nodes_pruned}"
)

print(
    f"Brute Force time: "
    f"{brute_force_time * 1000:.4f} ms"
)

print(
    f"KD-Tree time: "
    f"{kd_tree_time * 1000:.4f} ms"
)

print(
    f"Results match: "
    f"{'YES' if results_match else 'NO'}"
)

print("==============================")