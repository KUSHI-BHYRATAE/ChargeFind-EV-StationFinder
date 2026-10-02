class Station:

    def __init__(
        self,
        station_id,
        name,
        latitude,
        longitude,
        address="",
        city="",
        connector_type="Unknown",
        power_kw=0.0,
        status="Unknown"
    ):
        self.station_id = station_id
        self.name = name
        self.latitude = float(latitude)
        self.longitude = float(longitude)
        self.address = address
        self.city = city
        self.connector_type = connector_type
        self.power_kw = float(power_kw) if power_kw else 0.0
        self.status = status

    def __repr__(self):
        return f"{self.name} ({self.city})"