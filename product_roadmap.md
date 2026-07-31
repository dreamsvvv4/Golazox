# 🚀 Golazox — Product Roadmap

> Rediseño y mejora continua de la web. Modo autónomo: cada tarea se programa,
> se verifica que no rompe la app y se marca `[x]`. Orden = valor/riesgo.

**Leyenda:** `[ ]` pendiente · `[~]` en progreso · `[x]` hecho
**Principios:** reutilizar datos existentes (fichajes/valores/stats/histórico), no
romper rutas vivas, verificar con `node --check` + `npm test` + smoke HTTP antes de dar por hecha una tarea.

---

## Base de fiabilidad (pre-roadmap, ya implementada)
- [x] Caché en disco de scrapers (arranque en frío instantáneo)
- [x] Endpoint `/health` con estado por fuente + alertas webhook opcionales
- [x] Log cuando un scraper devuelve 0 resultados
- [x] Smoke-tests de parsers (`npm test`)
- [x] Verificación post-deploy automática en `_do_deploy.ps1`

---

## Roadmap (15 mejoras)

### UI / UX
- [x] **1. Termómetro del Mercado** — panel resumen en `/fichajes`: total invertido, nº de operaciones, fichaje más caro y club que más gasta. Calculado en vivo desde los datos ya raspados. *(bajo riesgo)*
- [ ] **2. Comparador de Cracks** — seleccionar 2 jugadores de la tabla de valores y compararlos lado a lado (valor, edad, club, nacionalidad). 100% cliente. *(bajo riesgo)*
- [x] **3. Favoritos (seguir jugadores/clubes)** — estrella en tarjetas + filtro "solo favoritos", persistido en `localStorage`. *(bajo riesgo)*
- [x] **4. Compartir tarjeta de fichaje** — botón con Web Share API + copiar enlace con fallback. *(bajo riesgo)*
- [ ] **5. Skeletons de carga** — placeholders animados en vez de páginas vacías/503 mientras carga. *(bajo riesgo)*
- [ ] **6. Buscador global en la home** — un único buscador que filtra jugadores/clubes across fichajes, valores y stats. *(medio)*

### Funcionalidades deportivas
- [ ] **7. Net Spend de clubes** — nueva subpestaña: ranking de clubes por gasto en fichajes de la temporada (desde el histórico propio). *(medio)*
- [ ] **8. Fichaje del Día** — destacado rotativo (determinista por fecha) del bombazo más relevante, en home y cabecera de `/fichajes`. *(bajo riesgo)*
- [ ] **9. Clasificaciones de las 5 grandes ligas** — scraping de standings (LaLiga, Premier, Serie A, Bundesliga, Ligue 1) con caché. Nueva pestaña. *(alto)*
- [ ] **10. Termómetro por jugador en rumores** — mini-histograma/insignia de "temperatura" agregada del mercado de rumores. *(bajo riesgo)*

### Integraciones técnicas
- [x] **11. API pública JSON** — `/api/transfers`, `/api/values`, `/api/rumors`, `/api/stats` (solo lectura, rate-limited, CORS). *(medio)*
- [x] **12. RSS propio de Golazox** — `/feed/fichajes.xml` generado desde los fichajes cerrados. *(bajo riesgo)*
- [x] **13. Página de estado visual** — `/status` HTML que consume `/health` con semáforos por fuente. *(bajo riesgo)*
- [ ] **14. Sitemap dinámico ampliado** — ~~incluir las nuevas rutas en el sitemap~~. **Descartada:** la API y los feeds no son páginas indexables y `/status` es `noindex`; añadirlos al sitemap sería incorrecto SEO. Se deja fuera a propósito.
- [ ] **15. Mejoras de accesibilidad y rendimiento** — `aria-*`, `prefers-reduced-motion`, lazy de secciones pesadas, foco visible. *(bajo riesgo)*

---

## Registro de progreso
_(se rellena a medida que se completan tareas)_
