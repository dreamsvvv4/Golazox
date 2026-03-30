/**
 * Simulador de Partidos de Fútbol — JavaScript Frontend
 * ═══════════════════════════════════════════════
 * Flujo:
 *   1. El usuario rellena los campos y pulsa “Simular Partido”
 *   2. handleSimulate() valida las entradas
 *   3. POST /simulate → Express → engine.js → resultado JSON
 *   4. renderResult(data) rellena todas las secciones de la UI
 */

'use strict';

// ── Internationalisation (ES / EN) ────────────────────────────
const I18N = {
  es: {
    'label-a':'EQUIPO A','label-b':'EQUIPO B',
    'inp-a-placeholder':'ej. FC Barcelona, Brasil, Ajax…','inp-b-placeholder':'ej. AC Milan, Real Madrid, Alemania…',
    'era-a-placeholder':'Temporada / Época (opcional) — ej. 1991-92','era-b-placeholder':'Temporada / Época (opcional) — ej. 1988-89',
    'formation-default':'Formación (automática)','lookup-btn':'🔍 Buscar alineación','lookup-searching':'⌛ Buscando…',
    'mode-lbl':'Modo:','stadium-lbl':'🏟️ ESTADIO','stadium-neutro':'Neutro',
    'btn-simulate':'Simular Partido','tagline':'Cualquier equipo · Cualquier época · Cualquier rivalidad',
    'loading-text':'Simulando el partido…','pm-eyebrow':'PRESENTACIÓN DE EQUIPOS','pm-start-label':'Comenzando en',
    'live-badge':'EN DIRECTO','btn-skip':'⏭ Saltar',
    'poster-label-final':'RESULTADO FINAL','poster-label-pens':'EMPATE · PENALTIS','poster-label-pen-mode':'TANDA DE PENALTIS','poster-context':'Partido de leyenda · Campo neutral',
    'section-probs':'PROBABILIDADES','section-timeline':'LÍNEA DE TIEMPO',
    'section-lineup':'ALINEACIONES','section-stats':'ESTADÍSTICAS','section-mom':'MEJOR JUGADOR',
    'btn-share':'📤 Compartir resultado',
    'btn-share-loading':'⏳ Generando imagen…',
    'btn-rivalry':'Rivals','rivalry-loading':'Buscando…','rivalry-ready':'¡Pulsa ▶ para simular!',
    'era-pending':'⏳ Selecciona un equipo primero','era-any':'⏳ Temporada (cualquiera)','era-no-seasons':'Sin temporadas locales',
    'mode-penalties':'🥅 Penaltis','pm-speed-label':'Duración del partido','pm-start-btn':'▶ Iniciar partido','speed-instant':'⚡ Directo',
    'tp-clubs':'Clubes','tp-nations':'Selecciones','tp-special':'Especial','tp-back':'‹ Volver','tp-nations-label':'Selecciones nacionales','tp-leagues-label':'Elige una liga','tp-special-label':'Fantasy & All-Time XIs',
    'tp-loading':'Cargando equipos…','tp-retry':'↺ Reintentar','tp-change-title':'Cambiar',
    'vs-play':'JUGAR','vs-simulate':'▶ SIMULAR','vs-recalc':'⏳ Recalculando…',
    'fl-balanced':'Equilibrado','fl-attack':'Atacante','fl-defensive':'Defensivo','fl-standard':'Estándar','fl-high-press':'Presión alta',
    'error-no-teams':'Introduce los nombres de ambos equipos.','error-too-long':'Los nombres de equipo no pueden superar 80 caracteres.',
    'error-rate-limit':'Demasiadas simulaciones seguidas. Espera un momento e inténtalo de nuevo.',
    'fail-lookup':'❌ No encontrado','hint-lookup':'Prueba sin época, o con el nombre en inglés',
    'timeout-lookup':'Tiempo de espera agotado (scraper lento). Intenta de nuevo.',
    'no-connection':'Sin conexión al servidor. ¿Está iniciado?',
    'pen-shootout-title':'🎯 Tandas de Penaltis','pen-winner-suffix':'gana la tanda','pen-winner-sd':' (muerte súbita)',
    'timeline-events-suffix':'evento','timeline-events-suffix-pl':'eventos','timeline-empty':'Sin incidencias destacadas',
    'km-title':'Puntos clave','km-reds':'Tanda de tarjetas rojas — el árbitro se mostró muy estricto','km-clutch':'Factor decisivo','km-clean-sheet':'Portería a cero','km-thrashing':'Goleada','km-draw':'Empate muy disputado','km-extra-time':'Se decidió en los penaltis',
    'mom-badge-text':'MEJOR JUGADOR','bench-label':'BANQUILLO','ovr-lbl':'OVR',
    'sub-change-toast':'✅ Cambio realizado','tooltip-copied':'Resultado copiado ✓','tooltip-copy-fail':'No se pudo copiar',
    'ev-goal':'¡GOL!','ev-yellow':'TARJETA AMARILLA','ev-red':'TARJETA ROJA','ev-pen_winner':'¡GANADOR!','ev-injury':'LESIÓN','ev-sub':'CAMBIO',
    'ev-penalty':'PENALTI MARCADO','ev-penalty-miss':'PENALTI FALLADO','ev-corner':'CÓRNER','ev-freekick':'FALTA DIRECTA',
    'ev-kickoff':'INICIO DEL PARTIDO','ev-fulltime':'PITIDO FINAL',
    'ev-tag-pen':'pen.','ev-tag-miss':'pen. fallado','ev-tag-corner':'córner','ev-tag-fk':'falta directa',
    'phase-playing':'EN JUEGO','phase-corner':'🚩 CÓRNER','phase-freekick':'🎯 FALTA DIRECTA',
    'phase-yellow':'🟨 T. AMARILLA','phase-red':'🟥 T. ROJA','phase-pen-miss':'❌ PENALTI FALLADO','phase-goal':'⚽ GOL','phase-injury':'🩹 LESIÓN','phase-sub':'🔄 CAMBIO',
    'pos-GK':'Portero','pos-RB':'Lateral Der.','pos-CB':'Central','pos-LB':'Lateral Izq.','pos-DM':'Mediocentro Def.',
    'pos-CM':'Centrocampista','pos-RM':'Interior Der.','pos-LM':'Interior Izq.','pos-AM':'Mediapunta',
    'pos-RW':'Extremo Der.','pos-LW':'Extremo Izq.','pos-ST':'Delantero Centro',
    'hth-possession':'Posesión','hth-shots':'Tiros','hth-corners':'Córneres','hth-saves':'Paradas','hth-fouls':'Faltas',
    'hth-attack':'Ataque','hth-midfield':'Centrocampo','hth-defense':'Defensa','hth-goalkeeping':'Portería',
    'radar-attack':'Ataque','radar-midfield':'Medio','radar-defense':'Defensa','radar-goalkeeping':'Portería','radar-physical':'Físico',
    'prob-draw':'Empate','alt-scores-label':'Otros resultados:',
    'prob-win-suffix':'gana','sim-iters-suffix':'simulaciones',
    'mom-reason-goal':'gol','mom-reason-goals':'goles','mom-reason-best':'Mejor en el campo',
    'sim-error-prefix':'Error en la simulación:','pm-intro-neutral':'Campo Neutral',
    'ref-section-label':'ÁRBITRO','ref-random':'Aleatorio / Ninguno',
    'referee-label':'Árbitro','weather-section-label':'CLIMA',
    'footer-tagline':'Simulador de Partidos de Fútbol · Motor probabilístico (Poisson xG + Monte Carlo) · Solo para entretenimiento',
    'footer-disclaimer':'GolazoX es un proyecto independiente sin afiliación, patrocinio ni respaldo de FIFA, UEFA, ningún club de fútbol, ni ningún jugador mencionado. Los nombres de equipos y jugadores se usan con fines estadísticos, históricos y de entretenimiento, bajo la doctrina de uso referencial de figuras públicas en el ejercicio de su actividad profesional. Los escudos mostrados son representaciones genéricas de identificación y no son marcas oficiales. Datos de plantilla parcialmente derivados de Wikipedia (CC BY-SA 4.0).',
    'footer-legal-link':'Aviso Legal','footer-privacy-link':'Política de Privacidad','footer-contact-link':'Contacto',
    'ma-title':'📊 Análisis del partido','ma-dist-label':'⚡ Distancia recorrida','ma-no-data':'Sin datos',
    'ma-hm-low':'Baja','ma-hm-high':'Alta',
    'pm-card-change':'— clic para cambio','pm-card-sub':'— clic para sustituir',
    // ── Tournament ────────────────────────────────────────────
    'trn-tab-btn':'🏆 Torneo',
    'trn-step-format':'Formato','trn-step-rules':'Reglas','trn-step-teams':'Equipos',
    'trn-step1-title':'Elige el formato','trn-step1-hint':'¿Cómo quieres que sea tu torneo?',
    'trn-fmt-copa-name':'Copa','trn-fmt-copa-desc':'Eliminatoria directa · o Fase de Grupos + KO',
    'trn-fmt-copa-tag1':'4–32 equipos (KO) / 8–32 (Grupos)','trn-fmt-copa-tag2':'KO / Grupos+KO',
    'trn-fmt-liga-name':'Liga','trn-fmt-liga-desc':'Todos contra todos · Clasificación por puntos',
    'trn-fmt-liga-tag1':'4–20 equipos','trn-fmt-name-liga':'Liga','trn-fmt-name-copa':'Copa','trn-fmt-name-champions':'Champions',
    'trn-num-teams-lbl':'Nº de equipos','trn-btn-next':'Siguiente →',
    'trn-step2-title':'Reglas del torneo','trn-step2-hint':'Personaliza cómo se deciden los enfrentamientos',
    'trn-btn-back':'← Atrás','trn-btn-continue':'Continuar →',
    'trn-rule-modality':'Modalidad','trn-rule-modality-hint':'Solo KO directo · o activa con fase de grupos previa',
    'trn-rule-idavuelta':'Ida y vuelta','trn-rule-match-fmt':'Formato de partido',
    'trn-rule-match-fmt-hint':'Partido único · o activa ida y vuelta por ronda',
    'trn-rule-tiebreak':'Desempate','trn-rule-tiebreak-hint':'Empate: penaltis directos · o activa prórroga primero',
    'trn-rule-third':'Partido por el 3er puesto','trn-rule-third-hint':'Los semifinalistas eliminados juegan por el 3er puesto',
    'trn-rule-legs':'Vueltas','trn-rule-legs-hint':'Solo ida (más rápido) · o activa doble vuelta completa',
    'trn-rule-group-stage':'Fase de grupos',
    'trn-rule-group-hint':'Partido único por jornada · o activa ida y vuelta en grupos',
    'trn-rule-group-hint2':'Partido único en grupos · o activa ida y vuelta',
    'trn-rule-ko-stage':'Fase eliminatoria','trn-rule-ko-hint':'Ida y vuelta en rondas KO · la final siempre a partido único',
    'trn-step3-title':'Añade equipos','trn-search-ph':'Busca por nombre, país o era…',
    'trn-btn-load-league':'📋 Cargar liga','trn-btn-random':'⚡ Aleatorio',
    'trn-btn-simulate':'▶ Simular torneo','trn-progress-init':'Simulando…',
    'trn-teams-empty-1':'Ningún equipo añadido todavía.','trn-teams-empty-2':'Busca por nombre, país o usa ⚡ Aleatorio',
    'trn-champ-eyebrow':'CAMPEÓN DEL TORNEO','trn-share-btn':'📤 Compartir','trn-btn-over':'↩ Nuevo torneo',
    'trn-tab-summary':'Resumen','trn-tab-bracket-ko':'Cuadro','trn-tab-bracket-liga':'Clasificación',
    'trn-tab-calendar':'Calendario','trn-tab-stats':'Estadísticas',
    'trn-reveal-hint':'Toca para continuar',
    'trn-reveal-liga':'📊 Liga · Campeón','trn-reveal-copa-groups':'🏆 Copa · Grupos · Campeón',
    'trn-reveal-copa':'🏆 Copa · Campeón','trn-reveal-champions':'⭐ Champions · Campeón',
    'trn-round-final':'Final','trn-round-semi':'Semifinales','trn-round-qf':'Cuartos de final',
    'trn-round-r16':'Octavos de final','trn-round-r32':'Dieciseisavos de final','trn-round-r64':'Treinta y dos avos',
    'trn-round-default':'Ronda',
    'trn-draw-groups-title':'🎲 Sorteo de grupos','trn-draw-reshuffle':'🔀 Nuevo sorteo','trn-draw-group-prefix':'Grupo ',
    'trn-toast-no-fmt':'⚠ Selecciona un formato primero.',
    'trn-toast-duplicate':'⚠ Ya tienes ese equipo con la misma temporada.',
    'trn-toast-no-teams':'Sin equipos en esta liga','trn-toast-league-err':'Error al cargar la liga.',
    'trn-toast-poster-ok':'🖼 Póster descargado','trn-toast-poster-fail':'⚠ No se pudo generar el póster',
    'trn-copy-fail':'No se pudo copiar',
    'trn-loading-1':'Calculando xG con distribución de Poisson…',
    'trn-loading-2':'Simulando 30 000 escenarios por partido…',
    'trn-loading-3':'Aplicando ratings históricos de plantilla…',
    'trn-loading-4':'Resolviendo eliminatorias y desempates…',
    'trn-loading-5':'Calculando diferencia de goles y puntos…',
    'trn-loading-6':'Determinando MVP y Pichichi del torneo…',
    'trn-loading-7':'Compilando la tabla de clasificación…',
    'trn-loading-8':'Construyendo el cuadro de eliminatorias…',
    'trn-loading-9':'Generando estadísticas comparadas…',
    'trn-loading-10':'Finalizando resultados del torneo…',
    'trn-progress-starting':'Iniciando simulación…','trn-progress-3rd':'Simulando 3° puesto…',
    'trn-progress-groups':'Simulando grupos…','trn-progress-ko':'Simulando eliminatorias…',
    'trn-progress-league':'Simulando jornadas…','trn-cal-jornada':'Jornada',
    'trn-stat-card-champ':'Campeón','trn-stat-card-pich':'Pichichi','trn-stat-card-mvp':'MVP',
    'trn-stat-goals-unit':'goles',
    'trn-stats-h-pichichi':'⚽ Pichichi','trn-stats-h-mvp':'⭐ Mejor Jugador (MOM)',
    'trn-stats-h-teams-goals':'⚽ Equipos más goleadores','trn-stats-h-defense':'🛡 Defensas más sólidas',
    'trn-stats-h-xi':'🌟 Once Ideal del Torneo','trn-stats-h-highlights':'📊 Resultados destacados',
    'trn-col-goles':'Goles','trn-col-pj':'Partidos','trn-col-gc':'Goles en contra',
    'trn-col-pj-abbr':'PJ','trn-col-gc-abbr':'GC','trn-col-w-pct':'% V','trn-col-per-match':'/p',
    'trn-summ-top5':'🥇 TOP 5',
    'trn-summ-groups-h':'📊 Grupos','trn-summ-ko-h':'🏆 Eliminatorias',
    'trn-summ-rounds-h':'🏆 Resultados por ronda','trn-summ-3rd':'🥉 3er Puesto',
    'trn-modal-pens':'Penaltis:','trn-modal-no-goals':'Sin goles',
    'trn-modal-lineups':'👥 Alineaciones','trn-modal-poss':'Posesión %',
    'trn-modal-shots':'Tiros','trn-modal-corners':'Córners','trn-modal-saves':'Paradas','trn-modal-fouls':'Faltas',
    'trn-hl-top-win':'🥇 Mayor goleada','trn-hl-win':'Goleada',
    'trn-hl-top-goals':'⚽ Más goles','trn-hl-goals':'Golazos',
    'trn-xi-empty':'Datos insuficientes para el Once Ideal','trn-xi-no-data':'Sin datos suficientes','trn-xi-no-lineup':'Sin alineación',
    'trn-locked-prefix':'Equipo legendario bloqueado','trn-locked-sim-1':'simulación más para desbloquear','trn-locked-sim-n':'simulaciones más para desbloquear','trn-locked-share-cta':'Comparte en Twitter para desbloquear',
    'trn-poster-champ-lbl':'CAMPEÓN DEL TORNEO','trn-poster-standings':'CLASIFICACIÓN FINAL',
    'trn-poster-final':'GRAN FINAL','trn-poster-awards':'PREMIOS INDIVIDUALES',
    'trn-poster-pichichi':'⚽ PICHICHI','trn-poster-goals-lbl':'goles',
    'trn-poster-mvp':'⭐ MVP','trn-poster-mom':'MOM',
    'trn-cal-3rd-suffix':'3er Puesto · ',
    'trn-cal-calendar-liga':'📅 Partidos','trn-cal-calendar-groups':'📅 Fase de Grupos',
    'trn-cal-calendar-ko':'📅 Eliminatorias','trn-cal-calendar-copa':'📅 Resultados por ronda','trn-cal-matches-lbl':'Partidos',
    'trn-bracket-standings-h':'📊 Clasificación',
    'trn-col-team':'Equipo','trn-col-w-abbr':'G','trn-col-d-abbr':'E','trn-col-l-abbr':'P',
    'trn-col-gf-abbr':'GF','trn-col-dif':'DIF','trn-col-pts':'PTS','trn-col-sin-datos':'Sin datos',
    'trn-modal-legs-ida':'Ida','trn-modal-legs-vuelta':'Vuelta',
    'trn-sim-error':'⚠ Error en la simulación. Inténtalo de nuevo.',
    'trn-render-error':'Error al renderizar',
  },
  en: {
    'label-a':'TEAM A','label-b':'TEAM B',
    'inp-a-placeholder':'e.g. FC Barcelona, Brazil, Ajax…','inp-b-placeholder':'e.g. AC Milan, Real Madrid, Germany…',
    'era-a-placeholder':'Season / Era (optional) — e.g. 1991-92','era-b-placeholder':'Season / Era (optional) — e.g. 1988-89',
    'formation-default':'Formation (auto)','lookup-btn':'🔍 Search lineup','lookup-searching':'⌛ Searching…',
    'mode-lbl':'Mode:','stadium-lbl':'🏟️ STADIUM','stadium-neutro':'Neutral',
    'btn-simulate':'Simulate Match','tagline':'Any team · Any era · Any rivalry',
    'loading-text':'Simulating match…','pm-eyebrow':'TEAM PRESENTATION','pm-start-label':'Starting in',
    'live-badge':'LIVE','btn-skip':'⏭ Skip',
    'poster-label-final':'FINAL SCORE','poster-label-pens':'DRAW · PENALTIES','poster-label-pen-mode':'PENALTY SHOOTOUT','poster-context':'Legendary match · Neutral ground',
    'section-probs':'PROBABILITIES','section-timeline':'MATCH TIMELINE',
    'section-lineup':'LINEUPS','section-stats':'MATCH STATISTICS','section-mom':'PLAYER OF THE MATCH',
    'btn-share':'📤 Share result',
    'btn-share-loading':'⏳ Generating image…',
    'btn-rivalry':'Rivals','rivalry-loading':'Fetching…','rivalry-ready':'Press ▶ to simulate!',
    'era-pending':'⏳ Select a team first','era-any':'⏳ Season (any)','era-no-seasons':'No local seasons',
    'mode-penalties':'🥅 Penalties','pm-speed-label':'Match duration','pm-start-btn':'▶ Start match','speed-instant':'⚡ Instant',
    'tp-clubs':'Clubs','tp-nations':'National teams','tp-special':'Special','tp-back':'‹ Back','tp-nations-label':'National teams','tp-leagues-label':'Choose a league','tp-special-label':'Fantasy & All-Time XIs',
    'tp-loading':'Loading teams…','tp-retry':'↺ Retry','tp-change-title':'Change',
    'vs-play':'PLAY','vs-simulate':'▶ SIMULATE','vs-recalc':'⏳ Recalculating…',
    'fl-balanced':'Balanced','fl-attack':'Attacking','fl-defensive':'Defensive','fl-standard':'Standard','fl-high-press':'High press',
    'error-no-teams':'Please enter both team names.','error-too-long':'Team names cannot exceed 80 characters.',
    'error-rate-limit':'Too many simulations in a row. Please wait a moment and try again.',
    'fail-lookup':'❌ Not found','hint-lookup':'Try without era, or use the English team name',
    'timeout-lookup':'Request timed out (slow scraper). Try again.',
    'no-connection':'No connection to server. Is it running?',
    'pen-shootout-title':'🎯 Penalty Shootout','pen-winner-suffix':'wins on penalties','pen-winner-sd':' (sudden death)',
    'timeline-events-suffix':'event','timeline-events-suffix-pl':'events','timeline-empty':'No notable incidents',
    'km-title':'Key moments','km-reds':'Lots of red cards — the referee was very strict','km-clutch':'Decisive factor','km-clean-sheet':'Clean sheet','km-thrashing':'Dominant victory','km-draw':'Closely contested draw','km-extra-time':'Decided on penalties',
    'mom-badge-text':'PLAYER OF THE MATCH','bench-label':'BENCH','ovr-lbl':'OVR',
    'sub-change-toast':'✅ Substitution made','tooltip-copied':'Result copied ✓','tooltip-copy-fail':'Could not copy',
    'ev-goal':'GOAL!','ev-yellow':'YELLOW CARD','ev-red':'RED CARD','ev-pen_winner':'WINNER!','ev-injury':'INJURY','ev-sub':'SUBSTITUTION',
    'ev-penalty':'PENALTY SCORED','ev-penalty-miss':'PENALTY MISSED','ev-corner':'CORNER','ev-freekick':'FREE KICK',
    'ev-kickoff':'KICK OFF','ev-fulltime':'FULL TIME',
    'ev-tag-pen':'pen.','ev-tag-miss':'pen. missed','ev-tag-corner':'corner','ev-tag-fk':'free kick',
    'phase-playing':'IN PLAY','phase-corner':'🚩 CORNER','phase-freekick':'🎯 FREE KICK',
    'phase-yellow':'🟨 YELLOW CARD','phase-red':'🟥 RED CARD','phase-pen-miss':'❌ PENALTY MISSED','phase-goal':'⚽ GOAL','phase-injury':'🩹 INJURY','phase-sub':'🔄 SUBSTITUTION',
    'pos-GK':'Goalkeeper','pos-RB':'Right Back','pos-CB':'Centre Back','pos-LB':'Left Back','pos-DM':'Def. Midfielder',
    'pos-CM':'Midfielder','pos-RM':'Right Mid','pos-LM':'Left Mid','pos-AM':'Attacking Mid',
    'pos-RW':'Right Winger','pos-LW':'Left Winger','pos-ST':'Striker',
    'hth-possession':'Possession','hth-shots':'Shots','hth-corners':'Corners','hth-saves':'Saves','hth-fouls':'Fouls',
    'hth-attack':'Attack','hth-midfield':'Midfield','hth-defense':'Defense','hth-goalkeeping':'Goalkeeping',
    'radar-attack':'Attack','radar-midfield':'Mid','radar-defense':'Defense','radar-goalkeeping':'GK','radar-physical':'Physical',
    'prob-draw':'Draw','alt-scores-label':'Other scorelines:',
    'prob-win-suffix':'wins','sim-iters-suffix':'simulations',
    'mom-reason-goal':'goal','mom-reason-goals':'goals','mom-reason-best':'Best on the pitch',
    'sim-error-prefix':'Simulation error:','pm-intro-neutral':'Neutral Ground',
    'ref-section-label':'REFEREE','ref-random':'Random / None',
    'referee-label':'Referee','weather-section-label':'WEATHER',
    'footer-tagline':'Football Match Simulator · Probabilistic engine (Poisson xG + Monte Carlo) · For entertainment only',
    'footer-disclaimer':'GolazoX is an independent project with no affiliation, sponsorship, or endorsement from FIFA, UEFA, any football club, or any mentioned player. Team and player names are used for statistical, historical, and entertainment purposes, under the referential use doctrine for public figures in the exercise of their professional activities. Badges shown are generic identification representations and are not official trademarks. Squad data partially derived from Wikipedia (CC BY-SA 4.0).',
    'footer-legal-link':'Legal Notice','footer-privacy-link':'Privacy Policy','footer-contact-link':'Contact',
    'ma-title':'📊 Match Analysis','ma-dist-label':'⚡ Distance covered','ma-no-data':'No data',
    'ma-hm-low':'Low','ma-hm-high':'High',
    'pm-card-change':'— click to swap','pm-card-sub':'— click to substitute',
    // ── Tournament ────────────────────────────────────────────
    'trn-tab-btn':'🏆 Tournament',
    'trn-step-format':'Format','trn-step-rules':'Rules','trn-step-teams':'Teams',
    'trn-step1-title':'Choose format','trn-step1-hint':'What kind of tournament do you want?',
    'trn-fmt-copa-name':'Cup','trn-fmt-copa-desc':'Direct knockout · or Group Stage + KO',
    'trn-fmt-copa-tag1':'4–32 teams (KO) / 8–32 (Groups)','trn-fmt-copa-tag2':'KO / Groups+KO',
    'trn-fmt-liga-name':'League','trn-fmt-liga-desc':'Round robin · Points table',
    'trn-fmt-liga-tag1':'4–20 teams','trn-fmt-name-liga':'League','trn-fmt-name-copa':'Cup','trn-fmt-name-champions':'Champions',
    'trn-num-teams-lbl':'No. of teams','trn-btn-next':'Next →',
    'trn-step2-title':'Tournament rules','trn-step2-hint':'Customise how matches are decided',
    'trn-btn-back':'← Back','trn-btn-continue':'Continue →',
    'trn-rule-modality':'Mode','trn-rule-modality-hint':'Direct KO only · or enable group stage first',
    'trn-rule-idavuelta':'Two legs','trn-rule-match-fmt':'Match format',
    'trn-rule-match-fmt-hint':'Single match · or enable two legs per round',
    'trn-rule-tiebreak':'Tiebreaker','trn-rule-tiebreak-hint':'Draw: direct penalties · or enable extra time first',
    'trn-rule-third':'Third-place match','trn-rule-third-hint':'Eliminated semi-finalists play for 3rd place',
    'trn-rule-legs':'Legs','trn-rule-legs-hint':'Single leg (faster) · or enable full double round',
    'trn-rule-group-stage':'Group stage',
    'trn-rule-group-hint':'Single match per matchday · or enable two legs in groups',
    'trn-rule-group-hint2':'Single match in groups · or enable two legs',
    'trn-rule-ko-stage':'Knockout stage','trn-rule-ko-hint':'Two legs in KO rounds · final always single match',
    'trn-step3-title':'Add teams','trn-search-ph':'Search by name, country or era…',
    'trn-btn-load-league':'📋 Load league','trn-btn-random':'⚡ Random',
    'trn-btn-simulate':'▶ Simulate tournament','trn-progress-init':'Simulating…',
    'trn-teams-empty-1':'No teams added yet.','trn-teams-empty-2':'Search by name, country or use ⚡ Random',
    'trn-champ-eyebrow':'TOURNAMENT CHAMPION','trn-share-btn':'📤 Share','trn-btn-over':'↩ New tournament',
    'trn-tab-summary':'Summary','trn-tab-bracket-ko':'Bracket','trn-tab-bracket-liga':'Standings',
    'trn-tab-calendar':'Calendar','trn-tab-stats':'Statistics',
    'trn-reveal-hint':'Tap to continue',
    'trn-reveal-liga':'📊 League · Champion','trn-reveal-copa-groups':'🏆 Cup · Groups · Champion',
    'trn-reveal-copa':'🏆 Cup · Champion','trn-reveal-champions':'⭐ Champions · Champion',
    'trn-round-final':'Final','trn-round-semi':'Semi-finals','trn-round-qf':'Quarter-finals',
    'trn-round-r16':'Round of 16','trn-round-r32':'Round of 32','trn-round-r64':'Round of 64',
    'trn-round-default':'Round',
    'trn-draw-groups-title':'🎲 Group draw','trn-draw-reshuffle':'🔀 New draw','trn-draw-group-prefix':'Group ',
    'trn-toast-no-fmt':'⚠ Select a format first.',
    'trn-toast-duplicate':'⚠ You already have that team with the same era.',
    'trn-toast-no-teams':'No teams in this league','trn-toast-league-err':'Error loading league.',
    'trn-toast-poster-ok':'🖼 Poster downloaded','trn-toast-poster-fail':'⚠ Could not generate poster',
    'trn-copy-fail':'Could not copy',
    'trn-loading-1':'Calculating xG using Poisson distribution…',
    'trn-loading-2':'Simulating 30,000 scenarios per match…',
    'trn-loading-3':'Applying historical squad ratings…',
    'trn-loading-4':'Resolving knockouts and tiebreakers…',
    'trn-loading-5':'Calculating goal difference and points…',
    'trn-loading-6':'Determining tournament MVP and top scorer…',
    'trn-loading-7':'Compiling the league standings…',
    'trn-loading-8':'Building the knockout bracket…',
    'trn-loading-9':'Generating comparative statistics…',
    'trn-loading-10':'Finalising tournament results…',
    'trn-progress-starting':'Starting simulation…','trn-progress-3rd':'Simulating 3rd place match…',
    'trn-progress-groups':'Simulating groups…','trn-progress-ko':'Simulating knockouts…',
    'trn-progress-league':'Simulating matchdays…','trn-cal-jornada':'Matchday',
    'trn-stat-card-champ':'Champion','trn-stat-card-pich':'Top Scorer','trn-stat-card-mvp':'MVP',
    'trn-stat-goals-unit':'goals',
    'trn-stats-h-pichichi':'⚽ Top Scorer','trn-stats-h-mvp':'⭐ Best Player (MOM)',
    'trn-stats-h-teams-goals':'⚽ Top Scoring Teams','trn-stats-h-defense':'🛡 Strongest Defences',
    'trn-stats-h-xi':'🌟 Tournament Dream XI','trn-stats-h-highlights':'📊 Notable Results',
    'trn-col-goles':'Goals','trn-col-pj':'Matches','trn-col-gc':'Goals against',
    'trn-col-pj-abbr':'MP','trn-col-gc-abbr':'GA','trn-col-w-pct':'% W','trn-col-per-match':'/g',
    'trn-summ-top5':'🥇 TOP 5',
    'trn-summ-groups-h':'📊 Groups','trn-summ-ko-h':'🏆 Knockout Rounds',
    'trn-summ-rounds-h':'🏆 Results by round','trn-summ-3rd':'🥉 Third Place',
    'trn-modal-pens':'Penalties:','trn-modal-no-goals':'No goals',
    'trn-modal-lineups':'👥 Lineups','trn-modal-poss':'Possession %',
    'trn-modal-shots':'Shots','trn-modal-corners':'Corners','trn-modal-saves':'Saves','trn-modal-fouls':'Fouls',
    'trn-hl-top-win':'🥇 Biggest win','trn-hl-win':'Big win',
    'trn-hl-top-goals':'⚽ Most goals','trn-hl-goals':'Goalfest',
    'trn-xi-empty':'Insufficient data for the Dream XI','trn-xi-no-data':'Not enough data','trn-xi-no-lineup':'No lineup available',
    'trn-locked-prefix':'Legendary team locked','trn-locked-sim-1':'more simulation to unlock','trn-locked-sim-n':'more simulations to unlock','trn-locked-share-cta':'Share on Twitter to unlock',
    'trn-poster-champ-lbl':'TOURNAMENT CHAMPION','trn-poster-standings':'FINAL STANDINGS',
    'trn-poster-final':'GRAND FINAL','trn-poster-awards':'INDIVIDUAL AWARDS',
    'trn-poster-pichichi':'⚽ TOP SCORER','trn-poster-goals-lbl':'goals',
    'trn-poster-mvp':'⭐ MVP','trn-poster-mom':'MOM',
    'trn-cal-3rd-suffix':'3rd Place · ',
    'trn-cal-calendar-liga':'📅 Matches','trn-cal-calendar-groups':'📅 Group Stage',
    'trn-cal-calendar-ko':'📅 Knockout Rounds','trn-cal-calendar-copa':'📅 Results by round','trn-cal-matches-lbl':'Matches',
    'trn-bracket-standings-h':'📊 Standings',
    'trn-col-team':'Team','trn-col-w-abbr':'W','trn-col-d-abbr':'D','trn-col-l-abbr':'L',
    'trn-col-gf-abbr':'GF','trn-col-dif':'GD','trn-col-pts':'PTS','trn-col-sin-datos':'No data',
    'trn-modal-legs-ida':'Leg 1','trn-modal-legs-vuelta':'Leg 2',
    'trn-sim-error':'⚠ Simulation error. Please try again.',
    'trn-render-error':'Error rendering',
  },
};

let _lang = (() => { try { return localStorage.getItem('golazox_lang') || 'es'; } catch(_) { return 'es'; } })();

function t(key) {
  return (I18N[_lang] || I18N.es)[key] || I18N.es[key] || key;
}

function setLang(lang) {
  _lang = (lang === 'en') ? 'en' : 'es';
  try { localStorage.setItem('golazox_lang', _lang); } catch(_) {}
  applyI18n();
}

function applyI18n() {
  document.documentElement.lang = _lang;
  // Header
  const tagline = document.querySelector('.tagline');
  if (tagline) tagline.textContent = t('tagline');
  const langBtn = document.getElementById('lang-toggle');
  if (langBtn) langBtn.textContent = _lang === 'es' ? 'EN' : 'ES';
  // Team labels
  document.querySelectorAll('.label-a').forEach(el => { el.textContent = t('label-a'); });
  document.querySelectorAll('.label-b').forEach(el => { el.textContent = t('label-b'); });
  // Inputs
  const el = id => document.getElementById(id);
  if (el('teamA')) el('teamA').placeholder = t('inp-a-placeholder');
  if (el('teamB')) el('teamB').placeholder = t('inp-b-placeholder');
  if (el('eraA'))  el('eraA').placeholder  = t('era-a-placeholder');
  if (el('eraB'))  el('eraB').placeholder  = t('era-b-placeholder');
  ['formationA','formationB'].forEach(id => {
    const sel = el(id);
    if (sel && sel.options.length) sel.options[0].textContent = t('formation-default');
  });
  // Buttons
  const la = el('lookupA'); if (la) la.textContent = t('lookup-btn');
  const lb = el('lookupB'); if (lb) lb.textContent = t('lookup-btn');
  // Labels  
  document.querySelectorAll('.mode-lbl').forEach(el => { el.textContent = t('mode-lbl'); });
  document.querySelectorAll('.stadium-picker-lbl').forEach(el2 => { el2.textContent = t('stadium-lbl'); });
  const loaderSpan = document.querySelector('#loader span');
  if (loaderSpan) loaderSpan.textContent = t('loading-text');
  document.querySelectorAll('.live-badge').forEach(el2 => { el2.textContent = t('live-badge'); });
  document.querySelectorAll('.btn-skip').forEach(el2 => { el2.textContent = `⏭ ${t('btn-skip').replace(/^⏭\s*/,'')}`.replace('⏭ ⏭','⏭'); });
  const pmEye = document.querySelector('.pm-eyebrow');
  if (pmEye) pmEye.textContent = t('pm-eyebrow');
  const pmStart = document.querySelector('.pm-start-label');
  if (pmStart) pmStart.textContent = t('pm-start-label');
  // Mode pills
  const modePen = el('mode-penalties'); if (modePen) modePen.textContent = t('mode-penalties');
  // PM screen
  const pmSpeedLbl = document.querySelector('.pm-speed-label'); if (pmSpeedLbl) pmSpeedLbl.textContent = t('pm-speed-label');
  const pmStartBtn = el('pm-start-btn'); if (pmStartBtn && !pmStartBtn.disabled) pmStartBtn.textContent = t('pm-start-btn');
  const speedInstant = document.querySelector('.pm-speed-pill[data-tick="0"]'); if (speedInstant) speedInstant.textContent = t('speed-instant');
  // Share button
  document.querySelectorAll('.btn-share').forEach(b => { b.textContent = t('btn-share'); });
  // Era selects — update placeholder of disabled (no team selected) ones
  ['eraA','eraB'].forEach(id => {
    const s = el(id);
    if (s && s.disabled && s.options.length === 1) s.options[0].textContent = t('era-pending');
  });
  // Update POS_DESCRIPTIONS in-place
  POS_DESCRIPTIONS.GK = t('pos-GK'); POS_DESCRIPTIONS.RB = t('pos-RB'); POS_DESCRIPTIONS.CB = t('pos-CB');
  POS_DESCRIPTIONS.LB = t('pos-LB'); POS_DESCRIPTIONS.DM = t('pos-DM'); POS_DESCRIPTIONS.CM = t('pos-CM');
  POS_DESCRIPTIONS.RM = t('pos-RM'); POS_DESCRIPTIONS.LM = t('pos-LM'); POS_DESCRIPTIONS.AM = t('pos-AM');
  POS_DESCRIPTIONS.RW = t('pos-RW'); POS_DESCRIPTIONS.LW = t('pos-LW'); POS_DESCRIPTIONS.ST = t('pos-ST');
  // Neutral stadium card
  const neutroCard = document.querySelector('.spk-card[data-id=""] .spk-name');
  if (neutroCard) neutroCard.textContent = t('stadium-neutro');
  // Rebuild weather picker labels when language changes (guard: fn may not be defined on first call)
  if (typeof _buildWeatherPicker === 'function') _buildWeatherPicker();
  // Refresh formation dropdowns with translated labels
  if (typeof setMatchMode === 'function' && typeof _matchMode !== 'undefined') setMatchMode(_matchMode);
  // Re-render team pickers so type-select labels (Clubs/Nations/Back…) update
  if (typeof _renderPicker === 'function') { _renderPicker('A'); _renderPicker('B'); }
  // Footer
  const ftTag = document.querySelector('.site-footer > p:first-child');
  if (ftTag) ftTag.textContent = t('footer-tagline');
  const ftDisc = document.querySelector('.footer-disclaimer');
  if (ftDisc) ftDisc.textContent = t('footer-disclaimer');
  document.querySelectorAll('.footer-link').forEach(a => {
    const p = a.pathname;
    a.href = _lang === 'en' ? p + '?lang=en' : p;
    if (p === '/legal')   a.textContent = t('footer-legal-link');
    if (p === '/privacy') a.textContent = t('footer-privacy-link');
    if (p === '/contact') a.textContent = t('footer-contact-link');
  });
  // Tournament-specific live updates
  const trnSearch = document.getElementById('trn-search-input');
  if (trnSearch) trnSearch.placeholder = t('trn-search-ph');
  const bracketBtn = document.querySelector('.trn-dash-tab[data-tab="bracket"]');
  if (bracketBtn?.dataset.trnFmt) bracketBtn.textContent = bracketBtn.dataset.trnFmt === 'liga' ? t('trn-tab-bracket-liga') : t('trn-tab-bracket-ko');
  // Generic data-i18n sweep
  document.querySelectorAll('[data-i18n]').forEach(node => {
    const key = node.dataset.i18n;
    const val = t(key);
    if (val && val !== key) node.textContent = val;
  });
}

/** Strip data-source prefix from lookup result for display (hides internal source names) */
function _displayLabel(data) {
  if (data && data.teamLabel) return data.teamLabel;
  const s = (data && data.source) || '';
  return s.replace(/^(DB local|Local DB|TheSportsDB|BDFutbol|Transfermarkt|Wikipedia)\s*[\u2014\u2013-]+\s*/i, '').replace(/^"|"$/g, '').trim() || s;
}

const FORMATIONS = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '3-4-3', '5-3-2', '4-5-1', '4-1-4-1'];
const FORMATIONS_5V5 = ['1-2-1', '1-1-2', '2-1-1'];
const FORMATIONS_3V3 = ['1-1', '1-2'];
const FORMATION_LABELS = {};
function _formationLabel(f) {
  const map = {
    '1-2-1': t('fl-balanced'), '1-1-2': t('fl-attack'), '2-1-1': t('fl-defensive'),
    '1-1': t('fl-standard'),  '1-2': t('fl-high-press'),
  };
  return map[f] ? `${f} (${map[f]})` : f;
}

// ── Badge fallback: SVG con iniciales del equipo ───────────────
function _badgeFallback(teamName) {
  const initials = (teamName || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase();
  let h = 0;
  for (const c of (teamName || '')) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  const hue = h % 360;
  const sz  = initials.length > 2 ? '24' : '30';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">`
    + `<circle cx="50" cy="50" r="48" fill="hsl(${hue},55%,22%)" stroke="hsl(${hue},80%,55%)" stroke-width="4"/>`
    + `<text x="50" y="62" text-anchor="middle" font-family="sans-serif" font-size="${sz}" font-weight="800" fill="white">${initials}</text>`
    + `</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// ── Match mode state ───────────────────────────────────────────
let _matchMode = '11v11';

function toggleHaptic() {
  const next = !_HFX.isOn();
  _HFX.toggle(next);
  const btn = document.getElementById('btn-haptic');
  if (btn) btn.classList.toggle('btn-haptic--on', next);
  showToast(next ? '📳 Vibración activada' : '🔇 Vibración desactivada');
}

function setMatchMode(mode) {
  _matchMode = mode;
  ['11v11','5v5','3v3','penalties'].forEach(m => {
    document.getElementById(`mode-${m}`)?.classList.toggle('mode-pill-active', m === mode);
  });
  const formations = mode === '5v5' ? FORMATIONS_5V5 : mode === '3v3' ? FORMATIONS_3V3 : FORMATIONS;
  ['formationA','formationB'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = `<option value="">${t('formation-default')}</option>`;
    formations.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = _formationLabel(f);
      sel.appendChild(opt);
    });
  });
  // Refresh lookup previews so jersey count matches the new mode
  ['A','B'].forEach(s => { if (_lookupCache[s]) _renderLookupPlayers(s, _lookupCache[s]); });
}

// ── Estadios míticos ────────────────────────────────────────────
// Local image paths
const _imgProxy    = f => `/img/stadiums/${f}`;
const _refImgProxy = f => `/img/referees/${f}`;

// Palette for initials-avatar fallback (one per referee, hashed from id)
const _AVATAR_COLORS = [
  'linear-gradient(135deg,#b8860b,#ffd700)',
  'linear-gradient(135deg,#8b0000,#c0392b)',
  'linear-gradient(135deg,#1a3a5c,#2980b9)',
  'linear-gradient(135deg,#1a5c2a,#27ae60)',
  'linear-gradient(135deg,#4a1a5c,#8e44ad)',
  'linear-gradient(135deg,#5c3a1a,#e67e22)',
  'linear-gradient(135deg,#1a5c5c,#16a085)',
  'linear-gradient(135deg,#3d3d3d,#7f8c8d)',
];
function _avatarColor(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h * 5) + id.charCodeAt(i)) & 0xffff;
  return _AVATAR_COLORS[h % _AVATAR_COLORS.length];
}
function _initials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

// ── Clima ───────────────────────────────────────────────────────
const _WEATHER_SVG = {
  // Sun rotates slowly around its own center
  sunny: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g><animateTransform attributeName="transform" type="rotate" from="0 16 16" to="360 16 16" dur="14s" repeatCount="indefinite"/>
      <circle cx="16" cy="16" r="5.5" fill="#fbbf24"/>
      <g stroke="#fbbf24" stroke-width="2.2" stroke-linecap="round">
        <line x1="16" y1="2.5" x2="16" y2="6"/><line x1="16" y1="26" x2="16" y2="29.5"/>
        <line x1="2.5" y1="16" x2="6" y2="16"/><line x1="26" y1="16" x2="29.5" y2="16"/>
        <line x1="6.5" y1="6.5" x2="9" y2="9"/><line x1="23" y1="23" x2="25.5" y2="25.5"/>
        <line x1="6.5" y1="25.5" x2="9" y2="23"/><line x1="23" y1="9" x2="25.5" y2="6.5"/>
      </g>
    </g></svg>`,
  // Cloud drifts gently left-right
  cloudy: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g><animateTransform attributeName="transform" type="translate" values="0 0;2 -1;0 1;0 0" dur="5s" repeatCount="indefinite"/>
      <path d="M25 21H9a5 5 0 0 1-.5-9.97A7 7 0 0 1 23 16h2a4 4 0 0 1 0 8Z" fill="rgba(200,215,235,.85)"/>
      <circle cx="9.5" cy="11" r="2.8" fill="#fbbf24" opacity=".7"/>
      <path d="M7 10 a2.5 2.5 0 0 1 4.5-1.5" stroke="rgba(200,215,235,.85)" stroke-width="3" fill="none"/>
    </g></svg>`,
  // Rain drops fall with staggered delay
  rain: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 19H8a5 5 0 0 1-.5-9.97A7 7 0 0 1 22 14h2a4 4 0 0 1 0 8Z" fill="rgba(150,180,220,.85)"/>
    <g stroke="#60a5fa" stroke-width="2.2" stroke-linecap="round">
      <line x1="10" y1="23" x2="8.5" y2="28">
        <animate attributeName="y1" values="23;26;23" dur="1s" repeatCount="indefinite"/>
        <animate attributeName="y2" values="28;31;28" dur="1s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="1;.2;1" dur="1s" repeatCount="indefinite"/>
      </line>
      <line x1="16" y1="23" x2="14.5" y2="28">
        <animate attributeName="y1" values="23;26;23" dur="1s" begin=".35s" repeatCount="indefinite"/>
        <animate attributeName="y2" values="28;31;28" dur="1s" begin=".35s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="1;.2;1" dur="1s" begin=".35s" repeatCount="indefinite"/>
      </line>
      <line x1="22" y1="23" x2="20.5" y2="28">
        <animate attributeName="y1" values="23;26;23" dur="1s" begin=".7s" repeatCount="indefinite"/>
        <animate attributeName="y2" values="28;31;28" dur="1s" begin=".7s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="1;.2;1" dur="1s" begin=".7s" repeatCount="indefinite"/>
      </line>
    </g></svg>`,
  // Storm: rain + lightning blinks
  storm: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 18H8a5 5 0 0 1-.5-9.97A7 7 0 0 1 22 13h2a4 4 0 0 1 0 8Z" fill="rgba(120,130,160,.85)"/>
    <g stroke="#93b4dd" stroke-width="2" stroke-linecap="round">
      <line x1="9" y1="22" x2="7.5" y2="27">
        <animate attributeName="opacity" values="1;.1;1" dur=".8s" begin=".1s" repeatCount="indefinite"/>
      </line>
      <line x1="22" y1="22" x2="20.5" y2="27">
        <animate attributeName="opacity" values="1;.1;1" dur=".8s" begin=".55s" repeatCount="indefinite"/>
      </line>
    </g>
    <path d="M17 20 L13 28 L17 26 L13 33" stroke="#fde047" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <animate attributeName="opacity" values="1;1;.05;1;.05;1;1" dur="4s" repeatCount="indefinite"/>
    </path></svg>`,
  // Snowflake rotates
  snow: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g><animateTransform attributeName="transform" type="rotate" from="0 16 16" to="360 16 16" dur="9s" repeatCount="indefinite"/>
      <g stroke="#a5f3fc" stroke-width="2.2" stroke-linecap="round">
        <line x1="16" y1="4" x2="16" y2="28"/><line x1="4" y1="16" x2="28" y2="16"/>
        <line x1="7.5" y1="7.5" x2="24.5" y2="24.5"/><line x1="24.5" y1="7.5" x2="7.5" y2="24.5"/>
      </g>
      <circle cx="16" cy="16" r="2.5" fill="#a5f3fc"/>
    </g></svg>`,
  // Wind gusts ripple
  wind: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g stroke="rgba(147,210,255,.9)" stroke-width="2.2" stroke-linecap="round">
      <path d="M4 10 Q10 6 18 10 a4 4 0 0 0 4 0 a4 4 0 0 0 0-4">
        <animate attributeName="opacity" values=".4;1;.4" dur="2.2s" repeatCount="indefinite"/>
      </path>
      <path d="M4 16 Q12 12 20 16 Q26 19 28 16">
        <animate attributeName="opacity" values=".4;1;.4" dur="2.2s" begin=".5s" repeatCount="indefinite"/>
      </path>
      <path d="M4 22 Q9 18 16 22 a3.5 3.5 0 0 0 3.5 0 a3.5 3.5 0 0 0 0-3.5">
        <animate attributeName="opacity" values=".4;1;.4" dur="2.2s" begin="1s" repeatCount="indefinite"/>
      </path>
    </g></svg>`,
  // Thermometer: clean 2-color, liquid pulses red
  heat: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="13.5" y="4" width="5" height="15" rx="2.5" stroke="rgba(220,60,40,.45)" stroke-width="1.4" fill="rgba(220,60,40,.07)"/>
    <rect x="14.8" y="11" width="2.4" height="8" rx="1.2" fill="rgba(220,60,40,.55)">
      <animate attributeName="height" values="8;11;8" dur="1.8s" repeatCount="indefinite"/>
      <animate attributeName="y" values="11;8;11" dur="1.8s" repeatCount="indefinite"/>
      <animate attributeName="fill" values="rgba(220,60,40,.55);rgba(255,90,50,.9);rgba(220,60,40,.55)" dur="1.8s" repeatCount="indefinite"/>
    </rect>
    <circle cx="16" cy="23" r="3.8" fill="rgba(220,60,40,.85)"/>
    <g stroke="rgba(220,60,40,.55)" stroke-width="1.4" stroke-linecap="round">
      <line x1="20" y1="8" x2="22.5" y2="8"/>
      <line x1="20" y1="12" x2="22.5" y2="12"/>
      <line x1="20" y1="16" x2="22.5" y2="16"/>
    </g></svg>`,
  // Moon + twinkling stars
  night: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22 8a10 10 0 1 1-12.5 12.5A7.5 7.5 0 0 0 22 8Z" fill="rgba(147,130,200,.85)" stroke="rgba(180,165,230,.7)" stroke-width="1.5"/>
    <circle cx="7" cy="11" r="1" fill="rgba(255,255,255,.85)">
      <animate attributeName="opacity" values=".2;1;.2" dur="2.8s" repeatCount="indefinite"/>
    </circle>
    <circle cx="4.5" cy="16.5" r=".8" fill="rgba(255,255,255,.85)">
      <animate attributeName="opacity" values="1;.2;1" dur="2s" repeatCount="indefinite"/>
    </circle>
    <circle cx="10" cy="7.5" r=".7" fill="rgba(255,255,255,.85)">
      <animate attributeName="opacity" values=".5;1;.1;1;.5" dur="3.5s" repeatCount="indefinite"/>
    </circle></svg>`,
};

const WEATHER = [
  { id: 'sunny',  labelEs: 'Soleado',       labelEn: 'Sunny',        goalMult: 1.00 },
  { id: 'cloudy', labelEs: 'Nublado',        labelEn: 'Cloudy',       goalMult: 0.97 },
  { id: 'rain',   labelEs: 'Lluvia',         labelEn: 'Rain',         goalMult: 0.88 },
  { id: 'storm',  labelEs: 'Tormenta',       labelEn: 'Storm',        goalMult: 0.76 },
  { id: 'snow',   labelEs: 'Nieve',          labelEn: 'Snow',         goalMult: 0.82 },
  { id: 'wind',   labelEs: 'Viento fuerte',  labelEn: 'Strong wind',  goalMult: 0.93 },
  { id: 'heat',   labelEs: 'Calor extremo',  labelEn: 'Extreme heat', goalMult: 0.91 },
  { id: 'night',  labelEs: 'Noche',          labelEn: 'Night',        goalMult: 1.00 },
];

const STADIUMS = [
  { id:'bernabeu',   name:'Santiago Bernabéu',    city:'Madrid',          country:'España',
    capacity:81044, year:1947, surface:'Césped híbrido',  climate:'☀️ Templado',
    img: _imgProxy('Santiago_Bernabeu_Stadium.jpg') },
  { id:'campnou',    name:'Camp Nou',              city:'Barcelona',       country:'España',
    capacity:99354, year:1957, surface:'Césped natural',  climate:'☀️ Mediterráneo',
    img: _imgProxy('Camp_Nou.jpg') },
  { id:'wembley',    name:'Wembley Stadium',       city:'Londres',         country:'Inglaterra',
    capacity:90000, year:2007, surface:'Césped híbrido',  climate:'🌧️ Oceánico',
    img: _imgProxy('Wembley_stadium.jpg') },
  { id:'maracana',   name:'Maracanã',              city:'Río de Janeiro',  country:'Brasil',
    capacity:78838, year:1950, surface:'Césped natural',  climate:'☀️ Tropical',
    img: _imgProxy('Maracanã.jpg') },
  { id:'sansiro',    name:'San Siro (G. Meazza)',  city:'Milán',           country:'Italia',
    capacity:80018, year:1926, surface:'Césped híbrido',  climate:'🌦️ Continental',
    img: _imgProxy('San_Siro.jpg') },
  { id:'allianz',    name:'Allianz Arena',         city:'Múnich',          country:'Alemania',
    capacity:75024, year:2005, surface:'Césped natural',  climate:'🌨️ Frío',
    img: _imgProxy('Allianz_Arena.jpg') },
  { id:'dortmund',   name:'BVB-Stadion Dortmund',  city:'Dortmund',        country:'Alemania',
    capacity:81365, year:1974, surface:'Césped natural',  climate:'🌨️ Frío',
    img: _imgProxy('Signal_Iduna_Park.jpg') },
  { id:'oldtrafford',name:'Old Trafford',          city:'Mánchester',      country:'Inglaterra',
    capacity:74310, year:1910, surface:'Césped híbrido',  climate:'🌧️ Oceánico',
    img: _imgProxy('Old_Trafford.jpg') },
  { id:'anfield',    name:'Anfield',               city:'Liverpool',       country:'Inglaterra',
    capacity:61276, year:1884, surface:'Césped natural',  climate:'🌧️ Oceánico',
    img: _imgProxy('Anfield.jpg') },
  { id:'azteca',     name:'Estadio Azteca',        city:'Ciudad de México', country:'México',
    capacity:87523, year:1966, surface:'Césped natural',  climate:'⛅ Altitud',
    img: _imgProxy('Estadio_azteca.jpg') },
  { id:'luzhniki',   name:'Estadio Luzhniki',      city:'Moscú',           country:'Rusia',
    capacity:81000, year:1956, surface:'Césped natural',  climate:'❄️ Continental',
    img: _imgProxy('Luzhniki_Stadium.jpg') },
  { id:'sanmames',   name:'San Mamés',             city:'Bilbao',          country:'España',
    capacity:53289, year:2013, surface:'Césped híbrido',  climate:'🌧️ Atlántico',
    img: _imgProxy('San_Mames_stadium.jpg') },
  { id:'celtic',     name:'Celtic Park',           city:'Glasgow',         country:'Escocia',
    capacity:60411, year:1892, surface:'Césped natural',  climate:'🌧️ Oceánico',
    img: _imgProxy('Celtic_Park.jpg') },
];

let _selectedStadium = null;
let _selectedReferee = null;     // full referee object from /referees
let _selectedWeather = null;     // weather object from WEATHER array
let _shareData       = null;     // data snapshot for share card generation

// ── Analytics helper (GA4 via existing gtag) ─────────────────
function _gx(event, params) {
  try { if (typeof gtag === 'function') gtag('event', event, params || {}); } catch(_) {}
}

// ── Haptic feedback (vibration API, opt-in) ──────────────────
const _HFX = (() => {
  let _on = false;
  try { _on = localStorage.getItem('gx_haptic') !== '0'; } catch(_) {}
  function _vib(pattern) {
    if (_on && navigator.vibrate) { try { navigator.vibrate(pattern); } catch(_) {} }
  }
  return {
    goal:   () => _vib([60, 30, 80, 30, 120]),
    card:   () => _vib([200]),
    red:    () => _vib([300, 60, 300]),
    whistle:() => _vib([40]),
    toggle: (on) => { _on = on; try { localStorage.setItem('gx_haptic', on ? '1' : '0'); } catch(_) {} },
    isOn:   () => _on,
  };
})();

// ── Match History (last 20 results) ──────────────────────────
const _HIST_KEY = 'gx_match_history';
function _histSave(payload, data) {
  try {
    const hist = _histLoad();
    const scoreA = data.finalScore?.teamA ?? 0;
    const scoreB = data.finalScore?.teamB ?? 0;
    const entry = {
      ts: Date.now(),
      slugA: payload.teamA, nameA: payload.teamA, eraA: payload.eraA || '',
      slugB: payload.teamB, nameB: payload.teamB, eraB: payload.eraB || '',
      scoreA, scoreB, mode: payload.matchMode || '11v11',
      momName: data.stats?.manOfMatch?.name || null,
      badgeA: data.badgeA || null, badgeB: data.badgeB || null,
    };
    hist.unshift(entry);
    localStorage.setItem(_HIST_KEY, JSON.stringify(hist.slice(0, 20)));
    _histRender();
  } catch(_) {}
}
function _histLoad() {
  try { return JSON.parse(localStorage.getItem(_HIST_KEY) || '[]'); } catch(_) { return []; }
}
function clearMatchHistory() {
  try { localStorage.removeItem(_HIST_KEY); } catch(_) {}
  _histRender();
}
function _histRender() {
  const el = document.getElementById('match-history-list');
  if (!el) return;
  const hist = _histLoad();
  const wrap = document.getElementById('match-history-wrap');
  if (wrap) wrap.classList.toggle('hidden', hist.length === 0);
  if (!hist.length) return;
  el.innerHTML = hist.map((h, i) => {
    const date = new Date(h.ts).toLocaleDateString('es-ES', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
    const eA = h.eraA ? ` <small>'${String(h.eraA).slice(-2)}</small>` : '';
    const eB = h.eraB ? ` <small>'${String(h.eraB).slice(-2)}</small>` : '';
    const badgeSrcA = h.badgeA || `/img/badges/${h.slugA}.svg`;
    const badgeSrcB = h.badgeB || `/img/badges/${h.slugB}.svg`;
    const PH = '/img/badges/_placeholder.svg';
    return `<div class="mh-row" data-hist-idx="${i}" title="Volver a simular este partido">
      <img class="mh-badge" src="${escHtml(badgeSrcA)}" onerror="this.src='${PH}'" alt="">
      <span class="mh-name">${escHtml(h.nameA)}${eA}</span>
      <span class="mh-score">${h.scoreA}–${h.scoreB}</span>
      <span class="mh-name mh-name-b">${escHtml(h.nameB)}${eB}</span>
      <img class="mh-badge" src="${escHtml(badgeSrcB)}" onerror="this.src='${PH}'" alt="">
      <span class="mh-date">${date}</span>
    </div>`;
  }).join('');
}
function histReplay(idx) {
  const hist = _histLoad();
  const h = hist[idx];
  if (!h) return;
  // Pre-fill team hidden inputs and select era
  document.getElementById('teamA').value = h.slugA;
  document.getElementById('teamB').value = h.slugB;
  _populateEraSelect(h.slugA, 'A');
  _populateEraSelect(h.slugB, 'B');
  if (h.eraA) { const sel = document.getElementById('eraA'); if (sel) sel.value = h.eraA; }
  if (h.eraB) { const sel = document.getElementById('eraB'); if (sel) sel.value = h.eraB; }
  _pickerState.A = { type: null, league: null }; _renderPicker('A');
  _pickerState.B = { type: null, league: null }; _renderPicker('B');
  _updateClashButton();
  // Scroll to top
  document.getElementById('col-a')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast('♻ Equipos restaurados · Pulsa ⚔ para simular');
}

// ── Surprise Me — random matchup ─────────────────────────────
function surpriseMe() {
  if (!_catalogReady || !_catalog.length) { showToast(t('catalog-loading') || 'Cargando catálogo…'); return; }
  // Exclude special/historica/fantasy entries for better game quality
  const pool = _catalog.filter(c =>
    c.group !== '🌐 Continentes Históricos' &&
    c.group !== '⭐ Fantasy XI' &&
    c.seasons?.length
  );
  if (pool.length < 2) return;
  const pick = () => pool[Math.floor(Math.random() * pool.length)];
  let tA = pick(), tB;
  do { tB = pick(); } while (tB.slug === tA.slug);
  const seasons = s => s.seasons || [];
  const randEra = t => { const s = seasons(t); return s.length ? s[Math.floor(Math.random() * s.length)] : ''; };
  const eA = randEra(tA);
  const eB = randEra(tB);
  document.getElementById('teamA').value = tA.slug;
  document.getElementById('teamB').value = tB.slug;
  _populateEraSelect(tA.slug, 'A');
  _populateEraSelect(tB.slug, 'B');
  if (eA) { const sel = document.getElementById('eraA'); if (sel) sel.value = eA; }
  if (eB) { const sel = document.getElementById('eraB'); if (sel) sel.value = eB; }
  _pickerState.A = { type: null, league: null }; _renderPicker('A');
  _pickerState.B = { type: null, league: null }; _renderPicker('B');
  _updateClashButton();
  _gx('surprise_me');
  showToast('⚡ ¡Enfrentamiento aleatorio!');
}

// ── Partidos Históricos / Grandes Rivalidades ─────────────────
// Each entry is a SPECIFIC dream match with exact team eras.
// Covers real finals that happened + fantasy cross-era clashes fans debate.
const HISTORIC_MATCHES = [
  // ── Selecciones: finales y sueños ──────────────────────────
  { label: '¿Pelé o Maradona?',              en: 'Pelé vs Maradona',
    desc: 'Brasil \'70 · Argentina \'86',
    a: { slug: 'brasilien',                  era: '1970' },
    b: { slug: 'argentinien',                era: '1986' } },
  { label: 'La Tragedia del 82',             en: 'The Tragedy of \'82',
    desc: 'Brasil \'82 · Alemania \'82',
    a: { slug: 'brasilien',                  era: '1982' },
    b: { slug: 'deutschland',                era: '1982' } },
  { label: 'Final EE.UU. 1994',             en: 'USA \'94 World Cup Final',
    desc: 'Brasil \'94 · Italia \'94',
    a: { slug: 'brasilien',                  era: '1994' },
    b: { slug: 'italien',                    era: '1994' } },
  { label: 'Beckenbauer vs Cruyff',          en: 'Beckenbauer vs Cruyff',
    desc: 'Alemania \'74 · Holanda \'74',
    a: { slug: 'deutschland',                era: '1974' },
    b: { slug: 'niederlande',                era: '1974' } },
  { label: 'Final Sudáfrica 2010',           en: '2010 World Cup Final',
    desc: 'España \'10 · Holanda \'10',
    a: { slug: 'spanien',                    era: '2010' },
    b: { slug: 'niederlande',                era: '2010' } },
  { label: 'El Séptimo Cielo',               en: 'The Seventh Heaven',
    desc: 'Alemania \'14 · Argentina \'14',
    a: { slug: 'deutschland',                era: '2014' },
    b: { slug: 'argentinien',                era: '2014' } },
  { label: 'Francia 98 vs Brasil 98',        en: 'France \'98 vs Brazil \'98',
    desc: 'Francia \'98 · Brasil \'98',
    a: { slug: 'frankreich',                 era: '1998' },
    b: { slug: 'brasilien',                  era: '1998' } },
  // ── El Clásico y sus versiones míticas ────────────────────
  { label: 'Galácticos vs Los Invencibles',  en: 'Galacticos vs The Invincibles',
    desc: 'Real Madrid \'02 · Arsenal \'04',
    a: { slug: 'real-madrid',                era: '2002' },
    b: { slug: 'fc-arsenal',                 era: '2004' } },
  { label: 'El Treble vs Los Invencibles',   en: 'Treble vs The Invincibles',
    desc: 'Manchester United \'99 · Arsenal \'04',
    a: { slug: 'manchester-united',          era: '1999' },
    b: { slug: 'fc-arsenal',                 era: '2004' } },
  { label: 'MSN vs BBC',                     en: 'MSN vs BBC',
    desc: 'Barcelona \'15 · Real Madrid \'15',
    a: { slug: 'fc-barcelona',               era: '2015' },
    b: { slug: 'real-madrid',                era: '2015' } },
  { label: 'Mou vs Pep: El Clásico',         en: 'Mourinho vs Guardiola',
    desc: 'Real Madrid \'12 · Barcelona \'11',
    a: { slug: 'real-madrid',                era: '2012' },
    b: { slug: 'fc-barcelona',               era: '2011' } },
  { label: 'Di Stéfano vs el Dream Team',    en: 'Di Stéfano vs the Dream Team',
    desc: 'Real Madrid \'60 · Barcelona \'92',
    a: { slug: 'real-madrid',                era: '1960' },
    b: { slug: 'fc-barcelona',               era: '1992' } },
  // ── Duelos legendarios europeos ───────────────────────────
  { label: 'Maradona vs Messi',              en: 'Maradona vs Messi',
    desc: 'Nápoles \'88 · Barcelona \'09',
    a: { slug: 'ssc-neapel',                 era: '1988' },
    b: { slug: 'fc-barcelona',               era: '2009' } },
  { label: 'La Final de Múnich 99',          en: 'Munich \'99 Final',
    desc: 'Manchester United \'99 · Bayern \'99',
    a: { slug: 'manchester-united',          era: '1999' },
    b: { slug: 'fc-bayern-munchen',          era: '1999' } },
  { label: 'El Milagro de Estambul',         en: 'The Istanbul Miracle',
    desc: 'AC Milán \'03 · Liverpool \'05',
    a: { slug: 'ac-mailand',                 era: '2003' },
    b: { slug: 'fc-liverpool',               era: '2005' } },
  { label: 'La Semifinal de Milán',          en: 'The Milan Semi \'10',
    desc: 'Inter \'10 · Barcelona \'10',
    a: { slug: 'inter-mailand',              era: '2010' },
    b: { slug: 'fc-barcelona',              era: '2010' } },
  { label: 'La Final de Ámsterdam',          en: 'Amsterdam \'95 Final',
    desc: 'Ajax \'95 · Juventus \'96',
    a: { slug: 'ajax-amsterdam',             era: '1995' },
    b: { slug: 'juventus-turin',             era: '1996' } },
  { label: 'Platini vs el Dream Team',       en: 'Platini vs the Dream Team',
    desc: 'Juventus \'85 · Barcelona \'92',
    a: { slug: 'juventus-turin',             era: '1985' },
    b: { slug: 'fc-barcelona',              era: '1992' } },
  { label: 'Der Wembley-Klassiker',          en: 'The Wembley Klassiker',
    desc: 'Bayern \'13 · Dortmund \'12',
    a: { slug: 'fc-bayern-munchen',          era: '2013' },
    b: { slug: 'borussia-dortmund',          era: '2012' } },
  { label: 'Los Reyes de Europa: \'73 vs \'74', en: 'Kings of Europe: \'73 vs \'74',
    desc: 'Ajax \'73 · Bayern \'74',
    a: { slug: 'ajax-amsterdam',             era: '1973' },
    b: { slug: 'fc-bayern-munchen',          era: '1974' } },
  { label: 'Milán \'94 vs Liverpool \'84',   en: 'Milan \'94 vs Liverpool \'84',
    desc: 'AC Milán \'94 · Liverpool \'84',
    a: { slug: 'ac-mailand',                 era: '1994' },
    b: { slug: 'fc-liverpool',              era: '1984' } },
  { label: 'Grande Inter vs el Madrid \'66', en: 'Grande Inter vs Real Madrid \'66',
    desc: 'Inter \'65 · Real Madrid \'66',
    a: { slug: 'inter-mailand',              era: '1965' },
    b: { slug: 'real-madrid',                era: '1966' } },
  // ── Sueños ──────────────────────────────────────────────
  { label: 'El Superclásico',                en: 'El Superclásico',
    desc: 'Boca \'07 · River \'15',
    a: { slug: 'club-atletico-boca-juniors', era: '2007' },
    b: { slug: 'club-atletico-river-plate',  era: '2015' } },
  { label: 'Ronaldo vs Ronaldo',             en: 'Ronaldo vs Ronaldo',
    desc: 'Brasil \'02 · Real Madrid \'18',
    a: { slug: 'brasilien',                  era: '2002' },
    b: { slug: 'real-madrid',                era: '2018' } },
  { label: 'Pep vs Jupp',                    en: 'Pep vs Jupp',
    desc: 'Barcelona \'11 · Bayern \'13',
    a: { slug: 'fc-barcelona',               era: '2011' },
    b: { slug: 'fc-bayern-munchen',          era: '2013' } },
  { label: 'Londres vs Madrid en Kiev',      en: 'London vs Madrid in Kyiv',
    desc: 'Liverpool \'19 · Real Madrid \'18',
    a: { slug: 'fc-liverpool',              era: '2019' },
    b: { slug: 'real-madrid',               era: '2018' } },
  { label: 'Porto de Mourinho vs Galácticos',en: 'Mourinho\'s Porto vs Galácticos',
    desc: 'Porto \'04 · Real Madrid \'02',
    a: { slug: 'fc-porto',                   era: '2004' },
    b: { slug: 'real-madrid',                era: '2002' } },
  { label: 'Los Profetas del Fútbol Total',  en: 'Prophets of Total Football',
    desc: 'Ajax \'71 · AC Milán \'63',
    a: { slug: 'ajax-amsterdam',             era: '1971' },
    b: { slug: 'ac-mailand',                 era: '1963' } },
  { label: 'La Décima vs el Doblete Atlético',en: 'La Décima vs Atlético\'s Double',
    desc: 'Real Madrid \'14 · Atlético \'16',
    a: { slug: 'real-madrid',                era: '2014' },
    b: { slug: 'atletico-madrid',            era: '2016' } },
  { label: 'Maradona en Nápoles vs Liverpool 84', en: 'Maradona\'s Napoli vs Liverpool \'84',
    desc: 'Nápoles \'87 · Liverpool \'84',
    a: { slug: 'ssc-neapel',                 era: '1987' },
    b: { slug: 'fc-liverpool',              era: '1984' } },

  // ── Nuevos: equipos sin usar (Chelsea, Celtic, Benfica, Man City…) ──
  { label: 'Los Leones de Lisboa',           en: 'The Lions of Lisbon',
    desc: 'Celtic \'67 · Inter \'65',
    a: { slug: 'celtic-glasgow',             era: '1967' },
    b: { slug: 'inter-mailand',              era: '1965' } },
  { label: 'Eusébio vs Di Stéfano',          en: 'Eusébio vs Di Stéfano',
    desc: 'Benfica \'62 · Real Madrid \'60',
    a: { slug: 'benfica-lissabon',           era: '1962' },
    b: { slug: 'real-madrid',                era: '1960' } },
  { label: 'La Remontada Robada de Stamford', en: 'The Stamford Bridge Comeback',
    desc: 'Chelsea \'12 · Barcelona \'11',
    a: { slug: 'fc-chelsea',                 era: '2012' },
    b: { slug: 'fc-barcelona',               era: '2011' } },
  { label: 'Inventores vs Maestros',         en: 'Inventors vs Masters',
    desc: 'England \'66 · Alemania \'74',
    a: { slug: 'england',                    era: '1966' },
    b: { slug: 'deutschland',                era: '1974' } },
  { label: 'El Año de los Pequeños Gigantes',en: 'Year of the Small Giants',
    desc: 'Porto \'04 · Mónaco \'04',
    a: { slug: 'fc-porto',                   era: '2004' },
    b: { slug: 'as-monaco',                  era: '2003' } },
  { label: 'La Final de París',              en: 'The Paris Final',
    desc: 'Portugal \'16 · Francia \'16',
    a: { slug: 'portugal',                   era: '2016' },
    b: { slug: 'frankreich',                 era: '2016' } },
  { label: 'La Semifinal de San Petersburgo',en: 'The Saint Petersburg Semi',
    desc: 'Bélgica \'18 · Francia \'18',
    a: { slug: 'belgien',                    era: '2018' },
    b: { slug: 'frankreich',                 era: '2018' } },
  { label: 'Los Diables Rouges vs Mbappé',   en: 'Les Diables vs Mbappé',
    desc: 'Bélgica \'22 · Francia \'22',
    a: { slug: 'belgien',                    era: '2022' },
    b: { slug: 'frankreich',                 era: '2022' } },
  { label: 'La Semifinal de Marsella \'98',  en: 'The Marseille Semi \'98',
    desc: 'Croacia \'98 · Francia \'98',
    a: { slug: 'kroatien',                   era: '1998' },
    b: { slug: 'frankreich',                 era: '1998' } },
  { label: 'PSG \'20 vs los Reds de Klopp',  en: 'PSG \'20 vs Klopp\'s Reds',
    desc: 'PSG \'20 · Liverpool \'19',
    a: { slug: 'fc-paris-saint-germain',     era: '2020' },
    b: { slug: 'fc-liverpool',               era: '2019' } },
  { label: 'Los Campeones de Europa del 93', en: 'Champions of Europe \'93',
    desc: 'Marsella \'93 · AC Milán \'89',
    a: { slug: 'olympique-marseille',        era: '1993' },
    b: { slug: 'ac-mailand',                 era: '1989' } },
  { label: 'Dos Tripletes del Siglo',        en: 'Two Trebles of the Century',
    desc: 'Man City \'23 · Bayern \'13',
    a: { slug: 'manchester-city',            era: '2023' },
    b: { slug: 'fc-bayern-munchen',          era: '2013' } },

  // ── Selecciones: Mundiales y Eurocopas soñadas ─────────────
  { label: 'El Mineirazo',                   en: 'The Mineirazo (7-1)',
    desc: 'Brasil \'14 · Alemania \'14',
    a: { slug: 'brasilien',                  era: '2014' },
    b: { slug: 'deutschland',                era: '2014' } },
  { label: 'La Final de Qatar 2022',         en: 'Qatar 2022 World Cup Final',
    desc: 'Argentina \'22 · Francia \'22',
    a: { slug: 'argentinien',                era: '2022' },
    b: { slug: 'frankreich',                 era: '2022' } },
  { label: 'Cruyff vs Beckenbauer — Final \'74', en: 'Cruyff vs Beckenbauer — Final \'74',
    desc: 'Holanda \'74 · Alemania \'74',
    a: { slug: 'niederlande',                era: '1974' },
    b: { slug: 'deutschland',                era: '1974' } },
  { label: 'La Noche de Sevilla',            en: 'The Night of Seville \'82',
    desc: 'Alemania \'82 · Francia \'82',
    a: { slug: 'deutschland',                era: '1982' },
    b: { slug: 'frankreich',                 era: '1982' } },
  { label: 'Wembley \'90 — Gazza llora',     en: 'Wembley \'90 — Gazza\'s tears',
    desc: 'Inglaterra \'90 · Alemania \'90',
    a: { slug: 'england',                    era: '1990' },
    b: { slug: 'deutschland',                era: '1990' } },
  { label: 'Final Berlín 2006 — El Cabezazo',en: 'Berlin Final 2006 — The Headbutt',
    desc: 'Italia \'06 · Francia \'06',
    a: { slug: 'italien',                    era: '2006' },
    b: { slug: 'frankreich',                 era: '2006' } },
  { label: 'La Mano de Dios',               en: 'The Hand of God',
    desc: 'Argentina \'86 · Inglaterra \'86',
    a: { slug: 'argentinien',                era: '1986' },
    b: { slug: 'england',                    era: '1986' } },
  { label: 'Final Buenos Aires \'78',        en: 'Buenos Aires Final \'78',
    desc: 'Argentina \'78 · Holanda \'78',
    a: { slug: 'argentinien',                era: '1978' },
    b: { slug: 'niederlande',                era: '1978' } },
  { label: 'Golden Goal — Euro 2000',        en: 'Golden Goal — Euro 2000',
    desc: 'Francia \'00 · Italia \'00',
    a: { slug: 'frankreich',                 era: '2000' },
    b: { slug: 'italien',                    era: '2000' } },
  { label: 'Final del Bernabéu \'82',        en: 'Bernabéu Final 1982',
    desc: 'Italia \'82 · Alemania \'82',
    a: { slug: 'italien',                    era: '1982' },
    b: { slug: 'deutschland',                era: '1982' } },
  { label: 'Final del Azteca \'70',          en: 'Azteca Final 1970',
    desc: 'Brasil \'70 · Italia \'70',
    a: { slug: 'brasilien',                  era: '1970' },
    b: { slug: 'italien',                    era: '1970' } },
  { label: 'Final de Moscú 2018',            en: 'Moscow Final 2018',
    desc: 'Croacia \'18 · Francia \'18',
    a: { slug: 'kroatien',                   era: '2018' },
    b: { slug: 'frankreich',                 era: '2018' } },
  { label: 'Argentina en Nápoles \'90',      en: 'Argentina in Naples \'90',
    desc: 'Argentina \'90 · Italia \'90',
    a: { slug: 'argentinien',                era: '1990' },
    b: { slug: 'italien',                    era: '1990' } },
  { label: 'Golden Goal — Euro 96',          en: 'Golden Goal — Euro 96',
    desc: 'Chequia \'96 · Alemania \'96',
    a: { slug: 'tschechien',                 era: '1996' },
    b: { slug: 'deutschland',                era: '1996' } },
  { label: '¡España aplasta a Alemania!',    en: 'Spain crushes Germany! — Euro\'12 SF',
    desc: 'España \'12 · Alemania \'12',
    a: { slug: 'spanien',                    era: '2012' },
    b: { slug: 'deutschland',                era: '2012' } },
  { label: 'Portugal vs Francia — Semi \'06',en: 'Portugal vs France — \'06 WC Semi',
    desc: 'Portugal \'06 · Francia \'06',
    a: { slug: 'portugal',                   era: '2006' },
    b: { slug: 'frankreich',                 era: '2006' } },
  { label: 'Romario & Stoichkov — Semi \'94', en: 'Romario & Stoichkov — Semi \'94',
    desc: 'Brasil \'94 · Suecia \'94',
    a: { slug: 'brasilien',                  era: '1994' },
    b: { slug: 'schweden',                   era: '1994' } },
  { label: 'Dinamarca \'92 — La Sorpresa',   en: 'Denmark \'92 — The Surprise',
    desc: 'Dinamarca \'92 · Francia \'92',
    a: { slug: 'danemark',                   era: '1992' },
    b: { slug: 'frankreich',                 era: '1992' } },
  { label: 'El Choque de las Filosofías',    en: 'Clash of Philosophies',
    desc: 'Brasil \'70 · Holanda \'74',
    a: { slug: 'brasilien',                  era: '1970' },
    b: { slug: 'niederlande',                era: '1974' } },
];

async function rivalryMe() {
  if (!_catalogReady || !_catalog.length) { showToast(t('catalog-loading') || 'Cargando catálogo…'); return; }

  const match = HISTORIC_MATCHES[Math.floor(Math.random() * HISTORIC_MATCHES.length)];
  const entryA = _catalog.find(c => c.slug === match.a.slug);
  const entryB = _catalog.find(c => c.slug === match.b.slug);
  if (!entryA || !entryB) { showToast('⚡ ' + (t('btn-rivalry') || 'Rivals')); return; }

  // Set teams + eras
  document.getElementById('teamA').value = match.a.slug;
  document.getElementById('teamB').value = match.b.slug;
  _populateEraSelect(match.a.slug, 'A');
  _populateEraSelect(match.b.slug, 'B');
  const selA = document.getElementById('eraA');
  const selB = document.getElementById('eraB');
  if (selA && match.a.era) selA.value = match.a.era;
  if (selB && match.b.era) selB.value = match.b.era;
  _eraConfirmed.A = true;
  _eraConfirmed.B = true;
  _lookupCache.A = null;
  _lookupCache.B = null;
  _pickerState.A = { type: null, league: null }; _renderPicker('A');
  _pickerState.B = { type: null, league: null }; _renderPicker('B');
  _updateClashButton();

  // Show loading state on button
  const btn = document.getElementById('btn-rivalry');
  const iconEl = btn?.querySelector('.btn-rivalry-icon');
  const lblEl  = btn?.querySelector('.btn-rivalry-lbl');
  if (btn)    { btn.disabled = true; btn.classList.add('btn-rivalry--loading'); }
  if (iconEl) iconEl.textContent = '⏳';
  if (lblEl)  lblEl.textContent  = t('rivalry-loading') || 'Buscando…';

  const name = _lang === 'en' ? match.en : match.label;
  showToast(`🔥 ${name}…`);

  // Scroll to top of input panel so teams are visible while loading
  document.querySelector('.input-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Auto-download lineups for both teams concurrently
  try {
    await Promise.all([handleLookup('A'), handleLookup('B')]);
  } finally {
    if (btn)    { btn.disabled = false; btn.classList.remove('btn-rivalry--loading'); }
    if (iconEl) iconEl.textContent = '🔥';
    if (lblEl)  lblEl.textContent  = t('btn-rivalry') || 'Rivals';
  }

  _gx('rivalry_me', { rivalry: match.label });

  // Scroll VS button into view and flash a hint
  const vsLbl = document.getElementById('vs-clash-label');
  document.getElementById('vs-clash')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  showToast(`✅ ${match.desc} · ${t('rivalry-ready') || '¡Pulsa ▶ para simular!'}`);
}
function _deepLinkShare() {
  if (!_shareData) return;
  const base = ((window.GOLAZOX_CONFIG?.siteUrl) || location.origin).replace(/\/$/, '');
  const url = `${base}/?a=${encodeURIComponent(_shareData.teamA + ((_shareData.eraA) ? ':' + _shareData.eraA : ''))}&b=${encodeURIComponent(_shareData.teamB + ((_shareData.eraB) ? ':' + _shareData.eraB : ''))}&mode=${encodeURIComponent(_shareData.matchMode || '11v11')}`;
  try {
    navigator.clipboard.writeText(url).then(() => showToast('🔗 Enlace copiado al portapapeles'));
  } catch(_) { showToast(url); }
  _gx('share_deeplink', { team_a: _shareData.teamA, team_b: _shareData.teamB });
}
function _deepLinkRestore() {
  try {
    const p = new URLSearchParams(location.search);
    const a = p.get('a'), b = p.get('b'), mode = p.get('m') || p.get('mode');
    if (!a || !b) return;
    const [slugA, eraA = ''] = a.split(':');
    const [slugB, eraB = ''] = b.split(':');
    const restore = () => {
      document.getElementById('teamA').value = slugA;
      document.getElementById('teamB').value = slugB;
      _populateEraSelect(slugA, 'A');
      _populateEraSelect(slugB, 'B');
      if (eraA) { const s = document.getElementById('eraA'); if (s) s.value = eraA; }
      if (eraB) { const s = document.getElementById('eraB'); if (s) s.value = eraB; }
      _pickerState.A = { type: null, league: null }; _renderPicker('A');
      _pickerState.B = { type: null, league: null }; _renderPicker('B');
      if (mode) setMatchMode(mode);
      _updateClashButton();
    };
    // Wait for catalog to be ready
    if (_catalogReady) restore();
    else {
      const orig = _fetchCatalog;
      const _poll = setInterval(() => { if (_catalogReady) { clearInterval(_poll); restore(); } }, 200);
      setTimeout(() => clearInterval(_poll), 8000);
    }
    // Clean URL without reload
    history.replaceState({}, '', location.pathname);
  } catch(_) {}
}

function selectStadium(stadiumId) {
  _selectedStadium = STADIUMS.find(s => s.id === stadiumId) || null;
  // Update visual picker active state
  document.querySelectorAll('.spk-card').forEach(c => {
    c.classList.toggle('spk-active', c.dataset.id === (stadiumId || ''));
  });
}

function selectReferee(refereeId) {
  // If already selected, deselect (toggle off)
  if (_selectedReferee && _selectedReferee.id === refereeId) {
    _selectedReferee = null;
  } else {
    _selectedReferee = window._refereesData?.find(r => r.id === refereeId) || null;
  }
  document.querySelectorAll('.ref-card').forEach(c => {
    c.classList.toggle('ref-active', _selectedReferee && c.dataset.id === _selectedReferee.id);
  });
}

function selectWeather(weatherId) {
  if (_selectedWeather && _selectedWeather.id === weatherId) {
    _selectedWeather = null;
  } else {
    _selectedWeather = WEATHER.find(w => w.id === weatherId) || null;
  }
  document.querySelectorAll('.wth-card').forEach(c => {
    c.classList.toggle('wth-active', _selectedWeather && c.dataset.id === _selectedWeather.id);
  });
  // Drive weather atmosphere overlay via body data attribute
  if (_selectedWeather) {
    document.body.dataset.wx = _selectedWeather.id;
  } else {
    delete document.body.dataset.wx;
  }
}

// ── Autocomplete data: loaded once on startup ───────────────────
const _acList = [];  // [{name,badge}, ...]
fetch('/suggest').then(r => r.json()).then(list => _acList.push(...list)).catch(() => {});

// ── Season catalog: team → available years ───────────────────
let _catalog = [];  // [{slug, name, badge, seasons:["2006",...], group}, ...]
let _catalogReady = false;
function _fetchCatalog() {
  fetch('/catalog')
    .then(r => {
      if (!r.ok || !r.headers.get('content-type')?.includes('json'))
        throw new Error('not json');
      return r.json();
    })
    .then(d => {
      _catalog = Array.isArray(d) ? d : [];
      _catalogReady = true;
      _renderPicker('A');
      _renderPicker('B');
    })
    .catch(() => {
      _catalogReady = false;
      _renderPicker('A');
      _renderPicker('B');
    });
}
_fetchCatalog();

// ── Team Picker ───────────────────────────────────────────
const _pickerState = { A: { type: null, league: null }, B: { type: null, league: null } };

// Map slug → ISO 3166-1 alpha-2 for flagcdn.com images (no emoji, works on Windows)
const _NATION_ISO = {
  // Slugs alemán (originales)
  'argentinien':'ar',   'belgien':'be',       'brasilien':'br',    'bulgarien':'bg',
  'danemark':'dk',      'deutschland':'de',   'england':'gb-eng',  'frankreich':'fr',
  'griechenland':'gr',  'italien':'it',       'japan':'jp',        'kroatien':'hr',
  'marokko':'ma',       'niederlande':'nl',   'norwegen':'no',     'osterreich':'at',
  'polen':'pl',         'portugal':'pt',      'russland':'ru',     'schottland':'gb-sct',
  'schweden':'se',      'schweiz':'ch',       'senegal':'sn',      'spanien':'es',
  'tschechien':'cz',    'vereinigte-staaten':'us', 'china':'cn',
  'irak':'iq',          'jordanien':'jo',
  // Slugs alemán WC2026
  'albanien':'al',      'algerien':'dz',      'australien':'au',   'agypten':'eg',
  'bosnien-herzegowina':'ba', 'elfenbeinkuste':'ci','finnland':'fi',    'island':'is',
  'jamaika':'jm',       'kamerun':'cm',       'kanada':'ca',       'kap-verde':'cv',
  'kongo':'cd',
  'kolumbien':'co',     'mexiko':'mx',        'neuseeland':'nz',   'nordkorea':'kp',
  'nordirland':'gb-nir','saudi-arabien':'sa', 'serbien':'rs',      'slowakei':'sk',
  'slowenien':'si',     'sudafrika':'za',     'sudkorea':'kr',     'trinidad-und-tobago':'tt',
  'tunesien':'tn',      'turkei':'tr',        'ungarn':'hu',       'usbekistan':'uz',
  // Slugs alemán WC2026
  'marruecos':'ma',     'noruega':'no',       'rusia':'ru',        'japon':'jp',
  'corea':'kr',         'holanda':'nl',
  // Slugs inglés (WC2026 + nuevas descargas)
  'albania':'al',       'algeria':'dz',       'argentina':'ar',    'australia':'au',
  'austria':'at',       'bahrain':'bh',       'belgium':'be',      'bolivia':'bo',
  'bosnia':'ba',        'brazil':'br',        'bulgaria':'bg',     'cameroon':'cm',
  'canada':'ca',        'cape-verde':'cv',    'chile':'cl',        'colombia':'co',
  'costa-rica':'cr',    'croatia':'hr',       'czech-republic':'cz','denmark':'dk',
  'democratic-republic-of-congo':'cd',
  'ecuador':'ec',       'egypt':'eg',         'finland':'fi',      'france':'fr',
  'germany':'de',       'ghana':'gh',         'greece':'gr',       'haiti':'ht',         'honduras':'hn',
  'hungary':'hu',       'iceland':'is',       'iran':'ir',         'iraq':'iq',
  'ireland':'ie',       'ivory-coast':'ci',   'jordan':'jo',       'mali':'ml',
  'mexico':'mx',        'morocco':'ma',       'netherlands':'nl',  'new-zealand':'nz',
  'nigeria':'ng',       'north-korea':'kp',   'norway':'no',       'oman':'om',
  'panama':'pa',        'paraguay':'py',      'peru':'pe',         'poland':'pl',
  'republic-of-ireland':'ie', 'romania':'ro', 'russia':'ru',       'saudi-arabia':'sa',
  'scotland':'gb-sct',  'serbia':'rs',        'slovakia':'sk',     'slovenia':'si',
  'south-africa':'za',  'south-korea':'kr',   'spain':'es',        'sweden':'se',
  'switzerland':'ch',   'trinidad-and-tobago':'tt', 'tunisia':'tn', 'turkey':'tr',
  'ukraine':'ua',       'united-states':'us', 'uruguay':'uy',      'uzbekistan':'uz',
  'venezuela':'ve',     'wales':'gb-wls',
};
const _LEAGUE_META = {
  '🇪🇸 La Liga':           { name:'La Liga',          iso:'es'     , tier:1 },
  '🇪🇸 La Liga 2':         { name:'La Liga 2',        iso:'es'     , tier:2 },
  '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League':  { name:'Premier League',   iso:'gb-eng'  , tier:1 },
  '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship':   { name:'Championship',     iso:'gb-eng'  , tier:2 },
  '🇩🇪 Bundesliga':       { name:'Bundesliga',       iso:'de'     , tier:1 },
  '🇩🇪 2. Bundesliga':    { name:'2. Bundesliga',    iso:'de'     , tier:2 },
  '🇮🇹 Serie A':          { name:'Serie A',          iso:'it'     , tier:1 },
  '🇮🇹 Serie B':          { name:'Serie B',          iso:'it'     , tier:2 },
  '🇫🇷 Ligue 1':          { name:'Ligue 1',          iso:'fr'     , tier:1 },
  '🇫🇷 Ligue 2':          { name:'Ligue 2',          iso:'fr'     , tier:2 },
  '🇳🇱 Eredivisie':       { name:'Eredivisie',       iso:'nl'     , tier:1 },
  '🇵🇹 Liga Portugal':    { name:'Liga Portugal',    iso:'pt'     , tier:1 },
  '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Escocia':        { name:'Escocia',          nameEn:'Scotland',              iso:'gb-sct'  , tier:1 },
  '🇸🇦 Saudi Pro League': { name:'Saudi Pro League', iso:'sa'     , tier:1 },
  '🇺🇸 MLS':              { name:'MLS',              iso:'us'     , tier:1 },
  '🌎 América del Sur':    { name:'América del Sur',  nameEn:'South America',         iso:null, svg:'/img/badges/_south-america.svg' , tier:1 },
  '🌍 Otros':            { name:'Otros',            nameEn:'Other',                 iso:null, svg:'/img/badges/_globe.svg'         , tier:1 },
  '⭐ Fantasy XI':        { name:'Fantasy XI',       nameEn:'Fantasy XI',            iso:null, svg:'/img/badges/_best-xi-history.svg', tier:1 },
  '🌐 Continentes Históricos': { name:'Continentes Históricos', nameEn:'Historical Continents', iso:null, svg:'/img/badges/_europa-historica.svg', tier:1 },
};

function _pickerSelectType(side, type) {
  _pickerState[side] = { type, league: null };
  _renderPicker(side);
}
function _pickerSelectLeague(side, league) {
  _pickerState[side].league = league;
  _renderPicker(side);
}
// Returns the localized display name for a catalog entry
function _entryName(entry) {
  if (!entry) return '';
  return _lang === 'en'
    ? (entry.nameEn || entry.name)
    : (entry.nameEs || entry.name || entry.nameEn);
}
function _pickerSelectTeam(side, slugVal) {
  document.getElementById(`team${side}`).value = slugVal;
  _populateEraSelect(slugVal, side);
  _updateClashButton();
  _renderPicker(side);
  // Flash the team panel to confirm selection
  const col = document.getElementById(`col-${side.toLowerCase()}`);
  if (col) {
    col.classList.remove('col-flash');
    void col.offsetWidth; // force reflow to restart animation
    col.classList.add('col-flash');
    setTimeout(() => col.classList.remove('col-flash'), 650);
  }
}
function _pickerReset(side) {
  _pickerState[side] = { type: null, league: null };
  document.getElementById(`team${side}`).value = '';
  const era = document.getElementById(`era${side}`);
  if (era) { era.innerHTML = `<option value="">${t('era-pending')}</option>`; era.disabled = true; }
  _eraConfirmed[side] = false;
  _lookupCache[side] = null;
  _updateLookupBtn(side);
  _updateClashButton();
  _renderPicker(side);
}

function _initTeamPicker(side) {
  const container = document.getElementById(`picker-${side}`);
  if (!container || container._wired) return;
  container._wired = true;
  container.addEventListener('click', e => {
    const btn = e.target.closest('[data-pa]');
    if (!btn) return;
    const a = btn.dataset.pa, v = btn.dataset.pv || '';
    if      (a === 'type')   _pickerSelectType(side, v);
    else if (a === 'league') _pickerSelectLeague(side, v);
    else if (a === 'team')   _pickerSelectTeam(side, v);
    else if (a === 'reset')  _pickerReset(side);
    else if (a === 'back')   { _pickerState[side] = { type: _pickerState[side]?.type || 'club', league: null }; _renderPicker(side); }
    else if (a === 'backtype') { _pickerState[side] = { type: null, league: null }; _renderPicker(side); }
    else if (a === 'retry')  _fetchCatalog();
  });
  _renderPicker(side);
}

function _renderPicker(side) {
  const container = document.getElementById(`picker-${side}`);
  if (!container) return;
  const chosenName = document.getElementById(`team${side}`)?.value || '';
  const st = _pickerState[side];

  // ── Chosen ──────────────────────────────────────────────
  if (chosenName) {
    const entry = _catalog.find(c => c.slug === chosenName || c.name === chosenName);
    const badge = entry?.badge || BADGE_PLACEHOLDER;
    const meta  = _LEAGUE_META[entry?.group];
    const displayName = _entryName(entry) || chosenName;
    container.innerHTML =
      `<div class="tp-chosen">` +
      `<img class="tp-chosen-badge" src="${escHtml(badge)}" alt="" onerror="this.src='${BADGE_PLACEHOLDER}'">` +
      `<div class="tp-chosen-info">` +
        `<span class="tp-chosen-name">${escHtml(displayName)}</span>` +
        `<span class="tp-chosen-group">${escHtml(meta?.name || '')}</span>` +
      `</div>` +
      `<button class="tp-change-btn" data-pa="reset" title="${t('tp-change-title')}">&#10005;</button>` +
      `</div>`;
    return;
  }

  // ── Loading / error ──────────────────────────────────────
  if (!_catalogReady && !_catalog.length) {
    container.innerHTML =
      `<div class="tp-loading">` +
      `<span class="tp-loading-spinner"></span>` +
      `<span class="tp-loading-text">${t('tp-loading')}</span>` +
      `<button class="tp-retry-btn" data-pa="retry">${t('tp-retry')}</button>` +
      `</div>`;
    return;
  }

  // ── Type select ──────────────────────────────────────────
  if (!st.type) {
    container.innerHTML =
      `<div class="tp-type-row">` +
      `<button class="tp-type-btn" data-pa="type" data-pv="club">` +
      `<svg class="tp-type-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2h12M8 2v3a4 4 0 008 0V2M7 7H4a2 2 0 000 4h3m10-4h3a2 2 0 010 4h-3M9 21h6m-3-7v7M8 14a4 4 0 018 0"/></svg>` +
      `<span class="tp-type-label">${t('tp-clubs')}</span></button>` +
      `<button class="tp-type-btn" data-pa="type" data-pv="seleccion">` +
      `<svg class="tp-type-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>` +
      `<span class="tp-type-label">${t('tp-nations')}</span></button>` +
      `<button class="tp-type-btn" data-pa="type" data-pv="special">` +
      `<svg class="tp-type-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>` +
      `<span class="tp-type-label">${t('tp-special')}</span></button>` +
      `</div>`;
    return;
  }

  // ── Selecciones — flag image grid ──────────────────────────────
  if (st.type === 'seleccion') {
    const nations = _catalog.filter(c => c.group === '🌍 Selecciones');
    container.innerHTML =
      `<div class="tp-breadcrumb"><button class="tp-back-btn" data-pa="backtype">${t('tp-back')}</button><span class="tp-bread-label">${t('tp-nations-label')}</span></div>` +
      `<div class="tp-nations-grid">` +
      nations.map(n => {
        const iso = _NATION_ISO[n.slug.toLowerCase()];
        const flagHtml = iso
          ? `<img class="tp-flag-img" src="https://flagcdn.com/w40/${iso}.png" alt="" loading="lazy">`
          : `<span class="tp-flag-fallback">${escHtml(_entryName(n).slice(0,2).toUpperCase())}</span>`;
        return `<button class="tp-nation-card" data-pa="team" data-pv="${escHtml(n.slug)}">` +
          flagHtml +
          `<span class="tp-nation-name">${escHtml(_entryName(n))}</span>` +
          `</button>`;
      }).join('') +
      `</div>`;
    return;
  }

  // ── Special — Fantasy XI + Continentes Históricos ─────────────
  if (st.type === 'special') {
    if (!st.league) {
      const specGroups = [...new Set(
        _catalog.filter(c => c.group === '⭐ Fantasy XI' || c.group === '🌐 Continentes Históricos').map(c => c.group)
      )];
      container.innerHTML =
        `<div class="tp-breadcrumb"><button class="tp-back-btn" data-pa="backtype">${t('tp-back')}</button><span class="tp-bread-label">${t('tp-special-label')}</span></div>` +
        `<div class="tp-leagues-grid">` +
        specGroups.map(g => {
          const meta  = _LEAGUE_META[g] || { name: g.replace(/^\S+ /,''), tier: 1 };
          const count = _catalog.filter(c => c.group === g).length;
          const metaName = _lang === 'en' ? (meta.nameEn || meta.name) : meta.name;
          const flagInner = meta.svg
            ? `<img class="tp-league-flag tp-league-flag-svg" src="${meta.svg}" alt="" loading="lazy">`
            : `<span class="tp-league-flag-dot"></span>`;
          const flagHtml = `<span class="tp-flag-wrap">${flagInner}</span>`;
          return `<button class="tp-league-btn" data-pa="league" data-pv="${escHtml(g)}">` +
            flagHtml +
            `<span class="tp-lg-name">${escHtml(metaName)}</span>` +
            `<span class="tp-lg-count">${count}</span></button>`;
        }).join('') +
        `</div>`;
      return;
    }
    const spTeams = _catalog.filter(c => c.group === st.league);
    const spMeta  = _LEAGUE_META[st.league] || { name: st.league.replace(/^\S+ /,'') };
    const spName  = _lang === 'en' ? (spMeta.nameEn || spMeta.name) : spMeta.name;
    container.innerHTML =
      `<div class="tp-breadcrumb"><button class="tp-back-btn" data-pa="back">‹ ${escHtml(spName)}</button></div>` +
      `<div class="tp-teams-grid">` +
      spTeams.map(t =>
        `<button class="tp-team-card" data-pa="team" data-pv="${escHtml(t.slug)}">` +
        `<img class="tp-team-badge" src="${escHtml(t.badge || BADGE_PLACEHOLDER)}" alt="" loading="lazy" onerror="this.src='${BADGE_PLACEHOLDER}'" >` +
        `<span class="tp-team-name">${escHtml(_entryName(t))}</span>` +
        `</button>`
      ).join('') +
      `</div>`;
    return;
  }

  // ── Clubs — league list ──────────────────────────────────
  if (!st.league) {
    const leagues = [...new Set(
      _catalog.filter(c => c.group !== '🌍 Selecciones' && c.group !== '⭐ Fantasy XI' && c.group !== '🌐 Continentes Históricos').map(c => c.group || '🌍 Otros')
    )];
    container.innerHTML =
      `<div class="tp-breadcrumb"><button class="tp-back-btn" data-pa="backtype">${t('tp-back')}</button><span class="tp-bread-label">${t('tp-leagues-label')}</span></div>` +
      `<div class="tp-leagues-grid">` +
      leagues.map(g => {
        const meta  = _LEAGUE_META[g] || { name: g.replace(/^\S+ /,''), iso: null, tier: 1 };
        const count = _catalog.filter(c => c.group === g).length;
        const flagInner = meta.iso
          ? `<img class="tp-league-flag" src="https://flagcdn.com/w40/${meta.iso}.png" alt="" loading="lazy">`
          : meta.svg
            ? `<img class="tp-league-flag tp-league-flag-svg" src="${meta.svg}" alt="" loading="lazy">`
            : `<span class="tp-league-flag-dot"></span>`;
        const flagHtml = `<span class="tp-flag-wrap${meta.tier === 2 ? ' tp-flag-t2' : ''}">${flagInner}</span>`;
        return `<button class="tp-league-btn${meta.tier === 2 ? ' tp-league-tier2' : ''}" data-pa="league" data-pv="${escHtml(g)}">` +
          flagHtml +
          `<span class="tp-lg-name">${escHtml(_lang === 'en' ? (meta.nameEn || meta.name) : meta.name)}</span>` +
          `<span class="tp-lg-count">${count}</span></button>`;
      }).join('') +
      `</div>`;
    return;
  }

  // ── Clubs — team badge grid ────────────────────────────────
  const teams = _catalog.filter(c => c.group === st.league);
  const lgMeta = _LEAGUE_META[st.league] || { name: st.league.replace(/^\S+ /,'') };
  const lgName  = _lang === 'en' ? (lgMeta.nameEn || lgMeta.name) : lgMeta.name;
  container.innerHTML =
    `<div class="tp-breadcrumb"><button class="tp-back-btn" data-pa="back">‹ ${escHtml(lgName)}</button></div>` +
    `<div class="tp-teams-grid">` +
    teams.map(t =>
      `<button class="tp-team-card" data-pa="team" data-pv="${escHtml(t.slug)}">` +
      `<img class="tp-team-badge" src="${escHtml(t.badge || BADGE_PLACEHOLDER)}" alt="" loading="lazy" onerror="this.src='${BADGE_PLACEHOLDER}'">` +
      `<span class="tp-team-name">${escHtml(_entryName(t))}</span>` +
      `</button>`
    ).join('') +
    `</div>`;
}

/** Populate the era <select> for the given team name from the catalog. */
function _updateLookupBtn(side) {
  const btn  = document.getElementById(`lookup${side}`);
  if (!btn) return;
  const team = (document.getElementById(`team${side}`)?.value || '').trim();
  const era  = document.getElementById(`era${side}`);
  const hasEra = era && !era.disabled && era.value !== '';
  btn.disabled = !(team && hasEra);
}

function _populateEraSelect(teamName, side) {
  const sel = document.getElementById(`era${side}`);
  if (!sel) return;
  const q = teamName.trim().toLowerCase();
  const entry = _catalog.find(c =>
    c.slug.toLowerCase() === q ||
    c.name.toLowerCase() === q ||
    (c.nameEn || '').toLowerCase() === q ||
    (c.nameEs || '').toLowerCase() === q
  );
  // Reset confirmation — user must re-confirm after changing teams
  _eraConfirmed[side] = false;
  if (entry && entry.seasons.length) {
    const prev = sel.value;
    sel.innerHTML =
      `<option value="">${t('era-any')}</option>` +
      entry.seasons.map(y =>
        `<option value="${y}"${y === prev ? ' selected' : ''}>${y === 'all-time' ? '★ All Time' : y}</option>`
      ).join('');
    sel.disabled = false;
  } else {
    // No local seasons → era is not applicable; treat as auto-confirmed
    _eraConfirmed[side] = true;
    sel.innerHTML = `<option value="">${t('era-no-seasons')}</option>`;
    sel.disabled = true;
  }
  _updateLookupBtn(side);
  sel.onchange = () => {
    _eraConfirmed[side] = true;
    _updateLookupBtn(side);
    _updateClashButton();
  };
}

const BADGE_PLACEHOLDER = '/img/badges/_placeholder.svg';
function badgeOrPlaceholder(url) { return url || BADGE_PLACEHOLDER; }

// ── Bootstrap ────────────────────────────────────────────
window._refereesData = [];
document.addEventListener('DOMContentLoaded', () => {
  // Apply saved language preference
  applyI18n();

  // Logo is served directly as golazox-logo.png from public/

  // Populate formation dropdowns (11v11 default)
  ['formationA', 'formationB'].forEach(id => {
    const sel = document.getElementById(id);
    FORMATIONS.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f; opt.textContent = f;
      sel.appendChild(opt);
    });
  });

  // Build stadium visual picker
  const pickerRow = document.getElementById('stadium-picker-row');
  if (pickerRow) {
    // "Neutro" tile first
    const neutroCard = document.createElement('div');
    neutroCard.className = 'spk-card spk-active';
    neutroCard.dataset.id = '';
    neutroCard.innerHTML = `<div class="spk-img-placeholder">🏟️</div><div class="spk-name">${t('stadium-neutro')}</div>`;
    neutroCard.onclick = () => selectStadium('');
    pickerRow.appendChild(neutroCard);

    STADIUMS.forEach(s => {
      const card = document.createElement('div');
      card.className = 'spk-card';
      card.dataset.id = s.id;
      card.innerHTML =
        `<img class="spk-img" src="${escHtml(s.img)}" alt="${escHtml(s.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>` +
        `<div class="spk-img-placeholder" style="display:none">🏟️</div>` +
        `<div class="spk-name">${escHtml(s.name)}</div>` +
        `<div class="spk-city">${escHtml(s.city)}</div>`;
      card.onclick = () => selectStadium(s.id);
      pickerRow.appendChild(card);
    });
  }

  // Allow Enter key to trigger simulation from the era selects
  ['eraA','eraB'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') handleSimulate(); });
  });
  // Render match history and restore URL deep-link if present
  _histRender();
  _deepLinkRestore();
  // Sync haptic button state
  const _hBtn = document.getElementById('btn-haptic');
  if (_hBtn) _hBtn.classList.toggle('btn-haptic--on', _HFX.isOn());

  // 
  // Init team pickers (catalog fills them when it arrives)
  _initTeamPicker('A');
  _initTeamPicker('B');

  // Build weather picker
  _buildWeatherPicker();

  // Load referees (dentro de DOMContentLoaded — DOM garantizado listo)
  fetch('/referees').then(r => r.json()).then(list => {
    window._refereesData = list;
    _buildRefereePicker(list);
  }).catch(() => {});

  // ── Static event listeners (replaces inline onclick= in index.html) ──────
  const _on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };

  // Header & main tabs
  _on('lang-toggle', () => setLang(_lang === 'es' ? 'en' : 'es'));
  document.querySelector('.main-tabs-bar')?.addEventListener('click', e => {
    const btn = e.target.closest('.main-tab-btn');
    if (btn) TRN.switchMainTab(btn.dataset.tab);
  });

  // Match input
  _on('lookupA', () => handleLookup('A'));
  _on('lookupB', () => handleLookup('B'));
  document.querySelector('.mode-pills')?.addEventListener('click', e => {
    const pill = e.target.closest('.mode-pill');
    if (pill) setMatchMode(pill.dataset.mode);
  });
  _on('btn-surprise', () => surpriseMe());
  _on('btn-rivalry',  () => rivalryMe());
  _on('btn-haptic',   () => toggleHaptic());

  // Match history clear
  _on('mh-clear-btn', e => { e.preventDefault(); clearMatchHistory(); });
  // Match history replay (delegation)
  document.getElementById('match-history-list')?.addEventListener('click', e => {
    const row = e.target.closest('.mh-row');
    if (row) histReplay(+row.dataset.histIdx);
  });

  // Pre-match speed pills (delegation)
  document.getElementById('pm-speed-pills')?.addEventListener('click', e => {
    const pill = e.target.closest('.pm-speed-pill');
    if (pill) selectSpeed(pill);
  });
  _on('pm-start-btn',      () => skipPreMatch());
  _on('btn-skip',          () => skipLive());
  _on('stats-modal-close', () => toggleStatsModal());

  // Match result
  _on('btn-share',    () => shareResult());
  _on('btn-deeplink', () => _deepLinkShare());

  // Match analysis heatmap tabs (delegation on persistent container)
  document.getElementById('match-analysis-card')?.addEventListener('click', e => {
    const tab = e.target.closest('.ma-hm-tab');
    if (tab) _switchHmTab(tab.dataset.team, tab);
  });

  // Tournament format cards
  document.querySelector('.trn-fmt-grid')?.addEventListener('click', e => {
    const card = e.target.closest('.trn-fmt-card');
    if (card) TRN.selectFormat(card.dataset.fmt);
  });

  // Tournament wizard nav
  _on('trn-next-1',       () => TRN.goStep2());
  _on('trn-back-1',       () => TRN.goBack(1));
  _on('trn-next-2',       () => TRN.goStep3());
  _on('trn-back-2',       () => TRN.goBack(2));
  _on('trn-search-clear', () => TRN.clearSearch());
  _on('trn-btn-liga',     () => TRN.openLeagueLoader());
  _on('trn-btn-random',   () => TRN.fillRandom());
  _on('trn-btn-simulate', () => TRN.runSimulation());

  // Tournament search input events
  document.getElementById('trn-search-input')?.addEventListener('input',   e => TRN.onTeamSearch(e.target.value));
  document.getElementById('trn-search-input')?.addEventListener('keydown', e => TRN.onSearchKeydown(e));

  // Tournament dashboard
  _on('trn-share-btn', () => TRN.shareTournament());
  _on('trn-btn-over',  () => TRN.startOver());
  document.querySelector('.trn-dash-tabs')?.addEventListener('click', e => {
    const tab = e.target.closest('.trn-dash-tab');
    if (tab) TRN.switchDashTab(tab.dataset.tab);
  });

  // Tournament match modal
  _on('trn-match-modal', e => { if (e.target === document.getElementById('trn-match-modal')) TRN.closeMatchModal(); });
  _on('trn-modal-close', () => TRN.closeMatchModal());
  _on('trn-modal-prev',  () => TRN.prevMatch());
  _on('trn-modal-next',  () => TRN.nextMatch());
});

// ── Referee picker builder (called after /referees load) ─────────
function _buildRefereePicker(referees) {
  const row = document.getElementById('referee-picker-row');
  if (!row) return;
  row.innerHTML = '';
  // "Random / None" option
  const noneCard = document.createElement('div');
  noneCard.className = 'ref-card ref-active';
  noneCard.dataset.id = '';
  noneCard.innerHTML =
    `<div class="ref-photo-area"><div class="ref-initials-av" style="background:linear-gradient(135deg,#444,#888)">?</div></div>` +
    `<div class="ref-name">${t('ref-random')}</div>`;
  noneCard.onclick = () => selectReferee('');
  row.appendChild(noneCard);

  referees.filter(r => r.id !== 'neutral').forEach(ref => {
    const card = document.createElement('div');
    card.className = 'ref-card';
    card.dataset.id = ref.id;
    const tip = `📋 ${ref.strictness.toFixed(2)} · 🟥 ${ref.red_card_bias.toFixed(2)} · 🥊 ${ref.penalty_rate.toFixed(2)}`;
    card.title = tip;
    const ini  = _initials(ref.name);
    const grad = _avatarColor(ref.id);
    if (ref.img) {
      const imgSrc = _refImgProxy(ref.img);
      card.innerHTML =
        `<div class="ref-photo-area">` +
          `<img class="ref-photo" src="${escHtml(imgSrc)}" alt="${escHtml(ref.name)}" loading="lazy"` +
          ` onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` +
          `<div class="ref-initials-av" style="display:none;background:${grad}">${ini}</div>` +
        `</div>` +
        `<div class="ref-name">${escHtml(ref.name)}</div>` +
        `<div class="ref-stats">${tip}</div>`;
    } else {
      card.innerHTML =
        `<div class="ref-photo-area"><div class="ref-initials-av" style="background:${grad}">${ini}</div></div>` +
        `<div class="ref-name">${escHtml(ref.name)}</div>` +
        `<div class="ref-stats">${tip}</div>`;
    }
    card.onclick = () => selectReferee(ref.id);
    row.appendChild(card);
  });
}

// ── Weather picker builder ───────────────────────────────────────
function _buildWeatherPicker() {
  const row = document.getElementById('weather-picker-row');
  if (!row) return;
  row.innerHTML = '';
  WEATHER.forEach(w => {
    const card = document.createElement('div');
    card.className = 'wth-card';
    card.dataset.id = w.id;
    const label = _lang === 'en' ? w.labelEn : w.labelEs;
    const icon = _WEATHER_SVG[w.id] || '';
    card.innerHTML = `<div class="wth-icon">${icon}</div><div class="wth-label">${escHtml(label)}</div>`;
    card.onclick = () => selectWeather(w.id);
    row.appendChild(card);
  });
}

// ── Lookup cache: stores last API result per side (A / B) ────
const _lookupCache = { A: null, B: null };
// Tracks whether the user has explicitly confirmed an era for each side
// (either by selecting a specific year, selecting "any era", or by the
// dropdown being disabled because the team has no local seasons).
const _eraConfirmed = { A: false, B: false };

// Converts a CSS hex colour (#rrggbb) to rgba(r,g,b,a)
function hexToRgba(hex, alpha) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Updates the VS badge: plain "VS" → "▶ JUGAR" when both teams chosen → "▶ SIMULAR" when both lineups loaded
function _updateClashButton() {
  const btn = document.getElementById('vs-clash');
  if (!btn) return;
  const lbl = document.getElementById('vs-clash-label');
  const aData = _lookupCache['A'], bData = _lookupCache['B'];
  const teamA = (document.getElementById('teamA')?.value || '').trim();
  const teamB = (document.getElementById('teamB')?.value || '').trim();

  if (aData && bData) {
    // Full ready — both lineups loaded
    const colA = hexToRgba(_getKitColor(aData.teamLabel || teamA, 'a'), .72);
    const colB = hexToRgba(_getKitColor(bData.teamLabel || teamB, 'b'), .72);
    btn.style.setProperty('--clash-a', colA);
    btn.style.setProperty('--clash-b', colB);
    btn.classList.remove('vs-teams-ready');
    btn.classList.add('vs-ready');
    btn.innerHTML = `
      <div class="clash-logo-wrap">
        <img class="clash-logo-img" src="/golazox-coin.png?v=2" alt="GolazOX" draggable="false" />
      </div>`;
    if (lbl) { lbl.textContent = t('vs-simulate'); lbl.classList.add('visible'); lbl.onclick = handleSimulate; lbl.style.cursor = 'pointer'; }
    btn.onclick = handleSimulate;
  } else {
    // Default — lineups not ready yet
    btn.classList.remove('vs-ready', 'vs-teams-ready');
    btn.style.removeProperty('--clash-a');
    btn.style.removeProperty('--clash-b');
    btn.innerHTML = '<span>VS</span>';
    if (lbl) { lbl.textContent = ''; lbl.classList.remove('visible'); lbl.onclick = null; lbl.style.cursor = ''; }
    btn.onclick = null;
  }
}

// Picks players by role for a given match mode (prevents 5v5 showing 4 defenders)
function _pickForMode(players, mode) {
  const POS_SORT = { GK:0, RB:1, CB:1, LB:1, DM:2, CM:3, RM:3, LM:3, AM:3.5, RW:4, LW:4, ST:4 };
  const sorted   = [...players].sort((a,b) => (POS_SORT[a.position]??3) - (POS_SORT[b.position]??3));
  if (mode === '11v11' || mode === 'penalties') return sorted.slice(0, 11);

  // Build pool grouped by position
  const byPos = {};
  sorted.forEach(p => { (byPos[p.position] = byPos[p.position] || []).push(p); });
  const pick = (...roles) => { for (const r of roles) if (byPos[r]?.length) return byPos[r].shift(); return null; };

  let result;
  if (mode === '3v3') {
    result = [
      pick('GK'),
      pick('CM','DM','AM','RM','LM','CB','RB','LB'),
      pick('ST','RW','LW','AM','CM'),
    ];
  } else /* 5v5 */ {
    result = [
      pick('GK'),
      pick('CB','RB','LB'),
      pick('DM','CM'),
      pick('AM','CM','RM','LM'),
      pick('ST','RW','LW'),
    ];
  }
  // Deduplicate and fill any nulls from remaining sorted players
  const used = new Set(result.filter(Boolean));
  for (const p of sorted) {
    if (result.length >= (mode === '3v3' ? 3 : 5)) break;
    if (!used.has(p)) { result.push(p); used.add(p); }
  }
  return result.filter(Boolean).slice(0, mode === '3v3' ? 3 : 5);
}

// Renders the jersey-card grid inside a lookup preview panel.
// Re-used both from handleLookup and from setMatchMode (mode switch).
function _renderLookupPlayers(side, data) {
  const picked = _pickForMode(data.players, _matchMode);
  const kitCol  = _getKitColor(data.teamLabel || document.getElementById(`team${side}`)?.value, side.toLowerCase());
  const el      = document.getElementById(`preview-players-${side}`);
  if (!el) return;
  const teamRxgs = data.ratings || { attack: 72, midfield: 72, defense: 72, goalkeeping: 72 };
  // Assign unique sequential numbers: avoid duplicates by bumping when colliding
  const usedNums = new Set();
  const header = '<div class="lk-header"><span class="lk-h-kit">Kit</span><span class="lk-h-ovr">Media</span><span class="lk-h-num">Dorsal</span><span class="lk-h-name">Nombre</span><span class="lk-h-pos">Pos</span></div>';
  el.innerHTML = header + picked.map((p, i) => {
    let num = _JERSEY_NUM[p.position] ?? (i + 1);
    while (usedNums.has(num)) num++;
    usedNums.add(num);
    // Show last word of name, but if it’s just initials/short, also use second-to-last
    const parts = p.name.trim().split(/\s+/);
    const last  = parts[parts.length - 1];
    const short = (last.length <= 3 && parts.length > 1)
      ? (parts[parts.length - 2] + ' ' + last).toUpperCase()
      : last.toUpperCase();
    const desc  = POS_DESCRIPTIONS[p.position] || p.position;
    const ovr   = calcPlayerRating(p, teamRxgs);
    const tier  = ovr >= 90 ? 'elite' : ovr >= 82 ? 'gold' : ovr >= 72 ? 'silver' : 'bronze';
    return [
      '<div class="lk-jcard lk-jcard-' + tier + '" title="' + escHtml(p.name) + ' — ' + escHtml(desc) + '">',
      '<span class="lk-jkit" style="background:' + kitCol + '"></span>',
      '<span class="lk-jovr">' + ovr + '</span>',
      '<span class="lk-jnum">#' + num + '</span>',
      '<span class="lk-jname">' + escHtml(short) + '</span>',
      '<span class="lk-jpos">' + escHtml(p.position) + '</span>',
      '</div>',
    ].join('');
  }).join('');
}

// ── Lookup handler — called by 🔍 buttons ─────────────────
async function handleLookup(side) {
  const teamInput = document.getElementById(`team${side}`).value.trim();
  const eraInput  = document.getElementById(`era${side}`).value.trim();
  const btn       = document.getElementById(`lookup${side}`);
  const preview   = document.getElementById(`preview-${side}`);

  if (!teamInput) {
    preview.classList.add('hidden');
    return;
  }

  btn.disabled    = true;
  btn.textContent = t('lookup-searching');

  try {
    const params = new URLSearchParams({ team: teamInput });
    if (eraInput) params.set('era', eraInput);

    // 30s timeout — external scrapers can be slow for historic teams
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 30000);
    let res;
    try {
      res = await fetch(`/lookup?${params}`, { signal: ctrl.signal });
    } finally {
      clearTimeout(tid);
    }

    if (!res.ok) throw new Error(`Servidor: HTTP ${res.status}`);
    const data = await res.json();

    if (!data.found) {
      document.getElementById(`preview-source-${side}`).textContent =
        `${t('fail-lookup')}: "${teamInput}"${eraInput ? ' · ' + eraInput : ''}`;
      document.getElementById(`preview-players-${side}`).innerHTML =
        `<div class="lk-hint">${t('hint-lookup')}</div>`;
      _lookupCache[side] = null;
      document.getElementById(`col-${side.toLowerCase()}`)?.classList.remove('tc-loaded');
      _updateClashButton();
    } else {
      _lookupCache[side] = data;

      document.getElementById(`preview-source-${side}`).textContent =
        `✅ ${_displayLabel(data)}`;

      _renderLookupPlayers(side, data);

      // Auto-fill formation if found
      const formSel = document.getElementById(`formation${side}`);
      if (data.formation && formSel) {
        const opt = [...formSel.options].find(o => o.value === data.formation);
        if (opt) formSel.value = data.formation;
      }

      // Premium UI: inject kit colour glow into team column + update clash button
      const colEl = document.getElementById(`col-${side.toLowerCase()}`);
      if (colEl) {
        const kitHex = _getKitColor(data.teamLabel || teamInput, side.toLowerCase());
        colEl.style.setProperty('--team-glow', hexToRgba(kitHex, .7));
        colEl.classList.add('tc-loaded');
      }
      _updateClashButton();
    }

    preview.classList.remove('hidden');

  } catch (err) {
    const msg = err.name === 'AbortError'
      ? t('timeout-lookup')
      : err.message === 'Failed to fetch'
        ? t('no-connection')
        : `Error: ${err.message}`;
    document.getElementById(`preview-source-${side}`).textContent = `⚠️ ${msg}`;
    document.getElementById(`preview-players-${side}`).innerHTML = '';
    preview.classList.remove('hidden');
    _lookupCache[side] = null;
    document.getElementById(`col-${side.toLowerCase()}`)?.classList.remove('tc-loaded');
    _updateClashButton();
  } finally {
    btn.disabled    = false;
    btn.textContent = t('lookup-btn');
  }
}

// ── Main handler — called by the "Simulate Match" button ──
async function handleSimulate() {
  // Coin collapse animation before transitioning
  const vsBtn = document.getElementById('vs-clash');
  if (vsBtn?.classList.contains('vs-ready')) {
    vsBtn.classList.add('coin-collapsing');
    await new Promise(r => setTimeout(r, 420));
  }

  // Brief weather burst effect at simulation start
  if (_selectedWeather) {
    document.body.classList.add('wx-burst');
    setTimeout(() => document.body.classList.remove('wx-burst'), 2800);
  }

  // Resolve slug → localized display name for the match UI
  const slugA = document.getElementById('teamA').value.trim();
  const slugB = document.getElementById('teamB').value.trim();
  const entryA = _catalog.find(c => c.slug === slugA || c.name === slugA);
  const entryB = _catalog.find(c => c.slug === slugB || c.name === slugB);
  const teamA = _entryName(entryA) || slugA;
  const teamB = _entryName(entryB) || slugB;

  // Basic validation
  if (!teamA || !teamB) {
    showError(t('error-no-teams'));
    return;
  }
  if (teamA.length > 80 || teamB.length > 80) {
    showError(t('error-too-long'));
    return;
  }

  clearError();
  _gx('simulate_match_start', { team_a: teamA, team_b: teamB, mode: _matchMode });
  ['prematch-screen', 'live-viewer', 'event-overlay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('hidden');
      el.classList.remove('pm-fade-out', 'live-fade-out', 'eo-fade-in', 'eo-fade-out');
    }
  });
  document.getElementById('results')?.classList.add('hidden');
  _timelineStarted = false;
  // Clear key moments and MOTM from previous match
  const _kmEl = document.getElementById('key-moments');
  if (_kmEl) { _kmEl.innerHTML = ''; _kmEl.style.display = 'none'; }
  const _momName = document.getElementById('mom-name');
  const _momMeta = document.getElementById('mom-meta');
  if (_momName) _momName.textContent = '-';
  if (_momMeta) _momMeta.textContent = '-';
  if (_liveTimer)           { clearTimeout(_liveTimer);            _liveTimer = null; }
  if (_liveClockInterval)   { clearInterval(_liveClockInterval);   _liveClockInterval = null; }
  if (_pitchDriftInterval)  { clearInterval(_pitchDriftInterval);  _pitchDriftInterval = null; }

  setLoading(true);

  const payload = {
    teamA,
    teamB,
    eraA:       document.getElementById('eraA').value.trim(),
    eraB:       document.getElementById('eraB').value.trim(),
    formationA: document.getElementById('formationA').value || _lookupCache['A']?.formation || '',
    formationB: document.getElementById('formationB').value || _lookupCache['B']?.formation || '',
    matchMode:  _matchMode,
    stadium:    _selectedStadium ? _selectedStadium.id : null,
    refereeId:  _selectedReferee ? _selectedReferee.id : null,
    isFinal:    false,
    weatherId:  _selectedWeather ? _selectedWeather.id : null,
    matchSalt:  Date.now() & 0x7fffffff,
    lang:       _lang,
  };

  try {
    // ── POST /simulate ──────────────────────────────────
    const response = await fetch('/simulate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      // 404 = team not found: show the server message directly (no "Error en la simulación:" prefix)
      if (response.status === 404) throw new Error(err.error || t('fail-lookup'));
      if (response.status === 429) throw new Error(t('error-rate-limit') || 'Demasiadas simulaciones. Espera un momento.');
      throw new Error(err.error || `${t('sim-error-prefix')} ${response.status}`);
    }

    const data = await response.json();
    _gx('simulate_match_success', { team_a: teamA, team_b: teamB, mode: _matchMode });
    // Save to match history
    _histSave(payload, data);
    // Track sim count for unlock system
    try { const n = (parseInt(localStorage.getItem('gx_sim_count')||'0')||0)+1; localStorage.setItem('gx_sim_count', n); if (n >= 5) localStorage.setItem('gx_unlocked','1'); } catch(_) {}
    showPreMatch(data, payload);

  } catch (err) {
    // 404 messages come pre-formatted from the server (team not found)
    const isNotFound = err.message.includes('no encontrado') || err.message.includes('not found') || err.message.includes('No encontrado') || err.message.includes('Not found');
    showError(isNotFound ? err.message : `${t('sim-error-prefix')} ${err.message}`);
  } finally {
    setLoading(false);
    // Restore the coin button (remove collapse animation so it reappears)
    const _vsBtn = document.getElementById('vs-clash');
    if (_vsBtn) _vsBtn.classList.remove('coin-collapsing');
    document.body.classList.remove('wx-burst');
  }
}

// ── Render all result sections ────────────────────────────
function renderResult(data, payload) {
  const { lineups, ratings, probabilities, finalScore, altScores, simulation } = data;

  // Show results section with animation
  const section = document.getElementById('results');
  section.classList.remove('hidden');
  section.classList.add('fade-in');
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // ── Show/hide cards that don't apply to a pure penalties contest ──
  const isPenMode = payload.matchMode === 'penalties';
  document.querySelector('.probs-card')?.classList.toggle('hidden', isPenMode);
  document.querySelector('.stats-card')?.classList.toggle('hidden', isPenMode);

  // Draw radar into stats-modal (accessible via Stats button; not shown in results section)
  if (!isPenMode && ratings) drawRadar(ratings, payload.teamA, payload.teamB);

  // ── Score poster ───────────────────────────────────────
  document.getElementById('poster-name-a').textContent = payload.teamA;
  document.getElementById('poster-era-a').textContent  = payload.eraA || '';
  document.getElementById('poster-name-b').textContent = payload.teamB;
  document.getElementById('poster-era-b').textContent  = payload.eraB || '';
  animateScore(
    0, isPenMode ? (finalScore.penalties?.scoreA ?? 0) : finalScore.teamA,
    0, isPenMode ? (finalScore.penalties?.scoreB ?? 0) : finalScore.teamB
  );

  // ── Escudos ──────────────────────────────────────────────
  const setBadge = (id, url) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (url) { el.src = url; el.style.display = 'block'; el.classList.add('badge-loaded'); }
    else      { el.style.display = 'none'; }
  };
  setBadge('badge-a', data.badgeA || _badgeFallback(payload.teamA));
  setBadge('badge-b', data.badgeB || _badgeFallback(payload.teamB));

  // Scorers (with goal minute) — premium style
  const scorersAEl = document.getElementById('scorers-a');
  const scorersBEl = document.getElementById('scorers-b');
  const fmtGoal = g => `<div class="scorer-entry"><span class="scorer-ball">\u26bd</span><span class="scorer-name">${escHtml(g.name)}</span><span class="goal-min">${g.minute}'</span></div>`;
  scorersAEl.innerHTML = finalScore.scorersA.length
    ? finalScore.scorersA.map(fmtGoal).join('')
    : '<div class="scorer-empty">\u2014</div>';
  scorersBEl.innerHTML = finalScore.scorersB.length
    ? finalScore.scorersB.map(fmtGoal).join('')
    : '<div class="scorer-empty">\u2014</div>';

  // ── Tarjetas ───────────────────────────────────────────────────────
  const renderCards = (el, cards) => {
    if (!el) return;
    const yellows = (cards?.yellow || []).map(c => `<div class="card-entry">🟨 ${escHtml(c.name)} <span class="card-min">${c.minute}'</span></div>`).join('');
    const reds    = (cards?.red    || []).map(c => `<div class="card-entry">🟥 ${escHtml(c.name)} <span class="card-min">${c.minute}'</span></div>`).join('');
    el.innerHTML  = (yellows + reds) || '<span style="opacity:.3">—</span>';
  };
  renderCards(document.getElementById('cards-a'), finalScore.cardsA);
  renderCards(document.getElementById('cards-b'), finalScore.cardsB);
  if (!_timelineStarted) {
    if (Array.isArray(data.timeline) && data.timeline.length) {
      // Instantly populate and reveal the full timeline for post-match display
      animateTimeline(data.timeline, payload.teamA, payload.teamB, 0);
      flushTimeline();
    } else {
      // Fallback: build from finalScore fields when engine timeline is absent
      renderTimeline(finalScore.scorersA, finalScore.scorersB, finalScore.cardsA, finalScore.cardsB, payload.teamA, payload.teamB, finalScore.matchPenalties, data.stats?.notableEvents);
    }
  }

  // ── Penaltis (sólo si hubo empate o modo penalties puro)
  document.getElementById('poster-label').textContent =
    payload.matchMode === 'penalties' ? t('poster-label-pen-mode') :
    t(finalScore.penalties ? 'poster-label-pens' : 'poster-label-final');
  const stadiumCtxEl = document.getElementById('poster-context');
  if (stadiumCtxEl) {
    const stadiumTxt  = _selectedStadium ? `🏟️ ${_selectedStadium.name} · ${_selectedStadium.city}` : t('poster-context');
    const refName     = data.referee?.name;
    const weatherTxt  = _selectedWeather ? `${_selectedWeather.emoji} ${_lang === 'en' ? _selectedWeather.labelEn : _selectedWeather.labelEs}` : '';
    stadiumCtxEl.textContent = [stadiumTxt, refName ? `🟥 ${refName}` : '', weatherTxt].filter(Boolean).join(' · ');
  }
  renderPenalties(finalScore.penalties, payload.teamA, payload.teamB);
  renderKeyMoments(finalScore, data, payload);

  // ── Resultado: destacar ganador ───────────────────────────────────
  const posterA = document.getElementById('poster-team-a');
  const posterB = document.getElementById('poster-team-b');
  posterA.classList.remove('poster-winner', 'poster-loser');
  posterB.classList.remove('poster-winner', 'poster-loser');
  if (finalScore.teamA > finalScore.teamB) {
    posterA.classList.add('poster-winner');
    posterB.classList.add('poster-loser');
  } else if (finalScore.teamB > finalScore.teamA) {
    posterB.classList.add('poster-winner');
    posterA.classList.add('poster-loser');
  }

  // ── Probabilidades ──────────────────────────────────────────────
  document.getElementById('prob-label-a').textContent = `${payload.teamA} ${t('prob-win-suffix')}`;
  document.getElementById('prob-label-b').textContent = `${payload.teamB} ${t('prob-win-suffix')}`;

  const pA = probabilities.teamA_win;
  const pD = probabilities.draw;
  const pB = probabilities.teamB_win;
  document.getElementById('prob-a').textContent    = `${pA}%`;
  document.getElementById('prob-draw').textContent = `${pD}%`;
  document.getElementById('prob-b').textContent    = `${pB}%`;

  // Animate bars (rAF ensures CSS transitions fire)
  requestAnimationFrame(() => {
    document.getElementById('bar-a').style.width = `${pA}%`;
    document.getElementById('bar-d').style.width = `${pD}%`;
    document.getElementById('bar-b').style.width = `${pB}%`;
  });

  // Alt scorelines
  const altEl = document.getElementById('alt-scores-list');
  altEl.innerHTML = altScores
    .map(s => `<span class="alt-score-chip">${escHtml(s.score)} <small>(${s.probability}%)</small></span>`)
    .join('');

  // xG + iterations
  document.getElementById('xg-a').textContent     = simulation.xgA;
  document.getElementById('xg-b').textContent     = simulation.xgB;
  document.getElementById('sim-iters').textContent = `${simulation.iterations.toLocaleString()} ${t('sim-iters-suffix')}`;

  // ── Estadísticas + Mejor jugador ──────────────────────
  renderHthBars(ratings, data.stats, payload.teamA, payload.teamB);
  renderMoM(data.stats?.manOfMatch);

  // ── Alineaciones ────────────────────────────────────────────
  renderLineup('a', lineups.teamA, payload.teamA, payload.eraA, data.badgeA || _badgeFallback(payload.teamA));
  renderLineup('b', lineups.teamB, payload.teamB, payload.eraB, data.badgeB || _badgeFallback(payload.teamB));

  // ── Snapshot para share card ──────────────────────────────
  // ── Snapshot para share card ──────────────────────────────
  _shareData = {
    teamA:    payload.teamA,
    teamB:    payload.teamB,
    eraA:     payload.eraA || '',
    eraB:     payload.eraB || '',
    scoreA:   isPenMode ? (finalScore.penalties?.scoreA ?? 0) : finalScore.teamA,
    scoreB:   isPenMode ? (finalScore.penalties?.scoreB ?? 0) : finalScore.teamB,
    scorersA: finalScore.scorersA || [],
    scorersB: finalScore.scorersB || [],
    penalties: finalScore.penalties || null,
    ratings,
    probabilities,
    badgeA:   data.badgeA || null,
    badgeB:   data.badgeB || null,
    mom:      data.stats?.manOfMatch || null,
    stadium:  _selectedStadium,
    weather:  _selectedWeather,
    matchMode: payload.matchMode,
    matchStats: isPenMode ? null : {
      possession: data.stats?.possession || { teamA: 50, teamB: 50 },
      shots:      data.stats?.shots      || { teamA: 0,  teamB: 0  },
      corners:    data.stats?.corners    || { teamA: 0,  teamB: 0  },
      saves:      data.stats?.saves      || { teamA: 0,  teamB: 0  },
      fouls:      data.stats?.fouls      || { teamA: 0,  teamB: 0  },
    },
    lineupA: isPenMode ? null : (lineups.teamA || null),
    lineupB: isPenMode ? null : (lineups.teamB || null),
  };
}

// ── Lineup pitch renderer ─────────────────────────────────
/**
 * Groups players by position row and renders a mini-pitch layout.
 * Position rows: GK(0) → CB/RB/LB(1) → DM(2) → CM/RM/LM(3) → AM(3.5) → RW/LW/ST(4)
 */
const POS_ROW = { GK:0, RB:1, CB:1, LB:1, DM:2, CM:3, RM:3, LM:3, AM:3.5, RW:4, LW:4, ST:4 };

// Team colour palettes — indexed by 'a' or 'b'
const JERSEY_COLORS = {
  a: { bg: '#1a56db', txt: '#ffffff' },
  b: { bg: '#c0392b', txt: '#ffffff' },
};

const POS_DESCRIPTIONS = {
  GK: 'Portero',          RB: 'Lateral Derecho',  CB: 'Central',
  LB: 'Lateral Izquierdo',DM: 'Mediocentro Def.', CM: 'Centrocampista',
  RM: 'Interior Derecho', LM: 'Interior Izquierdo',AM: 'Mediapunta',
  RW: 'Extremo Derecho',  LW: 'Extremo Izquierdo',ST: 'Delantero Centro',
};

function renderLineup(side, lineup, teamName, era, badgeUrl) {
  // Guard: no lineup data available
  if (!lineup || !Array.isArray(lineup.players) || !lineup.players.length) {
    const card = document.getElementById(`lineup-card-${side}`);
    if (card) card.style.opacity = '0.35';
    const titleEl = document.getElementById(`lineup-title-${side}`);
    if (titleEl) titleEl.textContent = era ? `${teamName} · ${era}` : teamName;
    return;
  }
  const titleEl = document.getElementById(`lineup-title-${side}`);
  titleEl.textContent = '';
  if (badgeUrl) {
    const img = document.createElement('img');
    img.className = 'lineup-badge';
    img.src       = badgeUrl;
    img.alt       = '';
    img.onerror   = () => { img.src = BADGE_PLACEHOLDER; };
    titleEl.appendChild(img);
  }
  titleEl.appendChild(document.createTextNode(era ? `${teamName} · ${era}` : teamName));
  document.getElementById(`formation-${side}-badge`).textContent = lineup.formation;
  document.getElementById(`source-${side}`).textContent = _displayLabel(lineup);

  // Group by row — respect match mode player count
  const nPlayersRL = { '3v3':3, '5v5':5, '11v11':11 }[_matchMode] || 11;
  const rows = {};
  lineup.players.slice(0, nPlayersRL).forEach(p => {
    const row = POS_ROW[p.position] ?? 3;
    (rows[row] = rows[row] || []).push(p);
  });

  const pitch = document.getElementById(`pitch-${side}`);
  pitch.innerHTML = '';
  const { primary: kitPrimary, secondary: kitSecondary } = _getKitColors(teamName, side.toLowerCase());
  const kitBg  = kitPrimary  || JERSEY_COLORS[side].bg;

  // Apply kit-accent CSS var to lineup card for badge + top-border tinting
  const card = document.getElementById(`lineup-card-${side}`);
  if (card) card.style.setProperty('--kit-col', kitBg);

  let chipIdx = 0;
  Object.keys(rows).sort((a, b) => a - b).forEach(rowKey => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'pitch-row';
    rows[rowKey].forEach(player => {
      const chip = document.createElement('div');
      chip.className = 'player-chip';
      chip.style.setProperty('--i', chipIdx++);
      const posDesc = POS_DESCRIPTIONS[player.position] || player.position;
      chip.innerHTML = `
        <div class="player-jersey">${_jerseyIcon(kitBg, _JERSEY_NUM[player.position] ?? '?', kitSecondary)}</div>
        <div class="player-name">${escHtml(player.name)}</div>
        <div class="player-pos-lbl">${escHtml(player.position)}</div>
        <div class="player-tooltip">
          <span class="tooltip-pos">${escHtml(player.position)}</span>
          <span class="tooltip-name">${escHtml(player.name)}</span>
          <span class="tooltip-desc">${escHtml(posDesc)}</span>
        </div>
      `;
      rowDiv.appendChild(chip);
    });
    pitch.appendChild(rowDiv);
  });
}

// ── Animated score counter ────────────────────────────────
function animateScore(fromA, toA, fromB, toB) {
  const el  = document.getElementById('poster-score');
  const dur = 900;
  const t0  = performance.now();
  function step(now) {
    const p  = Math.min(1, (now - t0) / dur);
    const ea = Math.round(fromA + (toA - fromA) * p);
    const eb = Math.round(fromB + (toB - fromB) * p);
    el.textContent = `${ea} : ${eb}`;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── Match timeline (broadcast-style 3-column) ──────────────
function renderTimeline(scorersA, scorersB, cardsA, cardsB, teamA, teamB, matchPenalties = [], notableEvents = []) {
  const events = [
    ...(scorersA || []).map(s => ({ ...s, type: 'goal',     side: 'A' })),
    ...(scorersB || []).map(s => ({ ...s, type: 'goal',     side: 'B' })),
    ...((cardsA?.yellow) || []).map(c => ({ ...c, type: 'yellow',  side: 'A' })),
    ...((cardsA?.red)    || []).map(c => ({ ...c, type: 'red',     side: 'A' })),
    ...((cardsB?.yellow) || []).map(c => ({ ...c, type: 'yellow',  side: 'B' })),
    ...((cardsB?.red)    || []).map(c => ({ ...c, type: 'red',     side: 'B' })),
    ...(matchPenalties || []).map(p => ({ type: p.scored ? 'penalty' : 'penalty-miss', side: p.side, minute: p.minute, name: p.taker })),
    ...(notableEvents  || []).map(e => ({ type: e.type, side: e.side, minute: e.minute, name: e.name || null })),
  ].sort((a, b) => a.minute - b.minute);

  const evCount = events.length;
  const header = document.getElementById('timeline-header');
  header.innerHTML =
    `<span class="tl-hdr-team" style="color:var(--accent-a)">${escHtml(teamA)}</span>` +
    `<span class="tl-hdr-sep">·</span>` +
    `<span class="tl-hdr-team" style="color:var(--accent-b)">${escHtml(teamB)}</span>`;

  const container = document.getElementById('timeline-events');
  if (!events.length) {
    container.innerHTML = `<div class="t-empty-match">${t('timeline-empty')}</div>`;
    return;
  }
  container.innerHTML = events.map(ev => {
    let icon, suffix;
    switch (ev.type) {
      case 'goal':         icon = '⚽'; suffix = ''; break;
      case 'yellow':       icon = '🟨'; suffix = ''; break;
      case 'red':          icon = '🟥'; suffix = ''; break;
      case 'penalty':      icon = '⚽'; suffix = ` <span class="t-tag t-tag-pen">${t('ev-tag-pen')}</span>`; break;
      case 'penalty-miss': icon = '❌'; suffix = ` <span class="t-tag t-tag-miss">${t('ev-tag-miss')}</span>`; break;
      case 'corner':       icon = '🚩'; suffix = ` <span class="t-tag t-tag-corner">${t('ev-tag-corner')}</span>`; break;
      case 'freekick':     icon = '🎯'; suffix = ` <span class="t-tag t-tag-fk">${t('ev-tag-fk')}</span>`; break;
      default:             icon = '•';  suffix = ''; break;
    }
    const isA  = ev.side === 'A';
    const nameStr = ev.name ? escHtml(ev.name) : (ev.type === 'corner' ? '' : '');
    const label = `${icon}${nameStr ? ' ' + nameStr : ''}${suffix}`;
    return `<div class="t-event"><div class="t-left">${isA ? label : ''}</div><div class="t-mid"><span class="t-icon">${icon}</span><span class="t-min">${ev.minute}'</span></div><div class="t-right">${!isA ? label : ''}</div></div>`;
  }).join('');
}

// ── Animated match timeline (1 real-second = 1 match minute) ──
/**
 * Progressively reveals match events over real time.
 * Uses data.timeline from the engine's buildTimeline() output — each event
 * has { minute, type, side, player, scoreA, scoreB, narrative? } already set.
 *
 * @param {Array}  events       - sorted timeline from engine response
 * @param {string} teamA        - display name Team A
 * @param {string} teamB        - display name Team B
 * @param {number} msPerMinute  - real milliseconds per match minute (default 1000)
 */
let _animTimers = [];

// Reveal all still-hidden timeline rows instantly (called when match ends)
function flushTimeline() {
  _animTimers.forEach(id => { clearTimeout(id); clearInterval(id); });
  _animTimers = [];
  // Reveal event count badge when match ends (stored in data-final-count)
  const badge = document.getElementById('tl-count-badge');
  if (badge && badge.dataset.finalCount) {
    badge.textContent = badge.dataset.finalCount;
    badge.removeAttribute('data-final-count');
  }
  const container = document.getElementById('timeline-events');
  if (!container) return;
  container.querySelectorAll('.t-anim-hidden').forEach(row => {
    row.classList.remove('t-anim-hidden');
    row.classList.add('t-anim-reveal');
    // Show full narration text immediately (no typewriter)
    const narEl = row.querySelector('[data-nar]');
    if (narEl) {
      narEl.classList.remove('t-nar-pending');
      narEl.textContent = narEl.dataset.nar;
    }
  });
  // Also flush any narration still being typed
  container.querySelectorAll('.t-nar-pending[data-nar]').forEach(narEl => {
    narEl.classList.remove('t-nar-pending');
    narEl.textContent = narEl.dataset.nar;
  });
}

function animateTimeline(events, teamA, teamB, msPerMinute = 1000) {
  // Cancel any previous animation run
  _animTimers.forEach(clearTimeout);
  _animTimers = [];
  _timelineStarted = true;

  const evCount   = events.length;
  const header    = document.getElementById('timeline-header');
  const container = document.getElementById('timeline-events');

  // Show VS initially; replaced with event count when match ends
  header.innerHTML =
    `<span class="tl-hdr-team" style="color:var(--accent-a)">${escHtml(teamA)}</span>` +
    `<span class="tl-hdr-sep" id="tl-count-badge">VS</span>` +
    `<span class="tl-hdr-team" style="color:var(--accent-b)">${escHtml(teamB)}</span>`;

  // Store event count for reveal after match
  const _evCountFinal = `${evCount} ${evCount !== 1 ? t('timeline-events-suffix-pl') : t('timeline-events-suffix')}`;
  const _countBadge = document.getElementById('tl-count-badge');
  if (_countBadge) _countBadge.dataset.finalCount = _evCountFinal;

  if (!events.length) {
    container.innerHTML = `<div class="t-empty-match">${t('timeline-empty')}</div>`;
    return;
  }

  // Pre-render all event rows hidden
  container.innerHTML = events.map((ev, idx) => {
    let icon, suffix;
    switch (ev.type) {
      case 'goal':         icon = '⚽'; suffix = ''; break;
      case 'yellow':       icon = '🟨'; suffix = ''; break;
      case 'red':          icon = '🟥'; suffix = ''; break;
      case 'penalty':      icon = '⚽'; suffix = ` <span class="t-tag t-tag-pen">${t('ev-tag-pen')}</span>`; break;
      case 'penalty_miss': icon = '❌'; suffix = ` <span class="t-tag t-tag-miss">${t('ev-tag-miss')}</span>`; break;
      case 'corner':       icon = '🚩'; suffix = ` <span class="t-tag t-tag-corner">${t('ev-tag-corner')}</span>`; break;
      case 'freekick':     icon = '🎯'; suffix = ` <span class="t-tag t-tag-fk">${t('ev-tag-fk')}</span>`; break;
      case 'injury':       icon = '🩹'; suffix = ''; break;
      case 'sub':          icon = '🔄'; suffix = ev.playerIn ? ` ▲ <span class="t-sub-in">${escHtml(ev.playerIn)}</span>` : ''; break;
      default:             icon = '•';  suffix = '';
    }
    const isA     = ev.side === 'A';
    const nameStr = ev.type === 'sub'
      ? (ev.playerOut ? escHtml(ev.playerOut) : '')
      : (ev.player ? escHtml(ev.player) : '');
    const label    = `${icon}${nameStr ? ' ' + nameStr : ''}${suffix}`;
    const narHtml  = ev.narrative
      ? `<div class="t-narration${isA ? ' t-nar-a' : ' t-nar-b'} t-nar-pending" data-nar="${escHtml(ev.narrative)}"></div>`
      : '';
    return `<div class="t-event t-event-narrated t-anim-hidden" id="t-ev-${idx}">` +
      `<div>` +
        `<div class="t-left">${isA ? label : ''}</div>` +
        `<div class="t-mid"><span class="t-icon">${icon}</span><span class="t-min">${ev.minute}'</span></div>` +
        `<div class="t-right">${!isA ? label : ''}</div>` +
      `</div>` +
      narHtml +
      '</div>';
  }).join('');

  // Schedule each event to appear at event.minute * msPerMinute
  // msPerMinute=0 → instant mode, no timers, caller must call flushTimeline() after
  if (msPerMinute === 0) return;

  // Reveal the event count after the last event appears
  const _lastDelay = events.length ? events[events.length - 1].minute * msPerMinute + 1200 : 500;
  _animTimers.push(setTimeout(() => {
    const badge = document.getElementById('tl-count-badge');
    if (badge && badge.dataset.finalCount) {
      badge.textContent = badge.dataset.finalCount;
      badge.removeAttribute('data-final-count');
    }
  }, _lastDelay));

  events.forEach((ev, idx) => {
    const delay = ev.minute * msPerMinute;
    const tid   = setTimeout(() => {
      const row = document.getElementById(`t-ev-${idx}`);
      if (row) {
        row.classList.remove('t-anim-hidden');
        row.classList.add('t-anim-reveal');
        // Show narration text immediately (no typewriter)
        const narEl = row.querySelector('.t-nar-pending[data-nar]');
        if (narEl) {
          narEl.classList.remove('t-nar-pending');
          narEl.textContent = narEl.dataset.nar;
        }
      }
      // Update live score on goal events
      if (ev.type === 'goal') {
        const scoreEl = document.getElementById('poster-score');
        if (scoreEl) scoreEl.textContent = `${ev.scoreA} : ${ev.scoreB}`;
      }
    }, delay);
    _animTimers.push(tid);
  });
}

// ── Head-to-head attribute + stat bars ────────────────────
function renderHthBars(ratings, stats, teamA, teamB) {
  document.getElementById('hth-name-a').textContent = teamA;
  document.getElementById('hth-name-b').textContent = teamB;

  const poss    = stats?.possession || { teamA: 50,  teamB: 50  };
  const shots   = stats?.shots      || { teamA: 5,   teamB: 5   };
  const corners = stats?.corners    || { teamA: 4,   teamB: 4   };
  const fouls   = stats?.fouls      || { teamA: 10,  teamB: 10  };
  const saves   = stats?.saves      || { teamA: 3,   teamB: 3   };
  const extraRows = [
    { label: t('hth-possession'),  vA: poss.teamA,    vB: poss.teamB,    suffix: '%' },
    { label: t('hth-shots'),       vA: shots.teamA,   vB: shots.teamB,   suffix: ''  },
    { label: t('hth-corners'),     vA: corners.teamA, vB: corners.teamB, suffix: ''  },
    { label: t('hth-saves'),       vA: saves.teamA,   vB: saves.teamB,   suffix: ''  },
    { label: t('hth-fouls'),       vA: fouls.teamA,   vB: fouls.teamB,   suffix: '',  lowerWins: true },
  ];
  const attrRows = [
    { key: 'attack',      label: t('hth-attack') },
    { key: 'midfield',    label: t('hth-midfield') },
    { key: 'defense',     label: t('hth-defense') },
    { key: 'goalkeeping', label: t('hth-goalkeeping') },
  ];

  function makeRow(label, vA, vB, suffix = '', lowerWins = false) {
    const total = vA + vB || 1;
    const pctA  = Math.round(vA / total * 100);
    const pctB  = 100 - pctA;
    const winA  = (lowerWins ? vA < vB : vA > vB) ? ' hth-win' : '';
    const winB  = (lowerWins ? vB < vA : vB > vA) ? ' hth-win' : '';
    return `<div class="hth-row"><div class="hth-val hth-val-a${winA}">${vA}${suffix}</div><div class="hth-track hth-track-a"><div class="hth-fill-a" data-w="${pctA}"></div></div><div class="hth-label">${label}</div><div class="hth-track"><div class="hth-fill-b" data-w="${pctB}"></div></div><div class="hth-val hth-val-b${winB}">${vB}${suffix}</div></div>`;
  }

  const container = document.getElementById('hth-rows');
  container.innerHTML =
    attrRows.map(a => makeRow(a.label, ratings.teamA[a.key], ratings.teamB[a.key])).join('') +
    '<div class="stat-sep"></div>' +
    extraRows.map(r => makeRow(r.label, r.vA, r.vB, r.suffix, r.lowerWins)).join('');

  requestAnimationFrame(() => {
    container.querySelectorAll('[data-w]').forEach(el => { el.style.width = el.dataset.w + '%'; });
  });
}

// ── Man of the Match card ──────────────────────────────────
function renderMoM(mom) {
  if (!mom) return;
  document.getElementById('mom-name').textContent = mom.name;
  const teamColor = mom.team === 'A' ? 'var(--accent-a)' : 'var(--accent-b)';
  let reasonText;
  if (mom.reason && typeof mom.reason === 'object') {
    if (mom.reason.type === 'goals') {
      const n = mom.reason.count;
      reasonText = `${n} ${n === 1 ? t('mom-reason-goal') : t('mom-reason-goals')}`;
    } else {
      reasonText = t('mom-reason-best');
    }
  } else {
    reasonText = mom.reason || '';
  }
  document.getElementById('mom-meta').innerHTML =
    `${escHtml(mom.teamName)} · <span style="color:${teamColor}">${escHtml(reasonText)}</span>`;
}

// ── Pre-match player card presentation ──────────────────────
let _pmData = null, _pmPayload = null, _pmTick = 667; // ms per simulated minute (default 1 min)
let _timelineStarted = false;

function selectSpeed(btn) {
  document.querySelectorAll('.pm-speed-pill').forEach(b => b.classList.remove('pm-speed-active'));
  btn.classList.add('pm-speed-active');
  _pmTick = parseInt(btn.dataset.tick, 10);
}

function showPreMatch(data, payload) {
  _pmData    = data;
  _pmPayload = payload;

  // Penalties-only mode: bypass the full pre-match screen entirely
  if (payload.matchMode === 'penalties') {
    _pmTick = 300;  // non-zero so playLiveMatch doesn't skip to instant results
    // Clear any stale lineup DOM from a previous regular match so _readLineupFromDom
    // doesn't reuse old players for the current simulation's lineup.
    ['a', 'b'].forEach(s => {
      const el = document.getElementById(`pm-block-${s}`);
      if (el) el.innerHTML = '';
    });
    skipPreMatch();
    return;
  }

  const screen = document.getElementById('prematch-screen');
  screen.classList.remove('hidden', 'pm-fade-out');
  screen.scrollIntoView({ behavior: 'smooth', block: 'start' });

  buildPreMatchSide('a', data.lineups.teamA, payload.teamA, payload.eraA, data.badgeA || _badgeFallback(payload.teamA), data.ratings.teamA);
  buildPreMatchSide('b', data.lineups.teamB, payload.teamB, payload.eraB, data.badgeB || _badgeFallback(payload.teamB), data.ratings.teamB);

  // ── Intro block ──────────────────────────────────────────
  const pmIntro = document.getElementById('pm-intro');
  if (pmIntro) {
    const nameA = payload.teamA, eraA = payload.eraA || '';
    const nameB = payload.teamB, eraB = payload.eraB || '';
    const stad  = _selectedStadium;
    const rA    = data.ratings?.teamA || {};
    const rB    = data.ratings?.teamB || {};
    const eraStrA = eraA ? ` <span class="pm-intro-era">${escHtml(eraA)}</span>` : '';
    const eraStrB = eraB ? ` <span class="pm-intro-era">${escHtml(eraB)}</span>` : '';
    const stadHtml = stad
      ? `<div class="pm-intro-stad">🏟️ <strong>${escHtml(stad.name)}</strong> &middot; ${escHtml(stad.city)}</div>`
      : `<div class="pm-intro-stad">🏟️ ${escHtml(t('pm-intro-neutral'))}</div>`;
    // Build preview line based on overall ratings gap and style
    const atkA = rA.attack || 75, midA = rA.midfield || 75, defA = rA.defense || 75;
    const atkB = rB.attack || 75, midB = rB.midfield || 75, defB = rB.defense || 75;
    const ovA  = (atkA + midA + defA) / 3;
    const ovB  = (atkB + midB + defB) / 3;
    const gap  = Math.abs(ovA - ovB);
    const domTeam  = ovA >= ovB ? nameA : nameB;
    const weakTeam = ovA >= ovB ? nameB : nameA;
    const highAtk  = atkA > 82 || atkB > 82;
    const highDef  = defA > 82 && defB > 82;
    let preview;
    if (_lang === 'en') {
      if (gap >= 10) {
        preview = `On paper, <strong>${escHtml(domTeam)}</strong> are the <em>clear favourites</em> ` +
          `— but upsets are the soul of football. Can <strong>${escHtml(weakTeam)}</strong> defy the odds?`;
      } else if (gap < 3 && highAtk) {
        preview = `Two attacking powerhouses collide in what promises to be a <em>goal‑fest</em>. ` +
          `Brace yourself — this one could go either way.`;
      } else if (gap < 3 && highDef) {
        preview = `Two defensive giants face off in a <em>tactical masterclass</em>. ` +
          `Every set piece, every counter — one moment of magic could decide it.`;
      } else if (gap < 3) {
        preview = `The ratings couldn't be closer. A <em>genuine 50–50</em> contest. ` +
          `Pure football will decide who takes the bragging rights.`;
      } else {
        preview = `<strong>${escHtml(domTeam)}</strong> come in as <em>slight favourites</em>, ` +
          `but football never follows a script. Will the stars deliver on the big stage?`;
      }
    } else {
      if (gap >= 10) {
        preview = `Sobre el papel, <strong>${escHtml(domTeam)}</strong> parte como <em>favorito claro</em> ` +
          `— pero el fútbol siempre guarda sorpresas. ¿Podrá <strong>${escHtml(weakTeam)}</strong> dar la campanada?`;
      } else if (gap < 3 && highAtk) {
        preview = `Dos potencias ofensivas que prometen un <em>duelo de goles</em>. ` +
          `Ataque contra ataque y resultado totalmente abierto — agárrate al asiento.`;
      } else if (gap < 3 && highDef) {
        preview = `Dos bloques defensivos de primer nivel en una <em>batalla táctica</em>. ` +
          `Cada balón parado o contragolpe puede ser decisivo.`;
      } else if (gap < 3) {
        preview = `Los números no podrían estar más igualados. Un <em>50–50</em> de manual. ` +
          `Solo el fútbol decidirá quién se lleva los tres puntos.`;
      } else {
        preview = `<strong>${escHtml(domTeam)}</strong> parte como <em>ligero favorito</em>, ` +
          `pero el fútbol nunca sigue un guión. ¿Serán capaces las estrellas de marcar la diferencia?`;
      }
    }
    pmIntro.innerHTML =
      `<div class="pm-intro-matchup">${escHtml(nameA)}${eraStrA} <span class="pm-intro-vs">VS</span> ${escHtml(nameB)}${eraStrB}</div>` +
      stadHtml +
      `<p class="pm-intro-text">${preview}</p>`;
    pmIntro.classList.remove('hidden');
  }

  // Show stadium info if selected
  const pmStadInfo = document.getElementById('pm-stadium-info');
  if (pmStadInfo) {
    if (_selectedStadium) {
      const s = _selectedStadium;
      pmStadInfo.innerHTML = `<span class="pm-stad-icon">🏟️</span> <span class="pm-stad-name">${escHtml(s.name)}</span> <span class="pm-stad-loc">${escHtml(s.city)} · ${s.capacity.toLocaleString()}</span>`;
      pmStadInfo.classList.remove('hidden');
    } else {
      pmStadInfo.classList.add('hidden');
    }
  }

  // Reset speed pills to default (1 min)
  _pmTick = 667;
  document.querySelectorAll('.pm-speed-pill').forEach(b => {
    b.classList.toggle('pm-speed-active', parseInt(b.dataset.tick, 10) === 667);
  });

  // Draw radar in pre-match row
  const isPenMode = payload.matchMode === 'penalties';
  const radarRow = document.getElementById('pm-radar-row');
  const radarCard = document.getElementById('radar-card');
  if (radarRow && radarCard && !isPenMode && data.ratings) {
    radarRow.appendChild(radarCard);
    radarCard.style.display = '';
    drawRadar(data.ratings, payload.teamA, payload.teamB);
  } else if (radarRow) {
    radarRow.innerHTML = '';
  }
}

function skipPreMatch() {
  // Read the current starter cards from the DOM and apply any pre-match
  // substitutions the user made to _pmData before launching the simulation.
  const _readLineupFromDom = (side, originalLineup) => {
    const block = document.getElementById(`pm-block-${side}`);
    if (!block) return originalLineup;
    const starters = [...block.querySelectorAll('.pm-starter')]
      .map(c => ({ name: c.dataset.playerName, position: c.dataset.playerPos }))
      .filter(p => p.name && p.position);
    if (starters.length === 0) return originalLineup;
    return { ...originalLineup, players: starters };
  };

  const luA = _readLineupFromDom('a', _pmData.lineups.teamA);
  const luB = _readLineupFromDom('b', _pmData.lineups.teamB);

  // Detect if any swaps were made vs the original simulation lineup
  const origNamesA = (_pmData.lineups.teamA?.players || []).map(p => p.name).join('|');
  const origNamesB = (_pmData.lineups.teamB?.players || []).map(p => p.name).join('|');
  const newNamesA  = (luA.players || []).map(p => p.name).join('|');
  const newNamesB  = (luB.players || []).map(p => p.name).join('|');
  const hasSwaps   = origNamesA !== newNamesA || origNamesB !== newNamesB;

  const doLaunch = (data) => {
    const screen = document.getElementById('prematch-screen');
    screen.classList.add('pm-fade-out');
    setTimeout(() => {
      screen.classList.add('hidden');
      screen.classList.remove('pm-fade-out');
      playLiveMatch(data, _pmPayload, _pmTick);
    }, 400);
  };

  if (!hasSwaps) {
    doLaunch(_pmData);
    return;
  }

  // Swaps detected → re-simulate with the new lineup so results reflect the changes
  const playBtn = document.querySelector('.pm-start-btn');
  if (playBtn) { playBtn.disabled = true; playBtn.textContent = t('vs-recalc'); }

  const body = {
    teamA: _pmPayload.teamA, eraA: _pmPayload.eraA || '',
    teamB: _pmPayload.teamB, eraB: _pmPayload.eraB || '',
    formationA: luA.formation || _pmPayload.formationA || '',
    formationB: luB.formation || _pmPayload.formationB || '',
    matchMode:  _pmPayload.matchMode || '11v11',
    matchSalt:  _pmPayload.matchSalt || 0,
    refereeId:  _pmPayload.refereeId || null,
    isFinal:    _pmPayload.isFinal   || false,
    weatherId:  _pmPayload.weatherId || null,
    lang:       _lang,
    playersOverrideA: luA.players,
    playersOverrideB: luB.players,
  };

  fetch('/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
    .then(r => r.json())
    .then(newData => {
      if (playBtn) { playBtn.disabled = false; playBtn.textContent = t('pm-start-btn'); }
      // Preserve original badges (re-sim may not re-fetch them)
      doLaunch({ ...newData, badgeA: newData.badgeA || _pmData.badgeA, badgeB: newData.badgeB || _pmData.badgeB });
    })
    .catch(() => {
      if (playBtn) { playBtn.disabled = false; playBtn.textContent = t('pm-start-btn'); }
      doLaunch(_pmData); // fallback to original if re-sim fails
    });
}

function buildPreMatchSide(side, lineup, teamName, era, badgeUrl, ratings) {
  const block = document.getElementById(`pm-block-${side}`);
  block.innerHTML = '';

  // ── Premium header with big badge ──────────────────────
  const hdr = document.createElement('div');
  hdr.className = `pm-team-hdr${side === 'b' ? ' pm-team-hdr-b' : ''}`;

  // Big badge zone
  const badgeZone = document.createElement('div');
  badgeZone.className = 'pm-badge-zone';
  if (badgeUrl) {
    const img = document.createElement('img');
    img.className = 'pm-badge-big';
    img.src = badgeUrl;
    img.alt = '';
    img.onerror = () => { img.src = BADGE_PLACEHOLDER; };
    badgeZone.appendChild(img);
  } else {
    badgeZone.innerHTML = `<div class="pm-badge-placeholder">${escHtml(teamName.slice(0,3).toUpperCase())}</div>`;
  }

  const info = document.createElement('div');
  info.className = 'pm-hdr-info';
  info.innerHTML =
    `<div class="pm-hdr-name">${escHtml(teamName)}</div>` +
    (era ? `<div class="pm-hdr-era">📅 ${escHtml(era)}</div>` : '') +
    `<div class="pm-hdr-form"><span class="pm-form-tag">${escHtml(lineup.formation)}</span></div>`;

  if (side === 'b') {
    hdr.appendChild(info);
    hdr.appendChild(badgeZone);
  } else {
    hdr.appendChild(badgeZone);
    hdr.appendChild(info);
  }
  block.appendChild(hdr);

  // ── Rating bar under header ─────────────────────────────
  const overallRating = Math.round((ratings.attack + ratings.midfield + ratings.defense + ratings.goalkeeping) / 4);
  const ratingBar = document.createElement('div');
  ratingBar.className = `pm-rating-bar pm-rating-bar-${side}`;
  ratingBar.innerHTML = `<span class="pm-rating-num">${overallRating}</span><span class="pm-rating-lbl">OVR</span>`;
  block.appendChild(ratingBar);

  // ── Rows (attack first → descending POS_ROW sort) — respect match mode ─
  const _nPM = { '3v3':3, '5v5':5, '11v11':11 }[_matchMode] || 11;
  const rows = {};
  lineup.players.slice(0, _nPM).forEach(p => {
    const r = POS_ROW[p.position] ?? 3;
    (rows[r] = rows[r] || []).push(p);
  });
  const rowsWrap = document.createElement('div');
  rowsWrap.className = 'pm-rows';
  let cardIdx = 0;
  const { primary: pmKit1, secondary: pmKit2 } = _getKitColors(teamName, side.toLowerCase());
  Object.keys(rows).map(Number).sort((a, b) => b - a).forEach(rowKey => {
    const rowEl = document.createElement('div');
    rowEl.className = `pm-row${side === 'b' ? ' pm-row-b' : ''}`;
    rows[rowKey].forEach(player => {
      const card = buildPlayerCard(player, ratings, 60 + cardIdx * 45, side, badgeUrl, pmKit1, pmKit2);
      card.dataset.slot   = player.name;
      card.dataset.pmSide = side;
      card.classList.add('pm-starter');
      card.title = `${player.name} ${t('pm-card-change')}`;
      card.addEventListener('click', () => _handlePmCardClick(card, side));
      rowEl.appendChild(card);
      cardIdx++;
    });
    rowsWrap.appendChild(rowEl);
  });
  block.appendChild(rowsWrap);

  // ── Bench section — only if at least one real squad player ──────
  const realBench = _matchMode === '11v11' ? (lineup.bench || []).filter(p => p.isReal).slice(0, 5) : [];
  if (realBench.length > 0) {
    const benchLabel = document.createElement('div');
    benchLabel.className = 'pm-bench-label';
    benchLabel.textContent = t('bench-label');
    block.appendChild(benchLabel);

    const benchRow = document.createElement('div');
    benchRow.className = `pm-bench-row${side === 'b' ? ' pm-row-b' : ''}`;
    realBench.forEach((player, i) => {
      const card = buildPlayerCard(player, ratings, 60 + (cardIdx + i) * 30, side, badgeUrl, pmKit1, pmKit2);
      card.classList.add('pm-card-bench');
      card.dataset.slot   = player.name;
      card.dataset.pmSide = side;
      card.classList.add('pm-sub');
      card.title = `${player.name} ${t('pm-card-sub')}`;
      card.addEventListener('click', () => _handlePmCardClick(card, side));
      benchRow.appendChild(card);
    });
    block.appendChild(benchRow);
  }
}

// ── Pre-match substitution interaction ──────────────────────
// State: stores selected card for swapping
const _pmSubState = { a: null, b: null };

function _handlePmCardClick(card, side) {
  const state = _pmSubState;
  const lside = side.toLowerCase();
  const isSub = card.classList.contains('pm-sub');

  // If nothing selected yet → select this card (highlight)
  if (!state[lside]) {
    card.classList.add('pm-selected');
    state[lside] = card;
    return;
  }

  const selected = state[lside];
  if (selected === card) {
    // Deselect on second click of same card
    card.classList.remove('pm-selected');
    state[lside] = null;
    return;
  }

  // Swap selected ↔ this card only if one is starter and one is bench
  const selectedIsSub = selected.classList.contains('pm-sub');
  if (isSub === selectedIsSub) {
    // Both same type — just re-select
    selected.classList.remove('pm-selected');
    card.classList.add('pm-selected');
    state[lside] = card;
    return;
  }

  // Perform swap: exchange innerHTML content + data attributes + title
  const aHtml = selected.innerHTML;
  const bHtml = card.innerHTML;
  selected.innerHTML = bHtml;
  card.innerHTML = aHtml;

  // Swap player data so DOM state stays consistent with visual content
  const aName = selected.dataset.playerName, aPos = selected.dataset.playerPos, aTitle = selected.title;
  selected.dataset.playerName = card.dataset.playerName;
  selected.dataset.playerPos  = card.dataset.playerPos;
  selected.title              = card.title;
  card.dataset.playerName = aName;
  card.dataset.playerPos  = aPos;
  card.title              = aTitle;

  // Swap the pm-sub / pm-starter class marker
  if (selectedIsSub) {
    selected.classList.remove('pm-sub');  selected.classList.add('pm-starter');
    card.classList.remove('pm-starter');  card.classList.add('pm-sub');
  } else {
    selected.classList.remove('pm-starter'); selected.classList.add('pm-sub');
    card.classList.remove('pm-sub');         card.classList.add('pm-starter');
  }

  // Show toast confirmation
  showToast(t('sub-change-toast'));

  // Deselect both
  selected.classList.remove('pm-selected');
  card.classList.remove('pm-selected');
  state[lside] = null;
}

// Footballer SVG silhouette — proper filled shapes
const _SILHOUETTE = `<svg viewBox="0 0 56 74" xmlns="http://www.w3.org/2000/svg">
  <circle cx="28" cy="10" r="8"/>
  <path d="M28 18 C20 18 13 22 11 28 L9 38 L19 40 L19 56 L37 56 L37 40 L47 38 L45 28 C43 22 36 18 28 18Z"/>
  <path d="M11 28 L5 33 L7 42 L19 40 L19 34Z" opacity=".72"/>
  <path d="M45 28 L51 33 L49 42 L37 40 L37 34Z" opacity=".72"/>
  <path d="M19 56 L16 72 L24 72 L28 61 L32 72 L40 72 L37 56Z" opacity=".68"/>
</svg>`;

const _KIT_COLORS = { a: '#1a56db', b: '#c0392b' };

// ── Team kit colors (primary shirt) — keyed by lowercase normalized name ──
const _TEAM_KIT_MAP = {
  // National teams
  'spain':'#c60b1e', 'españa':'#c60b1e', 'espana':'#c60b1e',
  'germany':'#ffffff', 'alemania':'#ffffff', 'deutschland':'#ffffff', 'west germany':'#ffffff',
  'france':'#003189', 'francia':'#003189',
  'brazil':'#f9c30e', 'brasil':'#f9c30e',
  'argentina':'#74acdf', 'argentina 1986':'#74acdf',
  'italy':'#003da5', 'italia':'#003da5',
  'england':'#ffffff', 'inglaterra':'#ffffff',
  'portugal':'#006600', 'portugal 1966':'#006600',
  'netherlands':'#ff6600', 'holanda':'#ff6600', 'holland':'#ff6600',
  'belgium':'#d01020', 'belgica':'#d01020',
  'croatia':'#ff2020', 'croacia':'#ff2020',
  'denmark':'#c60c30', 'dinamarca':'#c60c30',
  'sweden':'#006aa7', 'suecia':'#006aa7',
  'norway':'#ef2b2d', 'noruega':'#ef2b2d',
  'scotland':'#003da5', 'escocia':'#003da5',
  'ireland':'#169b62', 'irlanda':'#169b62',
  'wales':'#c8102e', 'gales':'#c8102e',
  'russia':'#cc0000', 'rusia':'#cc0000',
  'ukraine':'#0057b7', 'ucrania':'#0057b7',
  'turkey':'#e30a17', 'turquia':'#e30a17',
  'mexico':'#006847', 'méxico':'#006847',
  'usa':'#002868', 'estados unidos':'#002868',
  'colombia':'#fcd116',
  'chile':'#d52b1e',
  'uruguay':'#5aaad0',
  'paraguay':'#d52b1e',
  'ecuador':'#ffd100',
  'peru':'#d91023', 'perú':'#d91023',
  'venezuela':'#cf142b',
  'senegal':'#00853f',
  'nigeria':'#008751',
  'ghana':'#006b3f',
  'cameroon':'#007a5e', 'camerún':'#007a5e',
  'morocco':'#c1272d', 'marruecos':'#c1272d',
  'egypt':'#c8102e', 'egipto':'#c8102e',
  'japan':'#003087', 'japón':'#003087', 'japon':'#003087',
  'south korea':'#c60c30', 'corea':'#c60c30',
  'australia':'#f9c30e',
  'iran':'#239f40',
  'saudi arabia':'#006c35',
  'china':'#de2910',
  // Club teams — European
  'real madrid':'#ffffff',
  'barcelona':'#a50044',
  'atletico madrid':'#cc0000', 'atlético madrid':'#cc0000',
  'sevilla':'#ffffff',
  'valencia':'#ff8c00',
  'villarreal':'#f7d000',
  'athletic club':'#cc0000', 'athletic bilbao':'#cc0000',
  'manchester united':'#da291c',
  'manchester city':'#6cabdd',
  'liverpool':'#c8102e',
  'arsenal':'#ef0107',
  'chelsea':'#034694',
  'tottenham':'#132257', 'tottenham hotspur':'#132257',
  'everton':'#003399',
  'leicester':'#003090', 'leicester city':'#003090',
  'aston villa':'#95bfe5',
  'newcastle':'#000000', 'newcastle united':'#000000',
  'west ham':'#7a263a', 'west ham united':'#7a263a',
  'leeds':'#ffffff', 'leeds united':'#ffffff',
  'juventus':'#000000',
  'ac milan':'#fb090b', 'milan':'#fb090b',
  'inter milan':'#0068a8', 'inter':'#0068a8', 'internazionale':'#0068a8',
  'napoli':'#0067b1',
  'roma':'#8e1f2f', 'as roma':'#8e1f2f',
  'lazio':'#87ceeb',
  'fiorentina':'#4b0082',
  'atalanta':'#0000cd',
  'torino':'#8b0000',
  'sampdoria':'#003da5',
  'parma':'#0046a0',
  'udinese':'#000000',
  'bologna':'#bc0000',
  'ajax':'#9b0000',
  'psv':'#d00022', 'psv eindhoven':'#d00022',
  'feyenoord':'#c40022',
  'porto':'#003087',
  'benfica':'#cc0000',
  'sporting cp':'#006600', 'sporting':'#006600',
  'braga':'#9b0000',
  'celtic':'#16a929',
  'rangers':'#003da5',
  'anderlecht':'#6a0dad',
  'club brugge':'#003087',
  'standard liege':'#c40022',
  'marseille':'#009fda', 'olympique marseille':'#009fda',
  'paris saint-germain':'#003189', 'psg':'#003189',
  'lyon':'#0063a0', 'olympique lyon':'#0063a0',
  'monaco':'#e50020', 'as monaco':'#e50020',
  'lille':'#c60b1e',
  'bordeaux':'#003189',
  'nice':'#c60b1e',
  'lens':'#ffd700',
  'rc lens':'#ffd700',
  'rennes':'#cc0000',
  'bayern munich':'#dc052d', 'fc bayern':'#dc052d',
  'borussia dortmund':'#fde100', 'dortmund':'#fde100',
  'bayer leverkusen':'#e32221', 'leverkusen':'#e32221',
  'rb leipzig':'#cc1433', 'red bull leipzig':'#cc1433',
  'schalke':'#004b9c', 'fc schalke':'#004b9c',
  'borussia mönchengladbach':'#000000',
  'wolfsburg':'#65b32e',
  'eintracht frankfurt':'#e2001a', 'frankfurt':'#e2001a',
  'hamburger sv':'#005ca8', 'hamburg':'#005ca8',
  'stuttgart':'#e32221',
  'werder bremen':'#1d5e2b', 'bremen':'#1d5e2b',
  'real sociedad':'#003da5',
  'real betis':'#007e33',
  'celta vigo':'#87ceeb',
  'deportivo la coruna':'#003da5',
  'osasuna':'#c60b1e',
  'getafe':'#0033a0',
  'girona':'#9b0000',
  'fenerbahce':'#f9c30e', 'fenerbahçe':'#f9c30e',
  'galatasaray':'#c8102e',
  'besiktas':'#000000', 'beşiktaş':'#000000',
  'shakhtar donetsk':'#f08000',
  'dinamo kyiv':'#ffffff',
  'spartak moscow':'#c8102e',
  'cska moscow':'#cc0000',
  'red star belgrade':'#cc0000', 'estrella roja':'#cc0000',
  'dinamo zagreb':'#003da5',
  'panathinaikos':'#006400',
  'olympiakos':'#cc0000',
  'celtic 1967':'#16a929',
  // South American clubs
  'boca juniors':'#f9c30e',
  'river plate':'#cc0000',
  'flamengo':'#ed1c24',
  'corinthians':'#000000',
  'são paulo':'#cc0000', 'sao paulo':'#cc0000',
  'santos':'#000000',
  'cruzeiro':'#003da5',
  'atletico mineiro':'#000000',
  'gremio':'#003da5', 'grêmio':'#003da5',
  'nacional':'#ffffff',
  'peñarol':'#f9c30e',
  'colo-colo':'#ffffff',
  'universitario':'#cc0000',
  'alianza lima':'#003da5',
};

// Secondary/sleeve colour accents per team
const _TEAM_KIT_SECONDARY = {
  'germany':'#000000','alemania':'#000000',
  'argentina':'#75b2dd','brazil':'#009c3b','brasil':'#009c3b',
  'italy':'#ffffff','italia':'#ffffff',
  'netherlands':'#ffffff','holanda':'#ffffff','holland':'#ffffff',
  'england':'#cc0000','spain':'#f7c948','españa':'#f7c948',
  'france':'#cc0000','francia':'#cc0000',
  'portugal':'#006600',
  'croatia':'#cc0000','croacia':'#cc0000',
  'belgium':'#f7c948','bélgica':'#f7c948',
  'fc barcelona':'#004d98','barcelona':'#004d98',
  'real madrid':'#f7c948',
  'manchester united':'#ffe000','manchester city':'#ffffff',
  'juventus':'#ffffff','ac milan':'#000000','milan':'#000000',
  'inter milan':'#003da5','inter':'#003da5',
  'borussia dortmund':'#000000','dortmund':'#000000',
  'ajax':'#ffffff',
  'atletico madrid':'#002d6a','atlético madrid':'#002d6a',
  'river plate':'#cc0000','boca juniors':'#f7c948',
  'celtic':'#ffffff','rangers':'#cc0000',
  'porto':'#0070b8','benfica':'#cc0000',
  'psg':'#cc0000','paris saint-germain':'#cc0000',
  'arsenal':'#ffffff','chelsea':'#cc0000','liverpool':'#000000',
  'tottenham':'#000034','tottenham hotspur':'#000034',
  'sevilla':'#cc0000','villarreal':'#000000',
  'lyon':'#0047ab','marseille':'#000034',
  'leverkusen':'#000000','bayer leverkusen':'#000000',
  'rb leipzig':'#cc0000',
  'napoli':'#ffffff','lazio':'#003da5',
  'roma':'#cc0000','as roma':'#cc0000',
};

function _getKitColor(teamLabel, fallbackSide) {
  if (!teamLabel) return _KIT_COLORS[fallbackSide] || _KIT_COLORS.a;
  const key = teamLabel.toLowerCase().replace(/\s+\d{4}(-\d{2,4})?$/, '').trim();
  return _TEAM_KIT_MAP[key] || _TEAM_KIT_MAP[key.replace(/\s+(fc|cf|ac|as|rc|sc|1\.?\s*fc|united|city|town|club)$/i, '').trim()] || _KIT_COLORS[fallbackSide] || _KIT_COLORS.a;
}

function _getKitColors(teamLabel, fallbackSide) {
  const primary   = _getKitColor(teamLabel, fallbackSide);
  const key       = teamLabel ? teamLabel.toLowerCase().replace(/\s+\d{4}(-\d{2,4})?$/, '').trim() : '';
  const secondary = _TEAM_KIT_SECONDARY[key]
    || _TEAM_KIT_SECONDARY[key.replace(/\s+(fc|cf|ac|as|rc|sc|1\.?\s*fc|united|city|town|club)$/i, '').trim()]
    || null;
  return { primary, secondary };
}

// Jersey number by position (FUT-style defaults)
const _JERSEY_NUM = { GK:1, RB:2, CB:5, LB:3, DM:6, CM:8, RM:7, LM:11, AM:10, RW:7, LW:11, ST:9 };

// ── Jersey SVG shirt icon ────────────────────────────────────
// Renders a premium football-shirt silhouette with collar, sleeves + number
function _jerseyIcon(col, num, col2) {
  const sl  = col2 || 'rgba(0,0,0,.28)';
  const hi  = 'rgba(255,255,255,.13)';   // body highlight
  const sh  = 'rgba(0,0,0,.22)';          // inner shadow
  return `<svg viewBox="0 0 54 62" xmlns="http://www.w3.org/2000/svg">
    <!-- Main body -->
    <path d="M8,4 Q14,10 27,10 Q40,10 46,4 L54,12 L54,27 L44,25 L44,59 L10,59 L10,25 L0,27 L0,12 Z"
          fill="${col}" stroke="rgba(0,0,0,.28)" stroke-width="1"/>
    <!-- Left sleeve -->
    <path d="M8,4 L0,12 L0,27 L10,25 L10,10 Z" fill="${sl}" opacity=".75"/>
    <!-- Right sleeve -->
    <path d="M46,4 L54,12 L54,27 L44,25 L44,10 Z" fill="${sl}" opacity=".75"/>
    <!-- Collar shadow ring -->
    <path d="M18,4.5 Q27,13 36,4.5" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="2"/>
    <!-- Collar highlight -->
    <path d="M19,4.2 Q27,11.5 35,4.2" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.1"/>
    <!-- Body chest highlight -->
    <path d="M12,27 Q27,30 42,27 L42,46 Q27,49 12,46 Z" fill="${hi}"/>
    <!-- Sleeve inner highlight -->
    <path d="M2,16 L2,25 L9,24" fill="none" stroke="rgba(255,255,255,.10)" stroke-width="1"/>
    <path d="M52,16 L52,25 L45,24" fill="none" stroke="rgba(255,255,255,.10)" stroke-width="1"/>
    <!-- Shoulder seam line -->
    <line x1="13" y1="24" x2="41" y2="24" stroke="rgba(255,255,255,.18)" stroke-width=".8" stroke-dasharray="2.5,2"/>
    <!-- Number -->
    <text x="27" y="47" text-anchor="middle" dominant-baseline="middle"
          font-size="16" fill="rgba(255,255,255,.22)" font-weight="900"
          font-family="'Arial Black',Arial,sans-serif">${num}</text>
  </svg>`;
}

const _STAT_MAP = {
  GK:  [['REF',0,'goalkeeping'],['KIC',0,'goalkeeping'],['POS',0,'defense'],  ['SPD',1,'midfield']],
  CB:  [['DEF',0,'defense'],    ['FIS',0,'defense'],    ['PAS',1,'midfield'], ['VEL',1,'attack']],
  RB:  [['DEF',0,'defense'],    ['VEL',0,'attack'],     ['PAS',1,'midfield'], ['FIS',1,'defense']],
  LB:  [['DEF',0,'defense'],    ['VEL',0,'attack'],     ['PAS',1,'midfield'], ['FIS',1,'defense']],
  DM:  [['DEF',0,'defense'],    ['PAS',0,'midfield'],   ['FIS',1,'defense'],  ['TIR',1,'midfield']],
  CM:  [['PAS',0,'midfield'],   ['REG',0,'midfield'],   ['DEF',1,'defense'],  ['TIR',1,'attack']],
  RM:  [['PAS',0,'midfield'],   ['VEL',0,'attack'],     ['TIR',1,'attack'],   ['REG',1,'midfield']],
  LM:  [['PAS',0,'midfield'],   ['VEL',0,'attack'],     ['TIR',1,'attack'],   ['REG',1,'midfield']],
  AM:  [['REG',0,'midfield'],   ['TIR',0,'attack'],     ['PAS',1,'midfield'], ['VEL',1,'attack']],
  RW:  [['VEL',0,'attack'],     ['TIR',0,'attack'],     ['REG',1,'midfield'], ['PAS',1,'midfield']],
  LW:  [['VEL',0,'attack'],     ['TIR',0,'attack'],     ['REG',1,'midfield'], ['PAS',1,'midfield']],
  ST:  [['TIR',0,'attack'],     ['FIS',0,'defense'],    ['VEL',1,'attack'],   ['REG',1,'midfield']],
};

function buildPlayerCard(player, teamRatings, delayMs, side, badgeUrl, kitOverride, kit2Override) {
  const rating   = calcPlayerRating(player, teamRatings);
  const tier     = rating >= 90 ? 'elite' : rating >= 82 ? 'gold' : rating >= 72 ? 'silver' : 'bronze';
  const parts    = player.name.split(/\s+/);
  let display;
  if (player.name.length <= 12 || parts.length === 1) {
    display = player.name; // short or single-word: show full
  } else {
    // "F. APELLIDO" — initial + last word, readable and compact
    display = parts[0][0] + '. ' + parts[parts.length - 1];
  }
  display = display.toUpperCase();
  const kitColor = kitOverride || _KIT_COLORS[side] || _KIT_COLORS.a;
  const kitColor2 = kit2Override || null;
  const jerseyN  = _JERSEY_NUM[player.position] ?? 0;

  // Hash for stat variation
  let h = 0;
  for (let i = 0; i < player.name.length; i++) h = ((h * 31) + player.name.charCodeAt(i)) & 0xffff;

  // Badge corner (team shield on card)
  const badgeCorner = badgeUrl
    ? `<img class="pmc-badge" src="${escHtml(badgeUrl)}" alt="" onerror="this.src='${BADGE_PLACEHOLDER}'">`
    : '';

  // Jersey number watermark
  const jerseyNum = jerseyN ? `<div class="pmc-jersey-num">${jerseyN}</div>` : '';

  const card = document.createElement('div');
  card.className = `pm-card pm-card-${tier}`;
  card.style.animationDelay = `${delayMs}ms`;
  card.style.setProperty('--kit', kitColor);
  card.title = player.name;
  card.dataset.playerName = player.name;
  card.dataset.playerPos  = player.position;
  card.innerHTML =
    `<div class="pmc-top">${badgeCorner}<div class="pmc-ovr-pos"><div class="pmc-ovr">${rating}</div><div class="pmc-pos-tag">${escHtml(player.position)}</div></div></div>` +
    `<div class="pmc-sil">${_jerseyIcon(kitColor, jerseyN || '', kitColor2)}</div>` +
    `<div class="pmc-name">${escHtml(display)}</div>`;

  // ── Hover stats tooltip ──────────────────────────────────
  const tipColor = tier === 'elite' ? '#f7d02e' : tier === 'gold' ? '#daa520' : tier === 'silver' ? '#c0c0e0' : '#c48040';
  const stats = _deriveStats(player.position, rating, h);
  const tipHtml = stats.map(s =>
    `<div class="pmc-tip-row"><span class="pmc-tip-lbl">${s.label}</span><span class="pmc-tip-val" style="color:${tipColor}">${s.val}</span></div>`
  ).join('');
  const tipEl = document.createElement('div');
  tipEl.className = 'pmc-tooltip';
  tipEl.innerHTML = tipHtml;
  card.appendChild(tipEl);

  return card;
}

// Derive 4 position-specific stats from OVR + name hash for variety
function _deriveStats(pos, ovr, nhash) {
  // [label, bias relative to OVR]
  const profiles = {
    GK:  [['RFL', 14],['POS', 8],['PAR', 5],['SAL', -5]],
    CB:  [['DEF', 10],['FIS', 6],['INT', 4],['PAS', -6]],
    LB:  [['DEF', 5],['VEL', 8],['PAS', 4],['ATQ', -3]],
    RB:  [['DEF', 5],['VEL', 8],['PAS', 4],['ATQ', -3]],
    LWB: [['VEL', 9],['DEF', 4],['PAS', 5],['DRI', 2]],
    RWB: [['VEL', 9],['DEF', 4],['PAS', 5],['DRI', 2]],
    DM:  [['DEF', 7],['PAS', 4],['FIS', 5],['VIS', -3]],
    CM:  [['PAS', 6],['VIS', 6],['DRI', 2],['TIR', -4]],
    CAM: [['PAS', 7],['DRI', 8],['VIS', 5],['TIR', 3]],
    LM:  [['VEL', 8],['DRI', 6],['PAS', 4],['TIR', 0]],
    RM:  [['VEL', 8],['DRI', 6],['PAS', 4],['TIR', 0]],
    LW:  [['VEL', 10],['DRI', 8],['TIR', 3],['PAS', 2]],
    RW:  [['VEL', 10],['DRI', 8],['TIR', 3],['PAS', 2]],
    ST:  [['TIR', 12],['VEL', 7],['POT', 5],['DRI', 3]],
    CF:  [['TIR', 10],['DRI', 6],['VIS', 6],['POT', 4]],
    SS:  [['TIR', 8],['DRI', 5],['VEL', 6],['VIS', 5]],
  };
  const fallback = [['PAS', 4],['DRI', 2],['TIR', 0],['DEF', -4]];
  const profile = profiles[pos] || fallback;
  return profile.slice(0, 4).map(([label, bias], i) => {
    const noise = ((nhash >> (i * 4)) & 7) - 3; // -3 … +3
    const val   = Math.min(99, Math.max(55, Math.round(ovr + bias + noise)));
    return { label, val };
  });
}

// Notable player overrides — always displayed correctly regardless of team tier.
// Keys are lowercase substrings of player name (checked with .includes).
// More specific keys first (e.g. 'sergio ramos' before 'ramos') to avoid
// false positives. Accented + unaccented variants both listed.
// ─────────────────────────────────────────────────────────────────────────────
// PLAYER_OVERRIDES — only for genuinely distinctive names / unique nicknames.
// RULE: single-word keys only when the word is globally unique in football
// (e.g. 'benzema', 'ibrahimovic', 'ronaldinho'). NEVER use common surnames
// like 'suárez', 'marcelo', 'pepe', 'henry', 'villa', etc. as standalone keys
// because they match any squad player with that surname.
// ─────────────────────────────────────────────────────────────────────────────
const PLAYER_OVERRIDES = new Map([
  // ── Goalkeepers ──────────────────────────────────────────────────────────
  ['iker casillas',      88], ['casillas',         88],
  ['gianluigi buffon',   89], ['buffon',            89],
  ['manuel neuer',       93], ['neuer',             93],
  ['thibaut courtois',   91], ['courtois',          91],
  ['jan oblak',          92], ['oblak',             92],
  ['david de gea',       87], ['de gea',            87],
  ['marc-andré ter stegen',89],['ter stegen',       89],
  ['alisson becker',     91], ['alisson',           91],
  ['ederson moraes',     88], ['ederson',           88],
  ['hugo lloris',        87], ['lloris',            87],
  ['peter schmeichel',   91], ['schmeichel',        91],
  ['petr čech',          88], ['peter cech',        88], ['čech', 88],
  ['edwin van der sar',  89], ['van der sar',       89],
  ['oliver kahn',        92], ['kahn',              92],
  ['lev yashin',         95], ['yashin',            95],
  ['dino zoff',          91], ['zoff',              91],
  ['gianluigi donnarumma',90],['donnarumma',        90],
  ['keylor navas',       86],
  ['rene higuita',       82], ['higuita',           82],
  ['walter zenga',       85],
  ['pepe reina',         84],
  // ── Defenders ────────────────────────────────────────────────────────────
  ['sergio ramos',       91],
  ['raphael varane',     89], ['raphaël varane',   89], ['varane',      89],
  ['franco baresi',      97], ['baresi',            97],
  ['paolo maldini',      97], ['maldini',           97],
  ['carles puyol',       90], ['puyol',             90],
  ['alessandro nesta',   93], ['nesta',             93],
  ['fabio cannavaro',    93], ['cannavaro',         93],
  ['roberto carlos',     91],
  ['marcelo vieira',     87], ['marcelo brozovic',  86],
  ['philipp lahm',       92], ['lahm',              92],
  ['jordi alba',         86],
  ['dani carvajal',      87], ['carvajal',          87],
  ['giorgio chiellini',  89], ['chiellini',         89],
  ['leonardo bonucci',   87], ['bonucci',           87],
  ['nemanja vidic',      88], ['vidic',             88],
  ['rio ferdinand',      89],
  ['john terry',         87],
  ['lilian thuram',      88], ['thuram',            88],
  ['bixente lizarazu',   86], ['lizarazu',          86],
  ['cafu',               90], ['cafú',              90],
  ['pepe kellermann',    86], // Pepe (Portuguese CB) only when full name stored
  ['gabriel heinze',     80], ['heinze',            80],
  ['ferland mendy',      85],
  ['éder militão',       86], ['militao',           86], ['militão',   86],
  ['david alaba',        87], ['alaba',             87],
  ['virgil van dijk',    91], ['van dijk',          91],
  ['antonio rüdiger',    85], ['rudiger',           85], ['rüdiger',   85],
  // ── Midfielders ──────────────────────────────────────────────────────────
  ['luka modrić',        91], ['luka modric',       91], ['modrić',    91], ['modric',  91],
  ['toni kroos',         91], ['kroos',             91],
  ['xavi hernández',     93], ['xavi hernandez',    93],
  ['andrés iniesta',     92], ['andres iniesta',    92], ['iniesta',   92],
  ['andrea pirlo',       93], ['pirlo',             93],
  ['zinedine zidane',    96],
  ['michel platini',     96], ['platini',           96],
  ['xabi alonso',        91],
  ['sergio busquets',    89], ['busquets',          89],
  ['casemiro',           88],
  ['sami khedira',       84], ['khedira',           84],
  ['mesut özil',         88], ['mesut ozil',        88], ['özil',      88], ['ozil', 88],
  ['cesc fàbregas',      87], ['fabregas',          87], ['fàbregas',  87],
  ['frank lampard',      89], ['lampard',           89],
  ['steven gerrard',     89], ['gerrard',           89],
  ['paul scholes',       88], ['scholes',           88],
  ['ryan giggs',         88], ['giggs',             88],
  ['patrick vieira',     90], ['vieira',            90],
  ['claude makélélé',    88], ['makelele',          88], ['makélélé',  88],
  ['fernando redondo',   89],
  ['pablo aimar',        86], ['aimar',             86],
  ['pep guardiola',      88],
  ['federico valverde',  88],
  ['jude bellingham',    90], ['bellingham',        90],
  ['kevin de bruyne',    92], ['de bruyne',         92],
  ['eden hazard',        89], ['hazard',            89],
  ['camavinga',          85],
  ['pedri',              88], ['frenkie de jong',   88],
  // La Liga quality players — unique enough nicknames
  ['isco alarcón',       84], ['isco',              84],
  ['joaquín sánchez',    82], ['joaquín',           82],
  ['dani ceballos',      82], ['ceballos',          82],
  ['marco asensio',      83], ['asensio',           83],
  ['lucas vázquez',      82], ['lucas vázquez',     82],
  ['nacho fernández',    83],
  ['sergio canales',     83], ['canales',           83],
  ['nabil fekir',        83], ['fekir',             83],
  ['pablo fornals',      81], ['fornals',           81],
  ['dani parejo',        84], ['parejo',            84],
  ['ferran torres',      84],
  ['pablo sarabia',      82], ['sarabia',           82],
  ['mikel oyarzabal',    85], ['oyarzabal',         85],
  ['david silva',        91], // David Silva — unique enough (not generic 'silva')
  // ── Forwards / Attackers ─────────────────────────────────────────────────
  ['lionel messi',       99], ['leo messi',         99], ['messi',     99],
  ['cristiano ronaldo',  99],
  ['ronaldo nazário',    98], ['ronaldo nazario',   98],
  ['ronaldo fenomeno',   97], ['ronaldo r9',        97],
  ['ronaldinho',         96],
  ['pelé',               99], ['pele',              99],
  ['diego maradona',     99], ['maradona',          99],
  ['alfredo di stéfano', 98], ['di stéfano',        98], ['di stefano', 98],
  ['ferenc puskás',      96], ['puskas',            96], ['puskás',    96],
  ['francisco gento',    90], ['gento',             90],
  ['karim benzema',      91], ['benzema',           91],
  ['raúl gonzález',      88], ['raul gonzalez',     88],
  ['gonzalo higuaín',    85], ['higuain',           85], ['higuaín',   85],
  ['zlatan ibrahimovic', 92], ['ibrahimovic',       92], ['ibrahimović',92],
  ['robert lewandowski', 93], ['lewandowski',       93],
  ['luis suárez',        91], ['luis suarez',       91],
  ['neymar',             93],
  ['kylian mbappé',      96], ['mbappe',            96], ['mbappé',    96],
  ['arjen robben',       89], ['robben',            89],
  ['franck ribéry',      90], ['ribery',            90], ['ribéry',    90],
  ['gareth bale',        87],
  ['marco van basten',   98], ['van basten',        98],
  ['ruud van nistelrooy',88], ['van nistelrooy',    88],
  ['thierry henry',      93],
  ['jürgen klinsmann',   87], ['klinsmann',         87],
  ['thomas müller',      88], ['thomas muller',     88],
  ['ángel di maría',     88], ['angel di maria',    88], ['di maría',  88], ['di maria', 88],
  ['vinícius jr',        89], ['vinicius jr',       89], ['vinícius',  89], ['vinicius', 89],
  ['mo salah',           91], ['salah',             91],
  ['sadio mané',         89], ['sadio mane',        89],
  ['harry kane',         91],
  ['son heung-min',      88], ['heung-min',         88],
  ['antoine griezmann',  89], ['griezmann',         89],
  ['samuel eto\'o',      92], ['eto\'o',            92],
  ['carlos tevez',       88], ['tevez',             88],
  ['sergio agüero',      90], ['aguero',            90], ['agüero',    90],
  ['wayne rooney',       89], ['rooney',            89],
  ['didier drogba',      90], ['drogba',            90],
  ['michael owen',       87],
  ['rivaldo',            93],
  ['romário',            94], ['romario',           94],
  ['hristo stoichkov',   91], ['stoichkov',         91],
  ['george weah',        90],
  ['david villa',        89],
  ['lamine yamal',       87],
  ['wesley sneijder',    88], ['sneijder',          88],
  ['rafael van der vaart',84],['van der vaart',     84],
]);

function calcPlayerRating(player, teamRatings) {
  // 1. Rating ya calculado por el backend (override famoso o mvToRating) — usarlo directamente
  if (player.rating && player.rating > 0) return player.rating;

  // 2. Override por nombre usando el módulo compartido player_ratings.js (cargado antes que app.js)
  if (typeof getPlayerOverride === 'function') {
    const ovr = getPlayerOverride(player.name);
    if (ovr) return ovr;
  }

  // 3. Fallback: media del equipo ± hash determinista del nombre (±8)
  const pos  = player.position;
  const base = pos === 'GK'                        ? teamRatings.goalkeeping
             : ['CB','RB','LB'].includes(pos)      ? teamRatings.defense
             : ['DM','CM','RM','LM'].includes(pos) ? teamRatings.midfield
             :                                       teamRatings.attack;
  let h = 0;
  for (let i = 0; i < player.name.length; i++) h = ((h * 31) + player.name.charCodeAt(i)) & 0xffff;
  return Math.max(55, Math.min(99, Math.round(base + (h % 17) - 8)));
}

// ── Key moments summary ─────────────────────────────────────
function renderKeyMoments(finalScore, data, payload) {
  const el = document.getElementById('key-moments');
  if (!el) return;

  const bullets = [];
  const scoreA = finalScore.teamA, scoreB = finalScore.teamB;
  const teamA = payload.teamA, teamB = payload.teamB;

  // Penalties-only mode: show just the shootout result bullet
  if (payload.matchMode === 'penalties') {
    const pens = finalScore.penalties;
    if (pens) {
      const penWinner = pens.winner === 'A' ? teamA : teamB;
      const sdTxt = pens.suddenDeath ? (` ${t('pen-winner-sd')}`) : '';
      bullets.push(`🥅 ${escHtml(penWinner)} ${t('pen-winner-suffix')} ${pens.scoreA}–${pens.scoreB}${sdTxt}`);
    }
    el.innerHTML = bullets.map(b => `<div class="km-bullet">${b}</div>`).join('');
    el.style.display = bullets.length ? '' : 'none';
    return;
  }

  const redsA = (finalScore.cardsA?.red || []).length;
  const redsB = (finalScore.cardsB?.red || []).length;
  const totalReds = redsA + redsB;
  const mom = data.mom;

  // Penalties decided the match
  if (finalScore.penalties) {
    bullets.push(`🎯 ${t('km-extra-time')}`);
  }
  // Thrashing (3+ goal difference)
  const diff = Math.abs(scoreA - scoreB);
  if (diff >= 3) {
    const winner = scoreA > scoreB ? teamA : teamB;
    bullets.push(`💥 ${t('km-thrashing')}: ${escHtml(winner)} (${scoreA}–${scoreB})`);
  } else if (scoreA === scoreB && !finalScore.penalties) {
    bullets.push(`⚖️ ${t('km-draw')}`);
  }
  // Red cards
  if (totalReds >= 2) {
    bullets.push(`🟥 ${t('km-reds')} (${totalReds})`);
  } else if (totalReds === 1) {
    const red = (redsA ? finalScore.cardsA.red[0] : finalScore.cardsB.red[0]);
    bullets.push(`🟥 Expulsión: ${escHtml(red.name)} (${red.minute}')`);
  }
  // Clean sheet
  if (scoreA === 0) bullets.push(`🧤 ${t('km-clean-sheet')}: ${escHtml(teamB)}`);
  else if (scoreB === 0) bullets.push(`🧤 ${t('km-clean-sheet')}: ${escHtml(teamA)}`);
  // Top scorer (2+ goals)
  const allScorers = [...(finalScore.scorersA || []), ...(finalScore.scorersB || [])];
  const scorerMap = {};
  allScorers.forEach(s => { scorerMap[s.name] = (scorerMap[s.name] || 0) + 1; });
  const topScorer = Object.entries(scorerMap).sort((a, b) => b[1] - a[1])[0];
  if (topScorer && topScorer[1] >= 2) {
    bullets.push(`⚽ ${t('km-clutch')}: ${escHtml(topScorer[0])} (${topScorer[1]} goles)`);
  } else if (mom) {
    bullets.push(`⭐ ${t('km-clutch')}: ${escHtml(mom.name)}`);
  }
  // Referee
  if (_selectedReferee) {
    const s = _selectedReferee.strictness;
    if (s >= 1.3) bullets.push(`🟨 ${escHtml(_selectedReferee.name)} fue muy estricto (strictness ${s.toFixed(2)})`);
    else if (s <= 0.8) bullets.push(`😌 ${escHtml(_selectedReferee.name)} dejó jugar (strictness ${s.toFixed(2)})`);
  }

  if (!bullets.length) { el.style.display = 'none'; return; }

  el.innerHTML =
    `<div class="km-title">📋 ${t('km-title')}</div>` +
    `<ul class="km-list">${bullets.map(b => `<li>${b}</li>`).join('')}</ul>`;
  el.style.display = 'block';
}

// ── Radar (spider) chart — premium redesign ─────────────────
function drawRadar(ratings, teamA, teamB) {
  const axes = [
    { label: t('radar-attack'),      vA: ratings.teamA.attack,      vB: ratings.teamB.attack },
    { label: t('radar-midfield'),    vA: ratings.teamA.midfield,    vB: ratings.teamB.midfield },
    { label: t('radar-defense'),     vA: ratings.teamA.defense,     vB: ratings.teamB.defense },
    { label: t('radar-goalkeeping'), vA: ratings.teamA.goalkeeping, vB: ratings.teamB.goalkeeping },
    { label: t('radar-physical'),
      vA: Math.round((ratings.teamA.attack + ratings.teamA.midfield) / 2),
      vB: Math.round((ratings.teamB.attack + ratings.teamB.midfield) / 2) },
  ];
  const N = axes.length;
  const cx = 110, cy = 110, R = 78;
  const angle = i => (Math.PI * 2 * i / N) - Math.PI / 2;
  const pt    = (r, i) => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
  const maxV  = 100; // fixed scale 0-100

  let svg = `<defs>
    <filter id="rdr-glow-a" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="rdr-glow-b" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <linearGradient id="rdr-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a1628"/>
      <stop offset="100%" stop-color="#060e1a"/>
    </linearGradient>
  </defs>`;

  // Background
  svg += `<rect width="220" height="220" rx="10" fill="url(#rdr-bg)"/>`;

  // Grid rings with labels
  [25, 50, 75, 100].forEach((pct, ri) => {
    const f = pct / 100;
    const pts = axes.map((_, i) => pt(R * f, i).join(',')).join(' ');
    svg += `<polygon points="${pts}" fill="none" stroke="rgba(0,212,255,${ri === 3 ? .18 : .08})" stroke-width="${ri === 3 ? .9 : .6}" stroke-dasharray="${ri < 3 ? '3 3' : ''}"/>`;
    // small value label on rightmost axis
    const [lx, ly] = pt(R * f, 1);
    svg += `<text x="${(lx+2).toFixed(1)}" y="${ly.toFixed(1)}" font-size="6" fill="rgba(0,212,255,.35)"
      font-family="Rajdhani,sans-serif" dominant-baseline="middle">${pct}</text>`;
  });

  // Axis spokes
  axes.forEach((_, i) => {
    const [x, y] = pt(R, i);
    svg += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(0,212,255,.14)" stroke-width=".8"/>`;
  });

  // Team B fill (draw first so A is on top)
  const ptsB = axes.map((a, i) => pt(R * a.vB / maxV, i).join(',')).join(' ');
  svg += `<polygon points="${ptsB}" fill="rgba(231,76,60,.18)" stroke="#ff4d55" stroke-width="1.8"
    stroke-linejoin="round" filter="url(#rdr-glow-b)" opacity=".9"/>`;

  // Team A fill
  const ptsA = axes.map((a, i) => pt(R * a.vA / maxV, i).join(',')).join(' ');
  svg += `<polygon points="${ptsA}" fill="rgba(79,131,255,.2)" stroke="#4f83ff" stroke-width="1.8"
    stroke-linejoin="round" filter="url(#rdr-glow-a)" opacity=".9"/>`;

  // Dots + value callouts
  axes.forEach((a, i) => {
    const [xA, yA] = pt(R * a.vA / maxV, i);
    const [xB, yB] = pt(R * a.vB / maxV, i);
    svg += `<circle cx="${xA}" cy="${yA}" r="3.5" fill="#4f83ff" stroke="rgba(255,255,255,.4)" stroke-width=".8" filter="url(#rdr-glow-a)"/>`;
    svg += `<circle cx="${xB}" cy="${yB}" r="3.5" fill="#ff4d55" stroke="rgba(255,255,255,.4)" stroke-width=".8" filter="url(#rdr-glow-b)"/>`;
  });

  // Axis labels
  axes.forEach((a, i) => {
    const [x, y] = pt(R + 16, i);
    const anchor = x < cx - 8 ? 'end' : x > cx + 8 ? 'start' : 'middle';
    svg += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle"
      fill="rgba(255,255,255,.75)" font-size="9.5" font-family="Rajdhani,sans-serif"
      font-weight="700" letter-spacing=".03em">${a.label}</text>`;
    // value pair
    const [vx, vy] = pt(R + 28, i);
    svg += `<text x="${vx.toFixed(1)}" y="${vy.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle"
      font-size="7.5" font-family="Rajdhani,sans-serif" font-weight="800">
      <tspan fill="#4f83ff">${a.vA}</tspan><tspan fill="rgba(255,255,255,.3)"> · </tspan><tspan fill="#ff4d55">${a.vB}</tspan>
    </text>`;
  });

  document.getElementById('radar-svg').setAttribute('viewBox', '0 0 220 220');
  document.getElementById('radar-svg').innerHTML = svg;

  // Legend
  const leg = document.getElementById('radar-legend');
  leg.innerHTML =
    `<span class="radar-legend-item"><span class="radar-legend-dot" style="background:#4f83ff;box-shadow:0 0 6px #4f83ff"></span>${escHtml(teamA.slice(0,16))}</span>` +
    `<span class="radar-legend-item"><span class="radar-legend-dot" style="background:#ff4d55;box-shadow:0 0 6px #ff4d55"></span>${escHtml(teamB.slice(0,16))}</span>`;
}

// ── Live Smart-Dot Pitch ──────────────────────────────────────
const _LP = { W: 160, H: 240, cx: 80, cy: 120 };

// Rating → tier colour
function _lpTierColor(ovr) {
  if (ovr >= 88) return '#39ff9f';
  if (ovr >= 80) return '#e8a820';
  if (ovr >= 70) return '#9ab0cc';
  if (ovr >= 60) return '#aa6832';
  return '#c05050';
}

// Formation-aware position builder.
// Buckets every player into a tactical row (GK/DEF/DM/MID/AM/FWD)
// then distributes each row evenly across the width — zero overlaps for
// any formation (4-4-2, 4-3-3, 3-5-2, 5-3-2, etc.).
function _buildFormationPositions(players, isTeamA) {
  // Row index per position code (3 = midfield fallback for unknown)
  const ROW = {
    GK:0,
    SW:1, CB:1, RB:1, LB:1, RWB:1, LWB:1,
    CDM:2, DM:2,
    CM:3, RM:3, LM:3,
    CAM:4, AM:4,
    RW:5, LW:5, SS:5, CF:5, ST:5
  };
  // Left-to-right order within a row (negative = left side)
  const H_ORDER = {
    LWB:-3, LB:-2, LW:-2, LM:-2,
    SW:0, CB:0, DM:0, CDM:0, CM:0, AM:0, CAM:0, CF:0, SS:0, GK:0, ST:0,
    RB:2, RM:2, RW:2, RWB:3
  };
  // y positions as fraction of pitch height
  // Team A: defends top  → GK at low y, forwards at high y
  // Team B: defends bottom → GK at high y, forwards at low y
  const ROW_Y_A = [0.07, 0.20, 0.33, 0.47, 0.58, 0.72];
  const ROW_Y_B = [0.93, 0.80, 0.67, 0.53, 0.42, 0.28];
  const rowY = isTeamA ? ROW_Y_A : ROW_Y_B;

  const buckets = Array.from({ length: 6 }, () => []);
  players.forEach((p, i) => {
    const row = ROW[p.position] ?? 3;
    buckets[row].push(i);
  });

  const pos = new Array(players.length);
  buckets.forEach((idxList, rowIdx) => {
    if (!idxList.length) return;
    // Sort within row left→right (mirror for Team B so L/R names stay correct)
    idxList.sort((a, b) => {
      const oa = H_ORDER[players[a].position] ?? 0;
      const ob = H_ORDER[players[b].position] ?? 0;
      return isTeamA ? oa - ob : ob - oa;
    });
    const y = rowY[rowIdx];
    const n = idxList.length;
    idxList.forEach((playerIdx, j) => {
      const x = n === 1 ? 0.50 : 0.12 + j * 0.76 / (n - 1);
      pos[playerIdx] = { x, y };
    });
  });
  return pos; // pos[i] = { x, y } as [0,1] fractions
}

const _JERSEY_LP = { GK:1, RB:2, CB:5, LB:3, DM:6, CM:8, RM:7, LM:11, AM:10, RW:7, LW:11, ST:9 };

let _pitchDots       = { a: [], b: [], ball: null };
let _pitchDriftInterval = null;
let _lpBallOwnerEl   = null;  // current ball-owner dot <g> element
let _lpParticleEl    = null;
let _driftTick       = 0;     // attack-wave counter
let _attackBias      = 0;     // +1=team A attacking, -1=team B attacking
let _attackBiasTimer = null;
let _heatmapData     = { a: [], b: [] }; // position samples per team
let _distanceData    = {};               // player name → accumulated px distance
let _prevPos         = {};               // last known position per player name
let _distSamples     = 0;                // drift-tick distance samples taken this match (for km normalisation)

function _lpHexGrid(W, H) {
  const s = 9;
  const dx = s * Math.sqrt(3), dy = s * 1.5;
  const rows = Math.ceil(H / dy) + 2, cols = Math.ceil(W / dx) + 2;
  let d = '';
  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      const hx = col * dx + (row % 2 === 0 ? 0 : dx / 2);
      const hy = row * dy;
      let pts = '';
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 180 * (60 * i - 30);
        pts += (i === 0 ? 'M' : 'L') + (hx + s * Math.cos(a)).toFixed(1) + ',' + (hy + s * Math.sin(a)).toFixed(1);
      }
      d += pts + 'Z ';
    }
  }
  return `<path d="${d}" fill="none" stroke="rgba(80,220,180,.06)" stroke-width=".35" class="lp-hex"/>`;
}

function initLivePitch(lineupA, lineupB) {
  const svg = document.getElementById('live-pitch-svg');
  if (!svg) return;

  // Reset heatmap/distance tracking for fresh match
  _heatmapData = { a: [], b: [] };
  _distanceData = {};
  _prevPos = {};
  _distSamples = 0;

  const W = _LP.W, H = _LP.H, cx = _LP.cx, cy = _LP.cy;

  const rgsA = _liveData?.ratings?.teamA || { attack:72, midfield:72, defense:72, goalkeeping:72 };
  const rgsB = _liveData?.ratings?.teamB || { attack:72, midfield:72, defense:72, goalkeeping:72 };

  const playersA = (lineupA?.players || []).map(p => ({ ...p, _ovr: calcPlayerRating(p, rgsA) }));
  const playersB = (lineupB?.players || []).map(p => ({ ...p, _ovr: calcPlayerRating(p, rgsB) }));

  // Pick ball owner = highest-rated player (initial state)
  const allPlayers = [...playersA, ...playersB];
  const heroPlayer = allPlayers.reduce((b, p) => (!b || p._ovr > b._ovr) ? p : b, null);

  // ── Defs ────────────────────────────────────────────────────────────────
  let markup = `<defs>
    <radialGradient id="lp-pitch-grad" cx="50%" cy="50%" r="72%">
      <stop offset="0%"   stop-color="#0c2416"/>
      <stop offset="100%" stop-color="#040e08"/>
    </radialGradient>
    <radialGradient id="lp-ball-grad" cx="35%" cy="30%" r="65%">
      <stop offset="0%"   stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#44aaff"/>
    </radialGradient>
    <filter id="lp-dot-glow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="lp-hero-glow" x="-120%" y="-120%" width="340%" height="340%">
      <feGaussianBlur stdDeviation="3.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="lp-clip"><rect width="${W}" height="${H}" rx="6"/></clipPath>
  </defs>`;

  // ── Background ─────────────────────────────────────────────────────────
  markup += `<rect width="${W}" height="${H}" rx="6" fill="url(#lp-pitch-grad)"/>`;
  markup += `<g clip-path="url(#lp-clip)">${_lpHexGrid(W, H)}</g>`;

  // ── Pitch markings ──────────────────────────────────────────────────────
  markup += `<g clip-path="url(#lp-clip)" fill="none">
    <rect x="1" y="1" width="${W-2}" height="${H-2}" rx="5"
      stroke="rgba(255,255,255,.15)" stroke-width=".6"/>
    <line x1="0" y1="${H/2}" x2="${W}" y2="${H/2}"
      stroke="rgba(255,255,255,.18)" stroke-width=".6"/>
    <circle cx="${cx}" cy="${cy}" r="20"
      stroke="rgba(255,255,255,.15)" stroke-width=".6"/>
    <rect x="44" y="1"      width="72" height="22" rx="1"
      stroke="rgba(255,255,255,.12)" stroke-width=".5"/>
    <rect x="44" y="${H-23}" width="72" height="22" rx="1"
      stroke="rgba(255,255,255,.12)" stroke-width=".5"/>
    <rect x="58" y="1"      width="44" height="10" rx="1"
      stroke="rgba(255,255,255,.1)"  stroke-width=".4"/>
    <rect x="58" y="${H-11}" width="44" height="10" rx="1"
      stroke="rgba(255,255,255,.1)"  stroke-width=".4"/>
    <!-- Goal frames (crossbar + posts) -->
    <line x1="58" y1="1"       x2="102" y2="1"       stroke="rgba(255,255,255,.65)" stroke-width="1.8"/>
    <line x1="58" y1="1"       x2="58"  y2="11"      stroke="rgba(255,255,255,.5)"  stroke-width="1.4"/>
    <line x1="102" y1="1"      x2="102" y2="11"      stroke="rgba(255,255,255,.5)"  stroke-width="1.4"/>
    <rect x="58.5" y="1.5"     width="43" height="9" fill="rgba(79,131,255,.1)"     rx="0"/>
    <line x1="58" y1="${H-1}"  x2="102" y2="${H-1}"  stroke="rgba(255,255,255,.65)" stroke-width="1.8"/>
    <line x1="58" y1="${H-1}"  x2="58"  y2="${H-11}" stroke="rgba(255,255,255,.5)"  stroke-width="1.4"/>
    <line x1="102" y1="${H-1}" x2="102" y2="${H-11}" stroke="rgba(255,255,255,.5)"  stroke-width="1.4"/>
    <rect x="58.5" y="${H-10.5}" width="43" height="9" fill="rgba(255,77,85,.1)"    rx="0"/>
  </g>`;

  // ── Border glow ─────────────────────────────────────────────────────────
  markup += `<rect width="${W}" height="${H}" rx="6" fill="none"
    stroke="rgba(0,212,255,.3)" stroke-width="1"/>`;

  // ── Placeholder for particle stream ────────────────────────────────────
  markup += `<g id="lp-particle-layer"></g>`;

  // ── Write static markup → DOM ───────────────────────────────────────────
  svg.innerHTML = markup;

  // ── Render players as Smart Dots ────────────────────────────────────────
  _pitchDots.a = [];
  _pitchDots.b = [];
  _lpBallOwnerEl = null;

  const usedNumsA = new Set(), usedNumsB = new Set();
  let bestOvr = -1, ballOwnerX = cx, ballOwnerY = cy;

  const renderTeam = (players, posList, rimColor, fillColor, usedNums, teamKey) => {
    const EL = [];
    players.forEach((p, i) => {
      const pos = p.position || 'CM';
      const slot = posList[i] || { x: 0.5, y: 0.5 };
      const bx = slot.x * W;
      const by = slot.y * H;
      let num = _JERSEY_LP[pos] ?? (i + 1);
      while (usedNums.has(num)) num++;
      usedNums.add(num);

      const ovr     = p._ovr;
      const tierCol = _lpTierColor(ovr);
      const isHero  = heroPlayer && p.name === heroPlayer.name;
      const R       = isHero ? 7.5 : 6;  // hero dot slightly larger

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${bx},${by})`);
      g.classList.add('lp-player-g');
      if (isHero) g.classList.add('lp-hero-dot');
      g.dataset.bx    = bx;
      g.dataset.by    = by;
      g.dataset.homex = bx;
      g.dataset.homey = by;
      g.dataset.pos  = pos;
      g.dataset.name = p.name;
      g.dataset.ovr  = ovr;
      g.dataset.num  = num;
      g.dataset.tier = tierCol;
      g.dataset.team = teamKey;

      // Smart dot: dark glass fill + glowing rim
      g.innerHTML = `
        <circle r="${R+2}" fill="${rimColor}" opacity=".18" class="lp-dot-outer-ring"/>
        <circle r="${R}" fill="${fillColor}" stroke="${rimColor}" stroke-width="1.4"
          class="lp-dot-main" filter="url(#lp-dot-glow)"/>
        <circle r="${R*.55}" fill="rgba(255,255,255,.12)"/>
        <text y="1" text-anchor="middle" dominant-baseline="middle"
          font-family="'Rajdhani',sans-serif" font-size="${isHero ? 4.8 : 4.2}"
          font-weight="800" fill="rgba(255,255,255,.92)">${num}</text>
        <g class="lp-dot-tooltip" opacity="0" pointer-events="none">
          <rect x="-17" y="${-(R+14)}" width="34" height="11" rx="2.5"
            fill="rgba(3,8,20,.92)" stroke="${tierCol}" stroke-width=".65"/>
          <text x="0" y="${-(R+10)}" text-anchor="middle" dominant-baseline="middle"
            font-family="'Rajdhani',sans-serif" font-size="3.4" font-weight="700"
            fill="rgba(255,255,255,.85)">${pos}</text>
          <text x="0" y="${-(R+5.5)}" text-anchor="middle" dominant-baseline="middle"
            font-family="'Rajdhani',sans-serif" font-size="3.8" font-weight="900"
            fill="${tierCol}">${ovr}</text>
        </g>`;

      // Hover / touch: show tooltip
      const showTip = () => {
        const tip = g.querySelector('.lp-dot-tooltip');
        if (tip) tip.setAttribute('opacity', '1');
        g.style.zIndex = '99';
      };
      const hideTip = () => {
        const tip = g.querySelector('.lp-dot-tooltip');
        if (tip) tip.setAttribute('opacity', '0');
      };
      g.addEventListener('mouseenter', showTip);
      g.addEventListener('mouseleave', hideTip);
      g.addEventListener('touchstart', e => { e.preventDefault(); showTip(); }, { passive: false });
      g.addEventListener('touchend', () => setTimeout(hideTip, 1400));

      svg.appendChild(g);
      EL.push(g);

      if (ovr > bestOvr) {
        bestOvr = ovr;
        ballOwnerX = bx;
        ballOwnerY = by;
        _lpBallOwnerEl = g;
      }
    });
    return EL;
  };

  _pitchDots.a = renderTeam(playersA, _buildFormationPositions(playersA, true),  '#4f83ff', 'rgba(10,20,50,.85)',  usedNumsA, 'a');
  _pitchDots.b = renderTeam(playersB, _buildFormationPositions(playersB, false), '#ff4d55', 'rgba(50,10,14,.85)',  usedNumsB, 'b');

  // ── Ball ─────────────────────────────────────────────────────────────────
  const ballG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  ballG.setAttribute('transform', `translate(${cx},${cy})`);
  ballG.classList.add('lp-ball-g');
  ballG.dataset.bx = cx;
  ballG.dataset.by = cy;
  ballG.innerHTML = `
    <circle r="4.5" fill="url(#lp-ball-grad)" stroke="rgba(255,255,255,.75)" stroke-width=".7"/>
    <circle r="1.8" fill="rgba(255,255,255,.55)"/>`;
  svg.appendChild(ballG);
  _pitchDots.ball = ballG;

  // ── Particle stream: ball-owner → ball ──────────────────────────────────
  const streamLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  streamLine.setAttribute('x1', ballOwnerX);
  streamLine.setAttribute('y1', ballOwnerY);
  streamLine.setAttribute('x2', cx);
  streamLine.setAttribute('y2', cy);
  streamLine.setAttribute('stroke', _lpTierColor(bestOvr));
  streamLine.setAttribute('stroke-width', '0.8');
  streamLine.setAttribute('stroke-dasharray', '2 4');
  streamLine.setAttribute('opacity', '0.4');
  streamLine.classList.add('lp-particle');
  svg.appendChild(streamLine);
  _lpParticleEl = streamLine;

  _startPitchDrift();
}

// ── Penalty-only pitch: GK vs GK, ball at centre ─────────────
function initPenaltyPitch(lineupA, lineupB) {
  const svg = document.getElementById('live-pitch-svg');
  if (!svg) return;
  const W = _LP.W, H = _LP.H, cx = _LP.cx;

  svg.innerHTML = `<defs>
    <radialGradient id="lp-pitch-grad" cx="50%" cy="50%" r="72%">
      <stop offset="0%"   stop-color="#0c2416"/>
      <stop offset="100%" stop-color="#040e08"/>
    </radialGradient>
    <radialGradient id="lp-ball-grad" cx="35%" cy="30%" r="65%">
      <stop offset="0%"   stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#44aaff"/>
    </radialGradient>
    <filter id="lp-dot-glow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="lp-clip"><rect width="${W}" height="${H}" rx="6"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" rx="6" fill="url(#lp-pitch-grad)"/>
  <g clip-path="url(#lp-clip)" fill="none">
    <rect x="1" y="1" width="${W-2}" height="${H-2}" rx="5"
      stroke="rgba(255,255,255,.15)" stroke-width=".6"/>
    <rect x="44" y="1" width="72" height="22" rx="1"
      stroke="rgba(255,255,255,.22)" stroke-width=".7"/>
    <rect x="58" y="1" width="44" height="10" rx="1"
      stroke="rgba(255,255,255,.14)" stroke-width=".5"/>
    <circle cx="${cx}" cy="${H*.17}" r="1.5" fill="rgba(255,255,255,.7)"/>
    <rect x="44" y="${H-23}" width="72" height="22" rx="1"
      stroke="rgba(255,255,255,.22)" stroke-width=".7"/>
    <rect x="58" y="${H-11}" width="44" height="10" rx="1"
      stroke="rgba(255,255,255,.14)" stroke-width=".5"/>
    <circle cx="${cx}" cy="${H*.83}" r="1.5" fill="rgba(255,255,255,.7)"/>
    <line x1="0" y1="${H/2}" x2="${W}" y2="${H/2}"
      stroke="rgba(255,255,255,.1)" stroke-width=".5"/>
    <circle cx="${cx}" cy="${H/2}" r="20"
      stroke="rgba(255,255,255,.07)" stroke-width=".5"/>
  </g>
  <rect width="${W}" height="${H}" rx="6" fill="none"
    stroke="rgba(0,212,255,.3)" stroke-width="1"/>`;

  _pitchDots.a = []; _pitchDots.b = []; _lpBallOwnerEl = null;

  const mkG = (x, y, rim, fill, label) => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${x},${y})`);
    g.classList.add('lp-player-g', 'lp-hero-dot');
    // Set both current position AND home anchor so drift (if any) stays anchored
    g.dataset.bx = x; g.dataset.by = y;
    g.dataset.homex = x; g.dataset.homey = y;
    g.innerHTML = `
      <circle r="9" fill="${fill}" opacity=".2" class="lp-dot-outer-ring"/>
      <circle r="7" fill="${fill}" stroke="${rim}" stroke-width="2"
        class="lp-dot-main" filter="url(#lp-dot-glow)"/>
      <text y="1" text-anchor="middle" dominant-baseline="middle"
        font-family="'Rajdhani',sans-serif" font-size="5.5" font-weight="900"
        fill="rgba(255,255,255,.95)">${label}</text>`;
    svg.appendChild(g);
    return g;
  };

  // GK A top; GK B bottom
  _pitchDots.a.push(mkG(cx, H * 0.06, '#4f83ff', 'rgba(10,20,50,.9)', '1'));
  _pitchDots.b.push(mkG(cx, H * 0.94, '#ff4d55', 'rgba(50,10,14,.9)', '1'));

  // Ball at centre
  const ballG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  ballG.setAttribute('transform', `translate(${cx},${H * 0.5})`);
  ballG.classList.add('lp-ball-g');
  ballG.dataset.bx = cx; ballG.dataset.by = H * 0.5;
  ballG.innerHTML = `
    <circle r="5" fill="url(#lp-ball-grad)" stroke="rgba(255,255,255,.8)" stroke-width=".8"/>
    <circle r="2" fill="rgba(255,255,255,.6)"/>`;
  svg.appendChild(ballG);
  _pitchDots.ball = ballG;

  // Penalty pitch: GKs should sit still — no drift interval needed
  // (_driftPlayers jitter would move them around the full field)
}

function _startPitchDrift() {
  if (_attackBiasTimer) { clearTimeout(_attackBiasTimer); _attackBiasTimer = null; }
  _pitchDriftInterval = setInterval(_driftPlayers, 600);
}

function _driftPlayers() {
  const W = _LP.W, H = _LP.H;
  _driftTick++;
  // Every 4 ticks (~2.4s) trigger an attack/defense wave
  if (_driftTick % 4 === 0 && !_attackBiasTimer) {
    _attackBias = Math.random() < .5 ? 1 : -1;
    _attackBiasTimer = setTimeout(() => { _attackBias = 0; _attackBiasTimer = null; }, 2400);
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // Move each player: pull toward home zone + jitter.
  // Updating dataset.bx/by lets movement compound realistically.
  const movePlayer = (g, yBias) => {
    const hx = parseFloat(g.dataset.homex || g.dataset.bx);
    const hy = parseFloat(g.dataset.homey || g.dataset.by);
    const cx = parseFloat(g.dataset.bx);
    const cy = parseFloat(g.dataset.by);
    // 8% pull toward home each tick + ±18px jitter + attack y-bias
    const nx = clamp(cx + (hx - cx) * 0.08 + (Math.random() - .5) * 22, 6, W - 6);
    const ny = clamp(cy + (hy - cy) * 0.08 + (Math.random() - .5) * 22 + (yBias || 0), 6, H - 6);
    g.setAttribute('transform', `translate(${nx},${ny})`);
    g.dataset.bx = nx;
    g.dataset.by = ny;
  };

  const yBiasA = _attackBias === 1 ? 6 : _attackBias === -1 ? -4 : 0;
  const yBiasB = _attackBias === -1 ? -6 : _attackBias === 1 ? 4 : 0;
  _pitchDots.a.forEach(g => movePlayer(g, yBiasA));
  _pitchDots.b.forEach(g => movePlayer(g, yBiasB));

  // ── Heatmap + distance tracking (every other tick) ───────────────────
  if (_driftTick % 2 === 0) {
    _distSamples++;
    [..._pitchDots.a, ..._pitchDots.b].forEach(g => {
      const nx   = parseFloat(g.dataset.bx);
      const ny   = parseFloat(g.dataset.by);
      const team = g.dataset.team;
      const key  = g.dataset.name;
      // Heatmap sample (normalised 0-1, cap at 800 per team)
      if (team === 'a' || team === 'b') {
        if (_heatmapData[team] && _heatmapData[team].length < 800) {
          _heatmapData[team].push({ x: nx / W, y: ny / H });
        }
      }
      // Distance accumulation
      if (key && _prevPos[key]) {
        const dx = nx - _prevPos[key].x;
        const dy = ny - _prevPos[key].y;
        _distanceData[key] = (_distanceData[key] || 0) + Math.sqrt(dx * dx + dy * dy);
      }
      if (key) _prevPos[key] = { x: nx, y: ny, team };
    });
  }

  // Ball: 40% chance "pass" near a random player, else roll freely across the whole field
  if (_pitchDots.ball) {
    const allDots = [..._pitchDots.a, ..._pitchDots.b];
    let nbx, nby;
    if (allDots.length > 0 && Math.random() < 0.4) {
      const target = allDots[Math.floor(Math.random() * allDots.length)];
      nbx = clamp(parseFloat(target.dataset.bx) + (Math.random() - .5) * 14, 4, W - 4);
      nby = clamp(parseFloat(target.dataset.by) + (Math.random() - .5) * 14, 4, H - 4);
    } else {
      const bx = parseFloat(_pitchDots.ball.dataset.bx || _LP.cx);
      const by = parseFloat(_pitchDots.ball.dataset.by || _LP.cy);
      nbx = clamp(bx + (Math.random() - .5) * 40, 4, W - 4);
      nby = clamp(by + (Math.random() - .5) * 40, 4, H - 4);
    }
    _pitchDots.ball.setAttribute('transform', `translate(${nbx},${nby})`);
    _pitchDots.ball.dataset.bx = nbx;
    _pitchDots.ball.dataset.by = nby;

    // Update particle stream
    if (_lpParticleEl) {
      _lpParticleEl.setAttribute('x2', nbx);
      _lpParticleEl.setAttribute('y2', nby);
      if (_lpBallOwnerEl) {
        const t = _lpBallOwnerEl.getAttribute('transform') || '';
        const m = t.match(/translate\(([^,]+),([^)]+)\)/);
        if (m) { _lpParticleEl.setAttribute('x1', m[1]); _lpParticleEl.setAttribute('y1', m[2]); }
      }
    }
  }
}

// ── Pitch event helpers ───────────────────────────────────────
function _findDotByName(name) {
  if (!name) return null;
  const needle = name.toLowerCase();
  const all = [..._pitchDots.a, ..._pitchDots.b];
  return all.find(g => {
    const n = (g.dataset.name || '').toLowerCase();
    return n && n.includes(needle);
  }) || null;
}
function _flashDot(g, color, duration) {
  if (!g) return;
  const main = g.querySelector('.lp-dot-main');
  if (!main) return;
  const origStroke = main.getAttribute('stroke');
  const origWidth  = main.getAttribute('stroke-width');
  main.setAttribute('stroke', color);
  main.setAttribute('stroke-width', '3');
  setTimeout(() => {
    main.setAttribute('stroke', origStroke || '#4f83ff');
    main.setAttribute('stroke-width', origWidth || '1.4');
  }, duration);
}

function animatePitchEvent(type, ev) {
  const svg = document.getElementById('live-pitch-svg');
  const phaseEl = document.getElementById('live-pitch-phase');
  if (!svg || !phaseEl) return;

  function setPhase(txt) {
    phaseEl.textContent = txt;
  }

  // Resolve the team name for display in the pitch phase label
  const teamLabel = ev.side === 'A'
    ? (_livePayload?.teamA || 'A')
    : (_livePayload?.teamB || 'B');

  if (type === 'goal') {
    setPhase(`${t('phase-goal')} — ${teamLabel}`);
    const attackers = ev.side === 'A' ? _pitchDots.a : _pitchDots.b;
    attackers.forEach(g => {
      const goalY = ev.side === 'A' ? _LP.H * 0.88 : _LP.H * 0.12;
      const bx = parseFloat(g.dataset.bx);
      const by = parseFloat(g.dataset.by);
      const nx = bx + (Math.random() - .5) * 12;
      const ny = by + (goalY - by) * 0.4;
      g.setAttribute('transform', `translate(${nx},${ny})`);
    });
    if (_pitchDots.ball) {
      const bx = _LP.cx + (Math.random() - .5) * 20;
      const by = ev.side === 'A' ? _LP.H * 0.92 : _LP.H * 0.08;
      _pitchDots.ball.setAttribute('transform', `translate(${bx},${by})`);
    }
    setTimeout(() => { setPhase(t('phase-playing')); _resetToBase(); }, 2200);
  } else if (type === 'yellow' || type === 'red') {
    setPhase(type === 'yellow'
      ? `${t('phase-yellow')} — ${teamLabel}`
      : `${t('phase-red')} — ${teamLabel}`);
    // Flash the carded player's dot
    const culprit = _findDotByName(ev.name);
    _flashDot(culprit, type === 'yellow' ? '#ffdc00' : '#ff2020', 1800);
    // Player steps back slightly (guilty retreat)
    if (culprit) {
      const bx = parseFloat(culprit.dataset.bx);
      const by = parseFloat(culprit.dataset.by);
      const pullY = ev.side === 'A' ? -10 : 10;
      culprit.setAttribute('transform', `translate(${bx},${by + pullY})`);
    }
    setTimeout(() => { setPhase(t('phase-playing')); _resetToBase(); }, 1800);

  } else if (type === 'penalty-miss') {
    setPhase(`${t('phase-pen-miss')} — ${teamLabel}`);
    // Ball flies wide of the goal
    if (_pitchDots.ball) {
      const missX = _LP.cx + (Math.random() > .5 ? 1 : -1) * (28 + Math.random() * 14);
      const missY = ev.side === 'A' ? _LP.H * 0.04 : _LP.H * 0.96;
      _pitchDots.ball.setAttribute('transform', `translate(${missX},${missY})`);
    }
    setTimeout(() => { setPhase(t('phase-playing')); _resetToBase(); }, 1800);

  } else if (type === 'corner') {
    setPhase(`${t('phase-corner')} — ${teamLabel}`);
    if (_pitchDots.ball) {
      const cornerX = Math.random() < 0.5 ? _LP.W * 0.97 : _LP.W * 0.03;
      const cornerY = ev.side === 'A' ? _LP.H * 0.98 : _LP.H * 0.02;
      _pitchDots.ball.setAttribute('transform', `translate(${cornerX},${cornerY})`);
    }
    // Attackers cluster around penalty area for the cross
    const attackers = ev.side === 'A' ? _pitchDots.a : _pitchDots.b;
    const penY = ev.side === 'A' ? _LP.H * 0.82 : _LP.H * 0.18;
    attackers.forEach((g, i) => {
      const nx = 24 + i * (_LP.W - 48) / Math.max(attackers.length - 1, 1);
      g.setAttribute('transform', `translate(${nx},${penY + (Math.random() - .5) * 12})`);
    });
    setTimeout(() => { setPhase(t('phase-playing')); _resetToBase(); }, 1100);

  } else if (type === 'freekick') {
    setPhase(`${t('phase-freekick')} — ${teamLabel}`);
    // Ball to freekick spot
    if (_pitchDots.ball) {
      const fkX = _LP.cx + (Math.random() - .5) * 40;
      const fkY = ev.side === 'A' ? _LP.H * 0.40 : _LP.H * 0.60;
      _pitchDots.ball.setAttribute('transform', `translate(${fkX},${fkY})`);
      // Defenders form a wall near the ball
      const defenders = ev.side === 'A' ? _pitchDots.b : _pitchDots.a;
      defenders.slice(0, 4).forEach((g, i) => {
        const wx = fkX - 22 + i * 15;
        const wy = ev.side === 'A' ? fkY - 14 : fkY + 14;
        g.setAttribute('transform', `translate(${wx},${wy})`);
      });
    }
    setTimeout(() => { setPhase(t('phase-playing')); _resetToBase(); }, 1200);

  } else if (type === 'injury') {
    setPhase(`${t('phase-injury')} — ${teamLabel}`);
    // Dim the injured player
    const injured = _findDotByName(ev.name);
    if (injured) {
      injured.style.opacity = '0.3';
      setTimeout(() => { injured.style.opacity = ''; }, 2000);
    }
    setTimeout(() => { setPhase(t('phase-playing')); }, 1600);

  } else if (type === 'sub') {
    setPhase(`${t('phase-sub')} — ${teamLabel}`);
    // Swap the injured dot for the substitute
    const dotOut = _findDotByName(ev.playerOut);
    const dotIn  = _findDotByName(ev.playerIn);
    if (dotOut) {
      dotOut.style.opacity = '0.15';
      setTimeout(() => { if (dotOut) dotOut.style.opacity = ''; }, 2400);
    }
    if (dotIn) {
      dotIn.style.opacity = '1';
      dotIn.style.filter  = 'brightness(1.8)';
      setTimeout(() => { if (dotIn) dotIn.style.filter = ''; }, 1800);
    }
    setTimeout(() => { setPhase(t('phase-playing')); }, 1600);
  }
}

function _resetToBase() {
  _pitchDots.a.forEach(g => g.setAttribute('transform', `translate(${g.dataset.bx},${g.dataset.by})`));
  _pitchDots.b.forEach(g => g.setAttribute('transform', `translate(${g.dataset.bx},${g.dataset.by})`));
  if (_pitchDots.ball) _pitchDots.ball.setAttribute('transform', `translate(${_LP.cx},${_LP.cy})`);
}

function stopLivePitch() {
  if (_pitchDriftInterval) { clearInterval(_pitchDriftInterval); _pitchDriftInterval = null; }
  if (_attackBiasTimer)    { clearTimeout(_attackBiasTimer);     _attackBiasTimer = null; }
  _attackBias = 0; _driftTick = 0;
  // Snapshot final player positions into _heatmapData so the post-match card always
  // has data even in "⚡ Directo" (tickMs=0) where the drift interval fires very few times.
  const W = _LP.W || 1, H = _LP.H || 1;
  [..._pitchDots.a, ..._pitchDots.b].forEach(g => {
    const nx   = parseFloat(g.dataset.bx);
    const ny   = parseFloat(g.dataset.by);
    const team = g.dataset.team;
    const key  = g.dataset.name;
    if ((team === 'a' || team === 'b') && _heatmapData[team] && !isNaN(nx)) {
      _heatmapData[team].push({ x: nx / W, y: ny / H });
      if (key) _prevPos[key] = (_prevPos[key] || { x: nx, y: ny, team });
    }
  });
  _pitchDots = { a: [], b: [], ball: null };
  // _heatmapData / _distanceData / _prevPos kept alive for post-match render
}

// ── Match analysis: heatmap + distance recorrida ─────────────
// Canvas-based thermal heatmap: transparent → dark-blue → cyan → green → yellow → orange → red
function _buildHeatColorMap() {
  const stops = [
    [0,   [0,  0,   0,   0  ]],
    [20,  [0,  0,   100, 60 ]],
    [60,  [0,  30,  220, 150]],
    [110, [0,  190, 130, 200]],
    [160, [180,225, 0,   225]],
    [205, [255,110, 0,   245]],
    [255, [255, 20, 0,   255]]
  ];
  const map = [];
  for (let i = 0; i < 256; i++) {
    let s0 = stops[0], s1 = stops[1];
    for (let j = 0; j < stops.length - 1; j++) {
      if (i >= stops[j][0] && i <= stops[j + 1][0]) { s0 = stops[j]; s1 = stops[j + 1]; break; }
    }
    const fac = s1[0] > s0[0] ? (i - s0[0]) / (s1[0] - s0[0]) : 0;
    map.push(s0[1].map((v, k) => Math.round(v + (s1[1][k] - v) * fac)));
  }
  return map;
}

// ── Draw global (both-team) heatmap by layering A then B ────────
function _drawHeatmapGlobal(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const CW = canvas.width, CH = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#061008';
  ctx.fillRect(0, 0, CW, CH);

  // Draw team A in blue channel, B in red channel independently then composite
  const drawTeamLayer = (samples, colorStop0, colorStop1) => {
    const off = document.createElement('canvas');
    off.width = CW; off.height = CH;
    const octx = off.getContext('2d');
    octx.fillStyle = '#000'; octx.fillRect(0, 0, CW, CH);
    octx.globalCompositeOperation = 'lighter';
    const R = CW * 0.12;
    samples.forEach(({ x, y }) => {
      const px = x * CW, py = y * CH;
      const g = octx.createRadialGradient(px, py, 0, px, py, R);
      g.addColorStop(0, colorStop0); g.addColorStop(1, 'rgba(0,0,0,0)');
      octx.fillStyle = g;
      octx.beginPath(); octx.arc(px, py, R, 0, Math.PI * 2); octx.fill();
    });
    return octx.getImageData(0, 0, CW, CH);
  };

  const sa = _heatmapData.a.length >= 4 ? drawTeamLayer(_heatmapData.a, 'rgba(79,131,255,0.09)', '') : null;
  const sb = _heatmapData.b.length >= 4 ? drawTeamLayer(_heatmapData.b, 'rgba(255,77,85,0.09)',  '') : null;

  if (sa || sb) {
    const out = ctx.createImageData(CW, CH);
    const od  = out.data;
    const la = sa ? sa.data : null;
    const lb = sb ? sb.data : null;
    const la_len = la ? la.length : 0;
    for (let i = 0; i < od.length; i += 4) {
      const va = la && i < la_len ? la[i] : 0;
      const vb = lb && i < lb.length ? lb[i] : 0;
      // blue team (A) → blue/cyan tones; red team (B) → orange/red tones
      const [r1, g1, b1] = _heatVal(va, [0,0,120], [0,120,255], [0,220,255]);
      const [r2, g2, b2] = _heatVal(vb, [80,0,0],  [255,80,0],  [255,220,0]);
      od[i]   = Math.min(255, r1 + r2);
      od[i+1] = Math.min(255, g1 + g2);
      od[i+2] = Math.min(255, b1 + b2);
      od[i+3] = Math.min(255, (va > 0 || vb > 0) ? 180 + Math.min(74, (va + vb) / 2) : 0);
    }
    ctx.putImageData(out, 0, 0);
  }
  _pitchOverlay(ctx, CW, CH);
}

function _heatVal(v, col0, col1, col2) {
  if (v === 0) return [0, 0, 0];
  const t = Math.min(1, v / 180);
  if (t < 0.5) {
    const f = t * 2;
    return [Math.round(col0[0] + (col1[0] - col0[0]) * f), Math.round(col0[1] + (col1[1] - col0[1]) * f), Math.round(col0[2] + (col1[2] - col0[2]) * f)];
  }
  const f = (t - 0.5) * 2;
  return [Math.round(col1[0] + (col2[0] - col1[0]) * f), Math.round(col1[1] + (col2[1] - col1[1]) * f), Math.round(col1[2] + (col2[2] - col1[2]) * f)];
}

function _pitchOverlay(ctx, CW, CH) {
  ctx.globalAlpha = 0.60;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(2, 2, CW - 4, CH - 4);
  ctx.beginPath(); ctx.moveTo(2, CH / 2); ctx.lineTo(CW - 2, CH / 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(CW / 2, CH / 2, CW * 0.13, 0, Math.PI * 2); ctx.stroke();
  const pa = CW * 0.44, paH = CH * 0.165;
  ctx.strokeRect((CW - pa) / 2, 2, pa, paH);
  ctx.strokeRect((CW - pa) / 2, CH - paH - 2, pa, paH);
  const ga = CW * 0.275, gaH = CH * 0.067;
  ctx.strokeRect((CW - ga) / 2, 2, ga, gaH);
  ctx.strokeRect((CW - ga) / 2, CH - gaH - 2, ga, gaH);
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.arc(CW / 2, CH * 0.118, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(CW / 2, CH * 0.882, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

function _drawHeatmapCanvas(canvasId, samples) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const CW = canvas.width, CH = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#061008';
  ctx.fillRect(0, 0, CW, CH);

  if (samples.length >= 4) {
    const off = document.createElement('canvas');
    off.width = CW; off.height = CH;
    const octx = off.getContext('2d');
    octx.fillStyle = '#000';
    octx.fillRect(0, 0, CW, CH);
    octx.globalCompositeOperation = 'lighter';
    const R = CW * 0.12;
    samples.forEach(({ x, y }) => {
      const px = x * CW, py = y * CH;
      const g = octx.createRadialGradient(px, py, 0, px, py, R);
      g.addColorStop(0,   'rgba(255,255,255,0.07)');
      g.addColorStop(0.4, 'rgba(255,255,255,0.025)');
      g.addColorStop(1,   'rgba(0,0,0,0)');
      octx.fillStyle = g;
      octx.beginPath();
      octx.arc(px, py, R, 0, Math.PI * 2);
      octx.fill();
    });
    const sp = octx.getImageData(0, 0, CW, CH).data;
    let maxI = 0;
    for (let i = 0; i < sp.length; i += 4) if (sp[i] > maxI) maxI = sp[i];
    if (maxI > 0) {
      const colorMap = _buildHeatColorMap();
      const out = ctx.createImageData(CW, CH);
      const od  = out.data;
      for (let i = 0; i < sp.length; i += 4) {
        const [r, g, b, a] = colorMap[Math.min(255, Math.floor(sp[i] / maxI * 255))];
        od[i] = r; od[i+1] = g; od[i+2] = b; od[i+3] = a;
      }
      ctx.putImageData(out, 0, 0);
    }
  }
  _pitchOverlay(ctx, CW, CH);
}

let _hmActiveTab = 'global';

function _switchHmTab(team, btn) {
  _hmActiveTab = team;
  const wrap = btn.closest('.ma-heatmap-wrap');
  wrap.querySelectorAll('.ma-hm-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  wrap.querySelectorAll('.ma-canvas').forEach(c => { c.style.display = 'none'; });
  const target = document.getElementById(`ma-canvas-${team}`);
  if (target) target.style.display = 'block';
  if (team === 'global') _drawHeatmapGlobal('ma-canvas-global');
  _refreshDistList();
}

function _refreshDistList() {
  const container = document.querySelector('.ma-distance');
  if (!container) return;
  const filterTeam = _hmActiveTab === 'global' ? null : _hmActiveTab;
  const entries = Object.entries(_distanceData)
    .filter(([name, d]) => d > 0 && (!filterTeam || _prevPos[name]?.team === filterTeam))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 11);
  const maxDist = entries.length ? entries[0][1] : 1;
  const header = container.querySelector('.ma-dist-header');
  const distHtml = entries.map(([name, dist], idx) => {
    const pct   = Math.round(dist / maxDist * 100);
    const info  = _prevPos[name];
    const isA   = info?.team === 'a';
    const color = isA ? '#4f83ff' : '#ff4d55';
    const nm    = name.split(' ');
    const label = nm.length > 1 ? `${nm[0][0]}. ${nm[nm.length - 1]}` : name;
    const km    = _pxToKm(dist).toFixed(1);
    return `<div class="ma-dist-row">
      <span class="ma-dist-rank">${idx + 1}</span>
      <div class="ma-dist-dot" style="background:${color};box-shadow:0 0 5px ${color}88"></div>
      <span class="ma-dist-name">${escHtml(label.toUpperCase())}</span>
      <div class="ma-dist-bar-wrap"><div class="ma-dist-bar" style="width:${pct}%;background:linear-gradient(90deg,${color}55,${color})"></div></div>
      <span class="ma-dist-val">${km}&thinsp;km</span>
    </div>`;
  }).join('');
  // Remove old rows (keep the header)
  container.querySelectorAll('.ma-dist-row').forEach(el => el.remove());
  container.querySelector('span[style]')?.remove();
  if (distHtml) {
    container.insertAdjacentHTML('beforeend', distHtml);
  } else {
    container.insertAdjacentHTML('beforeend', `<span style="opacity:.3;font-size:.6rem">${t('ma-no-data')}</span>`);
  }
}

// Realistic km scaling: drift samples fire every 2nd drift tick (600ms each).
// 1-min mode (90×667ms) accumulates ~50 distance-samples → reference baseline.
// Any speed mode is normalised so the final display always represents 90 min.
function _pxToKm(px) {
  const REF_SAMPLES = 50;  // calibrated for 1-min mode
  const factor = _distSamples > 0 ? REF_SAMPLES / _distSamples : 1;
  return (px / _LP.W * 2.2 * factor);
}

function renderMatchAnalysis(teamA, teamB) {
  const card = document.getElementById('match-analysis-card');
  if (!card) return;
  const hasHeat = _heatmapData.a.length > 0 || _heatmapData.b.length > 0;
  const hasDist = Object.keys(_distanceData).length > 0;
  if (!hasHeat && !hasDist) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');

  // ── Distance per player (top 11) ──────────────────────────
  const distEntries = Object.entries(_distanceData)
    .filter(([, d]) => d > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 11);
  const maxDist = distEntries.length ? distEntries[0][1] : 1;
  const distHtml = distEntries.map(([name, dist], idx) => {
    const pct   = Math.round(dist / maxDist * 100);
    const info  = _prevPos[name];
    const isA   = info?.team === 'a';
    const color = isA ? '#4f83ff' : '#ff4d55';
    const nm    = name.split(' ');
    const label = nm.length > 1 ? `${nm[0][0]}. ${nm[nm.length - 1]}` : name;
    const km    = _pxToKm(dist).toFixed(1);
    return `<div class="ma-dist-row">
      <span class="ma-dist-rank">${idx + 1}</span>
      <div class="ma-dist-dot" style="background:${color};box-shadow:0 0 5px ${color}88"></div>
      <span class="ma-dist-name">${escHtml(label.toUpperCase())}</span>
      <div class="ma-dist-bar-wrap"><div class="ma-dist-bar" style="width:${pct}%;background:linear-gradient(90deg,${color}55,${color})"></div></div>
      <span class="ma-dist-val">${km}&thinsp;km</span>
    </div>`;
  }).join('');

  card.innerHTML = `
    <div class="ma-title">${t('ma-title')}</div>
    <div class="ma-body">
      <div class="ma-heatmap-wrap">
        <div class="ma-hm-tabs">
          <button class="ma-hm-tab active" data-team="global">Global</button>
          <button class="ma-hm-tab" data-team="a">${escHtml(teamA)}</button>
          <button class="ma-hm-tab" data-team="b">${escHtml(teamB)}</button>
        </div>
        <div class="ma-hm-frame">
          <canvas id="ma-canvas-global" class="ma-canvas" width="240" height="360"></canvas>
          <canvas id="ma-canvas-a"      class="ma-canvas" width="240" height="360" style="display:none"></canvas>
          <canvas id="ma-canvas-b"      class="ma-canvas" width="240" height="360" style="display:none"></canvas>
        </div>
        <div class="ma-hm-legend"><span>${t('ma-hm-low')}</span><div class="ma-hm-grad"></div><span>${t('ma-hm-high')}</span></div>
      </div>
      <div class="ma-distance">
        <div class="ma-dist-header">
          <div class="ma-dist-title">${t('ma-dist-label')}</div>
        </div>
        ${distHtml || `<span style="opacity:.3;font-size:.6rem">${t('ma-no-data')}</span>`}
      </div>
    </div>`;

  requestAnimationFrame(() => {
    _drawHeatmapGlobal('ma-canvas-global');
    _drawHeatmapCanvas('ma-canvas-a', _heatmapData.a);
    _drawHeatmapCanvas('ma-canvas-b', _heatmapData.b);
  });
}

// ── Live match playback ───────────────────────────────────────
let _liveTimer = null;
let _liveClockInterval = null;
let _eventTimers = [];   // all per-event setTimeout IDs, cleared on skip
let _liveData    = null;
let _livePayload = null;
let _lastGoalSide = 'A';  // tracks last team to score (for overlay)
let _overlayHideTimer1 = null;  // pending "start fade-out" timer
let _overlayHideTimer2 = null;  // pending "add hidden" timer

function playLiveMatch(data, payload, tickMs = 300) {
  _liveData    = data;
  _livePayload = payload;
  if (_liveTimer)         { clearTimeout(_liveTimer);          _liveTimer = null; }
  if (_liveClockInterval) { clearInterval(_liveClockInterval); _liveClockInterval = null; }
  // Clear any leftover timers from a previous live match (prevents phantom events/wrong scores)
  _eventTimers.forEach(id => clearTimeout(id)); _eventTimers = [];

  // Restore radar-card to stats-modal if it was in results or pm-radar-row
  const radarCard = document.getElementById('radar-card');
  const statsModalInner = document.getElementById('stats-modal-inner');
  if (radarCard && statsModalInner && !statsModalInner.contains(radarCard)) {
    statsModalInner.appendChild(radarCard);
  }
  // Close stats modal and clear pm-radar-row for the new match
  document.getElementById('stats-modal')?.classList.add('hidden');
  const pmRadarRow = document.getElementById('pm-radar-row');
  if (pmRadarRow) pmRadarRow.innerHTML = '';

  // ── Instant / "Directo" mode: skip live viewer entirely ─────────
  if (tickMs === 0) {
    // Generate heatmap + distance data synthetically so post-match analysis card works.
    // Init the pitch (populates _pitchDots with player home positions), then run
    // _driftPlayers() 120 times synchronously (~equivalent to a 90-min match at
    // 600ms interval = 72s of samples → same order of magnitude as live mode).
    const isPenMode = _livePayload?.matchMode === 'penalties';
    if (!isPenMode && data.lineups?.teamA && data.lineups?.teamB) {
      initLivePitch(data.lineups.teamA, data.lineups.teamB);
      for (let i = 0; i < 120; i++) _driftPlayers();
    }
    finishLive();
    return;
  }

  const { finalScore } = data;
  // Prefer the engine timeline (has narrative) — normalize player→name and type aliases
  const events = (Array.isArray(data.timeline) && data.timeline.length
    ? data.timeline.map(ev => ({
        ...ev,
        name: ev.name || ev.player || '',
        type: ev.type === 'penalty_miss' ? 'penalty-miss' : ev.type,
      }))
    : [
        ...(finalScore.scorersA || []).map(s => ({ ...s, type: 'goal',   side: 'A' })),
        ...(finalScore.scorersB || []).map(s => ({ ...s, type: 'goal',   side: 'B' })),
        ...((finalScore.cardsA?.yellow) || []).map(c => ({ ...c, type: 'yellow', side: 'A' })),
        ...((finalScore.cardsA?.red)    || []).map(c => ({ ...c, type: 'red',    side: 'A' })),
        ...((finalScore.cardsB?.yellow) || []).map(c => ({ ...c, type: 'yellow', side: 'B' })),
        ...((finalScore.cardsB?.red)    || []).map(c => ({ ...c, type: 'red',    side: 'B' })),
        ...(finalScore.matchPenalties || []).map(p => ({ type: p.scored ? 'penalty' : 'penalty-miss', side: p.side, minute: p.minute, name: p.taker })),
        ...(data.stats?.notableEvents || []).map(e => ({ type: e.type, side: e.side, minute: e.minute, name: e.name || '' })),
        ...(finalScore.injuriesA || []).map(i => ({ ...i, type: 'injury', side: 'A' })),
        ...(finalScore.injuriesB || []).map(i => ({ ...i, type: 'injury', side: 'B' })),
      ]
  ).sort((a, b) => a.minute - b.minute)
  // Corners and freekicks are shown in the timeline below but kept out of the live feed
  // to avoid visual clutter and timeline delays
  .filter(ev => ev.type !== 'corner' && ev.type !== 'freekick');

  // Init viewer
  const viewer = document.getElementById('live-viewer');
  viewer.classList.remove('hidden', 'live-fade-out');
  document.getElementById('live-team-a').textContent  = payload.teamA;
  document.getElementById('live-team-b').textContent  = payload.teamB;
  const badgeAEl = document.getElementById('live-badge-a');
  const badgeBEl = document.getElementById('live-badge-b');
  if (badgeAEl) { badgeAEl.src = data.badgeA || ''; badgeAEl.style.display = data.badgeA ? '' : 'none'; }
  if (badgeBEl) { badgeBEl.src = data.badgeB || ''; badgeBEl.style.display = data.badgeB ? '' : 'none'; }
  const isPenMode = payload.matchMode === 'penalties';
  document.getElementById('live-clock').textContent   = isPenMode ? '🥅' : "0'";
  document.getElementById('live-score-a').textContent = '0';
  document.getElementById('live-score-b').textContent = '0';
  document.getElementById('timeline-events').innerHTML = '';

  // Radar: draw into stats-modal (hidden until user clicks Stats button)
  const radarCardEl = document.getElementById('radar-card');
  if (radarCardEl) radarCardEl.style.display = isPenMode ? 'none' : '';
  if (!isPenMode) drawRadar(data.ratings, payload.teamA, payload.teamB);

  // Pitch: always show — simplified 2-dot layout in penalty mode
  const pitchWrap = document.querySelector('.live-pitch-wrap');
  if (pitchWrap) pitchWrap.style.display = '';
  if (isPenMode) {
    initPenaltyPitch(data.lineups?.teamA, data.lineups?.teamB);
  } else {
    initLivePitch(data.lineups?.teamA, data.lineups?.teamB);
  }
  viewer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // tickMs=0 → instant result (no animation delay)
  const TICK = tickMs;

  // Kick-off whistle overlay + timeline entry
  if (!isPenMode) {
    _eventTimers.push(setTimeout(() => {
      triggerEventOverlay('kick_off', '', null, null);
      addFeedEvent({ type: 'kick_off', minute: 0, name: t('ev-kickoff'), side: 'N' });
    }, 900));
  }
  // Start timeline in sync with live match — move timeline-card into the right column slot
  if (Array.isArray(data.timeline) && data.timeline.length) {
    const timelineCard = document.querySelector('.timeline-card');
    const liveSlot     = document.getElementById('live-timeline-wrap');
    if (timelineCard && liveSlot) liveSlot.appendChild(timelineCard);
    animateTimeline(data.timeline, payload.teamA, payload.teamB, TICK);
  }

  // ── Pre-compute total match duration so the clock syncs with events ──
  // (events with sequential accDelay can exceed 90*TICK)
  function _holdMs(type) {
    if (type === 'goal')         return 2600;
    if (type === 'penalty')     return 2200;
    if (type === 'penalty-miss') return 1800;
    if (type === 'corner')      return 1100;
    if (type === 'freekick')    return 1200;
    if (type === 'injury')      return 1600;
    return 1800; // yellow/red
  }
  let _preAcc = isPenMode ? 0 : (900 + 3000 + 350);
  events.forEach(ev => {
    const fireAt  = ev.minute * TICK;
    const startAt = Math.max(fireAt, _preAcc);
    _preAcc = startAt + _holdMs(ev.type) + 350;
  });
  const totalMatchMs = Math.max(90 * TICK, _preAcc);

  const start = performance.now();

  // Clock: advances 0→90' proportionally to totalMatchMs
  _liveClockInterval = setInterval(() => {
    const elapsed = performance.now() - start;
    const min = Math.min(90, Math.floor(elapsed / totalMatchMs * 90));
    document.getElementById('live-clock').textContent = `${min}'`;
    if (elapsed >= totalMatchMs) { clearInterval(_liveClockInterval); _liveClockInterval = null; }
  }, 200);

  // Schedule events with sequential queue
  let scoreA = 0, scoreB = 0;
  // Reserve room for the kick-off overlay (fires at 900ms, holds 3000ms, gap 350ms)
  // so the first match event never cancels it prematurely.
  let accDelay = isPenMode ? 0 : (900 + 3000 + 350);

  events.forEach(ev => {
    const fireAt  = ev.minute * TICK;
    const startAt = Math.max(fireAt, accDelay);
    accDelay      = startAt + _holdMs(ev.type) + 350;

    _eventTimers.push(setTimeout(() => {
      if (ev.type === 'goal') {
        if (ev.side === 'A') scoreA++; else scoreB++;
        _lastGoalSide = ev.side;
        const numA = document.getElementById('live-score-a');
        const numB = document.getElementById('live-score-b');
        numA.textContent = scoreA;
        numB.textContent = scoreB;
        const changed = ev.side === 'A' ? numA : numB;
        changed.classList.remove('pulse');
        void changed.offsetWidth;
        changed.classList.add('pulse');
        setTimeout(() => changed.classList.remove('pulse'), 450);
        triggerEventOverlay('goal', ev.name, `${scoreA} - ${scoreB}`, ev.side);
        animatePitchEvent('goal', ev);
      } else if (ev.type === 'penalty') {
        if (ev.side === 'A') scoreA++; else scoreB++;
        _lastGoalSide = ev.side;
        const numA = document.getElementById('live-score-a');
        const numB = document.getElementById('live-score-b');
        numA.textContent = scoreA;
        numB.textContent = scoreB;
        const changed = ev.side === 'A' ? numA : numB;
        changed.classList.remove('pulse'); void changed.offsetWidth; changed.classList.add('pulse');
        setTimeout(() => changed.classList.remove('pulse'), 450);
        triggerEventOverlay('penalty', ev.name, `${scoreA} - ${scoreB}`, ev.side);
        animatePitchEvent('goal', ev);
      } else {
        triggerEventOverlay(ev.type, ev.name, null, ev.side);
        animatePitchEvent(ev.type, ev);
      }
      // Note: regular events are already rendered by animateTimeline — no addFeedEvent here
    }, startAt));
  });

  // ── Penalty shootout animation (if draw OR penalties-only mode) ──
  const pens = finalScore.penalties;
  // Penalties-only mode: skip the 90-min clock entirely, start shootout immediately
  const regularMs = isPenMode ? 0 : Math.max(90 * TICK, accDelay);
  if (isPenMode && _liveClockInterval) { clearInterval(_liveClockInterval); _liveClockInterval = null; }
  let penaltyEndMs = 0;

  // Full-time whistle for ALL regular 90-min matches (with or without subsequent penalty shootout)
  if (!isPenMode) {
    const ftLabel = t('ev-fulltime') + ` — ${finalScore.teamA}:${finalScore.teamB}`;
    _eventTimers.push(setTimeout(() => {
      triggerEventOverlay('fulltime', `${payload.teamA} ${finalScore.teamA} – ${finalScore.teamB} ${payload.teamB}`, null, null);
      addFeedEvent({ type: 'ft_whistle', minute: 90, name: ftLabel, side: 'N' });
    }, regularMs + 50));
  }

  if (pens) {
    const kicks = Math.max(pens.shotsA.length, pens.shotsB.length);

    // After a regular match that goes to pens the FT overlay must fully clear first.
    // FT fires at regularMs+50, holds 3000ms, fades 550ms → gone at regularMs+3600.
    // penSeqStart ensures everything penalty-related starts AFTER that (+200ms safety pad).
    const penSeqStart = isPenMode ? 0 : regularMs + 3800;

    // Switch live pitch to kicker+GK view before shootout splash
    _eventTimers.push(setTimeout(() => {
      stopLivePitch();
      initPenaltyPitch(data.lineups?.teamA, data.lineups?.teamB);
    }, penSeqStart));

    // Cinematic penalty shootout splash
    _eventTimers.push(setTimeout(() => triggerShootoutSplash(payload.teamA, payload.teamB), penSeqStart + 100));

    // Announcement feed entry
    _eventTimers.push(setTimeout(() => addFeedEvent({ type: 'pen_start', minute: 90, name: t('pen-shootout-title'), side: 'N' }), penSeqStart + 300));

    // GK names for the PARADA label (opposing GK faces each kick)
    const gkA = data.lineups?.teamA?.players?.find(p => p.position === 'GK')?.name || '';
    const gkB = data.lineups?.teamB?.players?.find(p => p.position === 'GK')?.name || '';

    // Splash starts at penSeqStart+100, countdown 4×700ms + 600ms hide = ~3400ms → done at penSeqStart+3500.
    // Add 400ms padding so the first kick starts cleanly after the overlay is gone.
    let penT = penSeqStart + 3900;
    let runA = 0, runB = 0;
    for (let i = 0; i < kicks; i++) {
      const kA = pens.shotsA[i];
      const kB = pens.shotsB[i];
      if (kA) {
        if (kA.scored) runA++;
        const snapA = runA, snapB = runB;
        _eventTimers.push(((t, k, sA, sB) => setTimeout(() => triggerPenKickAnim(k.name, k.scored, sA, sB, payload.teamA, payload.teamB, gkB), t))(penT, kA, snapA, snapB));
        _eventTimers.push(((t, k) => setTimeout(() => addFeedEvent({ type: k.scored ? 'pen_goal' : 'pen_miss', minute: 90, name: k.name, side: 'A', scored: k.scored }), t))(penT + 1300, kA));
        penT += 3000;
      }
      if (kB) {
        if (kB.scored) runB++;
        const snapA = runA, snapB = runB;
        _eventTimers.push(((t, k, sA, sB) => setTimeout(() => triggerPenKickAnim(k.name, k.scored, sA, sB, payload.teamA, payload.teamB, gkA), t))(penT, kB, snapA, snapB));
        _eventTimers.push(((t, k) => setTimeout(() => addFeedEvent({ type: k.scored ? 'pen_goal' : 'pen_miss', minute: 90, name: k.name, side: 'B', scored: k.scored }), t))(penT + 1300, kB));
        penT += 3000;
      }
      penT += 200;
    }
    // Winner overlay
    _eventTimers.push(setTimeout(() => {
      const winName = pens.winner === 'A' ? payload.teamA : payload.teamB;
      addFeedEvent({ type: 'pen_winner', minute: 90, name: winName, side: pens.winner });
      triggerEventOverlay('pen_winner', winName, `${pens.scoreA}–${pens.scoreB}`);
    }, penT + 400));
    penaltyEndMs = penT + 400;
  }

  // Finish after full match + optional penalty sequence.
  // For penalties: wait until pen_winner overlay has fully displayed (holdMs 3200 + fade 550 + 200 padding)
  const overlayWait = pens ? 3950 : 0;
  _liveTimer = setTimeout(finishLive, Math.max(regularMs, penaltyEndMs) + 800 + overlayWait);
}

function addFeedEvent(ev) {
  const container = document.getElementById('timeline-events');
  if (!container) return;
  // Penalty shootout events are handled exclusively by the penalty-card — skip them here
  if (ev.type === 'pen_start' || ev.type === 'pen_goal' || ev.type === 'pen_miss' || ev.type === 'pen_winner') return;

  const div = document.createElement('div');

  if (ev.type === 'kick_off') {
    div.className = 't-event-special t-event-kickoff';
    div.textContent = '🔔 ' + (ev.name || t('ev-kickoff'));
    // Kick-off belongs at the TOP of the timeline (first event chronologically)
    container.prepend(div);
    return;
  } else if (ev.type === 'ft_whistle') {
    div.className = 't-event-special t-event-ft';
    div.textContent = ev.name || '⏱ FT';
  } else if (ev.type === 'pen_start') {
    div.className = 't-event-special t-event-pen-hdr';
    div.textContent = ev.name || t('pen-shootout-title');
  } else if (ev.type === 'pen_winner') {
    div.className = 't-event-special t-event-winner';
    div.textContent = '🏆 ' + escHtml(ev.name || '');
  } else if (ev.type === 'pen_goal' || ev.type === 'pen_miss') {
    const isA   = ev.side === 'A';
    const icon  = ev.scored !== false ? '⚽' : '❌';
    const suf   = ev.scored !== false
      ? ` <span class="t-tag t-tag-pen">${t('ev-tag-pen')}</span>`
      : ` <span class="t-tag t-tag-miss">${t('ev-tag-miss')}</span>`;
    const label = `${icon} ${escHtml(ev.name || '')}${suf}`;
    div.className = `t-event t-anim-reveal t-event-special ${isA ? 't-event-pen-a' : 't-event-pen-b'}`;
    div.innerHTML =
      `<div class="t-left">${isA ? label : ''}</div>` +
      `<div class="t-mid"><span class="t-min">P</span></div>` +
      `<div class="t-right">${!isA ? label : ''}</div>`;
  } else {
    // Regular match event — build standard t-event row
    let icon, suffix;
    switch (ev.type) {
      case 'goal':         icon = '⚽'; suffix = ''; break;
      case 'yellow':       icon = '🟨'; suffix = ''; break;
      case 'red':          icon = '🟥'; suffix = ''; break;
      case 'penalty':      icon = '⚽'; suffix = ` <span class="t-tag t-tag-pen">${t('ev-tag-pen')}</span>`; break;
      case 'penalty-miss': icon = '❌'; suffix = ` <span class="t-tag t-tag-miss">${t('ev-tag-miss')}</span>`; break;
      case 'corner':       icon = '🚩'; suffix = ` <span class="t-tag t-tag-corner">${t('ev-tag-corner')}</span>`; break;
      case 'freekick':     icon = '🎯'; suffix = ` <span class="t-tag t-tag-fk">${t('ev-tag-fk')}</span>`; break;
      case 'injury':       icon = '🩹'; suffix = ''; break;
      default:             icon = '•';  suffix = '';
    }
    const isA   = ev.side === 'A';
    const label = `${icon} ${escHtml(ev.name || '')}${suffix}`;
    const narHtml = ev.narrative
      ? `<div class="t-narration${isA ? ' t-nar-a' : ' t-nar-b'}">${escHtml(ev.narrative)}</div>`
      : '';
    div.className = 't-event t-event-narrated t-anim-reveal';
    div.innerHTML =
      `<div>` +
        `<div class="t-left">${isA ? label : ''}</div>` +
        `<div class="t-mid"><span class="t-icon">${icon}</span><span class="t-min">${ev.minute || ''}'</span></div>` +
        `<div class="t-right">${!isA ? label : ''}</div>` +
      `</div>` +
      narHtml;
  }

  container.appendChild(div);
}

function triggerEventOverlay(type, name, score, side) {
  // Haptic feedback
  if (type === 'goal' || type === 'penalty' || type === 'pen_winner') _HFX.goal();
  else if (type === 'red') _HFX.red();
  else if (type === 'yellow') _HFX.card();
  else if (type === 'kick_off' || type === 'fulltime') _HFX.whistle();

  // Cancel any stale hide timers from previous overlay events
  if (_overlayHideTimer1) { clearTimeout(_overlayHideTimer1); _overlayHideTimer1 = null; }
  if (_overlayHideTimer2) { clearTimeout(_overlayHideTimer2); _overlayHideTimer2 = null; }

  const overlay = document.getElementById('event-overlay');
  const inner   = document.getElementById('event-overlay-inner');
  const icon    = type === 'goal' || type === 'penalty' ? '⚽'
                : type === 'yellow' ? '🟨'
                : type === 'pen_winner' ? '🏆'
                : type === 'penalty-miss' ? '❌'
                : type === 'corner' ? '🚩'
                : type === 'freekick' ? '🎯'
                : type === 'injury' ? '🩹'
                : type === 'kick_off' ? '🔔'
                : type === 'fulltime' ? '⏱'
                : '🟥';
  const titleKey = type === 'goal'         ? 'ev-goal'
                 : type === 'yellow'       ? 'ev-yellow'
                 : type === 'pen_winner'   ? 'ev-pen_winner'
                 : type === 'penalty'      ? 'ev-penalty'
                 : type === 'penalty-miss' ? 'ev-penalty-miss'
                 : type === 'corner'       ? 'ev-corner'
                 : type === 'freekick'     ? 'ev-freekick'
                 : type === 'injury'       ? 'ev-injury'
                 : type === 'kick_off'     ? 'ev-kickoff'
                 : type === 'fulltime'     ? 'ev-fulltime'
                 : 'ev-red';
  const title   = t(titleKey);
  const holdMs  = (type === 'goal' || type === 'pen_winner' || type === 'penalty') ? 3200
                : (type === 'penalty-miss') ? 1800
                : (type === 'corner' || type === 'freekick') ? 1100
                : (type === 'injury') ? 1600
                : (type === 'kick_off' || type === 'fulltime') ? 3000
                : 1800;

  let badgeHtml = '';
  let teamName  = '';
  if (_livePayload) {
    if (type === 'pen_winner') {
      // Penalty winner: determine winning side from data
      const curSide = _liveData?.finalScore?.penalties?.winner || _lastGoalSide;
      const tName   = curSide === 'A' ? _livePayload.teamA : _livePayload.teamB;
      const rawBadge = curSide === 'A' ? _liveData?.badgeA : _liveData?.badgeB;
      teamName  = tName;
      badgeHtml = `<img class="eo-badge" src="${escHtml(rawBadge || _badgeFallback(tName))}" alt="">`;
    } else {
      // All other events: use event side
      const evSide = side || _lastGoalSide;
      const tName  = evSide === 'A' ? _livePayload.teamA : _livePayload.teamB;
      teamName = tName;
      if (type === 'goal' || type === 'penalty') {
        const rawBadge = evSide === 'A' ? _liveData?.badgeA : _liveData?.badgeB;
        badgeHtml = `<img class="eo-badge" src="${escHtml(rawBadge || _badgeFallback(tName))}" alt="">`;
      }
    }
  }

  inner.className = `eo-inner eo-${type}`;
  inner.innerHTML =
    (badgeHtml ? `<div class="eo-badge-wrap">${badgeHtml}</div>` : '') +
    `<div class="eo-icon">${icon}</div>` +
    `<div class="eo-title">${title}</div>` +
    (teamName ? `<div class="eo-team">${escHtml(teamName)}</div>` : '') +
    `<div class="eo-name">${escHtml(name)}</div>` +
    (score ? `<div class="eo-score">${escHtml(score)}</div>` : '');

  // Force visible, reset animation classes, trigger reflow for CSS re-play
  overlay.classList.remove('hidden', 'eo-fade-out', 'eo-fade-in');
  void overlay.offsetWidth;
  overlay.classList.add('eo-fade-in');
  _overlayHideTimer1 = setTimeout(() => {
    _overlayHideTimer1 = null;
    overlay.classList.remove('eo-fade-in');
    overlay.classList.add('eo-fade-out');
    _overlayHideTimer2 = setTimeout(() => {
      _overlayHideTimer2 = null;
      overlay.classList.add('hidden');
    }, 550);
  }, holdMs);
}

function finishLive() {
  if (_liveTimer)         { clearTimeout(_liveTimer);          _liveTimer = null; }
  if (_liveClockInterval) { clearInterval(_liveClockInterval); _liveClockInterval = null; }
  if (_overlayHideTimer1) { clearTimeout(_overlayHideTimer1);  _overlayHideTimer1 = null; }
  if (_overlayHideTimer2) { clearTimeout(_overlayHideTimer2);  _overlayHideTimer2 = null; }
  _eventTimers.forEach(id => clearTimeout(id)); _eventTimers = [];
  document.getElementById('pen-kick-overlay')?.classList.add('hidden');
  // Always hide event overlay before transitioning to results
  document.getElementById('event-overlay').classList.add('hidden');
  // Restore pitch and radar visibility for next match
  const pitchWrap = document.querySelector('.live-pitch-wrap');
  if (pitchWrap) pitchWrap.style.display = '';
  stopLivePitch();
  const viewer = document.getElementById('live-viewer');
  viewer.classList.add('live-fade-out');
  setTimeout(() => {
    viewer.classList.add('hidden');
    viewer.classList.remove('live-fade-out');
    // Close stats modal before transitioning to results
    document.getElementById('stats-modal')?.classList.add('hidden');
    // Move timeline-card back from live slot into results, before penalty-card (if any)
    const tc       = document.querySelector('.timeline-card');
    const resultsEl = document.getElementById('results');
    if (tc && resultsEl) {
      const penCard = resultsEl.querySelector('.penalty-card');
      if (penCard) penCard.before(tc);
      else resultsEl.appendChild(tc);
    }
    if (tc) tc.scrollTop = 0;
    // Flush any still-hidden timeline events so the full timeline is visible immediately
    flushTimeline();
    // Render post-match analysis card (heatmap + distance)
    renderMatchAnalysis(_livePayload?.teamA || '', _livePayload?.teamB || '');
    renderResult(_liveData, _livePayload);
  }, 620);
}

function skipLive() {
  document.getElementById('event-overlay').classList.add('hidden');
  document.getElementById('pen-kick-overlay')?.classList.add('hidden');
  finishLive();
}

// ── Share result ─────────────────────────────────────────────────────────────
// Generates a 1080×1920 Canvas poster and shares/downloads it.
function shareResult() {
  if (!_shareData) return;
  _openSharePanel(_shareData);
}

function _openSharePanel(data) {
  const siteUrl = (window.GOLAZOX_CONFIG && window.GOLAZOX_CONFIG.siteUrl) || '';
  const scoreText = `${data.teamA} ${data.scoreA}\u2013${data.scoreB} ${data.teamB}`;
  const eraNote   = (data.eraA && data.eraA === data.eraB) ? ` [${data.eraA}]`
                  : (data.eraA || data.eraB) ? ` [${[data.eraA, data.eraB].filter(Boolean).join(' / ')}]` : '';
  const shareText = `\u26BD ${scoreText}${eraNote}\nGolazoX.com${siteUrl ? '\n' + siteUrl : ''}`;
  const encodedText = encodeURIComponent(shareText);

  const existing = document.getElementById('share-panel-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'share-panel-overlay';
  overlay.className = 'share-panel-overlay';
  overlay.innerHTML = `
    <div class="share-panel">
      <div class="share-panel-title">Compartir resultado</div>
      <div class="share-panel-options">
        <div class="share-opt" id="sopt-native">
          <div class="share-opt-icon">\uD83D\uDCF8</div>
          <div class="share-opt-label">Imagen</div>
        </div>
        <div class="share-opt" id="sopt-copy">
          <div class="share-opt-icon">\uD83D\uDCCB</div>
          <div class="share-opt-label">Copiar</div>
        </div>
        <div class="share-opt" id="sopt-whatsapp">
          <div class="share-opt-icon">\uD83D\uDCAC</div>
          <div class="share-opt-label">WhatsApp</div>
        </div>
        <div class="share-opt" id="sopt-twitter">
          <div class="share-opt-icon">\uD83D\uDC26</div>
          <div class="share-opt-label">X / Twitter</div>
        </div>
      </div>
      <div class="share-panel-copied" id="share-copied">\u00A1Copiado al portapapeles!</div>
      <button class="share-panel-cancel" id="share-cancel">Cancelar</button>
    </div>
  `;
  document.body.appendChild(overlay);

  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('open')));

  function closePanel() {
    overlay.classList.remove('open');
    setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 320);
  }

  overlay.addEventListener('click', e => { if (e.target === overlay) closePanel(); });
  document.getElementById('share-cancel').addEventListener('click', closePanel);

  // Option: native share with image
  document.getElementById('sopt-native').addEventListener('click', () => {
    closePanel();
    const btn = document.querySelector('.btn-share');
    if (btn) { btn.textContent = t('btn-share-loading'); btn.disabled = true; }
    _generateShareCard(data).then(blob => {
      if (btn) { btn.textContent = t('btn-share'); btn.disabled = false; }
      const slug = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 30);
      const fileName = `golazox-${slug(data.teamA)}-vs-${slug(data.teamB)}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: `\u26BD ${scoreText}` }).catch(() => _scDownload(blob, fileName));
      } else {
        _scDownload(blob, fileName);
      }
    }).catch(err => {
      console.error('[share]', err);
      if (btn) { btn.textContent = t('btn-share'); btn.disabled = false; }
      showToast(t('tooltip-copy-fail'));
    });
  });

  // Option: copy text
  document.getElementById('sopt-copy').addEventListener('click', () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareText).then(() => {
        const el = document.getElementById('share-copied');
        if (el) { el.classList.add('visible'); setTimeout(() => el.classList.remove('visible'), 2200); }
      }).catch(() => showToast(t('tooltip-copy-fail')));
    } else {
      showToast(t('tooltip-copy-fail'));
    }
  });

  // Option: WhatsApp
  document.getElementById('sopt-whatsapp').addEventListener('click', () => {
    closePanel();
    window.open(`https://wa.me/?text=${encodedText}`, '_blank', 'noopener,noreferrer');
  });

  // Option: X / Twitter
  document.getElementById('sopt-twitter').addEventListener('click', () => {
    closePanel();
    _gx('share_result', { method: 'twitter' });
    // Grant unlock on Twitter share
    try { localStorage.setItem('gx_unlocked','1'); } catch(_) {}
    window.open(`https://twitter.com/intent/tweet?text=${encodedText}`, '_blank', 'noopener,noreferrer');
  });
}

function _scDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}

function showToast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast'; el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('toast-show');
  setTimeout(() => el.classList.remove('toast-show'), 2500);
}

// ── Penalty shootout renderer ────────────────────────────────
function renderPenalties(penalties, teamA, teamB) {
  const card = document.getElementById('penalty-card');
  if (!penalties) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');

  document.getElementById('pen-header').innerHTML =
    `<span style="color:var(--accent-a)">${escHtml(teamA)}</span>` +
    `<span class="pen-header-vs">${t('pen-shootout-title')}</span>` +
    `<span style="color:var(--accent-b)">${escHtml(teamB)}</span>`;

  const kicks = Math.max(penalties.shotsA.length, penalties.shotsB.length);
  const rowsEl = document.getElementById('pen-rows');
  rowsEl.innerHTML = '';

  for (let i = 0; i < kicks; i++) {
    const kA = penalties.shotsA[i];
    const kB = penalties.shotsB[i];
    const mkKick = k => `<span class="pen-kick ${k.scored ? 'scored' : 'missed'}" style="--ki:${i}">${k.scored ? '⚽' : '✕'}</span>`;
    const row = document.createElement('div');
    row.className = 'pen-row pen-row-anim' + (i >= 5 ? ' pen-sd' : '');
    row.style.setProperty('--i', i);
    row.innerHTML =
      `<div class="pen-kicker-a">${kA ? `<span class="pen-name pen-name-a">${escHtml(kA.name)}</span>${mkKick(kA)}` : ''}</div>` +
      `<div class="pen-round-num">${i < 5 ? i + 1 : 'SD'}</div>` +
      `<div class="pen-kicker-b">${kB ? `${mkKick(kB)}<span class="pen-name">${escHtml(kB.name)}</span>` : ''}</div>`;
    rowsEl.appendChild(row);
  }

  const winnerName = penalties.winner === 'A' ? teamA : teamB;
  const sdNote     = penalties.suddenDeath ? t('pen-winner-sd') : '';
  document.getElementById('pen-result').innerHTML =
    `<div class="pen-score-display pen-score-anim">${penalties.scoreA} – ${penalties.scoreB}</div>` +
    `<div class="pen-winner pen-winner-anim">🏆 <strong>${escHtml(winnerName)}</strong> ${t('pen-winner-suffix')}${sdNote}</div>`;
  // Trigger win confetti burst
  _penConfetti();
}

// ── Penalty kick animation ─────────────────────────────────────
function triggerPenKickAnim(kickerName, scored, penScoreA, penScoreB, teamA, teamB, gkName) {
  const overlay = document.getElementById('pen-kick-overlay');
  if (!overlay) return;
  const ballEl  = document.getElementById('pko-ball');
  const gkEl    = document.getElementById('pko-gk-g');
  const nameEl  = document.getElementById('pko-kicker-name');
  const lblEl   = document.getElementById('pko-result-label');
  const scoreEl = document.getElementById('pko-score-bar');

  // Reset
  ballEl.classList.remove('kick', 'miss-spin');
  gkEl.classList.remove('dive-left', 'dive-right', 'dive-up');
  lblEl.classList.remove('show', 'goal', 'miss', 'saved');
  void ballEl.offsetWidth;
  nameEl.textContent = kickerName;
  lblEl.textContent  = '';
  if (scoreEl && teamA != null) scoreEl.textContent = `${teamA}  ${penScoreA}–${penScoreB}  ${teamB}`;

  // Pre-determine outcome so ball trajectory matches the result type
  // 'saved' = 60% of misses, 'fuera' = remaining 40%
  const outcome = scored ? 'goal' : (Math.random() < 0.6 ? 'saved' : 'fuera');

  // Target positions per outcome
  const goalTargets = [
    { tx: -55, ty: -95, scale: .45 },
    { tx:  55, ty: -95, scale: .45 },
    { tx: -45, ty: -55, scale: .50 },
    { tx:  45, ty: -55, scale: .50 },
  ];
  // Saved: toward goal but stoppable — GK dives same direction
  const savedTargets = [
    { tx: -50, ty: -80, scale: .47 },
    { tx:  50, ty: -80, scale: .47 },
    { tx: -40, ty: -50, scale: .52 },
    { tx:  40, ty: -50, scale: .52 },
  ];
  // Fuera: way outside the goal frame (over the bar or wide)
  const fueraTargets = [
    { tx:   0, ty: -160, scale: .22 },  // high over the bar
    { tx: -130, ty: -30, scale: .35 },  // wide left
    { tx:  130, ty: -30, scale: .35 },  // wide right
    { tx: -100, ty: -130, scale: .28 }, // high & wide left
    { tx:  100, ty: -130, scale: .28 }, // high & wide right
  ];

  const pool = outcome === 'goal' ? goalTargets : outcome === 'saved' ? savedTargets : fueraTargets;
  const target = pool[Math.floor(Math.random() * pool.length)];

  // GK: dives opposite for goals (fooled), same side for saves, stands for fuera
  const ballDir = target.tx < -20 ? 'left' : target.tx > 20 ? 'right' : 'center';
  let gkClass;
  if (outcome === 'goal') {
    gkClass = ballDir === 'left' ? 'dive-right' : ballDir === 'right' ? 'dive-left' : 'dive-up';
  } else if (outcome === 'saved') {
    gkClass = ballDir === 'left' ? 'dive-left' : ballDir === 'right' ? 'dive-right' : 'dive-up';
  } else {
    // fuera — ball goes wide/over, GK barely reacts
    gkClass = 'dive-up';
  }

  // Show overlay
  overlay.classList.remove('hidden', 'pko-out');
  void overlay.offsetWidth;
  overlay.classList.add('pko-in');

  // 400ms → GK dives (slower, more tension)
  setTimeout(() => gkEl.classList.add(gkClass), 400);

  // 600ms → ball flies
  setTimeout(() => {
    ballEl.style.setProperty('--pko-tx',    target.tx + 'px');
    ballEl.style.setProperty('--pko-ty',    target.ty + 'px');
    ballEl.style.setProperty('--pko-scale', target.scale);
    ballEl.classList.add(outcome === 'goal' ? 'kick' : 'miss-spin');
  }, 600);

  // 1300ms → result label with big pop animation
  setTimeout(() => {
    let resultText, resultClass;
    if (outcome === 'goal') {
      resultText  = _lang === 'en' ? '⚽ GOAL!' : '⚽ ¡GOOOL!';
      resultClass = 'goal';
    } else if (outcome === 'saved') {
      const gkLabel = gkName ? ` ${gkName}` : '';
      resultText  = _lang === 'en' ? `🧤 SAVED!${gkLabel}` : `🧤 ¡PARADA!${gkLabel}`;
      resultClass = 'saved';
    } else {
      resultText  = _lang === 'en' ? '❌ MISSED!' : '❌ ¡FUERA!';
      resultClass = 'miss';
    }
    lblEl.textContent = resultText;
    lblEl.classList.add('show', resultClass);
  }, 1300);

  // 2600ms → fade out overlay
  setTimeout(() => {
    overlay.classList.remove('pko-in');
    overlay.classList.add('pko-out');
    setTimeout(() => {
      overlay.classList.add('hidden');
      overlay.classList.remove('pko-out');
    }, 300);
  }, 2600);
}

// ── Penalty shootout cinematic splash ─────────────────────────
function triggerShootoutSplash(teamA, teamB) {
  const overlay = document.getElementById('pen-shootout-overlay');
  if (!overlay) return;
  const labelA = overlay.querySelector('.pso-team-a');
  const labelB = overlay.querySelector('.pso-team-b');
  const countdown = overlay.querySelector('.pso-countdown');
  if (labelA) labelA.textContent = teamA;
  if (labelB) labelB.textContent = teamB;
  overlay.classList.remove('hidden', 'pso-hide');
  overlay.classList.add('pso-show');
  // Countdown 3 → 2 → 1 → GO!
  const steps = ['3', '2', '1', _lang === 'en' ? 'GO!' : '¡YA!'];
  let step = 0;
  if (countdown) countdown.textContent = steps[0];
  const tick = setInterval(() => {
    step++;
    if (step >= steps.length) {
      clearInterval(tick);
      overlay.classList.add('pso-hide');
      overlay.classList.remove('pso-show');
      setTimeout(() => overlay.classList.add('hidden'), 600);
    } else {
      if (countdown) {
        countdown.classList.remove('pso-count-pulse');
        void countdown.offsetWidth;
        countdown.classList.add('pso-count-pulse');
        countdown.textContent = steps[step];
      }
    }
  }, 700);
}

// ── Penalty confetti burst ─────────────────────────────────────
function _penConfetti() {
  const canvas = document.getElementById('pen-confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width  = canvas.offsetWidth  || window.innerWidth;
  canvas.height = canvas.offsetHeight || 320;
  const W = canvas.width, H = canvas.height;
  canvas.style.opacity = '1';
  const COLORS = ['#fbbf24','#22c55e','#60a5fa','#f87171','#a78bfa','#fff','#f472b6'];
  const particles = Array.from({length: 80}, () => ({
    x: W * Math.random(), y: -10 - Math.random() * 40,
    vx: (Math.random() - .5) * 4, vy: 2.5 + Math.random() * 3,
    r: 4 + Math.random() * 5, rot: Math.random() * 360,
    drot: (Math.random() - .5) * 8,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    shape: Math.random() > .5 ? 'rect' : 'circle',
  }));
  let frame = 0;
  const MAX = 90;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      p.x  += p.vx; p.y += p.vy; p.rot += p.drot; p.vy += 0.08;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - frame / MAX);
      ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') ctx.fillRect(-p.r, -p.r*.5, p.r*2, p.r);
      else { ctx.beginPath(); ctx.arc(0, 0, p.r*.7, 0, Math.PI*2); ctx.fill(); }
      ctx.restore();
    });
    frame++;
    if (frame < MAX + 20) requestAnimationFrame(draw);
    else { ctx.clearRect(0, 0, W, H); canvas.style.opacity = '0'; }
  }
  draw();
}

// ── UI state helpers ──────────────────────────────────────
function setLoading(on) {
  const loaderEl = document.getElementById('loader');
  loaderEl.classList.toggle('hidden', !on);
  const clashBtn = document.getElementById('vs-clash');
  if (clashBtn) clashBtn.disabled = on;
  if (on) _startLoadingCycle();
  else     _stopLoadingCycle();
}

const _LOADING_MSGS_ES = [
  'Calculando xG con distribución de Poisson…',
  'Simulando 30 000 escenarios de partido…',
  'Analizando estilo de juego y tácticas…',
  'Aplicando ratings históricos de plantilla…',
  'Procesando presión del árbitro y clima…',
  'Calculando probabilidades de penaltis…',
  'Determinando el MVP del partido…',
  'Generando crónica del partido…',
  'Compilando estadísticas comparadas…',
  'Finalizando resultado…',
];
const _LOADING_MSGS_EN = [
  'Computing xG via Poisson distribution…',
  'Simulating 30,000 match scenarios…',
  'Analysing playing style and tactics…',
  'Applying historical squad ratings…',
  'Processing referee pressure and weather…',
  'Computing penalty probabilities…',
  'Determining man of the match…',
  'Generating match chronicle…',
  'Compiling comparative statistics…',
  'Finalising result…',
];
let _loadingCycleTimer = null;
function _startLoadingCycle() {
  _stopLoadingCycle();
  const msgs = _lang === 'en' ? _LOADING_MSGS_EN : _LOADING_MSGS_ES;
  let i = 0;
  const span = document.querySelector('#loader span');
  if (!span) return;
  span.textContent = msgs[0];
  _loadingCycleTimer = setInterval(() => {
    i = (i + 1) % msgs.length;
    if (span && span.isConnected) span.textContent = msgs[i];
  }, 620);
}
function _stopLoadingCycle() {
  if (_loadingCycleTimer) { clearInterval(_loadingCycleTimer); _loadingCycleTimer = null; }
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function clearError() {
  document.getElementById('error-msg').classList.add('hidden');
}

// ── XSS-safe HTML escape ──────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ════════════════════════════════════════════════════════════════════════════
// SHARE CARD — Canvas 1080×1920 (9:16) infographic generator
// No external dependencies. Pure Canvas API.
// ════════════════════════════════════════════════════════════════════════════

/** Load an image, returning null on error (never throws). */
function _scLoadImg(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    // crossOrigin='anonymous' is only needed for genuinely external URLs.
    // Setting it on same-origin paths (e.g. /img/badges/…) triggers a CORS
    // preflight that Express.static doesn't answer → onerror and canvas taint.
    // For data: URIs no network request is made, so no header is needed either.
    if (/^https?:\/\//.test(src)) img.crossOrigin = 'anonymous';
    img.src = src;
  });
}

/** Strip non-Latin characters (incl. emoji) so canvas text renders reliably. */
function _scSafe(s) {
  return String(s || '').replace(/[^\u0000-\u024F\u1E00-\u1EFF]/g, '').trim();
}

/** Draw a horizontal gradient divider line. */
function _scDivider(ctx, y, W) {
  const g = ctx.createLinearGradient(0, y, W, y);
  g.addColorStop(0,   'rgba(0,212,255,0)');
  g.addColorStop(0.3, 'rgba(0,212,255,0.45)');
  g.addColorStop(0.7, 'rgba(0,212,255,0.45)');
  g.addColorStop(1,   'rgba(0,212,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, y, W, 1.5);
}

/** Draw text with a neon glow. */
function _scGlow(ctx, text, x, y, color, blur) {
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = blur;
  ctx.fillStyle   = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Draw a circular-clipped badge. Falls back to initials circle. */
function _scBadge(ctx, img, cx, cy, r, glowColor, initials) {
  ctx.save();
  // Glow ring
  ctx.shadowColor = glowColor; ctx.shadowBlur = 25;
  ctx.strokeStyle = glowColor + 'aa'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, r + 5, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;
  // Clip circle
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  if (img) {
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = glowColor + '22'; ctx.fill();
    ctx.font = `bold 52px "Rajdhani",Arial,sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = glowColor;
    ctx.fillText((initials || '?').slice(0, 3).toUpperCase(), cx, cy);
  }
  ctx.restore();
}

/**
 * Generate and return a PNG Blob for the share card.
 * @param {object} d  - _shareData snapshot
 */
async function _generateShareCard(d) {
  // ── 1. Font loading ──────────────────────────────────────────────────────
  await document.fonts.ready;
  await Promise.allSettled([
    'bold 230px "Rajdhani"', 'bold 170px "Rajdhani"',
    'bold 130px "Rajdhani"', 'bold 110px "Rajdhani"',
    'bold 88px "Rajdhani"',  'bold 58px "Rajdhani"',
    'bold 56px "Rajdhani"',  'bold 30px "Rajdhani"',
    '700 36px "Rajdhani"',   '700 27px "Rajdhani"',
    '700 25px "Rajdhani"',   '600 23px "Rajdhani"',
    '500 31px "Rajdhani"',   '500 30px "Rajdhani"',
    '500 28px "Rajdhani"',   '400 26px "Rajdhani"',
    '400 22px "Rajdhani"',
  ].map(f => document.fonts.load(f).catch(() => null)));

  // ── 2. Offscreen canvas — 1080 × 5000 scratch pad ────────────────────────
  // H=5000 is intentionally oversized; the canvas is auto-cropped to
  // finalH = footerY + 120 before export, so the output file is exactly as
  // tall as the content — no wasted pixels, no cut-off sections.
  const W = 1080, H = 5000;
  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  // alpha:false → the canvas has no alpha channel; compositing is faster and
  // there are no premultiplied-alpha artefacts or transparent-edge black borders.
  const ctx = canvas.getContext('2d', { alpha: false });
  // Paranoid transform reset: ensure no DPR scale is inherited.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // High-quality badge/image downscaling.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const CYAN    = '#00d4ff';
  const MAGENTA = '#ff2d78';
  const GOLD    = '#ffd700';
  const WHITE   = '#ffffff';
  const DIM     = 'rgba(255,255,255,0.55)';
  const DIM2    = 'rgba(255,255,255,0.28)';
  const isEN    = _lang === 'en';

  // Effective scores (show penalty scores if applicable)
  const finalScoreA = d.penalties ? (d.penalties.scoreA ?? d.scoreA) : d.scoreA;
  const finalScoreB = d.penalties ? (d.penalties.scoreB ?? d.scoreB) : d.scoreB;

  // Pre-load both badges in parallel
  const [imgA, imgB] = await Promise.all([
    _scLoadImg(d.badgeA),
    _scLoadImg(d.badgeB),
  ]);

  // ── 3. Background ─────────────────────────────────────────────────────────
  // Solid base fill FIRST. With alpha:false the canvas starts as opaque black;
  // the explicit fill ensures we meet the #1a1a1a acceptance criterion and
  // guarantees zero transparent/gap pixels even if the gradient below produces
  // any floating-point edge artefact.
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, W, H);
  // Gradient overlay on top of the solid base.
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0,    '#070710');
  bgGrad.addColorStop(0.5,  '#0b0d1a');
  bgGrad.addColorStop(1,    '#110418');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Grid overlay
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 54) {
    ctx.strokeStyle = `rgba(0,212,255,${x % 162 === 0 ? 0.06 : 0.022})`;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += 54) {
    ctx.strokeStyle = `rgba(0,212,255,${y % 162 === 0 ? 0.06 : 0.022})`;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Decorative glow orbs — centred on the new compact match-banner zone
  const addOrb = (x, y, r, color) => {
    const radGrad = ctx.createRadialGradient(x, y, 0, x, y, r);
    radGrad.addColorStop(0, color + '22');
    radGrad.addColorStop(1, color + '00');
    ctx.fillStyle = radGrad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  addOrb(200, 360, 320, '#00d4ff');
  addOrb(880, 360, 320, '#ff2d78');
  addOrb(540, 1200, 280, '#8800ff');

  // Top neon edge bar
  const topBar = ctx.createLinearGradient(0, 0, W, 0);
  topBar.addColorStop(0,   'rgba(0,212,255,0)');
  topBar.addColorStop(0.5, 'rgba(0,212,255,0.9)');
  topBar.addColorStop(1,   'rgba(0,212,255,0)');
  ctx.fillStyle = topBar; ctx.fillRect(0, 0, W, 3);

  // ── HEADER ZONE: 0 – 192 ─────────────────────────────────────────────────
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'alphabetic';

  // GOLAZOX wordmark
  ctx.font = 'bold 88px "Rajdhani",Arial,sans-serif';
  _scGlow(ctx, 'GOLAZOX', W / 2, 92, CYAN, 35);

  // Subtitle
  ctx.font = '500 28px "Rajdhani",Arial,sans-serif';
  ctx.fillStyle = DIM;
  ctx.fillText('HISTORIC MATCH SIMULATED', W / 2, 140);

  // Context (stadium · weather)
  const stadium = d.stadium ? `${_scSafe(d.stadium.name)} · ${_scSafe(d.stadium.city)}` : (isEN ? 'Neutral Ground' : 'Campo Neutral');
  const weatherTxt = d.weather ? _scSafe(isEN ? d.weather.labelEn : d.weather.labelEs) : '';
  const ctxLine = [stadium, weatherTxt].filter(Boolean).join('  ·  ').slice(0, 80);
  ctx.font = '400 24px "Rajdhani",Arial,sans-serif';
  ctx.fillStyle = DIM2;
  ctx.fillText(ctxLine, W / 2, 174);

  _scDivider(ctx, 190, W);

  // ── MATCH BANNER (both teams + score on one horizontal visual) ────────────
  // curY is the "cursor" for all dynamic content from here down.
  // Everything uses curY offsets so sections stack automatically.
  let curY = 212;

  // Badge A (left) and Badge B (right) — vertically centred on the score block
  const BAN_CY = curY + 102;   // = 314  badge vertical centre
  const BAN_AX = 165;           // badge A horizontal centre
  const BAN_BX = W - 165;       // badge B horizontal centre  (= 915)
  const BAN_R  = 82;            // badge radius
  _scBadge(ctx, imgA, BAN_AX, BAN_CY, BAN_R, CYAN,    d.teamA);
  _scBadge(ctx, imgB, BAN_BX, BAN_CY, BAN_R, MAGENTA, d.teamB);

  // Score digits — 170 px is bold and readable; right-aligning A and left-
  // aligning B around the centre creates clean score symmetry without the
  // large digits ever overrunning the badge circles (different x zones).
  const SCR_Y = curY + 182;  // = 394  score digit baseline
  ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 170px "Rajdhani",Arial,sans-serif';
  ctx.shadowColor = WHITE; ctx.shadowBlur = 45; ctx.fillStyle = WHITE;
  ctx.textAlign = 'right'; ctx.fillText(String(finalScoreA), W / 2 - 68, SCR_Y);
  ctx.textAlign = 'left';  ctx.fillText(String(finalScoreB), W / 2 + 68, SCR_Y);
  ctx.shadowBlur = 0;

  // Colon separator
  ctx.font = 'bold 110px "Rajdhani",Arial,sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.30)';
  ctx.textAlign = 'center';
  ctx.fillText(':', W / 2, curY + 158);   // = 370

  // Match result label
  const matchLabel = d.matchMode === 'penalties'
    ? (isEN ? 'PENALTY SHOOTOUT' : 'TANDA DE PENALTIS')
    : d.penalties
      ? (isEN ? 'DRAW  ·  PENALTIES' : 'EMPATE  ·  PENALTIS')
      : (isEN ? 'FINAL SCORE' : 'RESULTADO FINAL');
  ctx.font = '700 26px "Rajdhani",Arial,sans-serif';
  ctx.fillStyle = DIM2;
  ctx.fillText(matchLabel, W / 2, curY + 218);  // = 430

  // Penalty shootout scores (if applicable)
  const hasPen = !!(d.penalties && d.penalties.scoreA != null);
  if (hasPen) {
    ctx.font = '600 28px "Rajdhani",Arial,sans-serif';
    ctx.fillStyle = GOLD + 'cc';
    ctx.fillText(
      `(${d.penalties.scoreA} – ${d.penalties.scoreB} ${isEN ? 'pen.' : 'pen.'})`,
      W / 2, curY + 255   // = 467
    );
  }

  // Team names — left-aligned from far-left for A, right-aligned to far-right
  // for B. Placed *below* the badge/score block so they never clip digits.
  // fitText shrinks font until the name fits maxW, then adds "…" if needed.
  const NAME_MAX_W = 450;
  const nameY      = curY + (hasPen ? 292 : 260);  // = 504 or 472

  const fitText = (text, maxW, maxFs, minFs) => {
    let fs = maxFs;
    ctx.font = `bold ${fs}px "Rajdhani",Arial,sans-serif`;
    while (ctx.measureText(text).width > maxW && fs > minFs) {
      fs -= 2;
      ctx.font = `bold ${fs}px "Rajdhani",Arial,sans-serif`;
    }
    let t = text;
    if (ctx.measureText(t).width > maxW) {
      while (t.length > 2 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
      t += '…';
    }
    return t;
  };

  const nmA = fitText(_scSafe(d.teamA), NAME_MAX_W, 44, 22);
  ctx.textAlign = 'left'; ctx.fillStyle = WHITE;
  ctx.shadowColor = CYAN; ctx.shadowBlur = 10;
  ctx.fillText(nmA, 28, nameY);
  ctx.shadowBlur = 0;

  const nmB = fitText(_scSafe(d.teamB), NAME_MAX_W, 44, 22);
  ctx.textAlign = 'right'; ctx.fillStyle = WHITE;
  ctx.shadowColor = MAGENTA; ctx.shadowBlur = 10;
  ctx.fillText(nmB, W - 28, nameY);
  ctx.shadowBlur = 0;

  const eraY = nameY + 40;
  if (d.eraA) {
    ctx.font = '500 27px "Rajdhani",Arial,sans-serif';
    ctx.textAlign = 'left'; ctx.fillStyle = CYAN + 'bb';
    ctx.fillText(_scSafe(d.eraA), 28, eraY);
  }
  if (d.eraB) {
    ctx.font = '500 27px "Rajdhani",Arial,sans-serif';
    ctx.textAlign = 'right'; ctx.fillStyle = MAGENTA + 'bb';
    ctx.fillText(_scSafe(d.eraB), W - 28, eraY);
  }
  const hasEra = !!(d.eraA || d.eraB);
  curY = eraY + (hasEra ? 52 : 30);

  _scDivider(ctx, curY + 8, W);
  curY += 32;

  // ── SCORERS ───────────────────────────────────────────────────────────────
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = '700 25px "Rajdhani",Arial,sans-serif';
  ctx.fillStyle = DIM2;
  ctx.fillText(isEN ? 'GOALSCORERS' : 'GOLEADORES', W / 2, curY);
  curY += 16;

  // Team name colour-labels above their scorer column
  ctx.font = '600 22px "Rajdhani",Arial,sans-serif';
  ctx.textAlign = 'right'; ctx.fillStyle = CYAN + 'aa';
  ctx.fillText(_scSafe(d.teamA).slice(0, 18), W / 2 - 22, curY);
  ctx.textAlign = 'left';  ctx.fillStyle = MAGENTA + 'aa';
  ctx.fillText(_scSafe(d.teamB).slice(0, 18), W / 2 + 22, curY);
  curY += 8;

  const maxRows = 4;
  const sA      = (d.scorersA || []).slice(0, maxRows);
  const sB      = (d.scorersB || []).slice(0, maxRows);
  const rows    = Math.max(sA.length, sB.length, 1);

  // Vertical divider between the two scorer columns
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(W / 2 - 1, curY, 2, rows * 52 + 20);

  ctx.font = '500 31px "Rajdhani",Arial,sans-serif';
  for (let i = 0; i < rows; i++) {
    const ry = curY + 14 + i * 52;
    const gA = sA[i];
    const gB = sB[i];

    if (gA) {
      const nm     = _scSafe(gA.name);
      const minTxt = `${gA.minute || '?'}'`;
      ctx.font = '500 31px "Rajdhani",Arial,sans-serif';
      const nmW = ctx.measureText(nm).width;
      ctx.textAlign = 'right'; ctx.fillStyle = CYAN;
      ctx.fillText(nm, W / 2 - 15, ry);
      ctx.font = '500 24px "Rajdhani",Arial,sans-serif';
      ctx.fillStyle = CYAN + '88'; ctx.textAlign = 'right';
      ctx.fillText(minTxt, W / 2 - 15 - nmW - 10, ry);
      ctx.font = '500 31px "Rajdhani",Arial,sans-serif';
    } else {
      ctx.textAlign = 'right'; ctx.fillStyle = DIM2;
      ctx.fillText('—', W / 2 - 30, ry);
    }

    if (gB) {
      const nm     = _scSafe(gB.name);
      const minTxt = `${gB.minute || '?'}'`;
      ctx.font = '500 31px "Rajdhani",Arial,sans-serif';
      const nmW = ctx.measureText(nm).width;
      ctx.textAlign = 'left'; ctx.fillStyle = MAGENTA;
      ctx.fillText(nm, W / 2 + 15, ry);
      ctx.font = '500 24px "Rajdhani",Arial,sans-serif';
      ctx.fillStyle = MAGENTA + '88'; ctx.textAlign = 'left';
      ctx.fillText(minTxt, W / 2 + 15 + nmW + 10, ry);
      ctx.font = '500 31px "Rajdhani",Arial,sans-serif';
    } else {
      ctx.textAlign = 'left'; ctx.fillStyle = DIM2;
      ctx.fillText('—', W / 2 + 30, ry);
    }
  }

  curY += rows * 52 + 34;
  _scDivider(ctx, curY, W);
  curY += 42;

  if (d.ratings) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '700 25px "Rajdhani",Arial,sans-serif';
    ctx.fillStyle = DIM2;
    ctx.fillText(isEN ? 'TEAM STATS' : 'ESTADÍSTICAS', W / 2, curY);
    curY += 42;

    const BAR_W  = 320;
    const BAR_H  = 13;
    const ROW_H  = 56;
    const PAD    = 50;  // gap label to bar
    const statRows = [
      { lbl: isEN ? 'ATK' : 'ATQ', vA: d.ratings.teamA.attack,      vB: d.ratings.teamB.attack },
      { lbl: isEN ? 'MID' : 'MED', vA: d.ratings.teamA.midfield,    vB: d.ratings.teamB.midfield },
      { lbl: isEN ? 'DEF' : 'DEF', vA: d.ratings.teamA.defense,     vB: d.ratings.teamB.defense },
      { lbl: isEN ? 'GK'  : 'POR', vA: d.ratings.teamA.goalkeeping, vB: d.ratings.teamB.goalkeeping },
    ];

    statRows.forEach(s => {
      const ry    = curY;
      const total = (s.vA + s.vB) || 1;
      const wA    = Math.max(8, Math.round(BAR_W * s.vA / (total * 1.1)));
      const wB    = Math.max(8, Math.round(BAR_W * s.vB / (total * 1.1)));
      const cx2   = W / 2;

      // Label
      ctx.font = '600 23px "Rajdhani",Arial,sans-serif';
      ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(s.lbl, cx2, ry + BAR_H);

      // Team A bar (left)
      ctx.fillStyle = 'rgba(0,212,255,0.1)';
      ctx.fillRect(cx2 - PAD - BAR_W, ry, BAR_W, BAR_H);
      const gA2 = ctx.createLinearGradient(cx2 - PAD - wA, 0, cx2 - PAD, 0);
      gA2.addColorStop(0, 'rgba(0,212,255,0.3)');
      gA2.addColorStop(1, 'rgba(0,212,255,0.95)');
      ctx.fillStyle = gA2;
      ctx.fillRect(cx2 - PAD - wA, ry, wA, BAR_H);
      ctx.font = 'bold 27px "Rajdhani",Arial,sans-serif';
      ctx.textAlign = 'right'; ctx.fillStyle = CYAN;
      ctx.fillText(String(s.vA), cx2 - PAD - BAR_W - 14, ry + BAR_H);

      // Team B bar (right)
      ctx.fillStyle = 'rgba(255,45,120,0.1)';
      ctx.fillRect(cx2 + PAD, ry, BAR_W, BAR_H);
      const gB2 = ctx.createLinearGradient(cx2 + PAD, 0, cx2 + PAD + wB, 0);
      gB2.addColorStop(0, 'rgba(255,45,120,0.95)');
      gB2.addColorStop(1, 'rgba(255,45,120,0.3)');
      ctx.fillStyle = gB2;
      ctx.fillRect(cx2 + PAD, ry, wB, BAR_H);
      ctx.font = 'bold 27px "Rajdhani",Arial,sans-serif';
      ctx.textAlign = 'left'; ctx.fillStyle = MAGENTA;
      ctx.fillText(String(s.vB), cx2 + PAD + BAR_W + 14, ry + BAR_H);

      curY += ROW_H;
    });

    _scDivider(ctx, curY, W);
    curY += 40;
  }

  // ── MAN OF THE MATCH ──────────────────────────────────────────────────────
  if (d.mom) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '700 25px "Rajdhani",Arial,sans-serif';
    ctx.fillStyle = 'rgba(255,215,0,0.55)';
    ctx.fillText(isEN ? 'PLAYER OF THE MATCH' : 'MEJOR JUGADOR DEL PARTIDO', W / 2, curY);
    curY += 12;

    ctx.font = 'bold 56px "Rajdhani",Arial,sans-serif';
    _scGlow(ctx, _scSafe(d.mom.name || ''), W / 2, curY + 56, GOLD, 22);
    curY += 76;

    let reason = '';
    if (d.mom.reason?.type === 'goals') {
      const n = d.mom.reason.count;
      reason = `${n} ${n === 1 ? (isEN ? 'goal' : 'gol') : (isEN ? 'goals' : 'goles')}`;
    } else {
      reason = isEN ? 'Best on the pitch' : 'Mejor en el campo';
    }
    ctx.font = '500 28px "Rajdhani",Arial,sans-serif';
    ctx.fillStyle = GOLD + '88';
    ctx.fillText(_scSafe(reason), W / 2, curY);
    curY += 48;

    _scDivider(ctx, curY, W);
    curY += 40;
  }

  // ── WIN PROBABILITIES ─────────────────────────────────────────────────────
  if (d.probabilities) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '600 23px "Rajdhani",Arial,sans-serif';
    ctx.fillStyle = DIM2;
    ctx.fillText(isEN ? 'WIN PROBABILITY' : 'PROBABILIDAD DE VICTORIA', W / 2, curY);
    curY += 18;

    const { teamA_win: pA, draw: pD, teamB_win: pB } = d.probabilities;
    const bX = 90, bW = W - 180, bH = 18;
    const total = pA + pD + pB || 100;
    const wA = Math.round(bW * pA / total);
    const wD = Math.round(bW * pD / total);
    const wBb = bW - wA - wD;

    ctx.fillStyle = 'rgba(0,212,255,0.9)';   ctx.fillRect(bX,          curY, wA,  bH);
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(bX + wA,      curY, wD,  bH);
    ctx.fillStyle = 'rgba(255,45,120,0.9)';  ctx.fillRect(bX + wA + wD, curY, wBb, bH);
    curY += bH + 10;

    ctx.font = 'bold 30px "Rajdhani",Arial,sans-serif';
    ctx.textAlign = 'left';   ctx.fillStyle = CYAN;    ctx.fillText(`${pA}%`, bX, curY);
    ctx.textAlign = 'center'; ctx.fillStyle = DIM;     ctx.fillText(`${pD}%`, W / 2, curY);
    ctx.textAlign = 'right';  ctx.fillStyle = MAGENTA; ctx.fillText(`${pB}%`, bX + bW, curY);
    curY += 52;

    _scDivider(ctx, curY, W);
    curY += 40;
  }

  // ── MATCH STATS (possession / shots / corners / saves / fouls) ────────────
  if (d.matchStats) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '700 25px "Rajdhani",Arial,sans-serif';
    ctx.fillStyle = DIM2;
    ctx.fillText(isEN ? 'MATCH STATS' : 'ESTADÍSTICAS DEL PARTIDO', W / 2, curY);
    curY += 42;

    const ms = d.matchStats;
    const statLines = [
      { lbl: isEN ? 'POSSESSION' : 'POSESIÓN',  vA: ms.possession.teamA, vB: ms.possession.teamB, sfx: '%' },
      { lbl: isEN ? 'SHOTS'      : 'TIROS',      vA: ms.shots.teamA,      vB: ms.shots.teamB,      sfx: ''  },
      { lbl: isEN ? 'CORNERS'    : 'CÓRNERES',   vA: ms.corners.teamA,    vB: ms.corners.teamB,    sfx: ''  },
      { lbl: isEN ? 'SAVES'      : 'PARADAS',    vA: ms.saves.teamA,      vB: ms.saves.teamB,      sfx: ''  },
      { lbl: isEN ? 'FOULS'      : 'FALTAS',     vA: ms.fouls.teamA,      vB: ms.fouls.teamB,      sfx: ''  },
    ];

    const SBW = 280, SBH = 12, SPAD = 46, SROW = 48;
    const scx = W / 2;
    statLines.forEach(s => {
      const tot = (s.vA + s.vB) || 1;
      const wSA = Math.max(6, Math.round(SBW * s.vA / tot));
      const wSB = Math.max(6, Math.round(SBW * s.vB / tot));

      ctx.font = '500 22px "Rajdhani",Arial,sans-serif';
      ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText(s.lbl, scx, curY + SBH);

      ctx.fillStyle = 'rgba(0,212,255,0.1)';
      ctx.fillRect(scx - SPAD - SBW, curY, SBW, SBH);
      ctx.fillStyle = 'rgba(0,212,255,0.85)';
      ctx.fillRect(scx - SPAD - wSA, curY, wSA, SBH);

      ctx.fillStyle = 'rgba(255,45,120,0.1)';
      ctx.fillRect(scx + SPAD, curY, SBW, SBH);
      ctx.fillStyle = 'rgba(255,45,120,0.85)';
      ctx.fillRect(scx + SPAD, curY, wSB, SBH);

      ctx.font = 'bold 26px "Rajdhani",Arial,sans-serif';
      ctx.textAlign = 'right'; ctx.fillStyle = CYAN;
      ctx.fillText(`${s.vA}${s.sfx}`, scx - SPAD - SBW - 12, curY + SBH);
      ctx.textAlign = 'left'; ctx.fillStyle = MAGENTA;
      ctx.fillText(`${s.vB}${s.sfx}`, scx + SPAD + SBW + 12, curY + SBH);

      curY += SROW;
    });

    _scDivider(ctx, curY, W);
    curY += 40;
  }

  // ── RADAR CHART ────────────────────────────────────────────────────────────
  if (d.ratings) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '700 25px "Rajdhani",Arial,sans-serif';
    ctx.fillStyle = DIM2;
    ctx.fillText(isEN ? 'TEAM RADAR' : 'RADAR DE EQUIPOS', W / 2, curY);
    curY += 30;

    const radarAxes = [
      { lbl: isEN ? 'ATK' : 'ATQ', vA: d.ratings.teamA.attack,      vB: d.ratings.teamB.attack },
      { lbl: isEN ? 'MID' : 'MED', vA: d.ratings.teamA.midfield,    vB: d.ratings.teamB.midfield },
      { lbl: isEN ? 'DEF' : 'DEF', vA: d.ratings.teamA.defense,     vB: d.ratings.teamB.defense },
      { lbl: isEN ? 'GK'  : 'POR', vA: d.ratings.teamA.goalkeeping, vB: d.ratings.teamB.goalkeeping },
      { lbl: isEN ? 'PHY' : 'FÍS',
        vA: Math.round((d.ratings.teamA.attack + d.ratings.teamA.midfield) / 2),
        vB: Math.round((d.ratings.teamB.attack + d.ratings.teamB.midfield) / 2) },
    ];
    const RN  = radarAxes.length;
    const RCX = W / 2, RCY = curY + 220, RR = 200;
    const rang = i => (Math.PI * 2 * i / RN) - Math.PI / 2;
    const rpt  = (r, i) => [RCX + r * Math.cos(rang(i)), RCY + r * Math.sin(rang(i))];

    [0.25, 0.5, 0.75, 1].forEach(frac => {
      ctx.beginPath();
      for (let i = 0; i < RN; i++) {
        const [px, py] = rpt(RR * frac, i);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(255,255,255,${frac === 1 ? 0.12 : 0.06})`;
      ctx.lineWidth = 1; ctx.stroke();
    });

    for (let i = 0; i < RN; i++) {
      const [px, py] = rpt(RR, i);
      ctx.beginPath(); ctx.moveTo(RCX, RCY); ctx.lineTo(px, py);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1; ctx.stroke();
    }

    ctx.save();
    ctx.beginPath();
    radarAxes.forEach(({ vA }, i) => {
      const [px, py] = rpt(RR * vA / 100, i);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,212,255,0.18)'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,212,255,0.9)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    radarAxes.forEach(({ vB }, i) => {
      const [px, py] = rpt(RR * vB / 100, i);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,45,120,0.15)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,45,120,0.9)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();

    ctx.font = 'bold 26px "Rajdhani",Arial,sans-serif';
    ctx.textBaseline = 'middle';
    radarAxes.forEach(({ lbl }, i) => {
      const [px, py] = rpt(RR + 38, i);
      ctx.textAlign  = px < RCX - 10 ? 'right' : px > RCX + 10 ? 'left' : 'center';
      ctx.fillStyle  = DIM;
      ctx.fillText(lbl, px, py);
    });

    const legY = RCY + RR + 55;
    ctx.textBaseline = 'alphabetic';
    ctx.font = '600 26px "Rajdhani",Arial,sans-serif';
    ctx.beginPath(); ctx.arc(W / 2 - 180, legY - 8, 8, 0, Math.PI * 2);
    ctx.fillStyle = CYAN; ctx.fill();
    ctx.textAlign = 'left'; ctx.fillStyle = CYAN;
    ctx.fillText(_scSafe(d.teamA), W / 2 - 165, legY);
    ctx.beginPath(); ctx.arc(W / 2 + 60, legY - 8, 8, 0, Math.PI * 2);
    ctx.fillStyle = MAGENTA; ctx.fill();
    ctx.textAlign = 'left'; ctx.fillStyle = MAGENTA;
    ctx.fillText(_scSafe(d.teamB), W / 2 + 75, legY);

    curY = legY + 50;
    _scDivider(ctx, curY, W);
    curY += 40;
  }

  // ── LINEUPS ────────────────────────────────────────────────────────────────
  if (d.lineupA?.players?.length && d.lineupB?.players?.length) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '700 25px "Rajdhani",Arial,sans-serif';
    ctx.fillStyle = DIM2;
    ctx.fillText(isEN ? 'LINEUPS' : 'ALINEACIONES', W / 2, curY);
    curY += 16;

    ctx.font = '500 28px "Rajdhani",Arial,sans-serif';
    ctx.textAlign = 'left';  ctx.fillStyle = CYAN + 'cc';
    ctx.fillText(_scSafe(d.lineupA.formation || ''), 60, curY);
    ctx.textAlign = 'right'; ctx.fillStyle = MAGENTA + 'cc';
    ctx.fillText(_scSafe(d.lineupB.formation || ''), W - 60, curY);
    curY += 36;

    const POS_ROW_SC = { GK:0, RB:1, CB:1, LB:1, DM:2, CM:3, RM:3, LM:3, AM:3.5, RW:4, LW:4, ST:4 };
    const makeRows = lineup => {
      const rows = {};
      (lineup.players || []).slice(0, 11).forEach(p => {
        const row = POS_ROW_SC[p.position] ?? 3;
        (rows[row] = rows[row] || []).push(p);
      });
      return Object.keys(rows).sort((a, b) => a - b).map(k => rows[k]);
    };
    const rowsA = makeRows(d.lineupA);
    const rowsB = makeRows(d.lineupB);
    const totalRows = Math.max(rowsA.length, rowsB.length);

    for (let ri = 0; ri < totalRows; ri++) {
      const rowA = rowsA[ri] || [];
      const rowB = rowsB[ri] || [];
      const ROW_H_LU = 58, COL_W = W / 2 - 40;

      rowA.forEach((p, pi) => {
        const cellW = COL_W / rowA.length;
        const x = 40 + cellW * pi + cellW / 2;
        const y = curY + 38;
        ctx.beginPath(); ctx.arc(x, y - 14, 15, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,212,255,0.25)'; ctx.fill();
        ctx.strokeStyle = CYAN + '99'; ctx.lineWidth = 2; ctx.stroke();
        ctx.font = 'bold 13px "Rajdhani",Arial,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = CYAN; ctx.fillText(p.position, x, y - 14);
        ctx.font = '500 22px "Rajdhani",Arial,sans-serif';
        ctx.textBaseline = 'alphabetic';
        const nm = _scSafe(p.name).split(' ').pop();
        ctx.fillStyle = WHITE; ctx.fillText(nm, x, y + 14);
      });

      rowB.forEach((p, pi) => {
        const cellW = COL_W / rowB.length;
        const x = W / 2 + 40 + cellW * pi + cellW / 2;
        const y = curY + 38;
        ctx.beginPath(); ctx.arc(x, y - 14, 15, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,45,120,0.2)'; ctx.fill();
        ctx.strokeStyle = MAGENTA + '99'; ctx.lineWidth = 2; ctx.stroke();
        ctx.font = 'bold 13px "Rajdhani",Arial,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = MAGENTA; ctx.fillText(p.position, x, y - 14);
        ctx.font = '500 22px "Rajdhani",Arial,sans-serif';
        ctx.textBaseline = 'alphabetic';
        const nm = _scSafe(p.name).split(' ').pop();
        ctx.fillStyle = WHITE; ctx.fillText(nm, x, y + 14);
      });

      curY += ROW_H_LU;
    }

    curY += 40;
    _scDivider(ctx, curY, W);
    curY += 40;
  }

  // ── FOOTER (anchored at curY, not at fixed H) ──────────────────────────────
  const footerY = curY + 20;
  const botBar = ctx.createLinearGradient(0, 0, W, 0);
  botBar.addColorStop(0,   'rgba(0,212,255,0)');
  botBar.addColorStop(0.5, 'rgba(0,212,255,0.75)');
  botBar.addColorStop(1,   'rgba(0,212,255,0)');
  ctx.fillStyle = botBar; ctx.fillRect(0, footerY, W, 2);

  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = '700 36px "Rajdhani",Arial,sans-serif';
  const _sUrl = ((window.GOLAZOX_CONFIG && window.GOLAZOX_CONFIG.siteUrl) || 'golazox.com')
    .replace(/^https?:\/\//, '').replace(/\/$/, '');
  _scGlow(ctx, _sUrl, W / 2, footerY + 54, CYAN, 18);

  ctx.font = '400 22px "Rajdhani",Arial,sans-serif';
  ctx.fillStyle = DIM2;
  ctx.fillText('Football Time Machine', W / 2, footerY + 84);

  // ── Crop to actual content height ─────────────────────────────────────────
  const finalH = footerY + 120;
  const out    = document.createElement('canvas');
  out.width    = W;
  out.height   = Math.min(finalH, H);
  const outCtx = out.getContext('2d', { alpha: false });
  outCtx.drawImage(canvas, 0, 0, W, out.height, 0, 0, W, out.height);

  // ── Export ────────────────────────────────────────────────────────────────
  return new Promise((resolve, reject) => {
    try {
      out.toBlob(blob => {
        if (blob) { resolve(blob); return; }
        try {
          const dataUrl = out.toDataURL('image/png');
          const [header, b64] = dataUrl.split(',');
          const mime = (header.match(/:(.*?);/) || [])[1] || 'image/png';
          const bstr = atob(b64);
          const u8 = new Uint8Array(bstr.length);
          for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
          resolve(new Blob([u8], { type: mime }));
        } catch (e2) { reject(e2); }
      }, 'image/png');
    } catch (e) { reject(e); }
  });
}
