// ── Map setup ──────────────────────────────────────────────────────────────
const map = L.map('map').setView([51.509865, -0.118092], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
}).addTo(map);

// Shared state
let fromMarker = null;
let toMarker = null;
let routeLine = null;

// ── Custom marker icons ────────────────────────────────────────────────────
function makeIcon(label, colorClass) {
  return L.divIcon({
    className: '',
    html: `<div class="pin ${colorClass}"><span>${label}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -34],
  });
}

// ── Geocoding via Nominatim ────────────────────────────────────────────────
async function geocode(address) {
  const query = encodeURIComponent(address.includes('London') ? address : address + ', London, UK');
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=gb`;

  const response = await fetch(url, {
    headers: { 'Accept-Language': 'en' },
  });

  if (!response.ok) throw new Error('Geocoding service unavailable. Please try again.');

  const data = await response.json();
  if (!data || data.length === 0) {
    throw new Error(`Could not find location: "${address}". Try a more specific address.`);
  }

  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    display: data[0].display_name,
  };
}

// ── TfL Journey Planner API ───────────────────────────────────────────────
async function getTflJourney(fromLat, fromLng, toLat, toLng) {
  const from = `${fromLat},${fromLng}`;
  const to = `${toLat},${toLng}`;
  // Request tube + walking modes; date/time left blank → uses current time
  const url = `https://api.tfl.gov.uk/Journey/JourneyResults/${encodeURIComponent(from)}/to/${encodeURIComponent(to)}?mode=tube%2Cwalking&nationalSearch=false`;

  const response = await fetch(url);

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`TfL API returned ${response.status}. ${errBody ? JSON.parse(errBody)?.message || '' : ''}`);
  }

  return response.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────
function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function modeLabel(modeName) {
  const map = {
    tube: 'Tube',
    walking: 'Walk',
    bus: 'Bus',
    'national-rail': 'Rail',
    overground: 'Overground',
    'elizabeth-line': 'Elizabeth',
    dlr: 'DLR',
  };
  return map[modeName] || modeName;
}

function modeBg(modeName) {
  const colours = {
    tube: '#0019a8',
    walking: '#6b7280',
    bus: '#e53e3e',
    'national-rail': '#1e7e34',
    overground: '#e87722',
    'elizabeth-line': '#6950a1',
    dlr: '#009999',
  };
  return colours[modeName] || '#374151';
}

// ── Main calculate function ───────────────────────────────────────────────
async function calculate() {
  const fromInput = document.getElementById('from-input').value.trim();
  const toInput = document.getElementById('to-input').value.trim();
  const resultEl = document.getElementById('result');
  const btn = document.getElementById('calculate-btn');

  if (!fromInput || !toInput) {
    resultEl.innerHTML = '<p class="error">Please enter both a starting location and an office location.</p>';
    return;
  }

  btn.disabled = true;
  resultEl.innerHTML = '<p class="loading">⏳ Geocoding locations…</p>';

  try {
    // 1. Geocode both addresses in parallel
    const [fromLoc, toLoc] = await Promise.all([geocode(fromInput), geocode(toInput)]);

    resultEl.innerHTML = '<p class="loading">🚇 Fetching TfL journey…</p>';

    // 2. Clear previous layers
    if (fromMarker) map.removeLayer(fromMarker);
    if (toMarker) map.removeLayer(toMarker);
    if (routeLine) map.removeLayer(routeLine);

    // 3. Place markers
    fromMarker = L.marker([fromLoc.lat, fromLoc.lng], { icon: makeIcon('A', 'pin-from') })
      .addTo(map)
      .bindPopup(`<b>Your Location</b><br>${fromInput}`);

    toMarker = L.marker([toLoc.lat, toLoc.lng], { icon: makeIcon('B', 'pin-to') })
      .addTo(map)
      .bindPopup(`<b>Office Location</b><br>${toInput}`);

    // 4. Draw a dashed straight line between the two points
    routeLine = L.polyline(
      [[fromLoc.lat, fromLoc.lng], [toLoc.lat, toLoc.lng]],
      { color: '#0019a8', weight: 2, dashArray: '6 6', opacity: 0.6 }
    ).addTo(map);

    // 5. Fit map to show both markers
    map.fitBounds(
      L.latLngBounds([fromLoc.lat, fromLoc.lng], [toLoc.lat, toLoc.lng]).pad(0.25)
    );

    // 6. Fetch TfL journey
    const data = await getTflJourney(fromLoc.lat, fromLoc.lng, toLoc.lat, toLoc.lng);

    if (!data.journeys || data.journeys.length === 0) {
      resultEl.innerHTML =
        '<p class="error">No tube journey found between these locations. They may be too close together or outside the TfL network.</p>';
      return;
    }

    const journey = data.journeys[0];
    const duration = journey.duration;

    // Build step-by-step legs
    const legsHtml = journey.legs
      .map((leg) => {
        const mode = leg.mode?.name || 'walking';
        const summary = leg.instruction?.summary || leg.instruction?.detailed || `${modeLabel(mode)} leg`;
        const colour = modeBg(mode);
        return `<li>
          <span class="mode-tag" style="background:${colour};color:#fff">${modeLabel(mode)}</span>
          ${summary}
        </li>`;
      })
      .join('');

    resultEl.innerHTML = `
      <div class="result-card">
        <h3>Fastest Journey Time</h3>
        <div class="duration">${formatDuration(duration)}</div>
        <div class="route-info">
          <strong>From:</strong> ${fromInput}<br>
          <strong>To:</strong> ${toInput}
        </div>
        <h4>Steps</h4>
        <ul class="legs">${legsHtml}</ul>
        <p class="tfl-credit">Journey data &copy; <a href="https://api.tfl.gov.uk" target="_blank">TfL</a></p>
      </div>
    `;
  } catch (err) {
    resultEl.innerHTML = `<p class="error">❌ ${err.message}</p>`;
    console.error(err);
  } finally {
    btn.disabled = false;
  }
}

// ── Event listeners ───────────────────────────────────────────────────────
document.getElementById('calculate-btn').addEventListener('click', calculate);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') calculate();
});
