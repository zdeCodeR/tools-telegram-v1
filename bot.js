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

// ==== /start ====
bot.start(async (ctx) => {
  const infoText = [
    '🛠 *Tools V1*',
    '👨‍💻 Developer: azamtukam',
    '',
    'Perintah:',
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
  ].join('\n');

  await ctx.replyWithPhoto('https://files.catbox.moe/yzcgma.jpg', {
    caption: infoText,
    parse_mode: 'Markdown'
  });
});

bot.command('help', async (ctx) => {
  await ctx.replyWithPhoto('https://files.catbox.moe/o6zln9.jpg', {
    caption: [
      '🛠 *Tools V1*',
      '👨‍💻 Developer: azamtukam',
      '',
      'Perintah sama seperti di /start.'
    ].join('\n'),
    parse_mode: 'Markdown'
  });
});

bot.command('webinfo', async (ctx) => {
  const domain = sanitizeDomain(ctx.message.text.split(' ').slice(1).join(' '));
  if (!domain) return ctx.reply('Contoh: /webinfo contoh.com');

  const cmds = [
    `getent hosts ${domain} || host ${domain} 2>/dev/null || nslookup ${domain} 2>/dev/null`,
    `whois ${domain} 2>/dev/null | sed -n '1,120p'`,
    `dig +short NS ${domain} 2>/dev/null`,
    `dig +short MX ${domain} 2>/dev/null`,
    `curl -I -s https://${domain} | sed -n '1,20p'`,
  ];

  let msg = `🌐 *WebInfo* ${domain}\n\n`;
  for (const [i, c] of cmds.entries()) {
    const r = await sh(c);
    msg += `#${i + 1} $ ${c}\n${r.out || '(no output)'}\n\n`;
  }
  ctx.reply(cut(msg), { parse_mode: 'Markdown' });
});

// ==== Site Up/Down ====
bot.command('up', async (ctx) => {
  const url = sanitizeURL(ctx.message.text.split(' ').slice(1).join(' '));
  if (!url) return ctx.reply('Contoh: /up https://example.com');
  const r = await sh(`curl -sIL --max-time 10 "${url}" | sed -n '1,15p'`);
  const ok = /HTTP\/\d(\.\d)? 200/.test(r.out);
  ctx.reply((ok ? '✅ Up' : '❌ Down') + '\n\n' + cut(r.out || ''));
});

// ==== IP Tracker (ip-api.com) ====
bot.command('iptracker', async (ctx) => {
  const ip = sanitizeIP(ctx.message.text.split(' ').slice(1).join(' '));
  if (!ip) return ctx.reply('Contoh: /iptracker 8.8.8.8');
  const r = await sh(`curl -s "http://ip-api.com/json/${ip}?fields=status,message,continent,country,regionName,city,isp,org,as,query"`);
  ctx.reply(`📍 *IP Tracker*\n${r.out || 'gagal'}`, { parse_mode: 'Markdown' });
});

// ==== DNS Leak (butuh nslookup/dnsutils) ====
bot.command('dnsleak', async (ctx) => {
  // 3x query whoami.akamai.net; fallback kalau tidak ada nslookup
  const cmd = `
  c=0; while [ $c -lt 3 ]; do
    if command -v nslookup >/dev/null 2>&1; then
      ip=$(nslookup whoami.akamai.net 2>/dev/null | awk '/Address: /{print $2}' | sed -n '2p');
      [ -n "$ip" ] && echo "$ip"
    else
      host whoami.akamai.net 2>/dev/null | awk '{print $NF}'
    fi
    c=$((c+1)); sleep 1;
  done | sed '/^$/d' | nl
  `;
  const r = await sh(cmd);
  ctx.reply('🧪 *DNS Leak Test*\n(Jika IP/City kamu muncul, kemungkinan DNS leak)\n\n' + (r.out || 'Install dnsutils dulu'), {
    parse_mode: 'Markdown',
  });
});

