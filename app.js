// =======================
// VARIABLES GLOBALES
// =======================
let currentDate = new Date();

// =======================
// MAP
// =======================
// =======================
// MAP — MapLibre GL JS + Stadia Maps (gratuit en localhost)
// =======================
const STYLE_OUTDOORS  = 'https://tiles.stadiamaps.com/styles/outdoors.json';
const STYLE_SATELLITE = {
    version: 8,
    sources: {
        // Google Maps satellite tiles — zoom 20+, images très récentes, haute résolution
        sat: {
            type: 'raster',
            tiles: [
                'https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
                'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
                'https://mt2.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
                'https://mt3.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
            ],
            tileSize: 256,
            maxzoom: 18,
            attribution: '© Google Maps'
        },
        // Labels superposés (routes, villes)
        labels: {
            type: 'raster',
            tiles: [
                'https://mt0.google.com/vt/lyrs=h&x={x}&y={y}&z={z}',
                'https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}',
                'https://mt2.google.com/vt/lyrs=h&x={x}&y={y}&z={z}',
                'https://mt3.google.com/vt/lyrs=h&x={x}&y={y}&z={z}'
            ],
            tileSize: 256,
            maxzoom: 18
        }
    },
    layers: [
        { id: 'sat-layer',    type: 'raster', source: 'sat',    paint: { 'raster-fade-duration': 200 } },
        { id: 'labels-layer', type: 'raster', source: 'labels', paint: { 'raster-opacity': 0.85, 'raster-fade-duration': 200 } }
    ]
};

let currentStyle = 'outdoors';
let markerLngLat = [2.3522, 48.8566];

const map = new maplibregl.Map({
    container: 'map',
    style: STYLE_OUTDOORS,
    center: markerLngLat,
    zoom: 6
});
map.addControl(new maplibregl.NavigationControl(), 'top-right');

// Marqueur personnalisé vert lumineux
const markerEl = document.createElement('div');
markerEl.style.cssText = `
    width:26px;height:26px;
    background:linear-gradient(135deg,#4ade80,#22c55e);
    border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    border:3px solid #0e1210;
    box-shadow:0 2px 12px rgba(74,222,128,0.5);
    cursor:pointer;
`;
const marker = new maplibregl.Marker({ element: markerEl, draggable: true })
    .setLngLat(markerLngLat)
    .addTo(map);

marker.on('dragend', () => {
    const ll = marker.getLngLat();
    markerLngLat = [ll.lng, ll.lat];
    refreshWeather();
});

map.on('click', (e) => {
    marker.setLngLat(e.lngLat);
    markerLngLat = [e.lngLat.lng, e.lngLat.lat];
    refreshWeather();
});

function setMapStyle(style) {
    currentStyle = style;
    document.getElementById('btnOutdoors').classList.toggle('active', style === 'outdoors');
    document.getElementById('btnSatellite').classList.toggle('active', style === 'satellite');
    if (style === 'satellite') {
        if (map.getZoom() > 18) map.setZoom(18);
        map.setMaxZoom(18);
        map.setStyle(STYLE_SATELLITE);
    } else {
        map.setMaxZoom(22);
        map.setStyle(STYLE_OUTDOORS);
    }
}



// =======================
// UTILS MÉTÉO
// =======================
function weatherIcon(code) {
    if (code === 0) return { emoji: '☀️', label: 'Clair' };
    if ([1, 2, 3].includes(code)) return { emoji: '⛅', label: 'Nuageux' };
    if ([45, 48].includes(code)) return { emoji: '🌫️', label: 'Brouillard' };
    if ([51, 53, 55].includes(code)) return { emoji: '🌦️', label: 'Bruine' };
    if ([61, 63, 65].includes(code)) return { emoji: '🌧️', label: 'Pluie' };
    if ([71, 73, 75].includes(code)) return { emoji: '❄️', label: 'Neige' };
    if ([80, 81, 82].includes(code)) return { emoji: '🌧️', label: 'Pluie forte' };
    if ([95, 96, 99].includes(code)) return { emoji: '⛈️', label: 'Orage' };
    return { emoji: '❔', label: 'Inconnu' };
}

