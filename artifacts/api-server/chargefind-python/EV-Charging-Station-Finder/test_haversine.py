from src.haversine import haversine_distance


# Chennai approximate coordinates
user_lat = 13.0827
user_lon = 80.2707

# Another location
station_lat = 13.0878
station_lon = 80.2785

distance = haversine_distance(
    user_lat,
    user_lon,
    station_lat,
    station_lon
)

print(f"Distance: {distance:.2f} km")