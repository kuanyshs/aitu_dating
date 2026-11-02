// Turns the guide's HTML sections into Markdown, so docs/product-guide.md says exactly
// what docs/product-guide.html says. Only the markup build-guide.mjs emits is handled.

const unesc = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

/** Inline markup: <strong> back to **…**, everything else dropped. */
const inline = (s) =>
  unesc(
    s
      .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  );

const cell = (s) => inline(s).replace(/\|/g, '\\|');

function table(html) {
  const head = [...html.matchAll(/<th>(.*?)<\/th>/g)].map((m) => cell(m[1]));
  const rows = [...html.matchAll(/<tr>(.*?)<\/tr>/g)]
    .map((m) => [...m[1].matchAll(/<td>(.*?)<\/td>/g)].map((c) => cell(c[1])))
    .filter((r) => r.length);
  return [
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n');
}

const list = (html, ordered) =>
  [...html.matchAll(/<li>(.*?)<\/li>/g)]
    .map((m, i) => `${ordered ? `${i + 1}.` : '-'} ${inline(m[1])}`)
    .join('\n');

function screens(html) {
  const captions = [...html.matchAll(/<figcaption><span class="num">\d+<\/span><span>(.*?)<\/span>/g)].map(
    (m) => inline(m[1]),
  );
  return `_Экраны в HTML-версии: ${captions.join('; ')}._`;
}

/** One `<section>` of the guide in Markdown, with its number. */
export function sectionMarkdown(html, number) {
  const out = [];
  const pattern =
    /<h2>(.*?)<\/h2>|<p class="lead">(.*?)<\/p>|<h3>(.*?)<\/h3>|<h4>(.*?)<\/h4>|<div class="table-wrap">(.*?)<\/div>|<ol class="steps">(.*?)<\/ol>|<ul class="bullets">(.*?)<\/ul>|<div class="screens">(.*?<\/figure>)<\/div>|<p>(.*?)<\/p>/gs;
  for (const m of html.matchAll(pattern)) {
    const [, h2, lead, h3, h4, tbl, ol, ul, shots, para] = m;
    if (h2) out.push(`## ${number}. ${inline(h2)}`);
    else if (lead) out.push(inline(lead));
    else if (h3) out.push(`### ${inline(h3)}`);
    else if (h4) out.push(`#### ${inline(h4)}`);
    else if (tbl) out.push(table(tbl));
    else if (ol) out.push(list(ol, true));
    else if (ul) out.push(list(ul, false));
    else if (shots) out.push(screens(shots));
    else if (para) out.push(inline(para));
  }
  return out.join('\n\n');
}
