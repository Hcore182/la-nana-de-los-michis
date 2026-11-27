/**
 * La nAna de los Michis — Agenda en Google Sheets
 *
 * Guarda las reservas de la página en esta hoja, entrega a la página las horas
 * ocupadas (solo fecha y hora, nunca datos de clientes), envía un correo con
 * botones para confirmar o cancelar, y vence solas las reservas pendientes.
 *
 * Instalación: ver agenda-google/GUIA.md
 */

// ── Configuración ────────────────────────────────────────────────────────
const CONFIG = {
  SHEET_NAME: 'Reservas',
  PENDING_HOURS: 1,        // Las pendientes bloquean la hora y se vencen a la hora
  FIRST_HOUR: 6,           // Igual que en la página (schedule.firstHour)
  LAST_HOUR: 20,           // Igual que en la página (schedule.lastHour)
  MAX_DAYS_AHEAD: 120,
  PACK_DAYS: 7,            // Días de la Semana michi
  MAX_PER_PHONE: 3,        // Máximo de reservas por celular cada 30 minutos
  // El correo de cada reserva llega a la cuenta dueña del script y a estos correos adicionales.
  // Ejemplo: NOTIFY_EMAILS: ['nana@gmail.com', 'otro@gmail.com'],
  NOTIFY_EMAILS: [],
};

const HEADERS = ['Código', 'Creada', 'Estado', 'Servicio', 'Fecha inicio', 'Hora llegada', 'Días',
  'Gatos', 'Valor estimado', 'Pago al confirmar', 'Saldo', 'Nombre', 'Celular', 'Michi',
  'Dirección', 'Notas', 'Autorizó datos', 'Clave interna'];
const COL = {};
HEADERS.forEach(function (h, i) { COL[h] = i; });
const STATES = ['pendiente', 'confirmada', 'cancelada', 'vencida'];

// ── Instalación (ejecutar UNA vez desde el editor) ───────────────────────
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) sh = ss.insertSheet(CONFIG.SHEET_NAME);
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    .setFontWeight('bold').setBackground('#F8D3DA').setFontColor('#5B3A3F');
  sh.setFrozenRows(1);
  // Todo como texto, para que Sheets no convierta fechas ni celulares
  sh.getRange(2, 1, sh.getMaxRows() - 1, HEADERS.length).setNumberFormat('@');
  // Lista desplegable de estados
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(STATES, true).build();
  sh.getRange(2, COL['Estado'] + 1, sh.getMaxRows() - 1, 1).setDataValidation(rule);
  // Ocultar la clave interna (se usa para los botones del correo)
  sh.hideColumns(COL['Clave interna'] + 1);
  // Revisión de pendientes vencidas cada 15 minutos
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'expirePending') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('expirePending').timeBased().everyMinutes(15).create();
  SpreadsheetApp.flush();
  Logger.log('Listo. Ahora publica: Implementar > Nueva implementación > Aplicación web.');
}

// ── Lectura: horas ocupadas y botones del correo ─────────────────────────
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'confirm' || p.action === 'cancel') return changeState_(p);
  // Por defecto: horas ocupadas
  const busy = busySlots_();
  return json_({ ok: true, busy: busy, updated: new Date().toISOString() });
}

