# Pub « Site Internet Clé en Main »

Publicité verticale 9:16 (1080×1920, 30 i/s) rendue image par image par le code :
Three.js (WebGL) pour la 3D et les effets, police variable Mona Sans pour la typographie,
Chromium sans interface pour la capture, ffmpeg pour l'encodage et le mixage.

## Fabriquer les livrables avec la vraie voix

```bash
cd pub
npm install
tools/finaliser.sh ../voix-off.mp3            # ou : tools/finaliser.sh ../voix-off.mp3 ../musique.mp3
```

Le script mesure l'instant de chaque mot dans la voix, rend la vidéo calée sur ces instants,
synthétise les bruitages et produit à la racine du dépôt :

- `pub-site-internet.mp4` : vidéo + voix + bruitages (+ musique si fournie), −14 LUFS, crête −1 dBTP ;
- `pub-site-internet-sans-voix.mp4` : la même chose sans la voix, bruitages au même niveau.

## Structure

- `src/timeline.js` : instants des mots (valeurs du brief), courbes d'animation.
- `src/copy.js` : le texte à l'écran (uniquement les mots prononcés).
- `src/scenes/` : les cinq temps (`city.js` temps 1 et 2, `key.js`, `devices.js`, `cta.js`).
- `src/site.js`, `src/photos.js` : le site de boulangerie et ses photos générées en 3D.
- `src/post.js` : halo, rayons, onde de choc, aberration, grain, flash, volet.
- `tools/render.cjs` : rendu (`stills` pour quelques images, `video` pour le film, `--sub 3` pour le flou de bougé).
- `tools/sfx.py` : bruitages synthétisés ; `tools/assemble.py` : mixage ; `tools/align.py` : mesure des mots.
