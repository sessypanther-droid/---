import makeWASocket, {
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { config } from '../config.js';
import ppCommand from '../pp.js';
import songCommand from '../song.js';
import { getMessageText, parseCommand } from './commands.js';

const commands = [ppCommand, songCommand];
const registry = new Map();
for (const command of commands) {
  registry.set(command.name, command);
  for (const alias of command.aliases ?? []) registry.set(alias, command);
}
registry.set('ping', { name: 'ping', run: ({ reply }) => reply({ text: 'pong' }) });
registry.set('help', {
  name: 'help',
  run: ({ reply }) => reply({
    text: config.botName + '\n\n' +
      'Commands: ' + commands.map((command) => config.prefix + command.name).join(', ') +
      ', ' + config.prefix + 'ping, ' + config.prefix + 'help',
  }),
});

async function handleMessage(sock, m) {
  if (!m?.message || m.key?.fromMe) return;
  const jid = m.key?.remoteJid;
  if (!jid || jid === 'status@broadcast') return;

  const parsed = parseCommand(getMessageText(m.message), config.prefix);
  if (!parsed) return;
  const command = registry.get(parsed.name);
  if (!command) return;

  const reply = ({ text, ...options }) =>
    sock.sendMessage(jid, { text, ...options }, { quoted: m });
  const react = (text) => sock.sendMessage(jid, { react: { text, key: m.key } });
  const bare = (value) => String(value).split('@')[0];

  try {
    await command.run({ sock, m, jid, args: parsed.args, reply, react, bare });
  } catch (error) {
    console.error('[' + command.name + ']', error?.message ?? error);
    await reply({ text: '❌ Command failed. Check the bot logs.' }).catch(() => {});
  }
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: process.env.LOG_LEVEL || 'silent' }),
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) qrcode.generate(qr, { small: true });
    if (connection === 'open') console.log(config.botName + ' connected.');
    if (connection === 'close') {
      const status = lastDisconnect?.error?.output?.statusCode;
      if (status === 401) {
        console.error('WhatsApp session logged out. Remove auth/ and pair again.');
        return;
      }
      console.error('WhatsApp connection closed; reconnecting in 5 seconds.');
      setTimeout(() => start().catch((error) => console.error('Reconnect failed:', error?.message ?? error)), 5000);
    }
  });
  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const message of messages) {
      void handleMessage(sock, message).catch((error) => console.error('Message handler failed:', error?.message ?? error));
    }
  });
}

start().catch((error) => {
  console.error('Bot startup failed:', error?.message ?? error);
  process.exitCode = 1;
});
