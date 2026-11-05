/* Local approximation of the aem.live render of the da.live documents (import-work/da), before they
 * are published: repo code at /, documents at /<path> and /<path>.plain.html, `:icon:` -> icon spans,
 * content.da.live media -> local files. usage: node serve-local.mjs [port=3020] */
import fs from 'fs';
import http from 'http';
import path from 'path';

const PORT = +(process.argv[2] || 3020);
const ROOT = new URL('../../', import.meta.url).pathname;
const DA = path.join(ROOT, 'import-work/da');
const HEAD = fs.readFileSync(path.join(ROOT, 'head.html'), 'utf8');
const TYPES = {
  '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon',
};

function main(file) {
  const html = fs.readFileSync(file, 'utf8').match(/<main>([\s\S]*)<\/main>/)[1];
  return html
    .replace(/https:\/\/content\.da\.live\/[^/]+\/[^/]+\/media\//g, '/import-work/da/media/')
    .replace(/:([a-z0-9-]+):/g, '<span class="icon icon-$1"></span>');
}

function metaTags(html) {
  const tags = ['<meta name="nav" content="/nav"><meta name="footer" content="/footer">'];
  const block = html.match(/<div class="metadata">([\s\S]*?)<\/div><\/div><\/div>/);
  if (block) {
    const title = block[1].match(/<div>Title<\/div><div>([^<]*)/);
    if (title) tags.push(`<title>${title[1]}</title>`);
  }
  return tags.join('');
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let p = decodeURIComponent(url.pathname);
  const plain = p.endsWith('.plain.html');
  if (plain) p = p.replace(/\.plain\.html$/, '');
  const doc = path.join(DA, `${p === '/' ? '/en/personal-insurance' : p}.html`);
  if (!path.extname(p) && fs.existsSync(doc)) {
    const html = main(doc);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(plain ? html : `<!DOCTYPE html><html><head>${metaTags(html)}${HEAD}</head><body><header></header><main>${html.replace(/<div class="metadata">[\s\S]*?<\/div><\/div><\/div>/, '')}</main><footer></footer></body></html>`);
    return;
  }
  const file = path.join(ROOT, p);
  if (file.startsWith(ROOT) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
    return;
  }
  res.writeHead(404);
  res.end('not found');
}).listen(PORT, () => console.log(`http://localhost:${PORT}/en/personal-insurance`));
