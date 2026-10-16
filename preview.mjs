// Local preview only. No dependencies, no remote access, no file writes.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp4':'video/mp4','.pdf':'application/pdf'};
const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {res.writeHead(405);res.end();return;}
  let pathname;
  try {pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);} catch {res.writeHead(400);res.end();return;}
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) {res.writeHead(403);res.end();return;}
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) {res.writeHead(404);res.end('Not found');return;}
    let start = 0, end = stat.size - 1, status = 200;
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match || (!match[1] && !match[2])) {res.writeHead(416, {'Content-Range':`bytes */${stat.size}`});res.end();return;}
      if (match[1]) {start = Number(match[1]);if(match[2])end = Math.min(Number(match[2]), end);}
      else start = Math.max(0, stat.size - Number(match[2]));
      if (start > end || start >= stat.size) {res.writeHead(416, {'Content-Range':`bytes */${stat.size}`});res.end();return;}
      status = 206;
    }
    const headers = {'Content-Type':mime[path.extname(file)] || 'application/octet-stream', 'Content-Length':end-start+1, 'Accept-Ranges':'bytes', 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff'};
    if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    res.writeHead(status, headers);
    if (req.method === 'HEAD') {res.end();return;}
    const stream = fs.createReadStream(file, {start, end});
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  });
});
server.listen(8766, '127.0.0.1', () => console.log('ConfigWM local preview: http://127.0.0.1:8766'));
server.on('error', error => {console.error(error.message);process.exitCode=1;});
