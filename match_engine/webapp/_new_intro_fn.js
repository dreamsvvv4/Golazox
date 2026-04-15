/**
 * _getLineup — returns the starting 11 sorted by position order.
 * Forces 1 GK from the squad even if not in top-11 by rating.
 */
function _getLineup(slug, era) {
  try {
    const squadFile = path.join(SQUADS_DIR, `${slug}.json`);
    if (!fs.existsSync(squadFile)) return { formation: '4-4-2', players: [] };
    const data = JSON.parse(fs.readFileSync(squadFile, 'utf8'));
    const season = (data.seasons && data.seasons[era]) ||
                   (data.seasons && data.seasons[String(parseInt(era) - 1)]) || null;
    if (!season || !season.players) return { formation: '4-4-2', players: [] };
    const formation = season.formation || '4-4-2';
    const all       = [...season.players].sort((a, b) => b.rating - a.rating);
    const gk        = all.find(p => p.position === 'GK');
    const outfield  = all.filter(p => p.position !== 'GK').slice(0, 10);
    const lineup    = gk ? [gk, ...outfield] : all.slice(0, 11);
    const POS_ORDER = { GK:0, CB:1, RB:2, LB:3, CDM:4, DM:4, CM:5, MF:5, MC:5, CAM:6, AM:6, SS:7, RW:8, LW:8, FW:9, CF:9, ST:10 };
    lineup.sort((a, b) => (POS_ORDER[a.position] ?? 5) - (POS_ORDER[b.position] ?? 5));
    return { formation, players: lineup.slice(0, 11) };
  } catch { return { formation: '4-4-2', players: [] }; }
}

/**
 * createMatchIntroVideo — 3-slide premium intro (4s + 4s + 4s = 12s total).
 *
 * SLIDE 1 (4s) — Badge clash, zero clutter.
 *   Coin · Wordmark · Amber glow badge A · Blue glow badge B · VS · Names · Era pills · Scanline · Hook
 *
 * SLIDE 2 (4s) — Team A lineup card.
 *   Dark-amber bg · Badge · Team name · Era · Formation · 11 starters staggered in
 *
 * SLIDE 3 (4s) — Team B lineup card.
 *   Dark-blue bg  · Badge · Team name · Era · Formation · 11 starters staggered in
 */