// ==== Speedtest (pilih yang ada) ====
bot.command('speedtest', async (ctx) => {
  let cmd = '';
  if (SPEEDTEST_BIN) cmd = `${SPEEDTEST_BIN} --simple || ${SPEEDTEST_BIN} -f json`;
  else cmd = `command -v speedtest >/dev/null 2>&1 && speedtest --simple || command -v speedtest-cli >/dev/null 2>&1 && speedtest-cli --simple || (echo "Install: pkg/pip install speedtest-cli")`;
  const r = await sh(cmd, 120_000);
  ctx.reply('🚀 *Speedtest*\n\n' + (r.out || r.err || 'gagal'), { parse_mode: 'Markdown' });
});

// ==== Email Checker (2ip) ====
bot.command('mailcheck', async (ctx) => {
  const email = sanitizeEmail(ctx.message.text.split(' ').slice(1).join(' '));
  if (!email) return ctx.reply('Contoh: /mailcheck nama@domain.com');
  const r = await sh(`curl -s "https://api.2ip.me/email.txt?email=${email}"`);
  const ok = /true/.test(r.out);
  ctx.reply(`✉️ ${email}\nStatus: ${ok ? '✅ Valid (syntax/dns)' : '❌ Invalid'}`);
});

// ==== Phone Info (numverify/apilayer – opsional API key) ====
bot.command('phoneinfo', async (ctx) => {
  if (!NUMVERIFY_KEY) return ctx.reply('Set env NUMVERIFY_KEY dulu (apilayer/numverify).');
  const number = sanitizeNumber(ctx.message.text.split(' ').slice(1).join(' '));
  if (!number) return ctx.reply('Contoh: /phoneinfo 14158586273');
  const url = `http://apilayer.net/api/validate?access_key=${NUMVERIFY_KEY}&number=${encodeURIComponent(number)}&format=1`;
  const r = await sh(`curl -s "${url}"`);
  ctx.reply(`📱 *Phone Info*\n${r.out || 'gagal'}`, { parse_mode: 'Markdown' });
});

// ==== Subdomains (passive, non-intrusive) ====
bot.command('subdomains', async (ctx) => {
  const domain = sanitizeDomain(ctx.message.text.split(' ').slice(1).join(' '));
  if (!domain) return ctx.reply('Contoh: /subdomains contoh.com');

  // metode ringan: crt.sh + dig AXFR dicegah; hanya passive
  const cmd = `
  curl -s "https://crt.sh/?q=%25.${domain}&output=json" \
  | tr -d '\n' \
  | sed 's/},{/}\n{/g' \
  | grep -o '"name_value":"[^"]*"' \
  | cut -d'"' -f4 \
  | sed 's/\\n/\n/g' \
  | sed 's/\\*\\.//g' \
  | sort -u | head -n 60
  `;
  const r = await sh(cmd, 40_000);
  ctx.reply(cut(`🧩 *Subdomains* ${domain}\n\n${r.out || '(nggak ketemu)'}\n`), { parse_mode: 'Markdown' });
});

// ==== Check CMS (opsional WhatCMS API) ====
bot.command('checkcms', async (ctx) => {
  const url = sanitizeURL(ctx.message.text.split(' ').slice(1).join(' '));
  if (!url) return ctx.reply('Contoh: /checkcms https://contoh.com');

  if (WHATCMS_KEY) {
    const api = `https://whatcms.org/APIEndpoint?key=${WHATCMS_KEY}&url=${encodeURIComponent(url)}`;
    const r = await sh(`curl -s "${api}"`);
    return ctx.reply(`🧰 *CMS (API)*\n${r.out || 'gagal'}`, { parse_mode: 'Markdown' });
  }

  // Heuristik tanpa API
  const headers = await sh(`curl -sIL "${url}" | sed -n '1,40p'`);
  const html = await sh(`curl -s "${url}" | sed -n '1,400p'`);
  let guess = [];
  if (/wp-content|wp-includes/i.test(html.out)) guess.push('WordPress?');
  if (/x-drupal-cache|drupal-settings-json/i.test(headers.out + html.out)) guess.push('Drupal?');
  if (/Set-Cookie: (prestashop|ps_)/i.test(headers.out)) guess.push('PrestaShop?');
  if (/Shopify|x-shopify/i.test(headers.out)) guess.push('Shopify?');
  if (/Joomla|com_content/i.test(html.out)) guess.push('Joomla?');
  if (/x-powered-by: php/i.test(headers.out)) guess.push('PHP site');

  ctx.reply(
    cut(
      `🧰 *CMS (heuristik)*\nTebakan: ${guess.join(', ') || '(ga yakin)'}\n\n` +
        `-- Headers --\n${headers.out}\n-- Snippet HTML --\n${html.out}`
    ),
    { parse_mode: 'Markdown' }
  );
});

