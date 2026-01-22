// =======================
// INIT MAP LEAFLET
// =======================
const map = L.map('map').setView([48.8566, 2.3522], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
}).addTo(map);

let marker = null;

// =======================
// DATEPICKER
// =======================
let currentDate = new Date();
const dateInput = flatpickr("#dateInput", {
    altInput: true,
    altFormat: "d-m-Y",
    dateFormat: "Y-m-d",
    defaultDate: currentDate,
    minDate: "today",
    maxDate: new Date().fp_incr(7),
    onChange(selectedDates) {
        if (selectedDates.length) {
            currentDate = selectedDates[0];
            refreshWeather();
        }
    }
});

function getSelectedDate() {
    return currentDate;
}

// =======================
// UTILS METEO
// =======================
function weatherIcon(code) {
    if (code === 0) return '☀️ Clair';
    if ([1,2,3].includes(code)) return '⛅ Nuageux';
    if ([45,48].includes(code)) return '🌫️ Brouillard';
    if ([51,53,55].includes(code)) return '🌦️ Bruine';
    if ([61,63,65].includes(code)) return '🌧️ Pluie';
    if ([71,73,75].includes(code)) return '❄️ Neige';
    if ([80,81,82].includes(code)) return '🌧️🌧️ Pluie forte';
    if ([95,96,99].includes(code)) return '⛈️ Orage';
    return '❔';
}

function windDirectionCardinal(deg) {
    const dirs = ['Nord','Nord-Est','Est','Sud-Est','Sud','Sud-Ouest','Ouest','Nord-Ouest'];
    return dirs[Math.round(deg / 45) % 8];
}

function getSeason(date, lat = 0) {
    const m = date.getMonth() + 1;
    if (lat >= 0) {
        if (m <= 2) return 'Hiver';
        if (m <= 5) return 'Printemps';
        if (m <= 8) return 'Été';
        return 'Automne';
    } else {
        if (m <= 2) return 'Été';
        if (m <= 5) return 'Automne';
        if (m <= 8) return 'Hiver';
        return 'Printemps';
    }
}

// =======================
// LUNE / SOLUNAIRE
// =======================
function getMoonPhase(date) {
    const lp = 29.53058867;
    const newMoon = new Date(Date.UTC(2000,0,6,18,14));
    const days = (date - newMoon) / 86400000;
    const phase = (days % lp) / lp;

    if (phase < 0.03 || phase > 0.97) return 'Nouvelle lune';
    if (phase < 0.22) return 'Premier quartier';
    if (phase < 0.47) return 'Pleine lune';
    if (phase < 0.72) return 'Dernier quartier';
    return 'Nouvelle lune';
}

function getSolunar(date) {
    const phase = getMoonPhase(date);
    return {
        moonPhase: phase,
        major: phase === 'Nouvelle lune' || phase === 'Pleine lune'
    };
}

// =======================
// CONSEILS PECHE
// =======================
function fishingInfo(temp, windSpeed, windDir, pressure, date, lat) {
    let color = 'green';
    const tips = [];
    const wind = windDirectionCardinal(windDir);
    const season = getSeason(date, lat);

    if (temp < 8) { tips.push("🥶 Eau très froide"); color = 'red'; }
    else if (temp < 12) { tips.push("🌡️ Eau froide"); color = 'orange'; }
    else if (temp <= 22) tips.push("✅ Température idéale");
    else { tips.push("🔥 Eau chaude"); color = 'orange'; }

    if (pressure < 1010) tips.push("📉 Pression basse favorable");
    else if (pressure > 1020) {
        tips.push("📈 Pression élevée");
        if (color === 'green') color = 'orange';
    }

    tips.push(`💨 Vent ${wind}`);

    const solunar = getSolunar(date);
    tips.push(`🌙 ${solunar.moonPhase}`);

    if (season === 'Hiver' && color === 'green') color = 'orange';

    return { color, tips, season };
}

// =======================
// SCORE HEURE
// =======================
function getHourScore(temp, pressure, windSpeed, date) {
    let score = 0;

    if (temp >= 12 && temp <= 22) score += 4;
    else if (temp >= 8) score += 2;

    if (pressure >= 1010 && pressure <= 1020) score += 3;
    else if (pressure < 1010) score += 2;

    if (windSpeed <= 15) score += 2;

    if (getSolunar(date).major) score += 2;

    return score;
}

