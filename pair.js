import makeWASocket, {
  useMultiFileAuthState, fetchLatestBaileysVersion, Browsers, delay,
} from '@whiskeysockets/baileys';
import pino from 'pino';

const PHONE = (process.env.PHONE_NUMBER ?? '').replace(/\D/g, '');
if (!PHONE) {
  console.error('❌ PHONE_NUMBER දෙන්න: PHONE_NUMBER=94771234567 node pair.js');
  process.exit(1);
}
if (PHONE.startsWith('0')) {
  console.error('❌ Leading 0 තියෙනවා. 0771234567 නෙමෙයි → 94771234567');
  process.exit(1);
}
console.log('pairing number:', PHONE);

const { state, saveCreds } = await useMultiFileAuthState('./auth');
const { version } = await fetchLatestBaileysVersion();
console.log('WA version:', version);

const sock = makeWASocket({
  version,
  auth: state,
  logger: pino({ level: 'debug' }),   // debug = හැම error එකක්ම පේනවා
  printQRInTerminal: false,
  browser: Browsers.ubuntu('Chrome'),
  markOnlineOnConnect: false,
});

sock.ev.on('creds.update', saveCreds);

let requested = false;
let qrCount = 0;

sock.ev.on('connection.update', async (u) => {
  const code = u.lastDisconnect?.error?.output?.statusCode;
  console.log('[update]', { connection: u.connection, qr: !!u.qr, statusCode: code,
                            reason: u.lastDisconnect?.error?.message });

  // socket ready වුණාම විතරයි code ඉල්ලන්නේ
  if (u.qr && !sock.authState.creds.registered && !requested) {
    requested = true;
    qrCount++;
    if (qrCount > 3) { console.error('❌ QR 3 වතාවක් refresh වුණා — auth folder එක delete කරලා ආයෙ try කරන්න.'); process.exit(1); }
    await delay(2000);
    try {
      // 2වෙනි arg = custom 8-char code (optional)
      const pairing = await sock.requestPairingCode(PHONE, 'VISHI-MD');
      console.log('\n>>> PAIRING CODE:', pairing, '<<<\n');
      console.log('දැන් phone එකේ: WhatsApp → Settings → Linked devices → Link a device');
      console.log('→ "Link with phone number instead" → code එක ගහන්න (විනාඩියක් ඇතුළත)\n');
    } catch (e) {
      console.error('requestPairingCode failed:', e?.message || e);
      requested = false;
    }
  }

  if (u.connection === 'open') {
    console.log('✅ PAIRED as', sock.user?.id);
    await delay(2500);        // creds save වෙන්න කලින් exit නොකරන්න
    process.exit(0);
  }

  if (u.connection === 'close') {
    if (code === 401) {
      console.error('❌ 401 = logged out. auth/ folder එක delete කරන්න.');
      process.exit(1);
    }
  }
});