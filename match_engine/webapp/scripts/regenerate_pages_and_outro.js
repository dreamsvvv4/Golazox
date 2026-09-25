(async()=>{
  try {
    const A = require('../_agenda_screenshot');
    const dateStr = '2026-08-28';
    const ctx = A.pickEventsFor(dateStr);
    const events = (ctx && ctx.events) || [];
    const maxPerPage = 6;
    const pages = [];
    for (let i = 0; i < events.length; i += maxPerPage) pages.push(events.slice(i, i + maxPerPage));
    const maxOnAnyPage = pages.reduce((m, pg) => Math.max(m, (pg && pg.length) || 0), 0);

    for (let p = 0; p < pages.length && p < 2; p++) {
      const pageEvents = pages[p];
      const outBase = `agenda_${dateStr}_p${String(p+1).padStart(2,'0')}`;
      console.log('Rendering', outBase, 'with', pageEvents.length, 'events (durationPerStep=1.4)');
      await A.renderAgendaPageEventReveal(dateStr, outBase, pageEvents, { durationPerStep: 1.4, sizingMax: maxOnAnyPage });
    }

    // create a short outro/portada
    const outOutroBase = `agenda_${dateStr}_outro`;
    console.log('Rendering outro', outOutroBase);
    try {
      await A.renderIntroCombined(dateStr, outOutroBase, { durationSec: 3, transitionSec: 0.8, fps: 25 });
      console.log('Outro created');
    } catch (e) {
      console.error('Failed to create combined outro, falling back', e);
      const html = A.buildHtml({ date: dateStr, events: [] });
      await A.renderHtmlToPngMp4(html, outOutroBase, 3);
    }

    console.log('Regeneration complete');
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
