const net = require('net');
const crypto = require('crypto');
const EventEmitter = require('events');

const OP_HANDSHAKE = 0;
const OP_FRAME = 1;
const OP_CLOSE = 2;
const OP_PING = 3;
const OP_PONG = 4;

function encodeFrame(op, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const header = Buffer.alloc(8);
  header.writeInt32LE(op, 0);
  header.writeInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

function pipeNames() {
  const names = [];
  for (let i = 0; i < 10; i += 1) {
    if (process.platform === 'win32') {
      names.push(`\\\\?\\pipe\\discord-ipc-${i}`);
      names.push(`\\\\.\\pipe\\discord-ipc-${i}`);
    } else {
      const runtime = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || '/tmp';
      names.push(`${runtime.replace(/\/$/, '')}/discord-ipc-${i}`);
    }
  }
  return [...new Set(names)];
}

class DiscordIpcClient extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.clientId = null;
    this.ready = false;
    this.connecting = false;
    this.reconnectTimer = null;
    this.lastActivity = null;
  }

  async connect(clientId) {
    if (!clientId) throw new Error('Discord Application ID가 설정되지 않았습니다.');
    this.clientId = String(clientId).trim();
    if (this.ready || this.connecting) return;
    this.connecting = true;
    const names = pipeNames();
    let lastError = null;

    for (const name of names) {
      try {
        await this.connectPipe(name);
        this.connecting = false;
        return;
      } catch (error) {
        lastError = error;
      }
    }

    this.connecting = false;
    this.ready = false;
    this.emit('status', { connected: false, message: 'Discord 데스크톱 앱을 찾지 못했습니다.' });
    throw lastError || new Error('Discord IPC 연결 실패');
  }

  connectPipe(name) {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(name);
      let settled = false;
      const fail = (err) => {
        if (!settled) {
          settled = true;
          socket.destroy();
          reject(err);
        }
      };

      socket.setTimeout(1500, () => fail(new Error('Discord IPC timeout')));
      socket.once('error', fail);
      socket.once('connect', () => {
        socket.setTimeout(0);
        this.attachSocket(socket);
        this.write(OP_HANDSHAKE, { v: 1, client_id: this.clientId });
        const readyTimeout = setTimeout(() => fail(new Error('Discord handshake timeout')), 2500);
        const onReady = () => {
          if (settled) return;
          settled = true;
          clearTimeout(readyTimeout);
          socket.removeListener('error', fail);
          this.off('ready', onReady);
          resolve();
        };
        this.once('ready', onReady);
      });
    });
  }

  attachSocket(socket) {
    if (this.socket && !this.socket.destroyed) this.socket.destroy();
    this.socket = socket;
    this.buffer = Buffer.alloc(0);

    socket.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.parseFrames();
    });

    socket.on('close', () => {
      const wasReady = this.ready;
      this.ready = false;
      if (wasReady) this.emit('status', { connected: false, message: 'Discord 연결이 끊어졌습니다.' });
      if (this.clientId) this.scheduleReconnect();
    });

    socket.on('error', () => {});
  }

  parseFrames() {
    while (this.buffer.length >= 8) {
      const op = this.buffer.readInt32LE(0);
      const len = this.buffer.readInt32LE(4);
      if (this.buffer.length < 8 + len) return;
      const raw = this.buffer.subarray(8, 8 + len).toString('utf8');
      this.buffer = this.buffer.subarray(8 + len);
      let data = null;
      try { data = JSON.parse(raw); } catch { continue; }
      this.handleFrame(op, data);
    }
  }

  handleFrame(op, data) {
    if (op === OP_PING) {
      this.write(OP_PONG, data);
      return;
    }
    if (op === OP_CLOSE) {
      this.socket?.destroy();
      return;
    }
    if (op !== OP_FRAME) return;

    if (data?.cmd === 'DISPATCH' && data?.evt === 'READY') {
      this.ready = true;
      this.emit('ready', data.data);
      this.emit('status', { connected: true, message: 'Discord 연결됨' });
      if (this.lastActivity) this.setActivity(this.lastActivity).catch(() => {});
      return;
    }

    if (data?.evt === 'ERROR') {
      this.emit('error-frame', data);
    }
  }

  write(op, payload) {
    if (!this.socket || this.socket.destroyed) throw new Error('Discord IPC가 연결되지 않았습니다.');
    this.socket.write(encodeFrame(op, payload));
  }

  request(cmd, args) {
    const nonce = crypto.randomUUID();
    this.write(OP_FRAME, { cmd, args, nonce });
    return nonce;
  }

  async setActivity(activity) {
    this.lastActivity = activity;
    if (!this.ready) {
      await this.connect(this.clientId);
    }
    this.request('SET_ACTIVITY', { pid: process.pid, activity });
  }

  async clearActivity() {
    this.lastActivity = null;
    if (!this.ready) return;
    this.request('SET_ACTIVITY', { pid: process.pid, activity: null });
  }

  async switchApplication(clientId) {
    const next = String(clientId || '').trim();
    if (next === this.clientId && this.ready) return;
    this.clientId = next || null;
    this.ready = false;
    if (this.socket && !this.socket.destroyed) this.socket.destroy();
    if (next) await this.connect(next);
  }

  scheduleReconnect() {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(async () => {
      if (!this.clientId || this.ready || this.connecting) return;
      try { await this.connect(this.clientId); } catch {}
    }, 5000);
  }

  destroy() {
    clearTimeout(this.reconnectTimer);
    this.clientId = null;
    this.ready = false;
    if (this.socket && !this.socket.destroyed) this.socket.destroy();
  }
}

module.exports = { DiscordIpcClient };
