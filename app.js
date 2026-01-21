// =======================
// INIT MAP LEAFLET
// =======================
const map = L.map('map').setView([48.8566, 2.3522], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
let marker = null;

// =======================
// TRANCHES HORAIRES
// =======================
const timeSlots = [
    { label: "00h-07h", start: 0, end: 7 },
    { label: "07h-10h", start: 7, end: 10 },
    { label: "10h-15h", start: 10, end: 15 },
    { label: "15h-19h", start: 15, end: 19 },
    { label: "19h-00h", start: 19, end: 24 },
];

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
    onChange: function (selectedDates) {
        if (selectedDates.length) {
            currentDate = selectedDates[0];
            refreshWeather();
        }
    }
});
function getSelectedDate() { return currentDate; }

// =======================
// UTILS
// =======================
function weatherIcon(code) {
    if (code === 0) return '☀️ Clair';
    if ([1, 2, 3].includes(code)) return '⛅ Partiellement nuageux';
    if ([45, 48].includes(code)) return '🌫️ Brouillard';
    if ([51, 53, 55].includes(code)) return '🌦️ Bruine';
    if ([61, 63, 65].includes(code)) return '🌧️ Pluie';
    if ([71, 73, 75].includes(code)) return '❄️ Neige';
    if ([80, 81, 82].includes(code)) return '🌧️🌧️ Pluie forte';
    if ([95, 96, 99].includes(code)) return '⛈️ Orage';
    return '❔ Inconnu';
}

function windDirectionCardinal(deg) {
    const dirs = ['Nord', 'Nord-Est', 'Est', 'Sud-Est', 'Sud', 'Sud-Ouest', 'Ouest', 'Nord-Ouest'];
    return dirs[Math.round(deg / 45) % 8];
}

// Saison adaptée nord/sud
function getSeason(date, lat=0){
    const m = date.getMonth()+1;
    if(lat>=0){ // hémisphère nord
        if(m>=3 && m<=5) return 'Printemps';
        if(m>=6 && m<=8) return 'Été';
        if(m>=9 && m<=11) return 'Automne';
        return 'Hiver';
    } else { // hémisphère sud
        if(m>=3 && m<=5) return 'Automne';
        if(m>=6 && m<=8) return 'Hiver';
        if(m>=9 && m<=11) return 'Printemps';
        return 'Été';
    }
}

// =======================
// LUNE / SOLUNAIRE
// =======================
function getMoonPhase(date) {
    const lp = 29.53058867;
    const newMoon = new Date(Date.UTC(2000,0,6,18,14));
    const daysSinceNew = (date - newMoon)/86400000;
    const phase = (daysSinceNew%lp)/lp;
    if(phase<0.03 || phase>0.97) return 'Nouvelle lune';
    if(phase<0.22) return 'Premier quartier';
    if(phase<0.28) return 'Première lune gibbeuse';
    if(phase<0.47) return 'Pleine lune';
    if(phase<0.53) return 'Dernière lune gibbeuse';
    if(phase<0.72) return 'Dernier quartier';
    return 'Nouvelle lune';
}

function getSolunar(date) {
    const moonPhase = getMoonPhase(date);
    let majorActivity = false;
    let minorActivity = false;
    if(moonPhase==='Nouvelle lune' || moonPhase==='Pleine lune') majorActivity=true;
    else minorActivity=true;
    return {moonPhase, majorActivity, minorActivity};
}

