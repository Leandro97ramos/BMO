import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { Readable } from 'node:stream';

function redgifsProxyPlugin() {
  const setupMiddlewares = (server) => {
    // Redgifs Auth Token Proxy
    server.middlewares.use('/api/redgifs/auth', async (req, res) => {
      try {
        const authRes = await fetch('https://api.redgifs.com/v2/auth/temporary', {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const data = await authRes.json();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify(data));
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message }));
      }
    });

    // Redgifs Detail Proxy: /api/redgifs/detail?id=...
    server.middlewares.use('/api/redgifs/detail', async (req, res) => {
      try {
        const urlObj = new URL(req.url, 'http://localhost');
        const id = urlObj.searchParams.get('id');
        const token = req.headers['authorization'];

        if (!id) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'Missing id parameter' }));
        }

        const headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };
        if (token) {
          headers['Authorization'] = token;
        }

        const gifRes = await fetch(`https://api.redgifs.com/v2/gifs/${id.toLowerCase()}`, { headers });
        const data = await gifRes.json();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify(data));
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message }));
      }
    });

    // Redgifs Video Stream/Download Proxy: /api/redgifs/download?url=...
    server.middlewares.use('/api/redgifs/download', async (req, res) => {
      try {
        const urlObj = new URL(req.url, 'http://localhost');
        const targetUrl = urlObj.searchParams.get('url');

        if (!targetUrl) {
          res.statusCode = 400;
          return res.end('Missing url parameter');
        }

        const mediaRes = await fetch(targetUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });

        if (!mediaRes.ok) {
          res.statusCode = mediaRes.status;
          return res.end(`Failed to fetch media: ${mediaRes.statusText}`);
        }

        res.setHeader('Content-Type', mediaRes.headers.get('content-type') || 'video/mp4');
        const length = mediaRes.headers.get('content-length');
        if (length) {
          res.setHeader('Content-Length', length);
        }
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type');

        if (mediaRes.body) {
          Readable.fromWeb(mediaRes.body).pipe(res);
        } else {
          res.end();
        }
      } catch (err) {
        res.statusCode = 500;
        res.end('Proxy download error: ' + err.message);
      }
    });
  };

  return {
    name: 'redgifs-proxy',
    configureServer(server) {
      setupMiddlewares(server);
    },
    configurePreviewServer(server) {
      setupMiddlewares(server);
    }
  };
}

export default defineConfig({
  plugins: [react(), redgifsProxyPlugin()],
  server: {
    port: 3000,
    open: true
  }
});
