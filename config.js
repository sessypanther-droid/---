import 'dotenv/config';

export const config = Object.freeze({
  botName: process.env.BOT_NAME?.trim() || 'Vishi-MD Mini',
  prefix: process.env.PREFIX?.trim() || '.',
});
