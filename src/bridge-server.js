const http = require('http');
const EventEmitter = require('events');

class BridgeServer extends EventEmitter {
  constructor(port = 32145) {
    super();
    this.port = port;
    this.server = null;
    this.lastSeenAt = 0;
    this.latest = { active: false };
  }

  start() {
    if (this.server) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handle(req, res));
      this.server.once('error', reject);
      this.server.listen(this.port, '127.0.0.1', () => {
        this.server.removeListener('error', reject);
        resolve();
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.server) return resolve();
      this.server.close(() => resolve());
      this.server = null;
    });
  }

  allowedOrigin(origin) {
    return !origin || origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://');
  }

  sendJson(res, status, body) {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-WeirdHost-Bridge',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    res.end(JSON.stringify(body));
  }

  async readJson(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 64 * 1024) req.destroy();
      });
      req.on('end', () => {
        try { resolve(JSON.parse(body || '{}')); } catch (e) { reject(e); }
      });
      req.on('error', reject);
    });
  }

  async handle(req, res) {
    const origin = String(req.headers.origin || '');
    if (!this.allowedOrigin(origin)) return this.sendJson(res, 403, { ok: false, error: 'origin_denied' });
    if (req.method === 'OPTIONS') return this.sendJson(res, 204, {});


    if (req.method === 'POST' && req.url === '/activity') {
      if (req.headers['x-weirdhost-bridge'] !== 'v1') {
        return this.sendJson(res, 403, { ok: false, error: 'bad_bridge_header' });
      }
      try {
        const data = await this.readJson(req);
        const normalized = {
          active: Boolean(data.active),
          url: typeof data.url === 'string' ? data.url.slice(0, 2048) : '',
          host: typeof data.host === 'string' ? data.host.slice(0, 255) : '',
          serverName: typeof data.serverName === 'string' ? data.serverName.slice(0, 128) : '',
          section: typeof data.section === 'string' ? data.section.slice(0, 40) : 'other',
          title: typeof data.title === 'string' ? data.title.slice(0, 256) : ''
        };
        this.lastSeenAt = Date.now();
        this.latest = normalized;
        this.emit('activity', normalized);
        return this.sendJson(res, 200, { ok: true });
      } catch {
        return this.sendJson(res, 400, { ok: false, error: 'invalid_json' });
      }
    }

    this.sendJson(res, 404, { ok: false, error: 'not_found' });
  }
}

module.exports = { BridgeServer };
