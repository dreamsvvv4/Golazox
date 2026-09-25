#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { fetchTransfermarktSquad } = require('./transfermarkt');
const { fetchTeamBadge } = require('./lookup');

const args = process.argv.slice(2);
const hasFlag = flag => args.includes(flag);
const getArg = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const CONFIG_FILE = path.resolve(__dirname, getArg('--config', 'league-expansion.json'));
const STATE_FILE = path.resolve(__dirname, getArg('--state', 'data/league-expansion-progress.json'));
const MANIFEST_FILE = path.join(__dirname, 'data', 'expanded-leagues.json');
const META_FILE = path.join(__dirname, 'squads-meta.json');
const SQUADS_DIR = path.join(__dirname, 'squads');
const BADGES_DIR = path.join(__dirname, 'public', 'img', 'badges');
const LOG_FILE = path.join(__dirname, 'logs', 'league-expansion.log');
const DELAY = Number.parseInt(getArg('--delay', '3500'), 10);
const LIMIT = Number.parseInt(getArg('--limit', '25'), 10);
const MAX_ATTEMPTS = Number.parseInt(getArg('--max-attempts', '3'), 10);
const ONLY_CODE = getArg('--competition', '');
const DISCOVER_ONLY = hasFlag('--discover-only');
const DRY_RUN = hasFlag('--dry-run');
const WATCH = hasFlag('--watch');
const CYCLE_DELAY = Number.parseInt(getArg('--cycle-delay', '600000'), 10);

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.7',
};

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
};
const writeJsonAtomic = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
};
const log = message => {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.appendFileSync(LOG_FILE, `${line}\n`, 'utf8');
};
const slugify = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function loadConfig() {
  const config = readJson(CONFIG_FILE, null);
  if (!config?.season || !Array.isArray(config.competitions)) throw new Error(`Configuración inválida: ${CONFIG_FILE}`);
  const competitions = config.competitions
    .filter(item => !ONLY_CODE || item.code === ONLY_CODE)
    .sort((left, right) => left.priority - right.priority);
  if (!competitions.length) throw new Error(`No hay competiciones para procesar${ONLY_CODE ? ` (${ONLY_CODE})` : ''}`);
  return { ...config, competitions };
}

function localClubsById() {
  const clubs = new Map();
  for (const file of fs.readdirSync(SQUADS_DIR).filter(name => name.endsWith('.json'))) {
    const data = readJson(path.join(SQUADS_DIR, file), null);
    if (Number.isInteger(data?.id) && data.id > 0) clubs.set(data.id, data.slug || file.replace(/\.json$/, ''));
  }
  return clubs;
}

async function fetchHtml(url) {
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} en ${url}`);
  return response.text();
}

async function discoverCompetition(competition, season) {
  const route = competition.kind === 'overlay'
    ? `teilnehmer/pokalwettbewerb/${competition.code}`
    : `startseite/wettbewerb/${competition.code}`;
  const url = `https://www.transfermarkt.es/x/${route}/saison_id/${season}`;
  const $ = cheerio.load(await fetchHtml(url));
  const clubs = new Map();
  $('table.items a[href*="/verein/"]').each((_, anchor) => {
    const href = $(anchor).attr('href') || '';
    const match = href.match(/^\/([^/]+)\/[^/]+\/verein\/(\d+)/);
    const name = ($(anchor).attr('title') || $(anchor).text()).replace(/\s+/g, ' ').trim();
    if (!match || !name) return;
    const id = Number.parseInt(match[2], 10);
    clubs.set(id, { id, name, tmSlug: match[1] });
  });
  const teams = [...clubs.values()];
  if (teams.length < 2) throw new Error(`No se detectaron participantes para ${competition.code}`);
  if (competition.expectedTeams && teams.length !== competition.expectedTeams) {
    log(`AVISO ${competition.code}: esperados ${competition.expectedTeams}, detectados ${teams.length}`);
  }
  return teams;
}

