# map-distance-test

A London Tube journey planner built with OpenStreetMap and the TfL Journey API.

## What it does

- Enter your home location and your office location
- The app geocodes both addresses using [Nominatim](https://nominatim.openstreetmap.org/)
- Fetches the fastest tube route between them via the [TfL Journey Planner API](https://api.tfl.gov.uk/swagger/ui/index.html)
- Displays both locations as markers on an [OpenStreetMap](https://www.openstreetmap.org) map
- Shows journey time and step-by-step directions

## Tech stack

| Layer | Library / API |
|-------|---------------|
| Map | [Leaflet.js](https://leafletjs.com/) + OpenStreetMap tiles |
| Geocoding | [Nominatim](https://nominatim.openstreetmap.org/) (free, no key required) |
| Journey data | [TfL Journey Planner API](https://api.tfl.gov.uk) (free, no key required for basic use) |

## Running locally

Just open `index.html` in a browser — no build step required.

```bash
open index.html   # macOS
```

Or serve it with any static file server:

```bash
npx serve .
```

## Limitations

- Locations must be within the TfL network (Greater London area)
- Journey times are calculated for the current time
- The straight line drawn on the map is illustrative; actual tube routes follow the network topology