// ── Escritura: nueva reserva desde la página ─────────────────────────────
function doPost(e) {
  let data;
  try {
    data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'formato' });
  }
  // Trampa para robots: este campo es invisible para las personas
  if (data.website) return json_({ ok: true, code: 'LNM-OK' });

  const v = validate_(data);
  if (v.error) return json_({ ok: false, error: v.error });

  // Límite de reservas por celular
  const cache = CacheService.getScriptCache();
  const rlKey = 'rl_' + v.phone;
  const count = Number(cache.get(rlKey) || 0);
  if (count >= CONFIG.MAX_PER_PHONE) return json_({ ok: false, error: 'limite' });

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (err) {
    return json_({ ok: false, error: 'ocupado' });
  }
  try {
    const busy = busySlots_();
    const wanted = slotKeys_(v.date, v.hour, v.days);
    const taken = wanted.filter(function (k) { return busy.indexOf(k) !== -1; });
    if (taken.length) return json_({ ok: false, error: 'tomada', taken: taken });

    const code = newCode_();
    const token = Utilities.getUuid().replace(/-/g, '');
    const now = Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HH:mm');
    const row = [];
    row[COL['Código']] = code;
    row[COL['Creada']] = now;
    row[COL['Estado']] = 'pendiente';
    row[COL['Servicio']] = v.service === 'pack' ? 'Semana michi' : 'Visita michi';
    row[COL['Fecha inicio']] = v.date;
    row[COL['Hora llegada']] = pad_(v.hour) + ':00';
    row[COL['Días']] = String(v.days);
    row[COL['Gatos']] = v.cats;
    row[COL['Valor estimado']] = String(v.total);
    row[COL['Pago al confirmar']] = String(v.payNow);
    row[COL['Saldo']] = String(v.balance);
    row[COL['Nombre']] = v.name;
    row[COL['Celular']] = v.phone;
    row[COL['Michi']] = v.cat;
    row[COL['Dirección']] = v.address;
    row[COL['Notas']] = v.notes;
    row[COL['Autorizó datos']] = 'sí · ' + now;
    row[COL['Clave interna']] = token;
    // Se escribe como texto para que Sheets no convierta fechas ni horas
    const shw = sheet_();
    const target = shw.getRange(shw.getLastRow() + 1, 1, 1, HEADERS.length);
    target.setNumberFormat('@');
    target.setValues([row.map(safeCell_)]);
    cache.put(rlKey, String(count + 1), 1800);
    SpreadsheetApp.flush();
    notify_(code, token, v);
    return json_({ ok: true, code: code });
  } finally {
    lock.releaseLock();
  }
}

// ── Vencer pendientes (lo ejecuta el activador cada 15 minutos) ──────────
function expirePending() {
  const sh = sheet_();
  const limit = Date.now() - CONFIG.PENDING_HOURS * 3600 * 1000;
  readRows_().forEach(function (r) {
    // Si no se puede leer la fecha de creación, no se vence (mejor bloquear de más)
    if (r.state === 'pendiente' && r.created > 0 && r.created < limit) {
      sh.getRange(r.row, COL['Estado'] + 1).setValue('vencida');
    }
  });
}

// ── Lógica interna ───────────────────────────────────────────────────────
function busySlots_() {
  const limit = Date.now() - CONFIG.PENDING_HOURS * 3600 * 1000;
  const out = [];
  readRows_().forEach(function (r) {
    // Pendiente sin fecha de creación legible: se bloquea igual (mejor bloquear de más)
    const active = r.state === 'confirmada' || (r.state === 'pendiente' && (r.created === 0 || r.created >= limit));
    if (!active) return;
    slotKeys_(r.date, r.hour, r.days).forEach(function (k) { out.push(k); });
  });
  return out;
}

// Lee la hoja aunque Sheets haya convertido textos en fechas u horas
function readRows_() {
  const rng = sheet_().getDataRange();
  const vals = rng.getValues();
  const disp = rng.getDisplayValues();
  const out = [];
  for (let i = 1; i < disp.length; i++) {
    const d = disp[i], v = vals[i];
    if (!String(d[COL['Código']]).trim()) continue;
    out.push({
      row: i + 1, disp: d,
      state: String(d[COL['Estado']]).trim().toLowerCase(),
      created: isDate_(v[COL['Creada']]) ? v[COL['Creada']].getTime() : parseLocal_(d[COL['Creada']]),
      date: dateOf_(v[COL['Fecha inicio']], d[COL['Fecha inicio']]),
      hour: hourOf_(d[COL['Hora llegada']]),
      days: parseInt(d[COL['Días']], 10) || 1,
    });
  }
  return out;
}
function isDate_(x) { return Object.prototype.toString.call(x) === '[object Date]' && !isNaN(x.getTime()); }
// "2026-11-28", "2026-11-28" convertido en fecha, o "28/11/2026" -> "2026-11-28"
function dateOf_(val, text) {
  if (isDate_(val)) return Utilities.formatDate(val, tz_(), 'yyyy-MM-dd');
  const t = String(text).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (m) return m[1] + '-' + pad_(Number(m[2])) + '-' + pad_(Number(m[3]));
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t);
  if (m) return m[3] + '-' + pad_(Number(m[2])) + '-' + pad_(Number(m[1]));
  return t;
}
// "08:00", "8:00", "8:00:00" o "8:00 p. m." -> 8 o 20 (se usa el texto visible:
// el valor interno de una hora sin fecha puede correrse unos minutos)
function hourOf_(text) {
  const t = String(text).trim().toLowerCase();
  const m = /^(\d{1,2})(?::\d{2})?/.exec(t);
  if (!m) return NaN;
  let h = Number(m[1]);
  if (/p\.?\s*m/.test(t) && h < 12) h += 12;
  if (/a\.?\s*m/.test(t) && h === 12) h = 0;
  return h;
}

