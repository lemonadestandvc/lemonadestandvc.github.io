/* ===== Kodu ristlõige: muutub koos olukorraga ===== */
const SKY = {night:'#0a0f1f', dusk:'#2b2c52', day:'#4f6390', dawn:'#3a4774'};
function houseSvg(st, stage){
  const c = ctx(st);
  const sc = stage === 'scene' ? SC[st.i] : null;
  const idx = sc ? st.i : stage === 'end' ? SC.length : -1;
  const sky = SKY[stage === 'prep' ? 'dusk' : stage === 'end' ? 'dawn' : sc.sky];
  const grid = stage !== 'scene';                     // vool on olemas enne tormi ja lõpus
  const storm = stage === 'scene' && idx <= 1;
  const m = stage === 'prep' ? startMeters(computePicks(st)) : st.m;
  const has = id => (stage === 'prep' ? computePicks(st) : st.picks).includes(id);
  const did = id => (st.log || []).includes(id);
  const torch = !grid && has('light');
  const candles = !grid && !torch && did('candles') && idx <= 4;
  const fireOn = !grid && c.fire && idx >= 2 && (did('fire_ok') || did('fire_over') || did('fire_damper'));
  const lit = grid || torch || candles || fireOn;
  const tempC = grid ? 21 : Math.round(5 + m.warmth * .16);
  const blanket = !grid && idx >= 2 && (has('warm') || did('one_room'));
  const out = [];
  const W = '#1a2340', LIT = '#ffcf7a', OURS = lit ? (grid ? LIT : '#b4823a') : '#222c4d';

  /* taevas ja maa */
  out.push(`<rect x="0" y="0" width="360" height="190" rx="14" fill="${sky}"/>`);
  if(sky === SKY.night) for(let i = 0; i < 14; i++) out.push(`<circle cx="${(i * 53) % 150 + 6}" cy="${(i * 29) % 40 + 8}" r=".9" fill="#c9d3ef" opacity=".55"/>`);
  out.push(`<rect x="0" y="168" width="360" height="22" fill="#121a2e"/>`);
  if(DATES.mo.snow) out.push(`<rect x="0" y="166" width="156" height="4" rx="2" fill="#dfe6f5" opacity=".8"/>`);

  /* välisvaade */
  const win = (x, y, w, h, ours) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${ours ? OURS : grid ? LIT : W}" ${ours ? 'stroke="#ffb347" stroke-width="1.5"' : ''}/>`;
  if(c.home === 'paneel'){
    out.push(`<rect x="34" y="26" width="94" height="142" fill="#59607a"/><rect x="34" y="26" width="94" height="4" fill="#474d63"/>`);
    for(let f = 0; f < 9; f++) for(let k = 0; k < 4; k++){
      const y = 154 - f * 14.5, ours = f === 6 && k === 1;
      out.push(win(41 + k * 21, y, 14, 8, ours));
    }
  } else if(c.home === 'vaike'){
    out.push(`<rect x="28" y="92" width="104" height="76" fill="#6d5a47"/><polygon points="20,94 80,54 140,94" fill="#3f3347"/><rect x="28" y="156" width="104" height="12" fill="#4a4c5e"/>`);
    for(let k = 0; k < 3; k++){ out.push(win(38 + k * 32, 102, 18, 16, false)); out.push(win(38 + k * 32, 132, 18, 16, true)); }
    out.push(win(46, 159, 14, 5, true));
  } else if(c.home === 'eramaja'){
    out.push(`<rect x="40" y="108" width="84" height="60" fill="#8a7a63"/><polygon points="32,110 82,70 132,110" fill="#3f3347"/>`);
    out.push(win(50, 122, 18, 16, true), win(96, 122, 18, 16, true), win(73, 88, 14, 12, true));
    out.push(`<path d="M128 168v-14M136 168v-14M144 168v-14M126 158h22" stroke="#4a4c5e" stroke-width="2"/>`);
  } else {
    out.push(`<rect x="46" y="112" width="82" height="56" fill="#7d4a3a"/><polygon points="38,114 87,74 136,114" fill="#3a3a44"/>`);
    out.push(win(56, 126, 16, 14, true), win(100, 126, 16, 14, true));
    out.push(`<rect x="12" y="150" width="14" height="18" fill="#59607a"/><polygon points="9,151 19,142 29,151" fill="#3a3a44"/>`);
  }
  /* puu, tormis kõverdub */
  const bend = storm ? 9 : 0;
  out.push(`<path d="M146 168 Q146 140 ${146 + bend} 118" stroke="#3b2f2a" stroke-width="3" fill="none"/><ellipse cx="${146 + bend}" cy="112" rx="11" ry="16" fill="#2f4a3c"/>`);
  if(storm){
    let r = '';
    for(let i = 0; i < 22; i++){ const x = (i * 37) % 160, y = (i * 23) % 150; r += `<line x1="${x}" y1="${y}" x2="${x - 6}" y2="${y + 14}"/>`; }
    out.push(`<g class="rain" stroke="#9fb3e0" stroke-width="1.1" opacity=".55">${r}</g>`);
  }

  /* lõige: meie kodu seest */
  const X = 162, Y = 22, IW = 186, IH = 146, FL = Y + IH;
  out.push(`<rect x="${X}" y="${Y}" width="${IW}" height="${IH}" rx="6" fill="${grid ? '#3a3020' : '#151c32'}" stroke="#2b3659" stroke-width="2"/>`);
  out.push(`<defs><clipPath id="hc"><rect x="${X}" y="${Y}" width="${IW}" height="${IH}" rx="6"/></clipPath></defs><g clip-path="url(#hc)">`);
  if(torch) out.push(`<ellipse cx="${X + 62}" cy="${FL - 30}" rx="62" ry="46" fill="#ffb347" opacity=".18"/>`);
  if(candles) out.push(`<ellipse cx="${X + 104}" cy="${Y + 30}" rx="34" ry="26" fill="#ffb347" opacity=".14"/>`);
  if(fireOn) out.push(`<ellipse cx="${X + 104}" cy="${FL - 22}" rx="50" ry="36" fill="#ff7b5f" opacity=".2"/>`);
  /* aken */
  out.push(`<rect x="${X + 8}" y="${Y + 14}" width="30" height="36" rx="2" fill="${sky}" stroke="#59607a" stroke-width="2"/><line x1="${X + 23}" y1="${Y + 14}" x2="${X + 23}" y2="${Y + 50}" stroke="#59607a" stroke-width="1.5"/>`);
  if(storm) out.push(`<g class="rain" stroke="#9fb3e0" stroke-width="1" opacity=".7"><line x1="${X + 14}" y1="${Y + 18}" x2="${X + 11}" y2="${Y + 26}"/><line x1="${X + 30}" y1="${Y + 22}" x2="${X + 27}" y2="${Y + 30}"/><line x1="${X + 20}" y1="${Y + 34}" x2="${X + 17}" y2="${Y + 42}"/></g>`);
  if(blanket) out.push(`<rect x="${X + 8}" y="${Y + 14}" width="30" height="36" rx="2" fill="#5b4a8a" opacity=".85"/>`);
  /* radiaator */
  out.push(`<rect x="${X + 8}" y="${FL - 18}" width="30" height="12" rx="2" fill="${grid ? '#c96a4a' : '#4a5372'}"/>`);
  /* termomeeter */
  const th = Math.max(2, Math.min(26, (tempC - 5) / 16 * 26));
  out.push(`<rect x="${X + 46}" y="${Y + 14}" width="6" height="30" rx="3" fill="#0c111f" stroke="#59607a"/><rect x="${X + 47.5}" y="${Y + 42 - th}" width="3" height="${th}" fill="${tempC < 12 ? '#7fb2ff' : '#ff7b5f'}"/>`);
  out.push(`<text x="${X + 56}" y="${Y + 30}" font-size="11" font-weight="700" fill="#f3ebd9" font-family="Atkinson Hyperlegible, sans-serif">${tempC}°</text>`);
  /* riiul: toit, raadio, küünlad */
  const shX = X + 88, shY = Y + 14;
  out.push(`<rect x="${shX}" y="${shY}" width="34" height="28" rx="2" fill="#2b2230" stroke="#59607a"/><line x1="${shX}" y1="${shY + 14}" x2="${shX + 34}" y2="${shY + 14}" stroke="#59607a"/>`);
  const tins = Math.round(m.food / 100 * 8);
  for(let i = 0; i < tins; i++) out.push(`<rect x="${shX + 3 + (i % 4) * 8}" y="${shY + (i < 4 ? 17 : 3)}" width="6" height="9" rx="1" fill="#c9a24a"/>`);
  if(has('radio')) out.push(`<rect x="${shX + 2}" y="${shY - 9}" width="14" height="9" rx="1.5" fill="#8a94b4"/><line x1="${shX + 13}" y1="${shY - 9}" x2="${shX + 18}" y2="${shY - 17}" stroke="#8a94b4"/>`);
  if(candles) out.push(`<rect x="${shX + 22}" y="${shY - 8}" width="3" height="8" fill="#eee"/><rect x="${shX + 28}" y="${shY - 8}" width="3" height="8" fill="#eee"/><ellipse class="flame" cx="${shX + 23.5}" cy="${shY - 10}" rx="1.6" ry="2.6" fill="#ffb347"/><ellipse class="flame" cx="${shX + 29.5}" cy="${shY - 10}" rx="1.6" ry="2.6" fill="#ffb347"/>`);
  /* ahi või kamin */
  if(c.fire){
    const fx = X + 92, fw = c.heat === 'ahi' ? 30 : 26, fh = c.heat === 'ahi' ? 52 : 34;
    out.push(`<rect x="${fx}" y="${FL - fh}" width="${fw}" height="${fh}" rx="2" fill="#8a4a36"/><rect x="${fx + 7}" y="${FL - 18}" width="${fw - 14}" height="12" rx="1" fill="#1b1305"/>`);
    if(fireOn) out.push(`<path class="flame" d="M${fx + fw / 2} ${FL - 17} q5 6 0 10 q-5 -4 0 -10z" fill="#ffb347"/>`);
  }
  /* aku */
  const bw = Math.round(m.power / 100 * 20);
  out.push(`<rect x="${X + 150}" y="${Y + 12}" width="24" height="11" rx="2" fill="none" stroke="#a8b4d2"/><rect x="${X + 174}" y="${Y + 15}" width="2.5" height="5" fill="#a8b4d2"/><rect x="${X + 152}" y="${Y + 14}" width="${bw}" height="7" fill="${m.power < 25 ? '#ff7b5f' : '#ffb347'}"/>`);
  /* vannituba: vann ja veetase */
  const bx = X + 132;
  out.push(`<line x1="${bx - 4}" y1="${Y + 32}" x2="${bx - 4}" y2="${FL}" stroke="#2b3659" stroke-width="3"/>`);
  const wl = Math.round(m.water / 100 * 16);
  out.push(`<rect x="${bx + 2}" y="${FL - 24}" width="46" height="20" rx="6" fill="#d7dcea"/><rect x="${bx + 5}" y="${FL - 7 - wl}" width="40" height="${wl}" rx="3" fill="#6fa8e8"/>`);
  out.push(`<path d="M${bx + 40} ${FL - 24} v-14 h-8" stroke="#a8b4d2" stroke-width="2" fill="none"/>`);
  /* pere */
  const people = [];
  for(let i = 0; i < c.f.adults; i++) people.push([34, '#c47b5a']);
  for(let i = 0; i < c.f.teen; i++) people.push([30, '#5a8f7b']);
  for(let i = 0; i < c.f.school; i++) people.push([24, '#7b6bb0']);
  for(let i = 0; i < c.f.small; i++) people.push([18, '#d0a040']);
  for(let i = 0; i < c.f.baby; i++) people.push([11, '#e7b8a0']);
  const n = people.length, span = Math.min(70, n * 12), x0 = X + 50 - span / 2 + 6;
  people.forEach(([h, col], i) => {
    const px = x0 + (n > 1 ? i * span / (n - 1) : span / 2), top = FL - 6 - h;
    out.push(`<rect x="${px - 4}" y="${top + h * .32}" width="8" height="${h * .68}" rx="3" fill="${col}"/><circle cx="${px}" cy="${top + h * .18}" r="${Math.max(2.5, h * .14)}" fill="#e8c9a8"/>`);
  });
  if(blanket) out.push(`<path d="M${x0 - 10} ${FL - 6} Q${x0 + span / 2} ${FL - 40} ${x0 + span + 10} ${FL - 6}z" fill="#5b4a8a" opacity=".9"/>`);
  if(c.f.dog) out.push(`<ellipse cx="${X + 26}" cy="${FL - 7}" rx="9" ry="4.5" fill="#8a6a4a"/><circle cx="${X + 18}" cy="${FL - 11}" r="3.5" fill="#8a6a4a"/>`);
  if(c.f.cat) out.push(`<ellipse cx="${X + 82}" cy="${FL - 6}" rx="5" ry="3" fill="#a8a8b8"/><circle cx="${X + 86}" cy="${FL - 9}" r="2.4" fill="#a8a8b8"/>`);
  if(!lit && !grid) out.push(`<rect x="${X}" y="${Y}" width="${IW}" height="${IH}" rx="6" fill="#000" opacity=".35"/>`);
  out.push('</g>');

  const alt = `${c.H.n}. Toas ${tempC} kraadi, ${grid ? 'tuled põlevad' : lit ? 'valgust annab ' + (fireOn ? 'tuli koldes' : torch ? 'taskulamp' : 'küünal') : 'pime'}.`;
  return `<figure class="house"><svg viewBox="0 0 360 190" role="img" aria-label="${esc(alt)}">${out.join('')}</svg></figure>`;
}