// =======================
// OVERLAY POPUP
// =======================
function openWeatherOverlay(d) {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
        <div class="overlay-content">
            <h2>${d.label}</h2>
            <p>${d.icon}</p>
            <p>🌡️ ${d.temp} °C</p>
            <p>💨 ${d.windSpeed} km/h (${d.windDir})</p>
            <p>🌧️ Précipitations : ${d.precipitation} mm</p>
            <p>📈 ${d.pressure} hPa</p>
            <p>🌅 ${d.sunrise} / 🌇 ${d.sunset}</p>
            <p>📅 Saison : ${d.season}</p>
            <h3>Conseils</h3>
            <ul>${d.tips.map(t => `<li>${t}</li>`).join('')}</ul>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
}

// =======================
// METEO + CARTES HORAIRES
// =======================
function getWeather(lat, lon, date) {
    const dateStr = date.toISOString().split('T')[0];

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const currentHour = now.getHours();

    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weathercode,windspeed_10m,winddirection_10m,pressure_msl,precipitation&daily=sunrise,sunset&start_date=${dateStr}&end_date=${dateStr}&timezone=auto`)
        .then(r => r.json())
        .then(data => {
            const carousel = document.getElementById('weather-carousel');
            carousel.innerHTML = '';

            const sunrise = data.daily.sunrise[0].slice(11,16);
            const sunset = data.daily.sunset[0].slice(11,16);

            let bestScore = -1;
            let bestIndex = null;

            // ---- Calcul meilleure heure (future uniquement)
            data.hourly.time.forEach((t, i) => {
                const d = new Date(t);
                if (d.toDateString() !== date.toDateString()) return;
                if (isToday && d.getHours() < currentHour) return;

                const score = getHourScore(
                    data.hourly.temperature_2m[i],
                    data.hourly.pressure_msl[i],
                    data.hourly.windspeed_10m[i],
                    date
                );

                if (score > bestScore) {
                    bestScore = score;
                    bestIndex = i;
                }
            });

            // ---- Création des cartes horaires
            data.hourly.time.forEach((t, i) => {
                const d = new Date(t);
                if (d.toDateString() !== date.toDateString()) return;
                if (isToday && d.getHours() < currentHour) return;

                const temp = data.hourly.temperature_2m[i];
                const windSpeed = data.hourly.windspeed_10m[i];
                const windDir = data.hourly.winddirection_10m[i];
                const pressure = data.hourly.pressure_msl[i];
                const precipitation = data.hourly.precipitation[i] ?? 0;
                const code = data.hourly.weathercode[i];

                const info = fishingInfo(temp, windSpeed, windDir, pressure, date, lat);
                const hour = String(d.getHours()).padStart(2,'0') + 'h';
                const best = i === bestIndex ? ' ⭐' : '';

                const card = document.createElement('div');
                card.className = 'card';
                card.style.backgroundColor =
                    info.color === 'green' ? 'rgba(144,238,144,0.85)' :
                    info.color === 'orange' ? 'rgba(255,165,0,0.85)' :
                    'rgba(255,99,71,0.85)';

                card.innerHTML = `
                    <strong>${hour}${best}</strong><br>
                    ${weatherIcon(code)}<br>
                    🌡️ ${temp} °C<br>
                    💨 ${windSpeed} km/h<br>
                    🌧️ ${precipitation} mm<br>
                    📈 ${pressure} hPa
                `;

                card.onclick = () => openWeatherOverlay({
                    label: `${hour} - ${dateStr}${best}`,
                    icon: weatherIcon(code),
                    temp,
                    windSpeed,
                    windDir: windDirectionCardinal(windDir),
                    precipitation,
                    pressure,
                    sunrise,
                    sunset,
                    season: info.season,
                    tips: info.tips
                });

                carousel.appendChild(card);
            });
        });
}

// =======================
// RAFRAICHIR
// =======================
function refreshWeather() {
    if (!marker) return;
    const { lat, lng } = marker.getLatLng();
    getWeather(lat, lng, getSelectedDate());
}

// =======================
// MAP / RECHERCHE
// =======================
map.on('click', e => {
    if (marker) map.removeLayer(marker);
    marker = L.marker(e.latlng).addTo(map);
    refreshWeather();
});

function searchCity() {
    const city = cityInput.value;
    if (!city) return;

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`)
        .then(r => r.json())
        .then(d => {
            if (!d.length) return alert("Ville non trouvée");
            const lat = +d[0].lat;
            const lon = +d[0].lon;
            map.setView([lat, lon], 12);
            if (marker) map.removeLayer(marker);
            marker = L.marker([lat, lon]).addTo(map);
            refreshWeather();
        });
}

searchBtn.onclick = searchCity;
cityInput.onkeypress = e => { if (e.key === 'Enter') searchCity(); };
