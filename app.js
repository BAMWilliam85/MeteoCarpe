// =======================
// VARIABLES GLOBALES
// =======================
let currentLat = 48.8566;
let currentLon = 2.3522;
let currentDate = new Date();

// =======================
// MAP
// =======================
const map = L.map('map').setView([currentLat, currentLon], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

// Marker initial
let marker = L.marker([currentLat, currentLon]).addTo(map);
map.on('click', e => {
    marker.setLatLng(e.latlng);
    currentLat = e.latlng.lat;
    currentLon = e.latlng.lng;
    refreshWeather();
});

// =======================
// DATE PICKER
// =======================
const dateInput = flatpickr("#dateInput", {
    altInput: true,
    altFormat: "d-m-Y",
    dateFormat: "Y-m-d",
    defaultDate: currentDate,
    minDate: "today",
    maxDate: new Date().fp_incr(7),
    onChange: dates => {
        if(dates.length) {
            currentDate = dates[0];
            refreshWeather();
        }
    }
});

// =======================
// UTILS METEO
// =======================
function weatherIcon(code) {
    if(code===0) return '☀️ Clair';
    if([1,2,3].includes(code)) return '⛅ Nuageux';
    if([45,48].includes(code)) return '🌫️ Brouillard';
    if([51,53,55].includes(code)) return '🌦️ Bruine';
    if([61,63,65].includes(code)) return '🌧️ Pluie';
    if([71,73,75].includes(code)) return '❄️ Neige';
    if([80,81,82].includes(code)) return '🌧️🌧️ Pluie forte';
    if([95,96,99].includes(code)) return '⛈️ Orage';
    return '❔';
}

function windDirectionCardinal(deg) {
    const dirs=['Nord','Nord-Est','Est','Sud-Est','Sud','Sud-Ouest','Ouest','Nord-Ouest'];
    return dirs[Math.round(deg/45)%8];
}

function getSeason(date, lat=0){
    const m = date.getMonth()+1;
    if(lat>=0){
        if(m<=2) return 'Hiver';
        if(m<=5) return 'Printemps';
        if(m<=8) return 'Été';
        return 'Automne';
    } else {
        if(m<=2) return 'Été';
        if(m<=5) return 'Automne';
        if(m<=8) return 'Hiver';
        return 'Printemps';
    }
}

// =======================
// LUNE / SOLUNAIRE
// =======================
function getMoonPhase(date){
    const lp = 29.53058867;
    const newMoon = new Date(Date.UTC(2000,0,6,18,14));
    const days = (date-newMoon)/86400000;
    const phase = (days%lp)/lp;
    if(phase<0.03||phase>0.97) return 'Nouvelle lune';
    if(phase<0.22) return 'Premier quartier';
    if(phase<0.47) return 'Pleine lune';
    if(phase<0.72) return 'Dernier quartier';
    return 'Nouvelle lune';
}

function getSolunar(date){
    const phase = getMoonPhase(date);
    return { moonPhase: phase, major: phase==='Nouvelle lune'||phase==='Pleine lune' };
}

// =======================
// CONSEILS PECHE
// =======================
function fishingInfo(temp, windSpeed, windDir, pressure, precipitation, date, lat){
    const season = getSeason(date, lat);
    const solunar = getSolunar(date);
    const tips=[];
    let score=0;

    // --------------------
    // Température
    // --------------------
    const tempRanges = {
        'Printemps': {veryCold:8, cold:14, ideal:20, hot:Infinity},
        'Été': {veryCold:10, cold:16, ideal:27, hot:Infinity},
        'Automne': {veryCold:5, cold:14, ideal:18, hot:Infinity},
        'Hiver': {veryCold:4, cold:12, ideal:16, hot:Infinity}
    };
    const tr = tempRanges[season];
    const tempText = [
        { max: tr.veryCold, emoji:'🥶 Très froide', text:"Les carpes ralentissent beaucoup, la pêche sera difficile.", points:0 },
        { max: tr.cold, emoji:'🌡️ Froide', text:"Quelques touches possibles.", points:1 },
        { max: tr.ideal, emoji:'✅ Idéale', text:"Activité optimale, les carpes sont curieuses et mordent plus facilement.", points:3 },
        { max: Infinity, emoji:'🔥 Trop chaude', text:"Activité réduite, privilégiez les zones ombragées et le lever/coucher du soleil.", points:1 }
    ];
    for(let t of tempText){
        if(temp<=t.max){ tips.push(`${t.emoji} : ${t.text}`); score+=t.points; break; }
    }

    // --------------------
    // Pression atmosphérique
    // --------------------
    const pressureText = [
        { max:1009, emoji:'📉 Pression Basse', text:"Favorise les touches.", points:2 },
        { max:1020, emoji:'⚖️ Pression Stable', text:"Activité normale.", points:1 },
        { max:Infinity, emoji:'📈 Pression Élevée', text:"Carpes moins actives, elles se calment, profitez pour observer et ajuster votre stratégie.", points:0 }
    ];
    for(let p of pressureText){
        if(pressure<=p.max){ tips.push(`${p.emoji} : ${p.text}`); score+=p.points; break; }
    }

    // --------------------
    // Vent
    // --------------------
    const windText = [
        { max:5, emoji:'💨 Vent Faible', text:"Conditions parfaites.", points:2 },
        { max:15, emoji:'💨 Vent Modéré', text:"Pêche possible mais attention a l’agitation.", points:1 },
        { max:Infinity, emoji:'🌬️ Vent Fort', text:"Zones abritées à privilégier, l’agitation de l’eau peut compliquer la pêche.", points:0 }
    ];
    for(let w of windText){
        if(windSpeed<=w.max){ tips.push(`${w.emoji} (${windDirectionCardinal(windDir)}) : ${w.text}`); score+=w.points; break; }
    }

    // --------------------
    // Pluie / Humidité
    // --------------------
    const rainText = [
        { max:0, emoji:'☀️ Pas de pluie', text:"Pas de Parapluie.", points:2 },
        { max:2, emoji:'🌦️ Légère pluie', text:"Peut stimuler l’activité sans gêner les touches.", points:1 },
        { max:Infinity, emoji:'🌧️🌧️ Forte pluie', text:"L’eau se trouble, privilégiez les zones calmes.", points:0 }
    ];
    for(let r of rainText){
        if(precipitation<=r.max){ tips.push(`${r.emoji} : ${r.text}`); score+=r.points; break; }
    }

    // --------------------
    // Saison
    // --------------------
    const seasonTips = {
        'Printemps': "Poissons actifs, nutrition élevée, bon moment pour les gros sujets mais prudence à la période de fraye (mi-avril à fin mai)",
        'Été': "Activité concentrée tôt le matin et en soirée, journée trés chaude = pêche calme.",
        'Automne': "Préparation à l’hiver, carpes très actives, touches importantes possibles.",
        'Hiver': "Ralentissement général, pêche longue et patiente, privilégiez les journées douces."
    };
    tips.push(`📅 Saison (${season}) : ${seasonTips[season]}`);

    // --------------------
    // Phase lunaire
    // --------------------

    tips.push(`🌙 Phase lunaire : ${solunar.moonPhase}`);

    // --------------------
    // Couleur selon score
    // --------------------
    let color='red';
    if(score>=9) color='green';
    else if(score>=7) color='yellow';
    else if(score>=4) color='orange';

    return { score, color, tips, season, solunar };
}

// =======================
// OVERLAY POPUP
// =======================
function openWeatherOverlay(d){
    const overlay=document.createElement('div');
    overlay.className='overlay';
    overlay.innerHTML=`
        <div class="overlay-content">
            <h2>${d.label}</h2>
            <p>${d.icon}</p>
            <p>🌡️ Température: ${d.temp} °C</p>
            <p>💨 Vent: ${d.windSpeed} km/h (${d.windDir})</p>
            <p>🌧️ Précipitations: ${d.precipitation} mm</p>
            <p>📈 Pression: ${d.pressure} hPa</p>
            <p>🌅 ${d.sunrise} / 🌇 ${d.sunset}</p>
            <p>📅 Saison: ${d.season}</p>
            <h3>Conseils Pêche Carpe</h3>
            <ul>${d.tips.map(t=>`<li>${t}</li>`).join('')}</ul>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.onclick=e=>{if(e.target===overlay) overlay.remove();}
}

// =======================
// METEO + CARROUSEL
// =======================
function getWeather(lat, lon, date){
    const dateStr=date.toISOString().split('T')[0];
    const now=new Date();
    const isToday=now.toDateString()===date.toDateString();
    const currentHour=now.getHours();

    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weathercode,windspeed_10m,winddirection_10m,pressure_msl,precipitation&daily=sunrise,sunset&start_date=${dateStr}&end_date=${dateStr}&timezone=auto`)
    .then(r=>r.json())
    .then(data=>{
        const carousel=document.getElementById('weather-carousel');
        carousel.innerHTML='';
        const sunrise = data.daily.sunrise[0].slice(11,16);
        const sunset = data.daily.sunset[0].slice(11,16);

        let bestScore=-1, bestIndex=null;

        data.hourly.time.forEach((t,i)=>{
            const d=new Date(t);
            if(d.toDateString()!==date.toDateString()) return;
            if(isToday && d.getHours()<currentHour) return;
            const info = fishingInfo(
                data.hourly.temperature_2m[i],
                data.hourly.windspeed_10m[i],
                data.hourly.winddirection_10m[i],
                data.hourly.pressure_msl[i],
                data.hourly.precipitation[i] ?? 0,
                date,
                lat
            );
            if(info.score>bestScore){ bestScore=info.score; bestIndex=i; }
        });

        data.hourly.time.forEach((t,i)=>{
            const d=new Date(t);
            if(d.toDateString()!==date.toDateString()) return;
            if(isToday && d.getHours()<currentHour) return;

            const temp = data.hourly.temperature_2m[i];
            const windSpeed = data.hourly.windspeed_10m[i];
            const windDir = data.hourly.winddirection_10m[i];
            const pressure = data.hourly.pressure_msl[i];
            const precipitation = data.hourly.precipitation[i] ?? 0;
            const code = data.hourly.weathercode[i];

            const info = fishingInfo(temp, windSpeed, windDir, pressure, precipitation, date, lat);

            const dayLabel=d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'numeric'});
            const hourLabel=String(d.getHours()).padStart(2,'0')+'h';
            const best=i===bestIndex?' ⭐':'';

            const card=document.createElement('div');
            card.className='card';
            card.style.backgroundColor=
                info.color==='green' ? 'rgba(144,238,144,0.85)' :
                info.color==='yellow' ? 'rgba(255,255,0,0.85)' :
                info.color==='orange' ? 'rgba(255,165,0,0.85)' :
                'rgba(255,99,71,0.85)';

            card.innerHTML=`
                <strong>${dayLabel} ${hourLabel}${best}</strong><br>
                ${weatherIcon(code)}<br>
                🌡️ ${temp} °C<br>
                💨 ${windSpeed} km/h<br>
                🌧️ ${precipitation} mm<br>
                📈 ${pressure} hPa
            `;

            card.onclick=()=>openWeatherOverlay({
                label:`${dayLabel} ${hourLabel}${best}`,
                icon:weatherIcon(code),
                temp,
                windSpeed,
                windDir:windDirectionCardinal(windDir),
                precipitation,
                pressure,
                sunrise,
                sunset,
                season:info.season,
                tips:info.tips
            });

            carousel.appendChild(card);
        });

        // Drag & swipe
        let isDown=false, startX, scrollLeft;
        carousel.onmousedown=e=>{isDown=true;startX=e.pageX;scrollLeft=carousel.scrollLeft;}
        carousel.onmouseleave=()=>isDown=false;
        carousel.onmouseup=()=>isDown=false;
        carousel.onmousemove=e=>{if(!isDown) return; e.preventDefault(); carousel.scrollLeft=scrollLeft-(e.pageX-startX)*1.2;}
        carousel.ontouchstart=e=>{startX=e.touches[0].pageX; scrollLeft=carousel.scrollLeft;}
        carousel.ontouchmove=e=>{carousel.scrollLeft=scrollLeft-(e.touches[0].pageX-startX)*1.2;}
    });
}

