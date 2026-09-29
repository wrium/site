import { createServer } from 'http';
import { readFileSync, statSync, existsSync } from 'fs';
import { join, extname } from 'path';

const PORT = 4300;
const DIST = join(process.cwd(), 'dist');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
    '.xml': 'application/xml',
    '.txt': 'text/plain'
};

const server = createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);

    // Redirect .html requests to clean URLs (like production)
    if (urlPath.endsWith('.html') && urlPath !== '/index.html') {
        const cleanPath = urlPath.replace(/\.html$/, '');
        res.writeHead(307, { Location: cleanPath });
        return res.end();
    }

    if (urlPath === '/') {
        urlPath = '/index.html';
    }

    let filePath = join(DIST, urlPath);

    // Support Clean URLs: match /docs/introduction to /docs/introduction.html
    if (!existsSync(filePath) && existsSync(filePath + '.html')) {
        filePath = filePath + '.html';
    }

    if (existsSync(filePath) && statSync(filePath).isFile()) {
        const ext = extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        return res.end(readFileSync(filePath));
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
});

server.listen(PORT, () => {
    console.log(`Preview server running at http://localhost:${PORT}/`);
});
