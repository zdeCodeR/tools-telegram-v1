const readline = require('readline');

const ask = (q) => new Promise((res) => rl.question(q, (ans) => res(ans.trim())));

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

(async () => {
  console.log('=== Telegraf Bot Setup ===');
  const token = await ask('Masukkan BOT_TOKEN: ');
  if (!token) {
    console.error('❌ BOT_TOKEN tidak boleh kosong.');
    process.exit(1);
  }
  process.env.BOT_TOKEN = token;

  const allowScan = (await ask('Aktifkan fitur portscan? (y/N): ')).toLowerCase().startsWith('y');
  process.env.ALLOW_PORTSCAN = allowScan ? 'true' : 'false';

  const whatcms = await ask('Masukkan WHATCMS_KEY (opsional, Enter lewati): ');
  if (whatcms) process.env.WHATCMS_KEY = whatcms;

  const numverify = await ask('Masukkan NUMVERIFY_KEY (opsional, Enter lewati): ');
  if (numverify) process.env.NUMVERIFY_KEY = numverify;

  const speedtestBin = await ask('Path binary speedtest (opsional, Enter lewati): ');
  if (speedtestBin) process.env.SPEEDTEST_BIN = speedtestBin;

  rl.close();
  require('./bot.js');
})();