function windDirectionCardinal(deg) {
    const dirs = ['Nord', 'Nord-Est', 'Est', 'Sud-Est', 'Sud', 'Sud-Ouest', 'Ouest', 'Nord-Ouest'];
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
    const newMoon = new Date(Date.UTC(2000, 0, 6, 18, 14));
    const days = (date - newMoon) / 86400000;
    const phase = ((days % lp) + lp) % lp / lp;
    if (phase < 0.03 || phase > 0.97) return { name: 'Nouvelle lune', emoji: '🌑' };
    if (phase < 0.22) return { name: 'Premier croissant', emoji: '🌒' };
    if (phase < 0.28) return { name: 'Premier quartier', emoji: '🌓' };
    if (phase < 0.47) return { name: 'Lune gibbeuse croissante', emoji: '🌔' };
    if (phase < 0.53) return { name: 'Pleine lune', emoji: '🌕' };
    if (phase < 0.72) return { name: 'Lune gibbeuse décroissante', emoji: '🌖' };
    if (phase < 0.78) return { name: 'Dernier quartier', emoji: '🌗' };
    return { name: 'Dernier croissant', emoji: '🌘' };
}

function getSolunar(date) {
    const moon = getMoonPhase(date);
    const major = moon.name === 'Nouvelle lune' || moon.name === 'Pleine lune';
    return { moon, major };
}