// =======================
// CONSEILS DE PECHE
// =======================
function fishingInfo(temp, windSpeed, windDir, pressure, date, slot, lat) {
    const wind = windDirectionCardinal(windDir);
    const season = getSeason(date, lat);
    let color = 'green';
    let tips = [];

    // ------------------
    // Température
    // ------------------
    if (temp < 8) { tips.push("🥶 Eau très froide : activité minimale."); color = 'red'; }
    else if (temp < 12) { tips.push("🌡️ Eau froide : touches possibles mais activité faible."); color = 'orange'; }
    else if (temp <= 22) { tips.push("✅ Température idéale : activité optimale."); }
    else { tips.push("🔥 Eau chaude : activité irrégulière."); color = 'orange'; }

    // ------------------
    // Pression
    // ------------------
    if (pressure < 1010) { tips.push("📉 Pression basse : souvent favorable, surtout avec vent modéré."); if (color !== 'red') color = 'green'; }
    else if (pressure > 1020) { tips.push("📈 Pression élevée : activité réduite."); if (color === 'green') color = 'orange'; }
    else { tips.push("⚖️ Pression stable : conditions normales."); }

    // ------------------
    // Vent
    // ------------------
    if (['Sud', 'Sud-Ouest'].includes(wind)) { tips.push(`🍃 Vent ${wind} : souvent bénéfique.`); }
    else { tips.push(`🌬️ Vent ${wind} : privilégiez zones abritées.`); }

    // ------------------
    // Saisons
    // ------------------
    switch (season) {
        case 'Printemps':
            tips.push("🌱 Printemps : carpes remontent vers la surface, eau plus oxygénée, activité en hausse.");
            tips.push("⚠️ Profitez de la montée en température pour amorcer efficacement.");
            break;
        case 'Été':
            tips.push("☀️ Été : carpes actives tôt matin, en soirée et la nuit, cherchent fraîcheur et zones ombragées.");
            tips.push("⚠️ Attention à la fraie (mai à fin juillet) : appétit réduit.");
            break;
        case 'Automne':
            tips.push("🍂 Automne : activité élevée, carpes préparent l'hiver, bonnes opportunités de captures.");
            tips.push("💡 Ciblez les zones riches en nourriture naturelle et appâts attractifs.");
            break;
        case 'Hiver':
            tips.push("❄️ Hiver : carpes moins actives, se déplacent peu et économisent leur énergie.");
            tips.push("💡 Les grosses carpes restent actives : patience et précision requises.");
            if(color==='green') color='orange'; // ajustement couleur pour hiver
            break;
    }

    // Phase lunaire nuancée
    const solunar = getSolunar(date);
    if(solunar.majorActivity){ tips.push(`🌑 Phase lunaire (${solunar.moonPhase})`); }
    else if(solunar.minorActivity){ tips.push(`🌗 Phase lunaire (${solunar.moonPhase}) `); }

    return {color, tips, season};
}

// =======================
// OVERLAY POPUP
// =======================
function openWeatherOverlay(details){
    const overlay=document.createElement('div');
    overlay.className='overlay';
    overlay.innerHTML=`
        <div class="overlay-content">
            <h2>${details.label}</h2>
            <p>${details.icon}</p>
            <hr>
            <p>🌡️ Température : ${details.temp} °C</p>
            <p>💨 Vent : ${details.windSpeed} km/h (${details.windDir})</p>
            <p>📈 Pression : ${details.pressure} hPa</p>
            <p>🌅 Lever : ${details.sunrise} / 🌇 Coucher : ${details.sunset}</p>
            <p>📅 Saison : ${details.season}</p>
            <h3>Conseils :</h3>
            <ul>${details.tips.map(t=>`<li>${t}</li>`).join('')}</ul>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e=>{ if(e.target===overlay) overlay.remove(); });
}

// =======================
// SCORE CRENEAU
// =======================
function getSlotScore(temp, pressure, windSpeed, date, lat){
    let score=0;
    if(temp>=12 && temp<=22) score+=3;
    else if(temp>=8 && temp<12) score+=1;

    if(windSpeed<=15) score+=1;

    if(pressure<1010) score+=2;
    else if(pressure>=1010 && pressure<=1020) score+=3;
    else score+=1;

    const season=getSeason(date,lat);
    if(season==='Hiver' && temp<15) score*=0.9;
    if(season==='Hiver' && temp>=15) score+=0.5;

    const solunar=getSolunar(date);
    if(solunar.majorActivity) score+=1;
    else if(solunar.minorActivity) score+=0.5;

    return score;
}

// =======================
// METEO + CARROUSEL
// =======================
function getWeather(lat, lon, date){
    const dateStr=date.toISOString().split('T')[0];
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weathercode,windspeed_10m,winddirection_10m,pressure_msl&daily=sunrise,sunset&start_date=${dateStr}&end_date=${dateStr}&timezone=auto`)
        .then(res=>res.json())
        .then(data=>{
            const carousel=document.getElementById('weather-carousel');
            const scrollPos = carousel.scrollLeft; // conserve scroll
            carousel.innerHTML='';

            const sunrise=data.daily?.sunrise?.[0].slice(11,16)??'-';
            const sunset=data.daily?.sunset?.[0].slice(11,16)??'-';

            let bestScore=-Infinity;
            let bestSlotIndex=0;

            timeSlots.forEach((slot,index)=>{
                const indices=data.hourly.time
                    .map((t,i)=>({h:new Date(t).getHours(),i}))
                    .filter(o=>o.h>=slot.start && o.h<slot.end)
                    .map(o=>o.i);
                const hourIndex=indices.length?indices[0]:0;

                const temp=Number(data.hourly.temperature_2m[hourIndex]??20);
                const windSpeed=Number(data.hourly.windspeed_10m[hourIndex]??5);
                const windDir=Number(data.hourly.winddirection_10m[hourIndex]??0);
                const pressure=Number(data.hourly.pressure_msl[hourIndex]??1013);

                const score=getSlotScore(temp,pressure,windSpeed,date,lat);
                if(score>bestScore){ bestScore=score; bestSlotIndex=index; }
            });

            timeSlots.forEach((slot,index)=>{
                const indices=data.hourly.time
                    .map((t,i)=>({h:new Date(t).getHours(),i}))
                    .filter(o=>o.h>=slot.start && o.h<slot.end)
                    .map(o=>o.i);
                const hourIndex=indices.length?indices[0]:0;

                const temp=Number(data.hourly.temperature_2m[hourIndex]??20);
                const code=data.hourly.weathercode[hourIndex]??0;
                const windSpeed=Number(data.hourly.windspeed_10m[hourIndex]??5);
                const windDir=Number(data.hourly.winddirection_10m[hourIndex]??0);
                const pressure=Number(data.hourly.pressure_msl[hourIndex]??1013);

                const info=fishingInfo(temp,windSpeed,windDir,pressure,date,slot,lat);
                const icon=weatherIcon(code);

                const card=document.createElement('div');
                card.className='card';
                card.style.backgroundColor=info.color==='green'?'rgba(144,238,144,0.85)':info.color==='orange'?'rgba(255,165,0,0.85)':'rgba(255,99,71,0.85)';
                const bestMark=index===bestSlotIndex?' ⭐':'';

                card.innerHTML=`
                    <strong>${slot.label} - ${dateStr}${bestMark}</strong><br>
                    ${icon}<br>
                    🌡️ Temp: ${temp} °C<br>
                    💨 Vent: ${windSpeed} km/h<br>
                    📈 Pression: ${pressure} hPa
                `;

                card.addEventListener('click',()=>openWeatherOverlay({
                    label:`${slot.label} - ${dateStr}${bestMark}`,
                    icon,temp,windSpeed,windDir:windDirectionCardinal(windDir),
                    pressure,sunrise,sunset,season:info.season,tips:info.tips
                }));

                carousel.appendChild(card);
            });

            carousel.scrollLeft = scrollPos;
        })
        .catch(err=>{
            console.error(err);
            document.getElementById('weather-carousel').innerHTML='<p style="padding:15px;">Erreur récupération météo</p>';
        });
}

