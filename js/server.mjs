import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 3000;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

createServer(async (req, res) => {
  try {
    let url = req.url.split('?')[0];
    if (url === '/') url = '/index.html';

    const path = join(ROOT, url);
    const content = await readFile(path);
    const ext = extname(path).toLowerCase();

    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('404');
  }
}).listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});