// =======================
// CONSEILS PÊCHE
// Sources : Chronocarpe, 1max2peche, DNAbaits, planetecarpe, chtipecheur
//
// Barème sur 10 pts, honnête et équilibré :
//   Température    : 0-4 pts
//   Pression       : 0-2 pts
//   Vent vitesse   : 0-2 pts
//   Vent direction : 0-1 pt
//   Précipitations : 0-1 pt
//   Lune           : 0-0.5 pt
// Max théorique : 10.5 → normalisé sur 10
// =======================
function fishingInfo(temp, windSpeed, windDir, pressure, precipitation, date, lat, prevPressure) {
    const season = getSeason(date, lat);
    const solunar = getSolunar(date);
    const tips = [];
    let score = 0;

    // ── 1. TEMPÉRATURE (0-4 pts) ─────────────────────────────────────────
    const tempRanges = {
        'Printemps': { freeze: 5,  veryCold: 10, cold: 14, ideal: 22 },
        'Été':       { freeze: 8,  veryCold: 12, cold: 17, ideal: 26 },
        'Automne':   { freeze: 4,  veryCold: 8,  cold: 13, ideal: 20 },
        'Hiver':     { freeze: 2,  veryCold: 6,  cold: 10, ideal: 14 }
    };
    const tr = tempRanges[season];
    if (temp <= tr.freeze) {
        tips.push(`🥶 Gel proche : Métabolisme quasi nul. Pêche très difficile — grand fond, canne une, appât digeste.`);
        score += 0;
    } else if (temp <= tr.veryCold) {
        tips.push(`🌡️ Température très froide : Activité minimale. Quelques touches possibles en milieu de journée avec du soleil.`);
        score += 1;
    } else if (temp <= tr.cold) {
        tips.push(`🌡️ Température froide : Quelques opportunités, surtout sur les créneaux ensoleillés en fin de matinée.`);
        score += 2;
    } else if (temp <= tr.ideal) {
        tips.push(`✅ Température idéale : Les carpes s'alimentent activement. Plage d'activité optimale.`);
        score += 4;
    } else {
        tips.push(`🔥 Température élevée : Activité réduite en journée par manque d'oxygène. Misez sur l'aube, la soirée ou la nuit.`);
        score += 2;
    }

    // ── 2. PRESSION (0-2 pts) ────────────────────────────────────────────
    const pressureDelta = (prevPressure != null) ? (pressure - prevPressure) : null;
    const isStable = pressureDelta == null || Math.abs(pressureDelta) <= 0.4;

    if (isStable) {
        if (pressure < 1000) {
            tips.push(`📉 Dépression franche : Vent et pluie oxygènent l'eau. Les carpes s'activent — conditions potentiellement excellentes.`);
            score += 2;
        } else if (pressure <= 1015) {
            tips.push(`⚖️ Pression stable et équilibrée : Bonnes conditions de base. Une stabilité sur 24-48h est favorable.`);
            score += 2;
        } else if (pressure <= 1025) {
            tips.push(`📈 Anticyclone modéré : Carpes plus passives. Pêchez profond ou aux heures fraîches, allégez l'amorçage.`);
            score += 1;
        } else {
            tips.push(`📈 Forte haute pression : Carpes lentes et difficiles à déclencher. Approche finesse indispensable.`);
            score += 0;
        }
    } else if (pressureDelta < -0.4) {
        if (pressureDelta < -2) {
            tips.push(`📉 Chute de pression rapide : Moment idéal ! Les carpes s'activent avant l'arrivée du mauvais temps.`);
            score += 2;
        } else {
            tips.push(`📉 Pression en baisse : Tendance favorable, l'activité alimentaire augmente progressivement.`);
            score += 2;
        }
    } else {
        if (pressureDelta > 2) {
            tips.push(`📈 Remontée rapide : Activité perturbée pour 12-24h. Montages fins, amorçage très léger.`);
            score += 0;
        } else {
            tips.push(`📈 Légère remontée : Les carpes recommencent à s'alimenter après la dépression.`);
            score += 1;
        }
    }

    // ── 3. VENT — VITESSE (0-2 pts) ──────────────────────────────────────
    const windCard = windDirectionCardinal(windDir);
    if (windSpeed < 2) {
        tips.push(`🪨 Calme plat (${windCard}) : Peu d'oxygénation. Privilégiez les zones avec arrivées d'eau ou courants.`);
        score += 1;
    } else if (windSpeed <= 5) {
        tips.push(`💨 Légère brise (${windCard}) : Légères ondulations — idéal selon les pêcheurs. Les carpes s'alimentent avec confiance.`);
        score += 2;
    } else if (windSpeed <= 20) {
        tips.push(`💨 Vent modéré (${windCard}) : Bon brassage. Pêchez la berge sous le vent où les aliments s'accumulent.`);
        score += 2;
    } else if (windSpeed <= 35) {
        tips.push(`🌬️ Vent fort (${windCard}) : Difficultés pratiques. Cherchez les zones abritées derrière le vent.`);
        score += 1;
    } else {
        tips.push(`⛈️ Vent tempétueux (${windCard}) : Conditions extrêmes. Brassage trop intense, pêche très aléatoire.`);
        score += 0;
    }

    // ── 4. VENT — DIRECTION (0-1 pt) ─────────────────────────────────────
    const windDeg = (windDir % 360 + 360) % 360;
    if (windDeg >= 202 && windDeg <= 292) {
        tips.push(`🌬️ Direction ${windCard} : Vent d'Ouest/Sud-Ouest — le meilleur pour la pêche. Doux, humide, oxygénant.`);
        score += 1;
    } else if (windDeg >= 135 && windDeg < 202) {
        tips.push(`🌬️ Direction ${windCard} : Vent du Sud, chaud. Favorable au réchauffement de la couche de surface.`);
        score += 0.5;
    } else if (windDeg >= 315 || windDeg < 45) {
        tips.push(`🌬️ Direction ${windCard} : « Vent du nord, rien ne mord. » Refroidit la surface — pêchez à l'abri ou en profondeur.`);
        score += 0;
    } else if (windDeg >= 45 && windDeg < 135) {
        tips.push(`🌬️ Direction ${windCard} : Vent d'Est, froid et sec. Généralement défavorable s'il s'installe.`);
        score += 0;
    }

    // ── 5. PRÉCIPITATIONS (0-1 pt) ───────────────────────────────────────
    if (precipitation <= 0) {
        if (season === 'Hiver') {
            tips.push(`☀️ Pas de précipitations : En hiver, le soleil réchauffe les hauts-fonds et peut déclencher de l'activité.`);
        } else {
            tips.push(`☀️ Pas de précipitations : Conditions sèches. En eau claire, les carpes peuvent être plus méfiantes.`);
        }
        score += 0.5;
    } else if (precipitation <= 3) {
        if (season === 'Automne') {
            tips.push(`🌧️ Légère pluie en automne : Combinée à une dépression, c'est souvent le déclencheur. Les carpes s'activent rapidement.`);
            score += 1;
        } else if (season === 'Hiver') {
            tips.push(`🌧️ Légère pluie en hiver : Peut refroidir la couche de surface. Effet neutre à légèrement négatif.`);
            score += 0;
        } else if (season === 'Été') {
            tips.push(`🌦️ Légère pluie estivale : Refroidit la surface et augmente l'oxygène dissous. Souvent bénéfique.`);
            score += 1;
        } else {
            tips.push(`🌦️ Légère pluie : Oxygénation de l'eau, effets généralement positifs sur l'activité alimentaire.`);
            score += 1;
        }
    } else {
        tips.push(`🌧️ Fortes précipitations : L'eau se trouble. Activité possible mais éphémère. Zones calmes à privilégier.`);
        score += 0.5;
    }

    // ── 6. SAISON (conseil qualitatif — aucun impact sur le score) ───────
    const seasonTips = {
        'Printemps': `🌸 Printemps : Carpes en pleine forme après l'hiver. Attention à la fraye (mi-avril à fin mai).`,
        'Été':       `☀️ Été : Pêche aléatoire en journée. Misez sur l'aube, le crépuscule et la nuit. Privilégiez les zones brassées, les herbiers et les arrivées d'eau (zones oxygénées).`,
        'Automne':   `🍂 Automne : Saison la plus productive. Les carpes constituent leurs réserves — une dépression avec pluie et vent peut déclencher un carton.`,
        'Hiver':     `❄️ Hiver : Rythme lent. Les journées douces et stables entre deux dépressions sont souvent les meilleures. Amorçage très léger.`
    };
    tips.push(seasonTips[season]);

    // ── 7. LUNE (0-0.5 pt) — signal secondaire, quasi bruit de fond ──────
    tips.push(`${solunar.moon.emoji} Phase lunaire : ${solunar.moon.name}${solunar.major ? ' — légèrement favorable (à ne pas surestimer).' : ''}`);
    if (solunar.major) score += 0.5;

    // ── SCORE FINAL sur 10 — sans plancher artificiel ────────────────────
    const score10 = Math.round(Math.min(10, (score / 10.5) * 10));

    let color    = 'red';
    let colorHex = 'rgba(181,42,42,0.18)';
    if (score10 >= 8)      { color = 'green';  colorHex = 'rgba(46,125,79,0.18)'; }
    else if (score10 >= 6) { color = 'yellow'; colorHex = 'rgba(184,134,11,0.18)'; }
    else if (score10 >= 4) { color = 'orange'; colorHex = 'rgba(199,92,26,0.18)'; }

    return { score: score10, color, colorHex, tips, season, solunar };
}
// =======================
// SCORE → BARRE DE COULEUR
// =======================
function scoreToBarColor(score) {
    if (score >= 8) return 'linear-gradient(90deg, #3a7a45, #5aaa65)';
    if (score >= 6) return 'linear-gradient(90deg, #b8860b, #e8b84b)';
    if (score >= 4) return 'linear-gradient(90deg, #9a5010, #d07830)';
    return 'linear-gradient(90deg, #8a3820, #c05030)';
}