function createMatchIntroVideo(teamA, eraA, teamB, eraB, outFile, durationSec = 7, labelText = null, subLabel = null, contextLines = null, matchDesc = null) {
  const eraAraw = eraA;
  const eraBraw = eraB;
  eraA = displayEra(eraA);
  eraB = displayEra(eraB);
  const w = WIDTH, h = HEIGHT;
  const { bold: fontAlt, main: fontBold, reg: fontReg } = getFonts();
  const esc = (s) => String(s || '').replace(/['\\]/g, '').replace(/:/g, '\\:').replace(/%/g, '%%');

  const coinImg     = path.join(__dirname, 'public', 'golazox-coin.png');
  const wordmarkImg = path.join(__dirname, 'public', 'golazox-wordmark.png');
  const badgeAFile  = _badgeFile(teamA);
  const badgeBFile  = _badgeFile(teamB);
  const nameA       = slugToDisplayName(teamA);
  const nameB       = slugToDisplayName(teamB);

  const uid      = `${Date.now()}_${process.pid}`;
  const slide1   = path.join(os.tmpdir(), `gx_s1_${uid}.mp4`);
  const slide2   = path.join(os.tmpdir(), `gx_s2_${uid}.mp4`);
  const slide3   = path.join(os.tmpdir(), `gx_s3_${uid}.mp4`);
  const listFile = path.join(os.tmpdir(), `gx_list_${uid}.txt`);

  // ── SLIDE 1 (4s): Badge clash ─────────────────────────────────────────────
  (() => {
    const d1 = 4;
    const BADGE_W = 310, GLOW_W = 430;
    const BADGE_Y = 480, GLOW_Y = BADGE_Y - (GLOW_W - BADGE_W) / 2;

    const inputs = [
      '-f', 'lavfi', '-i', `color=c=0x050609:size=${w}x${h}:rate=30:duration=${d1}`,
      '-f', 'lavfi', '-i', `color=c=0x241808:size=540x${h}:rate=30:duration=${d1}`,
      '-f', 'lavfi', '-i', `color=c=0x071628:size=540x${h}:rate=30:duration=${d1}`,
    ];
    let idx = 3;
    const baI = badgeAFile ? (inputs.push('-i', badgeAFile), idx++) : -1;
    const bbI = badgeBFile ? (inputs.push('-i', badgeBFile), idx++) : -1;
    const cI  = fs.existsSync(coinImg)     ? (inputs.push('-i', coinImg),     idx++) : -1;
    const wI  = fs.existsSync(wordmarkImg) ? (inputs.push('-i', wordmarkImg), idx++) : -1;

    const fp = []; let last = '0:v';
    fp.push(`[1:v]hue=s=0.28,curves=all='0/0 0.5/0.50 1/0.88'[lp]`, `[${last}][lp]overlay=0:0[bg1]`); last = 'bg1';
    fp.push(`[2:v]hue=h=215:s=2.0,curves=b='0/0 0.35/0.60 1/1'[rp]`, `[${last}][rp]overlay=540:0[bg2]`); last = 'bg2';

    if (baI >= 0) {
      fp.push(`[${baI}:v]split=2[baG][baS]`);
      fp.push(`[baG]scale=${GLOW_W}:-1,format=rgba,gblur=sigma=30,colorchannelmixer=1.25:0:0:0:0:0.90:0:0:0:0:0.38:0[baGl]`);
      fp.push(`[${last}][baGl]overlay='270-w/2':${GLOW_Y}[bg3]`); last = 'bg3';
      fp.push(`[baS]scale=${BADGE_W}:-1,format=rgba,hue=s=0.24,colorchannelmixer=.32:.40:.28:0:.30:.42:.28:0:.18:.34:.48:0[baSh]`);
      fp.push(`[${last}][baSh]overlay='270-w/2':${BADGE_Y}[bg4]`); last = 'bg4';
    }
    if (bbI >= 0) {
      fp.push(`[${bbI}:v]split=2[bbG][bbS]`);
      fp.push(`[bbG]scale=${GLOW_W}:-1,format=rgba,gblur=sigma=30,colorchannelmixer=0.38:0:0:0:0:0.70:0:0:0:0:1.90:0[bbGl]`);
      fp.push(`[${last}][bbGl]overlay='810-w/2':${GLOW_Y}[bg5]`); last = 'bg5';
      fp.push(`[bbS]scale=${BADGE_W}:-1,format=rgba,eq=saturation=1.65:brightness=0.07[bbSh]`);
      fp.push(`[${last}][bbSh]overlay='810-w/2':${BADGE_Y}[bg6]`); last = 'bg6';
    }
    if (cI >= 0) {
      fp.push(`[${cI}:v]scale=162:-1,format=rgba[ci]`, `[${last}][ci]overlay=(W-w)/2:78[bg7]`); last = 'bg7';
    }
    if (wI >= 0) {
      fp.push(`[${wI}:v]scale=600:-1,format=rgba[wmi]`, `[${last}][wmi]overlay=(W-w)/2:272[bg8]`); last = 'bg8';
    }

    const fi  = (s, dur = 0.4) => `if(lt(t,${s}),0,min(1,(t-${s})/${dur}))`;
    const alp = (s) => `min(${fi(s)},if(gt(t,${d1 - 0.5}),max(0,(${d1}-t)/0.5),1))`;

    const nameALines = wrapText(nameA.toUpperCase(), 14, 2);
    const nameBLines = wrapText(nameB.toUpperCase(), 14, 2);
    const eraLA      = eraA || eraAraw || '';
    const eraLB      = eraB || eraBraw || '';
    const nameBaseY  = BADGE_Y + BADGE_W + 18;  // ~808
    const eraY_A     = nameBaseY + nameALines.length * 58;
    const eraY_B     = nameBaseY + nameBLines.length * 58;
    const VS_Y       = BADGE_Y + Math.round(BADGE_W * 0.38);

    const hookText   = labelText || 'EL DEBATE DEFINITIVO';
    const hookLines  = wrapText(hookText.toUpperCase(), 22, 3);
    const hookFontSz = hookText.length > 28 ? 60 : 74;
    const hookBaseY  = Math.max(eraY_A, eraY_B) + 80;

    const scanline = [
      `drawbox=x=0:y='${h}*(t-0.60)/0.55-8':w=${w}:h=18:color=FFD700@0.14:t=fill:enable='between(t,0.60,1.15)'`,
      `drawbox=x=0:y='${h}*(t-0.60)/0.55-2':w=${w}:h=6:color=FFD700@0.45:t=fill:enable='between(t,0.60,1.15)'`,
      `drawbox=x=0:y='${h}*(t-0.60)/0.55':w=${w}:h=2:color=FFFFFF@0.82:t=fill:enable='between(t,0.60,1.15)'`,
    ];
    const sA = [
      `drawbox=x=${270 - 200}:y=${BADGE_Y - 44}:w=400:h=${BADGE_W + 88}:color=D49A00@0.08:t=fill:enable='between(t,0.20,${d1})'`,
      `drawbox=x=${270 - 90}:y=${BADGE_Y}:w=180:h=${BADGE_W}:color=D4B800@0.04:t=fill:enable='between(t,0.20,${d1})'`,
    ];
    const sB = [
      `drawbox=x=${810 - 200}:y=${BADGE_Y - 44}:w=400:h=${BADGE_W + 88}:color=1155DD@0.10:t=fill:enable='between(t,0.20,${d1})'`,
      `drawbox=x=${810 - 90}:y=${BADGE_Y}:w=180:h=${BADGE_W}:color=2277FF@0.05:t=fill:enable='between(t,0.20,${d1})'`,
    ];
    const pA = eraLA ? [`drawbox=x=${270 - 68}:y=${eraY_A - 6}:w=136:h=62:color=8C6800@0.70:t=fill:enable='between(t,0.42,${d1})'`] : [];
    const pB = eraLB ? [`drawbox=x=${810 - 68}:y=${eraY_B - 6}:w=136:h=62:color=0D3A88@0.70:t=fill:enable='between(t,0.42,${d1})'`] : [];

    const hookFiltrs = hookLines.map((line, i) =>
      `drawtext=fontfile='${fontAlt}':text='${esc(line)}':fontsize=${hookFontSz}:fontcolor=FFD700:x=(w-text_w)/2:y=${hookBaseY + i * (hookFontSz + 14)}:shadowx=3:shadowy=3:shadowcolor=0x00000099:alpha='${alp(0.88)}'`
    );

    const texts = [
      ...scanline, ...sA, ...sB, ...pA, ...pB,
      `drawtext=fontfile='${fontAlt}':text='VS':fontsize=188:fontcolor=886600@0.30:x=(w-text_w)/2+8:y=${VS_Y + 8}:alpha='${alp(0.30)}'`,
      `drawtext=fontfile='${fontAlt}':text='VS':fontsize=188:fontcolor=FFD700@0.20:x=(w-text_w)/2:y=${VS_Y}:alpha='${alp(0.30)}'`,
      `drawtext=fontfile='${fontAlt}':text='VS':fontsize=188:fontcolor=white@0.96:x=(w-text_w)/2:y=${VS_Y}:alpha='${alp(0.30)}'`,
      ...nameALines.map((line, i) =>
        `drawtext=fontfile='${fontBold}':text='${esc(line)}':fontsize=52:fontcolor=F0E4CB:x=270-text_w/2:y=${nameBaseY + i * 58}:shadowx=2:shadowy=2:shadowcolor=00000099:alpha='${alp(0.45)}'`
      ),
      ...(eraLA ? [`drawtext=fontfile='${fontAlt}':text='${esc(eraLA)}':fontsize=50:fontcolor=FFD060:x=270-text_w/2:y=${eraY_A + 2}:alpha='${alp(0.52)}'`] : []),
      ...nameBLines.map((line, i) =>
        `drawtext=fontfile='${fontBold}':text='${esc(line)}':fontsize=52:fontcolor=D6ECFF:x=810-text_w/2:y=${nameBaseY + i * 58}:shadowx=2:shadowy=2:shadowcolor=00000099:alpha='${alp(0.45)}'`
      ),
      ...(eraLB ? [
        `drawtext=fontfile='${fontAlt}':text='${esc(eraLB)}':fontsize=50:fontcolor=3377FF@0.45:x=810-text_w/2+3:y=${eraY_B + 3}:alpha='${alp(0.52)}'`,
        `drawtext=fontfile='${fontAlt}':text='${esc(eraLB)}':fontsize=50:fontcolor=88CCFF:x=810-text_w/2:y=${eraY_B}:alpha='${alp(0.52)}'`,
      ] : []),
      ...hookFiltrs,
      `drawtext=fontfile='${fontReg}':text='golazox.com':fontsize=44:fontcolor=444444:x=(w-text_w)/2:y=1840:alpha='${alp(1.55)}'`,
    ];

    fp.push(`[${last}]` + texts.join(',') + `,fade=t=in:st=0:d=0.45,fade=t=out:st=${d1 - 0.45}:d=0.45[vout]`);
    ffmpeg(['-y', ...inputs, '-filter_complex', fp.join(';'), '-map', '[vout]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-pix_fmt', 'yuv420p', '-an', '-t', String(d1), slide1]);
  })();

  // ── SLIDES 2 & 3: Lineup cards ────────────────────────────────────────────
  const makeLineupSlide = (slug, eraRaw, teamName, eraLabel, badgeFile, isB, outSlide) => {
    const d2 = 4;
    const { formation, players } = _getLineup(slug, eraRaw);
    const bgColor        = isB ? '0x000810' : '0x0f0a00';
    const headerBg       = isB ? '001838'   : '1A0C00';
    const teamNameColor  = isB ? 'D6ECFF'   : 'FFE08A';
    const formColor      = isB ? '3377FF'   : 'CC8800';
    const eraPillColor   = isB ? '0D3A88'   : '8C6800';
    const eraTextColor   = isB ? '88CCFF'   : 'FFD060';
    const ratingColor    = isB ? '80BBFF'   : 'FFCC44';
    const rowBgColor     = isB ? '0A2050'   : '2A1800';
    const posColor       = isB ? '3388FF'   : 'CC7700';
    const nameTxtColor   = isB ? 'D0E8FF'   : 'F0E8D0';
    const badgeGlowCC    = isB
      ? 'colorchannelmixer=0.38:0:0:0:0:0.70:0:0:0:0:1.90:0'
      : 'colorchannelmixer=1.25:0:0:0:0:0.90:0:0:0:0:0.38:0';
    const badgeSharpFlt  = isB
      ? 'eq=saturation=1.65:brightness=0.07'
      : 'hue=s=0.24,colorchannelmixer=.32:.40:.28:0:.30:.42:.28:0:.18:.34:.48:0';

    const inputs2 = [
      '-f', 'lavfi', '-i', `color=c=${bgColor}:size=${w}x${h}:rate=30:duration=${d2}`,
    ];
    let idx2 = 1;
    const cI2 = fs.existsSync(coinImg)     ? (inputs2.push('-i', coinImg),     idx2++) : -1;
    const wI2 = fs.existsSync(wordmarkImg) ? (inputs2.push('-i', wordmarkImg), idx2++) : -1;
    const bI2 = badgeFile                  ? (inputs2.push('-i', badgeFile),   idx2++) : -1;

    const fp2 = []; let last2 = '0:v';

    // Subtle gradient header band
    fp2.push(`[0:v]drawbox=x=0:y=0:w=${w}:h=440:color=${headerBg}@0.55:t=fill[s2bg]`);
    last2 = 's2bg';

    if (cI2 >= 0) {
      fp2.push(`[${cI2}:v]scale=82:-1,format=rgba[s2c]`);
      fp2.push(`[${last2}][s2c]overlay=(W-w)/2:44[s2l0]`);
      last2 = 's2l0';
    }
    if (wI2 >= 0) {
      fp2.push(`[${wI2}:v]scale=380:-1,format=rgba[s2w]`);
      fp2.push(`[${last2}][s2w]overlay=(W-w)/2:140[s2l1]`);
      last2 = 's2l1';
    }
    if (bI2 >= 0) {
      fp2.push(`[${bI2}:v]split=2[bG2][bS2]`);
      fp2.push(`[bG2]scale=240:-1,format=rgba,gblur=sigma=22,${badgeGlowCC}[bGl2]`);
      fp2.push(`[${last2}][bGl2]overlay=(W-w)/2:258[s2l2]`);
      last2 = 's2l2';
      fp2.push(`[bS2]scale=152:-1,format=rgba,${badgeSharpFlt}[bSh2]`);
      fp2.push(`[${last2}][bSh2]overlay=(W-w)/2:302[s2l3]`);
      last2 = 's2l3';
    }

    const fi2  = (s, dur = 0.28) => `if(lt(t,${s}),0,min(1,(t-${s})/${dur}))`;
    const alp2 = (s) => `min(${fi2(s)},if(gt(t,${d2 - 0.4}),max(0,(${d2}-t)/0.4),1))`;

    // Shorten name to surname(s), max 18 chars
    const shortN = (n) => {
      const parts = n.split(' ');
      const s = parts.length >= 2 ? parts.slice(1).join(' ') : n;
      return s.length > 18 ? s.slice(0, 17) + '.' : s;
    };

    const PLAYER_START_Y = 840;
    const ROW_H          = 78;
    const ERA_Y          = 648;
    const FORM_Y         = 720;
    const SEP_Y          = 804;

    // Team name rows (2 lines max), centered
    const teamNameLines = wrapText(teamName.toUpperCase(), 16, 2);

    const s2texts = [
      // Team name
      ...teamNameLines.map((line, i) =>
        `drawtext=fontfile='${fontAlt}':text='${esc(line)}':fontsize=68:fontcolor=${teamNameColor}:x=(w-text_w)/2:y=${480 + i * 78}:shadowx=3:shadowy=3:shadowcolor=00000088:alpha='${alp2(0.00)}'`
      ),
      // Era pill background
      ...(eraLabel ? [
        `drawbox=x=472:y=${ERA_Y}:w=136:h=58:color=${eraPillColor}@0.78:t=fill:enable='between(t,0.05,${d2})'`,
        `drawtext=fontfile='${fontAlt}':text='${esc(eraLabel)}':fontsize=50:fontcolor=${eraTextColor}:x=(w-text_w)/2:y=${ERA_Y + 2}:alpha='${alp2(0.05)}'`,
      ] : []),
      // Formation
      `drawtext=fontfile='${fontBold}':text='${esc(formation)}':fontsize=36:fontcolor=${formColor}@0.90:x=(w-text_w)/2:y=${FORM_Y}:alpha='${alp2(0.10)}'`,
      // ALINEACION label
      `drawtext=fontfile='${fontBold}':text='ALINEACION':fontsize=30:fontcolor=555555:x=(w-text_w)/2:y=${SEP_Y - 38}:alpha='${alp2(0.12)}'`,
      // Separator line
      `drawbox=x=54:y=${SEP_Y}:w=972:h=2:color=333333@0.80:t=fill:enable='between(t,0.12,${d2})'`,
      // Player rows (staggered fade-in)
      ...players.map((p, i) => {
        const t0 = 0.25 + i * 0.065;
        const y  = PLAYER_START_Y + i * ROW_H;
        return [
          // Row background (alternating slight shade)
          `drawbox=x=54:y=${y + 2}:w=972:h=${ROW_H - 6}:color=${rowBgColor}@${i % 2 === 0 ? '0.55' : '0.42'}:t=fill:enable='between(t,${t0},${d2})'`,
          // Position pill
          `drawbox=x=62:y=${y + 10}:w=76:h=${ROW_H - 26}:color=${posColor}@0.40:t=fill:enable='between(t,${t0},${d2})'`,
          `drawtext=fontfile='${fontBold}':text='${esc(p.position)}':fontsize=26:fontcolor=FFFFFF@0.92:x=62+38-text_w/2:y=${y + 13}:alpha='${alp2(t0)}'`,
          // Player name
          `drawtext=fontfile='${fontBold}':text='${esc(shortN(p.name))}':fontsize=46:fontcolor=${nameTxtColor}:x=150:y=${y + 10}:alpha='${alp2(t0)}'`,
          // Rating
          `drawtext=fontfile='${fontAlt}':text='${p.rating}':fontsize=50:fontcolor=${ratingColor}:x=950-text_w:y=${y + 6}:alpha='${alp2(t0)}'`,
        ];
      }).flat(),
      // Footer
      `drawtext=fontfile='${fontReg}':text='golazox.com':fontsize=42:fontcolor=3A3A3A:x=(w-text_w)/2:y=1848:alpha='${alp2(1.40)}'`,
    ];

    fp2.push(`[${last2}]` + s2texts.join(',') + `,fade=t=in:st=0:d=0.4,fade=t=out:st=${d2 - 0.4}:d=0.4[s2out]`);
    ffmpeg(['-y', ...inputs2, '-filter_complex', fp2.join(';'), '-map', '[s2out]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-pix_fmt', 'yuv420p', '-an', '-t', String(d2), outSlide]);
  };

  makeLineupSlide(teamA, eraAraw, nameA, eraA || eraAraw, badgeAFile, false, slide2);
  makeLineupSlide(teamB, eraBraw, nameB, eraB || eraBraw, badgeBFile, true,  slide3);

  // ── Concat slide1 + slide2 + slide3 → outFile ─────────────────────────────
  fs.writeFileSync(
    listFile,
    `file '${slide1.replace(/\\/g, '/')}'\nfile '${slide2.replace(/\\/g, '/')}'\nfile '${slide3.replace(/\\/g, '/')}'`
  );
  try {
    ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outFile]);
  } finally {
    [slide1, slide2, slide3, listFile].forEach(f => { try { fs.unlinkSync(f); } catch {} });
  }
}
