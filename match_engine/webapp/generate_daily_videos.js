#!/usr/bin/env node
'use strict';
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const BASE = __dirname;
const OUT_DIR = path.join(BASE, 'videos');
const AGENDA = require('./_agenda_screenshot');
const FICHAJES = require('./_fichajes_cerrados_diarios');

async function generateAgendaPages(dateStr, maxPerPage = 6, opts = {}) {
  const ctx = AGENDA.pickEventsFor(dateStr);
  const events = (ctx && ctx.events) || [];
  if (!events.length) {
    console.log('No agenda events for', dateStr);
    return [];
  }
  // split into pages
  const pages = [];
  for (let i=0;i<events.length;i+=maxPerPage) pages.push(events.slice(i, i+maxPerPage));
  const outputs = [];
  // Determine the maximum events on any generated page so we can keep
  // typography consistent across pages (pass as `sizingMax` to buildHtml).
  const maxOnAnyPage = pages.reduce((m,pg)=>Math.max(m, (pg && pg.length)||0), 0);
  for (let p=0;p<pages.length;p++) {
    const pageEvents = pages[p];
    const pageCtx = { date: dateStr, events: pageEvents, sizingMax: maxOnAnyPage };
    const html = AGENDA.buildHtml(pageCtx);
    const outBase = `agenda_${dateStr}_p${String(p+1).padStart(2,'0')}`;
    console.log('Rendering', outBase, 'with', pageEvents.length, 'events');
    let res;
    // Force per-event reveal on ALL pages for consistent effect.
    try {
      const durationPerStep = opts.durationPerStep || 1.2;
      res = await AGENDA.renderAgendaPageEventReveal(dateStr, outBase, pageEvents, { durationPerStep, sizingMax: maxOnAnyPage });
    } catch (e) {
      console.error('Per-event reveal failed for', outBase, e);
      res = await AGENDA.renderHtmlToPngMp4(html, outBase, 6);
    }
    outputs.push({ outBase, ...res });
  }
  return outputs;
}

async function generateFichajes(dateStr, topN = 6) {
  // _fichajes_cerrados_diarios.main takes args from process.argv normally; call programmatically by spawning
  console.log('Generating fichajes for', dateStr);
  const r = spawnSync(process.execPath, [path.join(BASE, '_fichajes_cerrados_diarios.js'), dateStr, String(topN)], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('Fichajes generator failed');
    return null;
  }
  const out = path.join(OUT_DIR, `fichajes_${dateStr}.mp4`);
  if (fs.existsSync(out)) return out;
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const dateStr = args[0] || new Date().toISOString().slice(0,10);
  let maxPerPage = parseInt(args[1], 10);
  if (isNaN(maxPerPage)) maxPerPage = 6;
  let topFichajes = parseInt(args[2], 10);
  if (isNaN(topFichajes)) topFichajes = 6;
  const noFichajes = args.includes('--no-fichajes');

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // Optionally generate fichajes (best effort)
  let fichajesMp4 = null;
  if (!noFichajes) {
    fichajesMp4 = await generateFichajes(dateStr, topFichajes);
    if (fichajesMp4) console.log('Fichajes video:', fichajesMp4);
  } else {
    console.log('Skipping fichajes generation (--no-fichajes)');
  }

  // Generate agenda pages (split if necessary)
  const agendaOutputs = await generateAgendaPages(dateStr, maxPerPage, { durationPerStep: 1.2 });
  console.log('Agenda outputs:', agendaOutputs.map(o=>o.mp4 || o.png));
  // Always generate a short intro/portada for the agenda (used when concatenating)
  let introOutput = null;
  const introBase = `agenda_${dateStr}_intro`;
  try {
    // Prefer the combined animated intro
    console.log('Rendering combined animated intro (cover)');
    console.log('Rendering intro', introBase);
    introOutput = await AGENDA.renderIntroCombined(dateStr, introBase, { totalSec: 4, transitionSec: 1, fps: 25 });
  } catch (e) {
    console.error('Combined intro generation failed, falling back to static', e);
    try {
      const introHtml = AGENDA.buildHtml({ date: dateStr, events: [] });
      console.log('Rendering static intro (fallback)', introBase);
      introOutput = await AGENDA.renderHtmlToPngMp4(introHtml, introBase, 3);
    } catch (e2) { console.error('Static intro generation failed', e2); }
  }

  // If more than one page, optionally concatenate into a single video named agenda_<date>_multi.mp4
  if (agendaOutputs.length > 1) {
    const listFile = path.join(OUT_DIR, `agenda_${dateStr}_multi_list.txt`);
    // include intro first if available
    const ordered = [];
    // If we produced an animated intro, prefer it
    if (introOutput && introOutput.mp4) ordered.push(introOutput.mp4);
    for (const o of agendaOutputs) {
      if (o.mp4) ordered.push(o.mp4);
      else if (o.png) ordered.push(o.png);
    }
    const lines = ordered.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');
    fs.writeFileSync(listFile, lines, 'utf8');
    const outAll = path.join(OUT_DIR, `agenda_${dateStr}_multi.mp4`);
    const ffmpeg = require('ffmpeg-static');
    if (ffmpeg) {
      const r = spawnSync(ffmpeg, ['-y','-f','concat','-safe','0','-i',listFile,'-c','copy', outAll], { stdio: 'inherit' });
      if (r.status === 0) console.log('Created', outAll);
      try { fs.unlinkSync(listFile); } catch (e) {}
    } else {
      console.log('ffmpeg not available; skipping concat');
    }
  }
}

if (require.main === module) main().catch(e=>{ console.error(e); process.exit(1); });

module.exports = { main };