// =======================
// RAFRAICHIR
// =======================
function refreshWeather(){
    if(!marker) return;
    const {lat,lng}=marker.getLatLng();
    getWeather(lat,lng,currentDate);
}

// =======================
// BOUTONS JOURS
// =======================
function changeDay(delta){
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate()+delta);
    const today=new Date(); today.setHours(0,0,0,0);
    const maxDate=new Date(today); maxDate.setDate(today.getDate()+7);
    if(newDate<today || newDate>maxDate) return;
    currentDate=newDate;
    dateInput.setDate(currentDate,true);
    refreshWeather();
}
document.getElementById('prevDay').onclick=()=>changeDay(-1);
document.getElementById('nextDay').onclick=()=>changeDay(1);

// =======================
// RECHERCHE VILLE
// =======================
const cityInput=document.getElementById('cityInput');
const searchBtn=document.getElementById('searchBtn');
function searchCity(){
    const city=cityInput.value;
    if(!city) return;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`)
    .then(r=>r.json())
    .then(d=>{
        if(!d.length) return alert("Ville non trouvée");
        const lat=+d[0].lat;
        const lon=+d[0].lon;
        map.setView([lat, lon],12);
        marker.setLatLng([lat, lon]);
        currentLat=lat; currentLon=lon;
        refreshWeather();
    });
}
searchBtn.onclick=searchCity;
cityInput.onkeypress=e=>{if(e.key==='Enter') searchCity();}

// =======================
// INIT
// =======================
refreshWeather();
