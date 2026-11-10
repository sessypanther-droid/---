const SITE = 'https://pastpapers.wiki';
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };

// "al physics 2022 sinhala" වගේ query එක search URL එකක් කරනවා
function buildQuery(args) {
  return args
    .join(' ')
    .toLowerCase()
    .replace(/\b(al|a\/l)\b/g, 'a-l')
    .replace(/\b(ol|o\/l)\b/g, 'o-l')
    .trim();
}

async function fetchText(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// search page එකෙන් post links ගන්නවා
function extractPosts(html) {
  const links = new Map(); // url -> title
  const re = /<a[^>]+href="(https:\/\/pastpapers\.wiki\/[^""]+\/)"[^>]*>([^<]{5,150})<\/a>/g;
  let match;
  while ((match = re.exec(html))) {
    const url = match[1];
    const title = match[2].trim();
    // category/tag/author pages අයින් කරන්න
    if (/\/(category|tag|author|page)\/|\/wp-|\/feed/.test(url)) continue;
    if (!links.has(url)) links.set(url, title);
  }
  return [...links.entries()].slice(0, 5);
}

// post page එකෙන් PDF links ගන්නවා
function extractPdfLinks(html) {
  const out = [];
  const re = /href="([^"]+\.pdf[^"]*)"/gi;
  let match;
  while ((match = re.exec(html))) {
    let u = match[1];
    if (u.startsWith('/')) u = SITE + u;
    if (!out.includes(u)) out.push(u);
  }
  return out.slice(0, 5);
}

export default {
  name: 'pp',
  aliases: ['pastpaper', 'pastpapers'],
  category: 'education',
  description: 'Sri Lanka past papers download (A/L, O/L, term test)',
  usage: '<subject + year>  උදා: .pp ol maths 2022 sinhala',
  async run({ sock, m, jid, args, reply, react }) {
    const query = buildQuery(args);
    if (!query) {
      return reply({
        text:
          '📚 Past papers search\n\n' +
          'භාවිතය: .pp <subject> <year> [medium]\n\n' +
          'උදාහරණ:\n' +
          '• .pp al physics 2022\n' +
          '• .pp ol maths 2020 sinhala\n' +
          '• .pp grade 10 science term test\n' +
          '• .pp al chemistry marking scheme',
      });
    }

    await react('🔎');
    await reply({ text: `🔎 "${query}" හොයනවා...` });

    try {
      // 1) pastpapers.wiki එකේ search
      const searchHtml = await fetchText(`${SITE}/?s=${encodeURIComponent(query)}`);
      const posts = extractPosts(searchHtml);

      if (!posts.length) {
        await react('❌');
        return reply({ text: '❌ Results හොයාගන්න බැරි වුණා. වෙන query එකක් try කරන්න.\nඋදා: .pp ol mathematics 2021' });
      }

      // 2) පළවෙනි result එකේ page එකට ගිහින් PDF links ගන්නවා
      const [postUrl, postTitle] = posts[0];
      const postHtml = await fetchText(postUrl);
      const pdfs = extractPdfLinks(postHtml);

      const resultList = posts
        .map(([u, t], i) => `${i + 1}. ${t}\n   ${u}`)
        .join('\n');

      if (!pdfs.length) {
        // PDF direct නැත්නම් (Google Drive වගේ) results list එක යවනවා
        await react('📄');
        return reply({
          text:
            `📚 *${postTitle}*\n\n` +
            `📄 Direct PDF එකක් නැති නිසා links:\n\n${resultList}\n\n` +
            `💡 Page එක open කරලා download button එකෙන් ගන්න.`,
        });
      }

      // 3) පළවෙනි PDF එක download කරලා document විදිහට යවනවා
      await react('⏳');
      const pdfRes = await fetch(pdfs[0], { headers: UA });
      if (!pdfRes.ok) throw new Error(`PDF download failed: HTTP ${pdfRes.status}`);
      const buf = Buffer.from(await pdfRes.arrayBuffer());

      if (buf.length > 95 * 1024 * 1024) {
        return reply({ text: `❌ PDF එක ලොකු වැඩියි (${(buf.length / 1048576).toFixed(0)} MB). Link: ${pdfs[0]}` });
      }

      const fileName = postTitle
        .replace(/[^\w\s-()]/g, '')
        .slice(0, 60) + '.pdf';

      await sock.sendMessage(jid, {
        document: buf,
        mimetype: 'application/pdf',
        fileName,
        caption: `📚 ${postTitle}\n🔗 ${postUrl}\n\n_Yet another result: .pp වෙන query එකක් දෙන්න_`,
      }, { quoted: m });

      // අමතර PDF links තියෙනවා නම් (marking scheme වගේ) list එකක් යවනවා
      if (pdfs.length > 1) {
        const extra = pdfs.slice(1).map((u, i) => `${i + 2}. ${u}`).join('\n');
        await reply({ text: `📎 තව PDFs (marking scheme ඇතුළුව):\n${extra}` });
      }

      await react('✅');
    } catch (err) {
      console.error('[pp]', err);
      await react('❌');
      await reply({ text: `❌ Error: ${err.message}` });
    }
  },
};