function scoreLabel(score) {
    if (score >= 8) return '✅ Conditions idéales';
    if (score >= 6) return '👍 Conditions correctes';
    if (score >= 4) return '⚠️ Activité modérée';
    return '🛑 Conditions difficiles';
}

// =======================
// OVERLAY POPUP
// =======================
function openWeatherOverlay(d) {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';

    const barWidth = Math.min(100, Math.round((d.score / 10) * 100));
    const barColor = scoreToBarColor(d.score);
    const ovScoreColor = d.score>=8 ? '#6abf7a' : d.score>=6 ? '#c9a84c' : d.score>=4 ? '#c07840' : '#b05545';
    const ovAccent = d.score>=8 ? 'linear-gradient(90deg,#6abf7a,#4a9f5a)' : d.score>=6 ? 'linear-gradient(90deg,#c9a84c,#a88030)' : d.score>=4 ? 'linear-gradient(90deg,#c07840,#a05828)' : 'linear-gradient(90deg,#b05545,#903530)';

    overlay.innerHTML = `
        <div class="overlay-content">
            <button class="overlay-close" id="closeBtn">&#x2715;</button>
            <div class="ov-header">
                <div class="ov-header-accent" style="background:${ovAccent}"></div>
                <div class="ov-kicker">Conditions de pêche</div>
                <div class="ov-title">${d.label}</div>
                <div class="ov-weather-row">
                    <span class="ov-weather-icon">${d.icon.emoji}</span>
                    <span class="ov-weather-label">${d.icon.label}</span>
                </div>
            </div>
            <div class="ov-score-hero">
                <div class="ov-score-big" style="color:${ovScoreColor}">${d.score}<span>/10</span></div>
                <div class="ov-score-right">
                    <div class="ov-score-verdict" style="color:${ovScoreColor}">${scoreLabel(d.score)}</div>
                    <div class="ov-score-track">
                        <div class="ov-score-fill" style="width:${barWidth}%;background:${barColor}"></div>
                    </div>
                </div>
            </div>
            <div class="ov-body">
                <div class="ov-grid">
                    <div class="ov-stat"><div class="ov-stat-label">Température</div><div class="ov-stat-val">${d.temp} °C</div></div>
                    <div class="ov-stat"><div class="ov-stat-label">Vent</div><div class="ov-stat-val">${d.windSpeed} km/h</div></div>
                    <div class="ov-stat"><div class="ov-stat-label">Direction</div><div class="ov-stat-val">${d.windDir}</div></div>
                    <div class="ov-stat"><div class="ov-stat-label">Précipitations</div><div class="ov-stat-val">${d.precipitation} mm</div></div>
                    <div class="ov-stat"><div class="ov-stat-label">Pression</div><div class="ov-stat-val">${d.pressure} hPa</div></div>
                    <div class="ov-stat"><div class="ov-stat-label">Lever / Coucher</div><div class="ov-stat-val" style="font-size:0.92em">${d.sunrise} / ${d.sunset}</div></div>
                </div>
                <hr class="ov-div">
                <div class="ov-tips-label">🎣 Conseils de pêche</div>
                <ul class="ov-tips-list">
                    ${d.tips.map(t => '<li>' + t + '</li>').join('')}
                </ul>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    // Fermeture : clic sur le fond
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    // Fermeture : bouton ✕ — utilise delegation car innerHTML vient d'être injecté
    overlay.addEventListener('click', e => {
        if (e.target.id === 'closeBtn' || e.target.closest('#closeBtn')) overlay.remove();
    });
    // Fermeture : touche Escape
    const onKey = e => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
}

// =======================
// FETCH MET NORWAY (Yr.no)
// =======================
async function fetchMETNorway(lat, lon, dateStr) {
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'MeteoCarpe/2.0 contact@meteocarpe.fr' } });
    const data = await res.json();
    const hours = data.properties.timeseries.filter(ts => {
        const tsDate = new Date(ts.time);
        return tsDate.toISOString().split('T')[0] === dateStr;
    });
    return hours.map(ts => {
        const symbol = ts.data.next_1_hours?.summary?.symbol_code ?? '';
        return {
            time: ts.time,
            temperature_2m: ts.data.instant.details.air_temperature,
            windspeed_10m: ts.data.instant.details.wind_speed,
            winddirection_10m: ts.data.instant.details.wind_from_direction,
            pressure_msl: ts.data.instant.details.air_pressure_at_sea_level,
            precipitation: ts.data.next_1_hours?.details?.precipitation_amount ?? 0,
            weathercode: symbol.includes('clearsky') ? 0 :
                         symbol.includes('partlycloudy') ? 2 :
                         symbol.includes('cloudy') ? 3 :
                         symbol.includes('rain') ? 61 : 0
        };
    });
}

// =======================
// MÉTÉO + CARROUSEL
// =======================
async function getWeather(lat, lon, date) {
    const dateStr = date.toISOString().split('T')[0];
    const now = new Date();
    const isToday = now.toDateString() === date.toDateString();
    const currentHour = now.getHours();

    const carousel = document.getElementById('weather-carousel');
    carousel.innerHTML = `<div class="loading-state"><div class="spinner"></div>Chargement des données météo...</div>`;

    const openMeteoURL = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weathercode,windspeed_10m,winddirection_10m,pressure_msl,precipitation&daily=sunrise,sunset&start_date=${dateStr}&end_date=${dateStr}&timezone=auto`;

    let openData, yrData;
    try {
        [openData, yrData] = await Promise.all([
            fetch(openMeteoURL).then(r => r.json()),
            fetchMETNorway(lat, lon, dateStr)
        ]);
    } catch (err) {
        carousel.innerHTML = `<div class="loading-state" style="color:#b52a2a;">⚠️ Erreur lors du chargement des données. Vérifiez votre connexion.</div>`;
        return;
    }

    carousel.innerHTML = '';

    const sunrise = openData.daily.sunrise[0].slice(11, 16);
    const sunset  = openData.daily.sunset[0].slice(11, 16);

    const hours = openData.hourly.time.map((t, i) => {
        const openHour = {
            time: t,
            temp: openData.hourly.temperature_2m[i],
            wind: openData.hourly.windspeed_10m[i],
            windDir: openData.hourly.winddirection_10m[i],
            pressure: openData.hourly.pressure_msl[i],
            precip: openData.hourly.precipitation[i] ?? 0,
            code: openData.hourly.weathercode[i]
        };
        const yrHour = yrData.find(y => y.time === t);
        if (!yrHour) return openHour;
        return {
            time: t,
            temp:     (openHour.temp     + yrHour.temperature_2m)    / 2,
            wind:     (openHour.wind     + yrHour.windspeed_10m)      / 2,
            windDir:  (openHour.windDir  + yrHour.winddirection_10m)  / 2,
            pressure: (openHour.pressure + yrHour.pressure_msl)       / 2,
            precip:   (openHour.precip   + yrHour.precipitation)      / 2,
            code:     Math.round((openHour.code + yrHour.weathercode) / 2)
        };
    });

    // Trouver le meilleur créneau
    let bestScore = -1, bestIndex = null;
    hours.forEach((h, i) => {
        const d = new Date(h.time);
        if (d.toDateString() !== date.toDateString()) return;
        if (isToday && d.getHours() < currentHour) return;
        const prevP = i > 0 ? hours[i - 1].pressure : null;
        const info = fishingInfo(h.temp, h.wind, h.windDir, h.pressure, h.precip, date, lat, prevP);
        if (info.score > bestScore) { bestScore = info.score; bestIndex = i; }
    });

    let hasCards = false;
    hours.forEach((h, i) => {
        const d = new Date(h.time);
        if (d.toDateString() !== date.toDateString()) return;
        if (isToday && d.getHours() < currentHour) return;

        hasCards = true;
        const prevP = i > 0 ? hours[i - 1].pressure : null;
        const info = fishingInfo(h.temp, h.wind, h.windDir, h.pressure, h.precip, date, lat, prevP);
        const isBest = i === bestIndex;

        const dayLabel  = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'numeric' });
        const hourLabel = String(d.getHours()).padStart(2, '0') + 'h00';
        const wIcon     = weatherIcon(h.code);

        const card = document.createElement('div');
        card.className = 'card' + (isBest ? ' best-slot' : '');
        card.style.background = info.colorHex;
        card.style.borderColor = isBest ? 'rgba(201,168,76,0.5)' : 'rgba(255,255,255,0.5)';

        const sc = info.color;
        const scoreColor  = sc==='green' ? '#6abf7a' : sc==='yellow' ? '#c9a84c' : sc==='orange' ? '#c07840' : '#b05545';
        const scoreChipBg = sc==='green' ? 'rgba(106,191,122,0.13)' : sc==='yellow' ? 'rgba(201,168,76,0.13)' : sc==='orange' ? 'rgba(192,120,64,0.13)' : 'rgba(176,85,69,0.13)';
        const topBarColor = sc==='green' ? '#6abf7a' : sc==='yellow' ? '#c9a84c' : sc==='orange' ? '#c07840' : '#b05545';
        const scoreLbl    = info.score >= 8 ? 'Idéal' : info.score >= 6 ? 'Correct' : info.score >= 4 ? 'Modéré' : 'Difficile';
        card.innerHTML = `
            <div class="card-top-bar" style="background:${topBarColor}"></div>
            ${isBest ? '<div class="best-badge">⭐ Meilleur créneau</div>' : ''}
            <div class="card-body">
                <div class="card-time">
                    <div class="card-time-hour">${hourLabel}</div>
                    <div class="card-time-day">${dayLabel}</div>
                </div>
                <div class="card-score-row">
                    <span class="card-score-num" style="color:${scoreColor}">${info.score}<span class="card-score-sub">/10</span></span>
                    <span class="card-score-chip" style="background:${scoreChipBg};color:${scoreColor}">${scoreLbl}</span>
                </div>
                <div class="card-weather">
                    <span class="card-emoji">${wIcon.emoji}</span>
                    <span class="card-wlabel">${wIcon.label}</span>
                </div>
                <div class="card-data">
                    <div class="card-data-row"><span class="card-dk">Temp.</span><span class="card-dv">${h.temp.toFixed(1)} °C</span></div>
                    <div class="card-data-row"><span class="card-dk">Vent</span><span class="card-dv">${h.wind.toFixed(1)} km/h</span></div>
                    <div class="card-data-row"><span class="card-dk">Pluie</span><span class="card-dv">${h.precip.toFixed(1)} mm</span></div>
                    <div class="card-data-row"><span class="card-dk">Pression</span><span class="card-dv">${h.pressure.toFixed(0)} hPa</span></div>
                </div>
            </div>
        `;

        card.addEventListener('click', () => openWeatherOverlay({
            label:         `${dayLabel} — ${hourLabel}`,
            icon:          wIcon,
            temp:          h.temp.toFixed(1),
            windSpeed:     h.wind.toFixed(1),
            windDir:       windDirectionCardinal(h.windDir),
            precipitation: h.precip.toFixed(1),
            pressure:      h.pressure.toFixed(0),
            sunrise,
            sunset,
            season:        info.season,
            score:         info.score,
            tips:          info.tips
        }));

        carousel.appendChild(card);
    });

    if (!hasCards) {
        carousel.innerHTML = `<div class="loading-state">Aucun créneau disponible pour cette date.</div>`;
    }

    // Scroll jusqu'au meilleur créneau
    if (bestIndex !== null) {
        setTimeout(() => {
            const cards = carousel.querySelectorAll('.card');
            let idx = 0;
            hours.forEach((h, i) => {
                const d = new Date(h.time);
                if (d.toDateString() !== date.toDateString()) return;
                if (isToday && d.getHours() < currentHour) return;
                if (i === bestIndex && cards[idx]) {
                    cards[idx].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                }
                idx++;
            });
        }, 300);
    }

    // Drag & swipe
    let isDown = false, startX, scrollLeft;
    carousel.addEventListener('mousedown',  e => { isDown = true; startX = e.pageX; scrollLeft = carousel.scrollLeft; });
    carousel.addEventListener('mouseleave', () => isDown = false);
    carousel.addEventListener('mouseup',    () => isDown = false);
    carousel.addEventListener('mousemove',  e => {
        if (!isDown) return;
        e.preventDefault();
        carousel.scrollLeft = scrollLeft - (e.pageX - startX) * 1.2;
    });
    carousel.addEventListener('touchstart', e => { startX = e.touches[0].pageX; scrollLeft = carousel.scrollLeft; });
    carousel.addEventListener('touchmove',  e => { carousel.scrollLeft = scrollLeft - (e.touches[0].pageX - startX) * 1.2; });
}

