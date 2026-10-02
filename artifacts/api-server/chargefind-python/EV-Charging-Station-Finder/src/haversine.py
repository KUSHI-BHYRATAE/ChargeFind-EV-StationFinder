import math


def haversine_distance(
    latitude1,
    longitude1,
    latitude2,
    longitude2
):

    R = 6371.0

    lat1 = math.radians(latitude1)
    lat2 = math.radians(latitude2)

    delta_lat = math.radians(
        latitude2 - latitude1
    )

    delta_lon = math.radians(
        longitude2 - longitude1
    )

    a = (
        math.sin(delta_lat / 2) ** 2
        +
        math.cos(lat1)
        *
        math.cos(lat2)
        *
        math.sin(delta_lon / 2) ** 2
    )

    # Floating-point rounding can move values a few ulps outside [0, 1].
    a = min(1.0, max(0.0, a))

    c = 2 * math.atan2(
        math.sqrt(a),
        math.sqrt(1 - a)
    )

    return R * c