function chooseStorageSlug(club, knownIds, reservedSlugs) {
  if (knownIds.has(club.id)) return knownIds.get(club.id);
  const base = slugify(club.tmSlug || club.name) || `club-${club.id}`;
  if (!reservedSlugs.has(base)) return base;
  return `${base}-${club.id}`;
}

function hasLocalBadge(storageSlug) {
  const squad = readJson(path.join(SQUADS_DIR, `${storageSlug}.json`), null);
  if (!squad?.badgeLocalPath) return false;
  return fs.existsSync(path.join(__dirname, 'public', squad.badgeLocalPath.replace(/^\//, '')));
}

async function downloadBadge(club, storageSlug) {
  const target = path.join(BADGES_DIR, `${storageSlug}.png`);
  if (fs.existsSync(target) && fs.statSync(target).size > 500) return `/img/badges/${storageSlug}.png`;
  const response = await fetch(`https://tmssl.akamaized.net/images/wappen/head/${club.id}.png`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(15000),
  });
  if (response.ok && (response.headers.get('content-type') || '').startsWith('image/')) {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length >= 200 && bytes.length <= 512 * 1024) {
      fs.mkdirSync(BADGES_DIR, { recursive: true });
      fs.writeFileSync(target, bytes);
      return `/img/badges/${storageSlug}.png`;
    }
  }
  const fallbackPath = await fetchTeamBadge(club.name);
  if (!fallbackPath) return null;
  const fallbackFile = path.join(__dirname, 'public', fallbackPath.replace(/^\//, ''));
  if (!fs.existsSync(fallbackFile)) return null;
  const extension = path.extname(fallbackFile).toLowerCase() || '.png';
  const localPath = `/img/badges/${storageSlug}${extension}`;
  const localFile = path.join(__dirname, 'public', localPath.replace(/^\//, ''));
  if (path.resolve(fallbackFile) !== path.resolve(localFile)) fs.copyFileSync(fallbackFile, localFile);
  return localPath;
}

function updateMetadata(storageSlug, club, competition, badgeLocalPath) {
  const meta = readJson(META_FILE, {});
  const current = meta[storageSlug] || {};
  meta[storageSlug] = {
    ...current,
    nameEn: current.nameEn || club.name,
    nameEs: current.nameEs || club.name,
    ...(competition.kind === 'league' ? { group: competition.group } : {}),
    ...(badgeLocalPath ? { badgeLocalPath } : {}),
  };
  writeJsonAtomic(META_FILE, meta);
  if (badgeLocalPath) {
    const squadFile = path.join(SQUADS_DIR, `${storageSlug}.json`);
    const squad = readJson(squadFile, null);
    if (squad && squad.badgeLocalPath !== badgeLocalPath) {
      squad.badgeLocalPath = badgeLocalPath;
      writeJsonAtomic(squadFile, squad);
    }
  }
}

function competitionIsComplete(state, competition, slugs) {
  const records = Object.values(state.clubs).filter(club => club.competition === competition.code);
  return records.length === slugs.length
    && records.every(club => club.status === 'complete' && hasLocalBadge(club.storageSlug));
}

function publishCompletedCompetitions(config, state, manifest) {
  for (const competition of config.competitions) {
    const slugs = state.competitions[competition.code]?.slugs || [];
    if (slugs.length && competitionIsComplete(state, competition, slugs)) {
      manifest[competition.group] = slugs;
      state.competitions[competition.code].status = 'complete';
    } else {
      delete manifest[competition.group];
    }
  }
}

async function main() {
  const config = loadConfig();
  const state = readJson(STATE_FILE, { version: 1, season: config.season, clubs: {}, competitions: {} });
  const manifest = readJson(MANIFEST_FILE, {});
  const knownIds = localClubsById();
  const reservedSlugs = new Set(fs.readdirSync(SQUADS_DIR).filter(name => name.endsWith('.json')).map(name => name.replace(/\.json$/, '')));
  const queue = [];

  for (const competition of config.competitions) {
    log(`Descubriendo ${competition.group} (${competition.code})...`);
    try {
      const clubs = await discoverCompetition(competition, config.season);
      const slugs = [];
      for (const club of clubs) {
        const storageSlug = chooseStorageSlug(club, knownIds, reservedSlugs);
        knownIds.set(club.id, storageSlug);
        reservedSlugs.add(storageSlug);
        slugs.push(storageSlug);
        const key = `${competition.code}:${club.id}`;
        const previous = state.clubs[key] || {};
        state.clubs[key] = { ...previous, ...club, storageSlug, competition: competition.code, group: competition.group, kind: competition.kind };
        const needsImport = previous.status !== 'complete' || !hasLocalBadge(storageSlug);
        if (needsImport && Number(previous.attempts || 0) < MAX_ATTEMPTS) queue.push({ key, club, storageSlug, competition });
      }
      state.competitions[competition.code] = { group: competition.group, kind: competition.kind, teams: clubs.length, slugs, status: 'discovered', updatedAt: new Date().toISOString() };
      if (competitionIsComplete(state, competition, slugs)) manifest[competition.group] = slugs;
      else delete manifest[competition.group];
    } catch (error) {
      state.competitions[competition.code] = { group: competition.group, kind: competition.kind, status: 'failed', error: error.message, updatedAt: new Date().toISOString() };
      log(`ERROR descubrimiento ${competition.code}: ${error.message}`);
    }
    writeJsonAtomic(STATE_FILE, state);
    writeJsonAtomic(MANIFEST_FILE, manifest);
    await sleep(Math.min(DELAY, 1500));
  }

  log(`Cola pendiente: ${queue.length}. Límite de este ciclo: ${LIMIT}.`);
  if (DISCOVER_ONLY || DRY_RUN) return;

  let processed = 0;
  for (const item of queue) {
    if (processed >= LIMIT) break;
    const progress = state.clubs[item.key];
    progress.status = 'running';
    progress.attempts = Number(progress.attempts || 0) + 1;
    progress.updatedAt = new Date().toISOString();
    writeJsonAtomic(STATE_FILE, state);
    try {
      log(`[${processed + 1}/${Math.min(queue.length, LIMIT)}] ${item.club.name} -> ${item.storageSlug}`);
      const override = { id: item.club.id, slug: item.storageSlug, tmSlug: item.club.tmSlug };
      const squad = await fetchTransfermarktSquad(item.club.name, String(config.season), override, item.storageSlug);
      if (!squad?.players?.length && !squad?.allPlayers?.length) throw new Error('Transfermarkt no devolvió una plantilla válida');
      const badgeLocalPath = await downloadBadge(item.club, item.storageSlug);
      if (!badgeLocalPath) throw new Error('No se pudo obtener un escudo local válido');
      updateMetadata(item.storageSlug, item.club, item.competition, badgeLocalPath);
      progress.status = 'complete';
      progress.badge = Boolean(badgeLocalPath);
      delete progress.error;
    } catch (error) {
      progress.status = 'failed';
      progress.error = error.message;
      log(`ERROR ${item.club.name}: ${error.message}`);
    }
    progress.updatedAt = new Date().toISOString();
    writeJsonAtomic(STATE_FILE, state);
    processed++;
    if (processed < Math.min(queue.length, LIMIT)) await sleep(DELAY);
  }
  publishCompletedCompetitions(config, state, manifest);
  writeJsonAtomic(STATE_FILE, state);
  writeJsonAtomic(MANIFEST_FILE, manifest);
  log(`Ciclo terminado: ${processed} procesados, ${queue.length - processed} pendientes.`);
}

process.on('SIGINT', () => { log('Parada solicitada; el checkpoint queda guardado.'); process.exit(0); });
process.on('SIGTERM', () => { log('Parada solicitada; el checkpoint queda guardado.'); process.exit(0); });

async function run() {
  do {
    await main();
    if (WATCH) {
      log(`Próximo ciclo en ${Math.round(CYCLE_DELAY / 60000)} minutos.`);
      await sleep(CYCLE_DELAY);
    }
  } while (WATCH);
}

run().catch(error => {
  log(`ERROR FATAL: ${error.stack || error.message}`);
  process.exitCode = 1;
});