// ==== Port Scan (dikunci) ====
bot.command('portscan', async (ctx) => {
  if (!ALLOW_PORTSCAN) return ctx.reply('Fitur dikunci. Set ALLOW_PORTSCAN=true saat start (di index.js).');
  const parts = ctx.message.text.trim().split(/\s+/);
  if (parts.length < 3) return ctx.reply('Contoh: /portscan 192.168.1.10 22 atau /portscan 192.168.1.10 1-1000');

  const host = sanitizeDomain(parts[1]) || sanitizeIP(parts[1]);
  const portArg = parts[2];
  if (!host) return ctx.reply('Host tidak valid.');
  if (!sanitizeIP(host) && !/^[A-Za-z0-9.-]+$/.test(host)) return ctx.reply('Host tidak valid.');

  // Demi etika, beri peringatan bila target IP publik
  if (sanitizeIP(host) && !isPrivateIP(host)) {
    await ctx.reply('⚠️ Hati-hati: port scan ke IP publik bisa melanggar ToS/hukum tanpa izin.');
  }

  let cmd = '';
  if (/^\d+$/.test(portArg)) {
    cmd = `nc -z -v -w2 ${host} ${portArg} 2>&1 | sed -n '1,4p'`;
  } else if (/^\d+-\d+$/.test(portArg)) {
    const [a, b] = portArg.split('-').map((x) => parseInt(x, 10));
    const threads = 40;
    cmd = `
seq ${a} ${b} | xargs -P ${threads} -I{} sh -c 'nc -z -w1 ${host} {} 2>&1 | grep -E "succeeded|open" && echo "OPEN {}"' | sort -n -k2 | sed -n '1,200p'
`;
  } else {
    return ctx.reply('Port tidak valid. Gunakan angka atau rentang a-b.');
  }
  const r = await sh(cmd, 60_000);
  ctx.reply(cut(`🛰️ *Portscan ${host} ${portArg}*\n\n${r.out || '(nggak ada yang open / gagal)'}\n`), {
    parse_mode: 'Markdown',
  });
});
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
bot.command('photon_subdomains', async (ctx) => {
  const url = sanitizeURL(ctx.message.text.split(' ').slice(1).join(' '));
  if (!url) return ctx.reply('Contoh: /photon_subdomains https://example.com');
  const cmd = `python3 "${PHOTON_PATH}" -u "${url}" --only-urls --plugins find_subdomains`;
  const r = await sh(cmd, 300_000);
  ctx.reply(cut(`🌐 *Photon Subdomains*\n\n${r.out || r.err || 'gagal'}`), { parse_mode: 'Markdown' });
});

bot.command('photon_wayback', async (ctx) => {
  const url = sanitizeURL(ctx.message.text.split(' ').slice(1).join(' '));
  if (!url) return ctx.reply('Contoh: /photon_wayback https://example.com');
  const cmd = `python3 "${PHOTON_PATH}" -u "${url}" --plugins wayback`;
  const r = await sh(cmd, 300_000);
  ctx.reply(cut(`🗂️ *Photon Wayback*\n\n${r.out || r.err || 'gagal'}`), { parse_mode: 'Markdown' });
});

bot.command('photon_dnsdumpster', async (ctx) => {
  const url = sanitizeURL(ctx.message.text.split(' ').slice(1).join(' '));
  if (!url) return ctx.reply('Contoh: /photon_dnsdumpster https://example.com');
  const cmd = `python3 "${PHOTON_PATH}" -u "${url}" --plugins dnsdumpster`;
  const r = await sh(cmd, 300_000);
  ctx.reply(cut(`🧩 *Photon DNSDumpster*\n\n${r.out || r.err || 'gagal'}`), { parse_mode: 'Markdown' });
});

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