// =======================
// RAFRAÎCHIR
// =======================
function refreshWeather() {
    const [lng, lat] = markerLngLat;
    getWeather(lat, lng, currentDate);
}

// =======================
// BOUTONS JOURS + FLÈCHES
// =======================
function changeDay(delta) {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + delta);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today); maxDate.setDate(today.getDate() + 6);
    if (newDate < today || newDate > maxDate) return;
    currentDate = newDate;
    updateDayButtons();
    refreshWeather();
}
document.getElementById('prevDay').addEventListener('click', () => changeDay(-1));
document.getElementById('nextDay').addEventListener('click', () => changeDay(1));

function updateDayButtons() {
    const container = document.getElementById('dayButtons');
    container.innerHTML = '';
    const today = new Date();
    for (let i = 0; i <= 6; i++) {
        const d = new Date();
        d.setDate(today.getDate() + i);
        const btn = document.createElement('button');
        btn.className = 'day-btn' + (d.toDateString() === currentDate.toDateString() ? ' active' : '');
        if (i === 0)      btn.textContent = "Aujourd'hui";
        else if (i === 1) btn.textContent = 'Demain';
        else              btn.textContent = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'numeric' });
        btn.addEventListener('click', () => { currentDate = d; updateDayButtons(); refreshWeather(); });
        container.appendChild(btn);
    }
}
updateDayButtons();

