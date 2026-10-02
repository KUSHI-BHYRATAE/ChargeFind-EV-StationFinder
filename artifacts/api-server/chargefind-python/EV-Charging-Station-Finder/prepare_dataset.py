import pandas as pd


# ---------------------------------------
# 1. Load the original global dataset
# ---------------------------------------

INPUT_FILE = "data/charging_station.csv"
OUTPUT_FILE = "data/india_ev_stations.csv"

df = pd.read_csv(INPUT_FILE)

print("Original dataset:")
print("Total stations:", len(df))


# ---------------------------------------
# 2. Keep only Indian charging stations
# ---------------------------------------

india = df[
    df["country_code"]
    .astype(str)
    .str.upper()
    .eq("IN")
].copy()

print("\nIndian stations:", len(india))


# ---------------------------------------
# 3. Remove records without coordinates
# ---------------------------------------

india = india.dropna(
    subset=["latitude", "longitude"]
)


# ---------------------------------------
# 4. Remove duplicate station IDs
# ---------------------------------------

india = india.drop_duplicates(
    subset=["id"]
)


# ---------------------------------------
# 5. Remove invalid coordinates
# ---------------------------------------

india = india[
    (india["latitude"].between(-90, 90)) &
    (india["longitude"].between(-180, 180))
]


# ---------------------------------------
# 6. Remove records with unknown city
# ---------------------------------------

india = india[
    india["city"]
    .astype(str)
    .str.strip()
    .str.lower()
    .ne("unknown city")
]


# ---------------------------------------
# 7. Rename columns for our project
# ---------------------------------------

india = india.rename(columns={
    "id": "station_id"
})


# ---------------------------------------
# 8. Select useful columns
# ---------------------------------------

india = india[
    [
        "station_id",
        "name",
        "city",
        "state_province",
        "latitude",
        "longitude",
        "ports",
        "power_kw",
        "power_class",
        "is_fast_dc"
    ]
]


# ---------------------------------------
# 9. Sort by city
# ---------------------------------------

india = india.sort_values(
    by=["city", "name"]
).reset_index(drop=True)


# ---------------------------------------
# 10. Save cleaned dataset
# ---------------------------------------

india.to_csv(
    OUTPUT_FILE,
    index=False
)


# ---------------------------------------
# 11. Display summary
# ---------------------------------------

print("\n===================================")
print("DATASET PREPARATION COMPLETE")
print("===================================")

print("Final stations:", len(india))

print("\nStations by city:")
print(india["city"].value_counts().head(20))

print("\nSaved to:")
print(OUTPUT_FILE)