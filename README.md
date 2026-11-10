# Vishi-MD Mini

A small WhatsApp bot using Baileys.

## Run

1. Use Node.js 20 or newer.
2. Install dependencies with npm install.
3. Start with npm start and scan the QR code from WhatsApp's Linked devices screen.

Optional .env settings:

- BOT_NAME: display name (defaults to Vishi-MD Mini).
- PREFIX: command prefix (defaults to .).
- LOG_LEVEL: Pino log level (defaults to silent).

The WhatsApp session is stored in auth/ and is ignored by Git. Keep it private. Available commands: .pp, .song, .ping, and .help.
