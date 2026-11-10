import ytdl from 'ytdl-core';
import { config } from './config.js';

const YOUTUBE_REGEX = /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/;

export default {
  name: 'song',
  aliases: ['music', 'audio', 'geeya'],
  category: 'downloader',
  description: 'YouTube සිංදුවක්/link එකක් audio එකක් විදිහට download කරන්න',
  usage: '<song name | youtube link>',
  async run({ sock, m, jid, args, reply, react }) {
    const query = args.join(' ').trim();
    if (!query) return reply({ text: '🎵 සිංදු නමක් හෝ YouTube link එකක් දෙන්න.\nඋදා: .song manike mage hiyoum' });

    await react('⏳');
    await reply({ text: '⏳ Searching & downloading...' });

    try {
      let videoId = null;
      let title = query;

      const linkMatch = query.match(YOUTUBE_REGEX);
      if (linkMatch) {
        videoId = linkMatch[1];
      } else {
        // YouTube search (web page scrape - no API key needed)
        const res = await fetch(
          `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } },
        );
        const html = await res.text();
        const match = html.match(/"videoRenderer":{"videoId":"([\w-]{11})"/) ||
                      html.match(/"videoId":"([\w-]{11})"/);
        if (!match) return reply({ text: '❌ සිංදුව හොයාගන්න බැරි වුණා.' });
        videoId = match[1];
      }

      const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`);
      title = info.videoDetails.title;
      const seconds = parseInt(info.videoDetails.lengthSeconds, 10);

      // 15 විනාඩියට වඩා වැඩි නම් block කරන්න (WhatsApp size limit නිසා)
      if (seconds > 900) {
        return reply({ text: `❌ "${title}" දිව්‍රම වැඩි (${Math.floor(seconds / 60)} min). 15 min ට අඩු එකක් දෙන්න.` });
      }

      const stream = ytdl(`https://www.youtube.com/watch?v=${videoId}`, {
        filter: 'audioonly',
        quality: 'highestaudio',
      });

      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);

      if (buffer.length > 15 * 1024 * 1024) {
        return reply({ text: '❌ File එක WhatsApp limit එකට වඩා ලොකුයි (16 MB).' });
      }

      await sock.sendMessage(jid, {
        audio: buffer,
        mimetype: 'audio/mpeg',
        fileName: `${title.replace(/[^\w\s-]/g, '')}.mp3`,
        contextInfo: {
          externalAdReply: {
            title: title.slice(0, 60),
            body: config.botName,
            mediaType: 2,
            thumbnail: undefined,
            sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
          },
        },
      }, { quoted: m });

      await react('✅');
    } catch (err) {
      console.error('[song]', err);
      await react('❌');
      await reply({ text: `❌ Download අසාර්ථක වුණා: ${err.message}` });
    }
  },
};