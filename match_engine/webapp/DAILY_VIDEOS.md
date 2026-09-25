# Generación diaria de videos — Golazox

Resumen
- Script principal: `generate_daily_videos.js` (orquesta fichajes + agenda).
- Renderers: `_fichajes_cerrados_diarios.js` y `_agenda_screenshot.js` (PNG → MP4).
- Salidas: `match_engine/webapp/videos/`.

Requisitos
- Node.js 18+ (replicado en entorno donde ejecutas).
- Dependencias ya presentes en `package.json` (Puppeteer, ffmpeg-static, etc.).
- `ffmpeg` se usa a través de `ffmpeg-static` en los scripts; si prefieres sistema local, instala ffmpeg y ajusta variables.

Archivos relevantes
- [generate_daily_videos.js](generate_daily_videos.js) — Orquestador diario.
- [_agenda_screenshot.js](_agenda_screenshot.js) — Genera agenda (exporta `pickEventsFor`, `buildHtml`, `renderHtmlToPngMp4`).
- [_fichajes_cerrados_diarios.js](_fichajes_cerrados_diarios.js) — Genera clips de fichajes y concatena.
- `data/agenda_manual.json` — Overrides editoriales (temporal).
- `match_engine/webapp/videos/` — Carpeta de salida.
- `assets/fonts/` — Fuentes usadas (ajustar CSS si cambias fuentes).

Comandos útiles (ejecución manual)

- Generar para fecha concreta (ejemplo 2026-08-27):

```powershell
node generate_daily_videos.js 2026-08-27 6 6
```

Parámetros de `generate_daily_videos.js` (orden):
1. `dateStr` (YYYY-MM-DD). Si falta, el script puede usar la fecha de hoy.
2. `topN` — Número máximo de fichajes a incluir.
3. `maxPerPage` — Máx. eventos por página de la agenda (por ejemplo 6).

Salida esperada
- `videos/fichajes_<date>.mp4`  — Video de fichajes.
- `videos/agenda_<date>_pNN.mp4` — Página individual (p01, p02...).
- `videos/agenda_<date>_multi.mp4` — (opcional) concatenación de páginas si hay >1.
- `videos/*.png` — PNGs intermedios (para inspección visual rápida).

Ejemplo rápido de regeneración de una sola parte (solo agenda):
```powershell
node _agenda_screenshot.js 2026-08-27
# o, si quieres usar las funciones exportadas desde node REPL/otro script
node -e "require('./_agenda_screenshot').run('2026-08-27')"
```

Programar ejecución diaria

- Windows Task Scheduler (PowerShell) — ejecuta a las 06:00:

1. Acción: `Programar tarea` → Ejecutar `powershell.exe`.
2. Argumentos (ejemplo):

```text
-NoProfile -WindowStyle Hidden -Command "cd 'C:\Users\dream\Documents\Golazox\match_engine\webapp'; node generate_daily_videos.js (Get-Date -Format yyyy-MM-dd) 6 6"
```

- Cron (Linux) — ejecuta a las 06:00 (asumiendo node en PATH):

```cron
0 6 * * * cd /path/to/Golazox/match_engine/webapp && /usr/bin/node generate_daily_videos.js $(date +\%F) 6 6 >> /var/log/golazox_daily.log 2>&1
```

Notas importantes y troubleshooting

- tvguide ingestion: actualmente `_agenda_screenshot.js` usaba `rawTv.data.days[0]` — esto puede faltar si el array no está ordenado por fecha. Si ves eventos que faltan, actualizar `pickEventsFor` para buscar el día que coincida con `dateStr` en `rawTv.data.days`.
- Overrides editoriales: `data/agenda_manual.json` contiene entradas añadidas a mano. Manténlo solo como parche temporal; idealmente arreglar la ingestión upstream.
- Dedupe: el código usa `canonicalTitle` y `canonicalMatchKey` para deduplicar entre fuentes; si ves duplicados raros, revisa las reglas de canonicalización en `_agenda_screenshot.js`.
- Fuentes y safe-margins: para TikTok crop, ajusta las clases CSS `.titlebig`, `.title`, y contenedores en `_agenda_screenshot.js`.
- Escudos/badges faltantes: si aparecen rectángulos grises, añade imágenes a `public/img/badges/` con el slug correspondiente.

Cómo verificar rápida y manualmente

- Inspecciona PNGs en `match_engine/webapp/videos/` antes de concatenar.
- Reproducir MP4 localmente con VLC o `ffplay`.
- Logs: los scripts imprimen diagnóstico en stdout; redirige a archivo para historial.

Checklist para mañana (rápido)
- Ejecutar:
```powershell
node generate_daily_videos.js $(Get-Date -Format yyyy-MM-dd) 6 6
```
- Revisar `videos/agenda_<date>_p01.png`.
- Si falta evento, buscar en `data/.cache/tvguide.json` y en `data/fixtures_snapshot.json`.
- Aplicar override en `data/agenda_manual.json` solo si estás seguro.

Contacto/Notas del autor
- Creado por el pipeline de Golazox. Si quieres que lo deje en modo "autónomo" (logs rotados, uploads), dime y hago los pasos siguientes.