// "2026-12-05 08:00" para cada día que ocupa la reserva
function slotKeys_(date, hour, days) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date));
  if (!m || isNaN(hour)) return [];
  const keys = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + i, 12);
    keys.push(Utilities.formatDate(d, tz_(), 'yyyy-MM-dd') + ' ' + pad_(hour) + ':00');
  }
  return keys;
}

function validate_(d) {
  const service = d.service === 'pack' ? 'pack' : (d.service === 'visit' ? 'visit' : null);
  if (!service) return { error: 'servicio' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.date))) return { error: 'fecha' };
  const hour = parseInt(d.hour, 10);
  if (!(hour >= CONFIG.FIRST_HOUR && hour <= CONFIG.LAST_HOUR)) return { error: 'hora' };
  const p = String(d.date).split('-').map(Number);
  const start = new Date(p[0], p[1] - 1, p[2], hour);
  const now = Date.now();
  if (start.getTime() < now - 3600 * 1000 || start.getTime() > now + CONFIG.MAX_DAYS_AHEAD * 86400000) return { error: 'fecha' };
  const cats = ['1', '2', '3', '4 o más'].indexOf(String(d.cats)) !== -1 ? String(d.cats) : null;
  if (!cats) return { error: 'gatos' };
  const name = clean_(d.name, 60);
  const cat = clean_(d.cat, 60);
  const address = clean_(d.address, 120);
  const notes = clean_(d.notes, 500);
  const phone = String(d.phone || '').replace(/\D/g, '');
  if (name.length < 2) return { error: 'nombre' };
  // Mismos caracteres permitidos que en el formulario de la página
  if (!/^[\p{L}\p{M} '.-]+$/u.test(name)) return { error: 'nombre' };
  if (cat && !/^[\p{L}\p{M}\p{N} '.,&-]+$/u.test(cat)) return { error: 'michi' };
  if (address && !/^[\p{L}\p{M}\p{N} #°º.,\/()-]+$/u.test(address)) return { error: 'direccion' };
  if (!/^3\d{9}$/.test(phone)) return { error: 'celular' };
  if (cat.length < 1) return { error: 'michi' };
  if (address.length < 4) return { error: 'direccion' };
  if (d.consent !== true) return { error: 'autorizacion' };
  const money = function (x) { const n = Math.round(Number(x)); return isFinite(n) && n >= 0 && n < 10000000 ? n : 0; };
  return {
    service: service, date: String(d.date), hour: hour, days: service === 'pack' ? CONFIG.PACK_DAYS : 1,
    cats: cats, name: name, phone: phone, cat: cat, address: address, notes: notes,
    total: money(d.total), payNow: money(d.payNow), balance: money(d.balance),
  };
}

// Quita caracteres de control y evita que el texto se interprete como fórmula
function clean_(s, max) {
  return String(s || '').replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function safeCell_(x) {
  const s = x === undefined || x === null ? '' : String(x);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function changeState_(p) {
  const target = p.action === 'confirm' ? 'confirmada' : 'cancelada';
  const sh = sheet_();
  const all = readRows_();
  for (let n = 0; n < all.length; n++) {
    const row = all[n], r = row.disp, i = row.row - 1;
    if (r[COL['Código']] !== p.code) continue;
    if (!p.token || r[COL['Clave interna']] !== p.token) break;
    let note = '';
    if (target === 'confirmada' && row.state === 'vencida') {
      // Revisar que nadie haya tomado la hora mientras estaba vencida
      const busy = busySlots_();
      const mine = slotKeys_(row.date, row.hour, row.days);
      if (mine.some(function (k) { return busy.indexOf(k) !== -1; })) {
        return page_('⚠️ No se pudo confirmar', 'La reserva ' + p.code + ' se había vencido y otra persona ya tomó ese horario. Escríbele al cliente para ofrecerle otra hora.');
      }
      note = ' Estaba vencida, pero el horario seguía libre.';
    }
    sh.getRange(i + 1, COL['Estado'] + 1).setValue(target);
    return page_(target === 'confirmada' ? '✅ Reserva confirmada' : '❌ Reserva cancelada',
      'Reserva ' + p.code + ' de ' + r[COL['Nombre']] + ' · ' + r[COL['Fecha inicio']] + ' ' + r[COL['Hora llegada']] + '.' + note +
      (target === 'cancelada' ? ' El horario quedó libre.' : ''));
  }
  return page_('No encontrada', 'El enlace no es válido o la reserva no existe.');
}

function notify_(code, token, v) {
  const list = [Session.getEffectiveUser().getEmail()].concat(CONFIG.NOTIFY_EMAILS || [])
    .map(function (x) { return String(x || '').trim().toLowerCase(); })
    .filter(function (x, i, a) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x) && a.indexOf(x) === i; });
  if (!list.length) return;
  const to = list.join(',');
  const url = ScriptApp.getService().getUrl();
  const link = function (a) { return url + '?action=' + a + '&code=' + encodeURIComponent(code) + '&token=' + token; };
  const money = function (n) { return '$' + Number(n).toLocaleString('es-CO'); };
  const esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  const rows = [
    ['Servicio', v.service === 'pack' ? 'Semana michi (' + v.days + ' días)' : 'Visita michi'],
    ['Fecha', v.date], ['Llegada', pad_(v.hour) + ':00'], ['Gatos', v.cats],
    ['Valor estimado', money(v.total)], ['Pago al confirmar', money(v.payNow)], ['Saldo', money(v.balance)],
    ['Nombre', v.name], ['Celular', v.phone], ['Michi', v.cat], ['Dirección', v.address], ['Notas', v.notes || '—'],
  ].map(function (r) { return '<tr><td style="padding:4px 12px 4px 0;color:#8A6366">' + r[0] + '</td><td style="padding:4px 0;font-weight:bold">' + esc(r[1]) + '</td></tr>'; }).join('');
  const btn = function (href, label, bg) {
    return '<a href="' + href + '" style="display:inline-block;padding:12px 22px;margin:6px 8px 0 0;border-radius:24px;background:' + bg + ';color:#fff;font-weight:bold;text-decoration:none">' + label + '</a>';
  };
  MailApp.sendEmail({
    to: to,
    subject: '😻 Nueva reserva ' + code + ' · ' + v.date + ' ' + pad_(v.hour) + ':00 · ' + v.name,
    htmlBody: '<div style="font-family:Arial,sans-serif;color:#5B3A3F">' +
      '<h2 style="margin:0 0 8px">Nueva reserva ' + code + ' (pendiente)</h2>' +
      '<p>Se vence sola en ' + (CONFIG.PENDING_HOURS === 1 ? '1 hora' : CONFIG.PENDING_HOURS + ' horas') + ' si no la confirmas.</p>' +
      '<table>' + rows + '</table>' +
      '<p style="margin-top:16px">Cuando el cliente te envíe el comprobante por WhatsApp:</p>' +
      btn(link('confirm'), '✅ Confirmar', '#2E9E5B') + btn(link('cancel'), '❌ Cancelar', '#B9506B') +
      '</div>',
  });
}

function newCode_() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = 'LNM-';
  for (let i = 0; i < 4; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}
function sheet_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) throw new Error('Falta la hoja "' + CONFIG.SHEET_NAME + '". Ejecuta setup().');
  return sh;
}
function tz_() { return Session.getScriptTimeZone() || 'America/Bogota'; }
function pad_(n) { return (n < 10 ? '0' : '') + n; }
function parseLocal_(s) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})/.exec(String(s).trim());
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])).getTime() : 0;
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function page_(title, msg) {
  return HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;max-width:480px;margin:40px auto;padding:24px;border-radius:16px;background:#FDEEF1;color:#5B3A3F">' +
    '<h2>' + title + '</h2><p>' + String(msg).replace(/</g, '&lt;') + '</p></div>'
  ).setTitle(title);
}
