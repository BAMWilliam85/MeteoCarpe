# MeteoCarpe 🌤️

Petit projet météo en HTML / CSS / JavaScript.


22/01/2026
Patch Météo : 
Nouveau barème pour obtenir un score sur 10.
Calcul automatique de la couleur et ajout de la couleur jaune (vert/jaune/orange/rouge).
Conseils détaillés dans le popup avec explications complètes pour température, pression, vent, pluie, saison et phase lunaire.
Etoile sur la meilleure tranche horaire.
Ajout des précipitation





24/01/2026
Patch Météo : 
Ajout d'un API pour crée une moyenne des deux API utilisé
Suppression calendrier remplacer par des bouton des 7j de prévision





04/03/2026
refonte complete:

Algorithme de scoring
Avant
Score approximatif sur 10, logique simpliste :

Température : fourchette unique toutes saisons
Pression : valeur absolue uniquement (bas = bon, haut = mauvais)
Vent : vitesse seule, direction ignorée
Lune : poids trop élevé, influençait trop le score
Pas de modulation saisonnière sur les précipitations

Après
Score normalisé sur 10.5 pts répartis sur 6 critères documentés (Chronocarpe, DNAbaits, 1max2peche, planetecarpe, chtipecheur)

Carte

Leaflet supprimé → remplacé par MapLibre GL JS
Carte principale : Stadia Maps Outdoors (terrain, relief, lacs/rivières visibles — parfait pour la pêche)
Toggle 🛰 Satellite : tuiles Google Maps haute résolution, zoom bloqué à 18 pour éviter le pixelisé
Marqueur draggable en plus du clic
map.on('load') : attendre le chargement complet avant de déclencher la géoloc


Géolocalisation

Se déclenche après le chargement de la carte (map.on('load'))
Demande la permission navigateur (enableHighAccuracy: true)
Si refus ou erreur → Paris par défaut
map.flyTo() + mise à jour du marqueur et markerLngLat


Interface
Thème

Palette forêt profonde : fond #0d1612 (vert très sombre, pas noir), accents vert sauge #7fb98a, eau #6baab8
Typographie : Fraunces (sérif optique, titres) + Figtree (corps lisible)
Grain SVG subtil + radial-gradients de brume en fond
Plus de style.css externe — tout dans <style> de index.html

Cartes carrousel

Structure refaite : bande colorée en haut (score), heure en grand, score visible en premier, météo + données en dessous
Largeur passée à 185px, plus respirées

Overlay météo

Refonte complète : header avec accent coloré, score "hero" en grand, stats en grille 3 colonnes, conseils avec texte clair
Fermeture : bouton ✕ (event delegation), clic extérieur, ou touche Échap

Overlay scoring (nouveau)

Bouton "📊 Comment est calculé le score ?" dans le footer
Explique les 6 critères, leur poids relatif (barre visuelle), et l'échelle de lecture

Corrections techniques

Syntaxe JS : toutes les apostrophes françaises dans les strings converties en template literals backticks
Recherche de ville : setView/setLatLng (Leaflet) → flyTo/setLngLat (MapLibre)
Fermeture overlay : querySelector remplacé par event delegation (évite le race condition après innerHTML)
toggleSatellite() → setMapStyle('outdoors' | 'satellite') avec deux boutons distincts
