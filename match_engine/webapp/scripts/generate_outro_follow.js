(async()=>{
  try {
    const A = require('../_agenda_screenshot');
    const dateStr = '2026-08-28';
    const base = `agenda_${dateStr}_outro_follow`;
    // Build default intro HTML and replace footer with follow CTA + stronger CTA block
    let html = A.buildHtml({ date: dateStr, events: [] });
    // Replace the title and date with the CTA, and update the footer to avoid showing "Agenda del día"
    html = html.replace(/<div class=\"titlebig\">[\s\S]*?<\/div>/, `<div class=\"titlebig\">Síguenos en golazox.com</div>`);
    html = html.replace(/<div class=\"date\">[\s\S]*?<\/div>/, `<div class=\"date\"></div>`);
    // Replace the small footer with a stronger follow message and a centered CTA
    html = html.replace(/<div class="footer">[\s\S]*?<\/div><\/div><\/body>/, `
      <div class="footer">Visita <strong>golazox.com</strong> para más.</div>
      <div style=\"position:absolute;bottom:220px;width:100%;text-align:center\">\n        <div style=\"display:inline-block;padding:18px 28px;background:linear-gradient(90deg,#FFDD00,#FFA500);border-radius:12px;color:#021022;font-weight:800;font-size:28px;\">Síguenos</div>\n      </div>\n    </div></body>`);

    // Render a simple PNG->MP4 (no kenburns) of 3.5s so it's visibly different
    const res = await A.renderHtmlToPngMp4(html, base, 3.5);
    console.log('Created outro follow:', res.mp4 || res.png);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