// =======================
// RAFRAICHIR METEO
// =======================
function refreshWeather(){
    if(!marker) return;
    const {lat,lng}=marker.getLatLng();
    const date=getSelectedDate();
    getWeather(lat,lng,date);
}

// =======================
// BOUTONS JOUR
// =======================
document.getElementById('prevDay').addEventListener('click',()=>{
    const d=new Date(getSelectedDate());
    d.setDate(d.getDate()-1);
    const today=new Date(); today.setHours(0,0,0,0);
    const newDate=d<today?today:d;
    dateInput.setDate(newDate,true);
    refreshWeather();
});
document.getElementById('nextDay').addEventListener('click',()=>{
    const d=new Date(getSelectedDate());
    d.setDate(d.getDate()+1);
    const max=new Date(); max.setDate(max.getDate()+7);
    const newDate=d>max?max:d;
    dateInput.setDate(newDate,true);
    refreshWeather();
});

// =======================
// RECHERCHE VILLE + CLIC MAP
// =======================
function searchCity(){
    const city=document.getElementById('cityInput').value;
    if(!city) return;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`)
        .then(res=>res.json())
        .then(data=>{
            if(!data.length) return alert("Ville non trouvée");
            const {lat,lon,display_name}=data[0];
            map.setView([lat,lon],12);
            if(marker) map.removeLayer(marker);
            marker=L.marker([lat,lon]).addTo(map).bindPopup(display_name).openPopup();
            refreshWeather();
        }).catch(err=>console.error(err));
}

map.on('click',function(e){
    const {lat,lng}=e.latlng;
    if(marker) map.removeLayer(marker);
    marker=L.marker([lat,lng]).addTo(map).bindPopup("Lieu sélectionné").openPopup();
    refreshWeather();
});

document.getElementById('cityInput').addEventListener('keypress',e=>{if(e.key==='Enter') searchCity();});
document.getElementById('searchBtn').addEventListener('click',searchCity);