// =======================
// RECHERCHE VILLE
// =======================
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');

function searchCity() {
    const city = cityInput.value.trim();
    if (!city) return;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`)
        .then(r => r.json())
        .then(d => {
            if (!d.length) { alert('Ville non trouvée'); return; }
            const lat = +d[0].lat;
            const lon = +d[0].lon;
            map.flyTo({ center: [lon, lat], zoom: 12 });
            marker.setLngLat([lon, lat]);
            markerLngLat = [lon, lat];
            refreshWeather();
        })
        .catch(() => alert('Ville non trouvée ou erreur réseau.'));
}

searchBtn.addEventListener('click', searchCity);
cityInput.addEventListener('keypress', e => { if (e.key === 'Enter') searchCity(); });

// =======================
// GÉOLOCALISATION — au chargement de la carte
// =======================
map.on('load', () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => {
                const { latitude: lat, longitude: lon } = pos.coords;
                map.flyTo({ center: [lon, lat], zoom: 12 });
                marker.setLngLat([lon, lat]);
                markerLngLat = [lon, lat];
                refreshWeather();
            },
            () => {
                // Refus ou erreur → Paris par défaut
                refreshWeather();
            },
            { enableHighAccuracy: true, timeout: 8000 }
        );
    } else {
        refreshWeather();
    }
});

// =======================
// OVERLAY SCORING
// =======================
function openScoringOverlay() {
    const ov = document.createElement('div');
    ov.className = 'scoring-overlay';
    ov.innerHTML = `
        <div class="scoring-content">
            <button class="overlay-close" id="scoringClose" style="z-index:10">&#x2715;</button>
            <div class="scoring-header">
                <div class="scoring-header-bar"></div>
                <div class="scoring-kicker">Méthodologie</div>
                <div class="scoring-title">Comment est calculé le score ?</div>
            </div>
            <div class="scoring-body">
                <p class="scoring-intro">
                    Le score de pêche est calculé sur <strong style="color:var(--t1)">6 critères météo</strong> issus de sources spécialisées
                    (Chronocarpe, DNAbaits, 1max2peche, planetecarpe). Il ne reflète pas votre technique mais
                    les <em>conditions objectives</em> propices à l'activité alimentaire de la carpe.
                </p>

                <div class="scoring-criteria">
                    <div class="scoring-row">
                        <span class="scoring-icon">🌡️</span>
                        <div class="scoring-info">
                            <div class="scoring-name">Température <span class="scoring-pts">0 – 4 pts</span></div>
                            <div class="scoring-desc">Critère le plus déterminant. La carpe est ectotherme : son métabolisme dépend directement de l'eau. Zone idéale selon la saison (14–22°C au printemps, 8–14°C en hiver). En dessous ou au-dessus, les points diminuent.</div>
                            <div class="scoring-bar-wrap"><div class="scoring-bar-track"><div class="scoring-bar-fill" style="width:80%"></div></div></div>
                        </div>
                    </div>
                    <div class="scoring-row">
                        <span class="scoring-icon">📈</span>
                        <div class="scoring-info">
                            <div class="scoring-name">Pression atmosphérique <span class="scoring-pts">0 – 2 pts</span></div>
                            <div class="scoring-desc">La tendance compte plus que la valeur absolue. Une chute rapide déclenche l'activité alimentaire. Une forte remontée perturbe les carpes pendant 12–24h. Zone stable entre 1010–1015 hPa = confortable.</div>
                            <div class="scoring-bar-wrap"><div class="scoring-bar-track"><div class="scoring-bar-fill" style="width:40%"></div></div></div>
                        </div>
                    </div>
                    <div class="scoring-row">
                        <span class="scoring-icon">💨</span>
                        <div class="scoring-info">
                            <div class="scoring-name">Vitesse du vent <span class="scoring-pts">0 – 2 pts</span></div>
                            <div class="scoring-desc">Une légère brise (2–20 km/h) crée des ondulations qui oxygènent l'eau et dirigent les aliments vers la berge sous le vent. Le calme plat est moins favorable qu'une légère agitation.</div>
                            <div class="scoring-bar-wrap"><div class="scoring-bar-track"><div class="scoring-bar-fill" style="width:40%"></div></div></div>
                        </div>
                    </div>
                    <div class="scoring-row">
                        <span class="scoring-icon">🧭</span>
                        <div class="scoring-info">
                            <div class="scoring-name">Direction du vent <span class="scoring-pts">0 – 1 pt</span></div>
                            <div class="scoring-desc">« Vent du nord, rien ne mord. » Le vent d'Ouest/Sud-Ouest apporte air doux et humide, très favorable. Le vent d'Est, froid et sec, est généralement défavorable s'il s'installe.</div>
                            <div class="scoring-bar-wrap"><div class="scoring-bar-track"><div class="scoring-bar-fill" style="width:20%"></div></div></div>
                        </div>
                    </div>
                    <div class="scoring-row">
                        <span class="scoring-icon">🌧️</span>
                        <div class="scoring-info">
                            <div class="scoring-name">Précipitations <span class="scoring-pts">0 – 1 pt</span></div>
                            <div class="scoring-desc">Modulé selon la saison. Une pluie légère en automne combinée à une dépression est souvent le meilleur déclencheur. En hiver, la pluie peut refroidir la couche de surface et être neutre à négative.</div>
                            <div class="scoring-bar-wrap"><div class="scoring-bar-track"><div class="scoring-bar-fill" style="width:20%"></div></div></div>
                        </div>
                    </div>
                    <div class="scoring-row">
                        <span class="scoring-icon">🌕</span>
                        <div class="scoring-info">
                            <div class="scoring-name">Phase lunaire <span class="scoring-pts">0 – 0.5 pt</span></div>
                            <div class="scoring-desc">Signal secondaire à ne pas surestimer. Pleine lune et nouvelle lune sont légèrement favorables selon certaines sources. Le poids est volontairement minime.</div>
                            <div class="scoring-bar-wrap"><div class="scoring-bar-track"><div class="scoring-bar-fill" style="width:10%"></div></div></div>
                        </div>
                    </div>
                </div>

                <div class="scoring-scale">
                    <div class="scoring-scale-title">Échelle de lecture</div>
                    <div class="scoring-scale-items">
                        <div class="scoring-scale-row"><span class="scale-dot" style="background:#6abf7a"></span><span class="scale-range" style="color:#6abf7a">8–10</span><span class="scale-label">Conditions idéales — allez pêcher</span></div>
                        <div class="scoring-scale-row"><span class="scale-dot" style="background:#c9a84c"></span><span class="scale-range" style="color:#c9a84c">6–7</span><span class="scale-label">Conditions correctes — activité probable</span></div>
                        <div class="scoring-scale-row"><span class="scale-dot" style="background:#c07840"></span><span class="scale-range" style="color:#c07840">4–5</span><span class="scale-label">Activité modérée — patience requise</span></div>
                        <div class="scoring-scale-row"><span class="scale-dot" style="background:#b05545"></span><span class="scale-range" style="color:#b05545">0–3</span><span class="scale-label">Conditions difficiles — à éviter</span></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    ov.addEventListener('click', e => {
        if (e.target.id === 'scoringClose' || e.target.closest('#scoringClose')) ov.remove();
    });
    const onKey = e => { if (e.key === 'Escape') { ov.remove(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
}
