import streamlit as st
import folium
from streamlit_folium import st_folium
import requests

st.set_page_config(
    page_title="London Tube Journey Planner",
    page_icon="🚇",
    layout="wide",
)

st.title("🚇 London Tube Journey Planner")
st.caption("Enter two London locations to find the fastest tube route between them.")

# ── Helpers ───────────────────────────────────────────────────────────────

def geocode(address: str) -> tuple[float, float, str]:
    query = address if "london" in address.lower() else address + ", London, UK"
    resp = requests.get(
        "https://nominatim.openstreetmap.org/search",
        params={"q": query, "format": "json", "limit": 1, "countrycodes": "gb"},
        headers={"Accept-Language": "en", "User-Agent": "TubeJourneyPlanner/1.0"},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    if not data:
        raise ValueError(f'Could not find location: "{address}". Try a more specific address.')
    return float(data[0]["lat"]), float(data[0]["lon"]), data[0]["display_name"]


def get_tfl_journey(from_lat, from_lng, to_lat, to_lng):
    url = (
        f"https://api.tfl.gov.uk/Journey/JourneyResults/"
        f"{from_lat},{from_lng}/to/{to_lat},{to_lng}"
    )
    resp = requests.get(
        url,
        params={"mode": "tube,walking", "nationalSearch": "false"},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def format_duration(minutes: int) -> str:
    if minutes < 60:
        return f"{minutes} min"
    h, m = divmod(minutes, 60)
    return f"{h}h {m}min" if m else f"{h}h"


MODE_COLOURS = {
    "tube": "#0019a8",
    "walking": "#6b7280",
    "bus": "#e53e3e",
    "national-rail": "#1e7e34",
    "overground": "#e87722",
    "elizabeth-line": "#6950a1",
    "dlr": "#009999",
}

MODE_LABELS = {
    "tube": "Tube",
    "walking": "Walk",
    "bus": "Bus",
    "national-rail": "Rail",
    "overground": "Overground",
    "elizabeth-line": "Elizabeth",
    "dlr": "DLR",
}

# ── Layout ────────────────────────────────────────────────────────────────

left, right = st.columns([1, 2], gap="large")

with left:
    from_input = st.text_input("Your Location", placeholder="e.g. Baker Street, London")
    to_input = st.text_input("Office Location", placeholder="e.g. Canary Wharf, London")
    calculate = st.button("Calculate Journey", use_container_width=True, type="primary")
    result_area = st.container()

# ── Calculation ───────────────────────────────────────────────────────────

if calculate:
    if not from_input or not to_input:
        result_area.warning("Please enter both locations.")
    else:
        with st.spinner("Geocoding locations and fetching TfL journey…"):
            try:
                from_lat, from_lng, from_display = geocode(from_input)
                to_lat, to_lng, to_display = geocode(to_input)

                data = get_tfl_journey(from_lat, from_lng, to_lat, to_lng)

                if not data.get("journeys"):
                    result_area.error(
                        "No tube journey found. Locations may be outside the TfL network "
                        "or too close together."
                    )
                else:
                    journey = data["journeys"][0]
                    duration = journey["duration"]

                    # ── Results panel ──────────────────────────────────────
                    with result_area:
                        st.metric("Fastest Journey Time", format_duration(duration))

                        st.markdown(
                            f"**From:** {from_input}  \n**To:** {to_input}"
                        )

                        st.markdown("**Steps**")
                        for leg in journey["legs"]:
                            mode = leg.get("mode", {}).get("name", "walking")
                            summary = (
                                leg.get("instruction", {}).get("summary")
                                or leg.get("instruction", {}).get("detailed")
                                or MODE_LABELS.get(mode, mode)
                            )
                            colour = MODE_COLOURS.get(mode, "#374151")
                            label = MODE_LABELS.get(mode, mode)
                            st.markdown(
                                f'<span style="background:{colour};color:#fff;'
                                f'padding:2px 8px;border-radius:4px;font-size:12px;'
                                f'font-weight:700">{label}</span> {summary}',
                                unsafe_allow_html=True,
                            )

                        st.caption("Journey data © Transport for London")

                    # ── Map ────────────────────────────────────────────────
                    center_lat = (from_lat + to_lat) / 2
                    center_lng = (from_lng + to_lng) / 2
                    m = folium.Map(location=[center_lat, center_lng], zoom_start=12)

                    folium.Marker(
                        [from_lat, from_lng],
                        popup=f"<b>Your Location</b><br>{from_input}",
                        tooltip="Your Location (A)",
                        icon=folium.Icon(color="blue", icon="home", prefix="fa"),
                    ).add_to(m)

                    folium.Marker(
                        [to_lat, to_lng],
                        popup=f"<b>Office Location</b><br>{to_input}",
                        tooltip="Office Location (B)",
                        icon=folium.Icon(color="red", icon="briefcase", prefix="fa"),
                    ).add_to(m)

                    folium.PolyLine(
                        [[from_lat, from_lng], [to_lat, to_lng]],
                        color="#0019a8",
                        weight=2,
                        dash_array="6 6",
                        opacity=0.7,
                    ).add_to(m)

                    # Fit bounds
                    m.fit_bounds([[from_lat, from_lng], [to_lat, to_lng]], padding=(50, 50))

                    with right:
                        st_folium(m, use_container_width=True, height=520)

            except ValueError as e:
                result_area.error(str(e))
            except requests.HTTPError as e:
                result_area.error(f"API error: {e}")
            except Exception as e:
                result_area.error(f"Something went wrong: {e}")

else:
    # Show default map of London
    with right:
        m = folium.Map(location=[51.509865, -0.118092], zoom_start=11)
        st_folium(m, use_container_width=True, height=520)
