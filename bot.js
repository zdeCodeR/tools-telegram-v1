const { Telegraf } = require('telegraf');
const { exec } = require('child_process');

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('Set env BOT_TOKEN dulu. Jalankan via index.js atau export BOT_TOKEN.');
  process.exit(1);
}

const ALLOW_PORTSCAN = process.env.ALLOW_PORTSCAN === 'true';
const WHATCMS_KEY = process.env.WHATCMS_KEY || '';
const NUMVERIFY_KEY = process.env.NUMVERIFY_KEY || '';
const SPEEDTEST_BIN = process.env.SPEEDTEST_BIN || '';
const PHOTON_PATH = process.env.PHOTON_PATH || '/mnt/data/Photon-master/photon.py';

const bot = new Telegraf(BOT_TOKEN);

// ==== Helpers ====
const cut = (s, n = 3500) => (s.length > n ? s.slice(0, n) + '\n…(dipotong)' : s);
const sh = (cmd, timeout = 25_000) =>
  new Promise((resolve) => {
    exec(cmd, { timeout, maxBuffer: 1024 * 1024 * 8 }, (e, so, se) => {
      if (e) return resolve({ ok: false, out: (se || e.message || '').toString() });
      resolve({ ok: true, out: (so || '').toString() });
    });
  });

const only = (txt, re) => (txt || '').trim().match(re)?.[0] || '';
const sanitizeDomain = (d) => only(d, /^[A-Za-z0-9.-]{1,253}$/);
const sanitizeIP = (ip) => only(ip, /^(?:\d{1,3}\.){3}\d{1,3}$/);
const sanitizeEmail = (e) => only(e, /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/);
const sanitizeURL = (u) => only(u, /^(https?:\/\/)?[A-Za-z0-9._~:\/?#\[\]@!$&'()*+,;=%.-]+$/);
const sanitizeNumber = (n) => only(n, /^\+?[0-9]{5,18}$/);
const isPrivateIP = (ip) =>
  /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|127\.|0\.0\.0\.0|169\.254\.)/.test(ip);

// ==== /start & /help ====
bot.start((ctx) =>
  ctx.reply(
    [
      'Yo! Bot siap. Perintah:',
      '/webinfo <domain>',
      '/myinfo',
      '/up <url>',
      '/iptracker <ip>',
      '/dnsleak',
      '/speedtest',
      '/mailcheck <email>',
      '/phoneinfo <nomor>',
      '/checkcms <url>',
      '/subdomains <domain>',
      '/portscan <host> <port|start-end>',
      '/photon <opsi Photon>',
      '/photon_subdomains <url>',
      '/photon_wayback <url>',
      '/photon_dnsdumpster <url>',
      '/photon_full <url>',
    ].join('\n')
  )
);

// ==== Commands Lama ====
// ... (kode /webinfo, /myinfo, /up, /iptracker, /dnsleak, /speedtest, /mailcheck, /phoneinfo, /subdomains, /checkcms, /portscan tetap sama persis) ...

// ==== Photon bebas ====
bot.command('photon', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1).join(' ');
  if (!args) {
    return ctx.reply('Contoh: /photon -u https://example.com -l 2 -t 100 --dns --keys --wayback');
  }
  const cmd = `python3 "${PHOTON_PATH}" ${args}`;
  const r = await sh(cmd, 300_000);
  ctx.reply(cut(`🕵️ *Photon Output*\n\n${r.out || r.err || 'gagal'}`), { parse_mode: 'Markdown' });
});

// ==== Photon Presets ====

// Subdomains only
bot.command('photon_subdomains', async (ctx) => {
  const url = sanitizeURL(ctx.message.text.split(' ').slice(1).join(' '));
  if (!url) return ctx.reply('Contoh: /photon_subdomains https://example.com');
  const cmd = `python3 "${PHOTON_PATH}" -u "${url}" --only-urls --plugins find_subdomains`;
  const r = await sh(cmd, 300_000);
  ctx.reply(cut(`🌐 *Photon Subdomains*\n\n${r.out || r.err || 'gagal'}`), { parse_mode: 'Markdown' });
});

// Wayback
bot.command('photon_wayback', async (ctx) => {
  const url = sanitizeURL(ctx.message.text.split(' ').slice(1).join(' '));
  if (!url) return ctx.reply('Contoh: /photon_wayback https://example.com');
  const cmd = `python3 "${PHOTON_PATH}" -u "${url}" --plugins wayback`;
  const r = await sh(cmd, 300_000);
  ctx.reply(cut(`🗂️ *Photon Wayback*\n\n${r.out || r.err || 'gagal'}`), { parse_mode: 'Markdown' });
});

// DNSDumpster
bot.command('photon_dnsdumpster', async (ctx) => {
  const url = sanitizeURL(ctx.message.text.split(' ').slice(1).join(' '));
  if (!url) return ctx.reply('Contoh: /photon_dnsdumpster https://example.com');
  const cmd = `python3 "${PHOTON_PATH}" -u "${url}" --plugins dnsdumpster`;
  const r = await sh(cmd, 300_000);
  ctx.reply(cut(`🧩 *Photon DNSDumpster*\n\n${r.out || r.err || 'gagal'}`), { parse_mode: 'Markdown' });
});

// Full scan
bot.command('photon_full', async (ctx) => {
  const url = sanitizeURL(ctx.message.text.split(' ').slice(1).join(' '));
  if (!url) return ctx.reply('Contoh: /photon_full https://example.com');
  const cmd = `python3 "${PHOTON_PATH}" -u "${url}" -l 2 -t 100 --dns --keys --wayback`;
  const r = await sh(cmd, 300_000);
  ctx.reply(cut(`🕵️ *Photon Full Scan*\n\n${r.out || r.err || 'gagal'}`), { parse_mode: 'Markdown' });
});

// ==== Fallback ====
bot.on('text', (ctx) => {
  if (ctx.message.text.startsWith('/')) return;
  ctx.reply('Ketik /help buat lihat daftar command.');
});

bot.launch().then(() => console.log('Bot jalan 👌'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));