const http = require('http');
const os = require('os');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.AUTOPULSE_OBD_REPLAY_PORT || 8765);
const FIXTURE_PATH = process.env.AUTOPULSE_OBD_REPLAY_TRANSACTIONS
  || path.join(os.homedir(), 'Downloads', 'transactions.json');
const CHUNK_DELAY_MS = Number(process.env.AUTOPULSE_OBD_REPLAY_CHUNK_DELAY_MS || 25);

let tick = 0;
let replayCatalog = null;
let replayCursors = new Map();

function loadReplayCatalog() {
  if (!fs.existsSync(FIXTURE_PATH)) {
    console.log(`[OBD Replay] Fixture not found at ${FIXTURE_PATH}. Using built-in fallback responses.`);
    return null;
  }

  const parsed = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const transactions = Array.isArray(parsed) ? parsed : parsed.transactions;
  const byCommand = new Map();
  for (const tx of transactions || []) {
    const command = String(tx.command || '').trim().toUpperCase();
    if (!command || !Array.isArray(tx.rawChunks)) continue;
    const list = byCommand.get(command) || [];
    list.push(tx);
    byCommand.set(command, list);
  }

  console.log(`[OBD Replay] Loaded ${transactions?.length || 0} fixture transactions from ${FIXTURE_PATH}`);
  return byCommand;
}

replayCatalog = loadReplayCatalog();

function checksumFrame(frame) {
  return frame;
}

function toHexByte(value) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0').toUpperCase();
}

function rpmFrame() {
  tick += 1;
  const testCases = [0, 400, 750, 1100, 1600, 4500, 5500, 7000];
  const rpm = testCases[Math.floor(tick / 50) % testCases.length];
  const raw = Math.round(rpm * 4);
  const a = Math.floor(raw / 256);
  const b = raw % 256;
  return `410C${toHexByte(a)}${toHexByte(b)}\r\r>`;
}

function speedFrame() {
  const testCases = [0, 110, 150, 260, 310];
  const speed = testCases[Math.floor(tick / 50) % testCases.length];
  return `410D${toHexByte(speed)}\r\r>`;
}

function coolantFrame() {
  const testCases = [89, 95, 106, 116, -40];
  const temp = testCases[Math.floor(tick / 50) % testCases.length];
  return `4105${toHexByte(temp + 40)}\r\r>`;
}

function adapterVoltageFrame() {
  // 11.8 (CRITICAL), 12.5 (ELEVATED), 12.7 (NORMAL OFF), 13.5 (ELEVATED ON), 14.0 (NORMAL ON), 14.8 (ELEVATED ON), 15.2 (CRITICAL ON)
  const testCases = [11.8, 12.5, 12.7, 13.5, 14.0, 14.8, 15.2];
  const voltage = testCases[Math.floor(tick / 50) % testCases.length].toFixed(1);
  return `${voltage}V\r\r>`;
}

function responseFor(command) {
  const normalized = String(command || '').trim().toUpperCase();
  switch (normalized) {
    case 'ATZ': return '\r\rELM327 v2.1\r\r>';
    case 'ATE0': return 'ATE0\rOK\r\r>';
    case 'ATL0':
    case 'ATS0':
    case 'ATH0':
    case 'ATCAF1':
    case 'ATSP0':
    case 'ATSP3':
    case 'ATSP4':
    case 'ATSP5':
    case 'ATSP6':
    case 'ATSP7':
    case 'ATSP8':
    case 'ATSP9':
      return 'OK\r\r>';
    case 'ATAT1': return 'SEARCHING...\rOK\r\r>';
    case 'ATI': return 'ELM327 v2.1\r\r>';
    case 'AT@1': return 'OBDII to RS232 Interpreter\r\r>';
    case 'ATRV': return adapterVoltageFrame();
    case 'ATDP': return 'ISO 9141-2\r\r>';
    case 'ATDPN': return '3\r\r>';
    case '0100': return 'BUS INIT: OK\r410000000000\r\r>';
    case '010C': return rpmFrame();
    case '010D': return speedFrame();
    case '0105': return coolantFrame();
    case '0142': return '7F0112\r\r>';
    case '0900': return '490001FC000000\r\r>';
    case '0902': return '49020100000039\r49020246424C53\r49020352414442\r490204464D3439\r49020539393635\r\r>';
    case '0904': return '49040138323030\r49040239323731\r49040335350000\r49040400000000\r49040500000000\r49040600000000\r49040700000000\r49040800000000\r\r>';
    case '090A': return '7F0912\r\r>';
    case '03': return '43000000000000\r\r>';
    default: return '?\r\r>';
  }
}

function replayStepFor(command) {
  const normalized = String(command || '').trim().toUpperCase();
  
  // Force dynamic test values to cycle through all boundary colors
  if (['010C', '010D', '0105', 'ATRV'].includes(normalized)) {
    const raw = checksumFrame(responseFor(command));
    return { rawChunks: [raw], rawResponse: raw, status: 'FALLBACK' };
  }

  const entries = replayCatalog?.get(normalized);
  if (!entries || entries.length === 0) {
    const raw = checksumFrame(responseFor(command));
    return { rawChunks: [raw], rawResponse: raw, status: 'FALLBACK' };
  }

  const cursor = replayCursors.get(normalized) || 0;
  const step = entries[cursor % entries.length];
  replayCursors.set(normalized, cursor + 1);
  return step;
}

function frame(data) {
  const payload = Buffer.from(data);
  if (payload.length < 126) {
    return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
  }
  if (payload.length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
    return Buffer.concat([header, payload]);
  }
  throw new Error('Replay payload too large');
}

function unframe(buffer) {
  if (buffer.length < 6) return null;
  const opcode = buffer[0] & 0x0f;
  if (opcode === 0x8) return { close: true };
  let offset = 2;
  let length = buffer[1] & 0x7f;
  if (length === 126) {
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    length = Number(buffer.readBigUInt64BE(offset));
    offset += 8;
  }
  const masked = (buffer[1] & 0x80) !== 0;
  const mask = masked ? buffer.slice(offset, offset + 4) : null;
  offset += masked ? 4 : 0;
  if (buffer.length < offset + length) return null;
  const payload = buffer.slice(offset, offset + length);
  if (mask) {
    for (let i = 0; i < payload.length; i += 1) {
      payload[i] ^= mask[i % 4];
    }
  }
  return { text: payload.toString('utf8') };
}

function handleWs(socket, req) {
  const key = req.headers['sec-websocket-key'];
  const accept = crypto
    .createHash('sha1')
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');

  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
    '',
    ''
  ].join('\r\n'));

  console.log('[OBD Replay] Mobile connected');

  socket.on('data', (chunk) => {
    const message = unframe(Buffer.from(chunk));
    if (!message || message.close) return;

    let request;
    try {
      request = JSON.parse(message.text);
    } catch {
      request = { command: message.text };
    }

    const command = request.command;
    const step = replayStepFor(command);
    const chunks = step.rawChunks?.length ? step.rawChunks : [step.rawResponse || ''];
    const raw = chunks.join('');
    console.log(`[OBD Replay] ${command} => ${chunks.length} chunks ${JSON.stringify(raw)}`);

    chunks.forEach((chunk, index) => {
      setTimeout(() => {
        if (socket.destroyed) return;
        socket.write(frame(JSON.stringify({
          id: request.id || null,
          command,
          chunk,
          done: false,
          chunkIndex: index,
          chunkCount: chunks.length
        })));
      }, CHUNK_DELAY_MS * index);
    });

    setTimeout(() => {
      if (socket.destroyed) return;
      socket.write(frame(JSON.stringify({
        id: request.id || null,
        command,
        raw,
        status: step.status || 'OK',
        done: true,
        finishedAt: Date.now()
      })));
    }, CHUNK_DELAY_MS * chunks.length);
  });

  socket.on('close', () => console.log('[OBD Replay] Mobile disconnected'));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      service: 'autopulse-obd-replay',
      port: PORT,
      fixturePath: FIXTURE_PATH,
      fixtureLoaded: Boolean(replayCatalog),
      chunkDelayMs: CHUNK_DELAY_MS
    }));
    return;
  }

  if (req.url === '/command' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const request = JSON.parse(body || '{}');
      const command = request.command;
      const step = replayStepFor(command);
      const chunks = step.rawChunks?.length ? step.rawChunks : [step.rawResponse || ''];
      const raw = chunks.join('');
      console.log(`[OBD Replay HTTP] ${command} => ${chunks.length} chunks ${JSON.stringify(raw)}`);

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        id: request.id || null,
        command,
        raw,
        chunks,
        status: step.status || 'OK',
        finishedAt: Date.now()
      }));
    } catch (error) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Invalid replay request' }));
    }
    return;
  }

  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('AutoPulse OBD Replay Server\nHTTP: POST /command\nWebSocket: /obd\nHealth: /health\n');
});

server.on('upgrade', (req, socket) => {
  if (req.url !== '/obd') {
    socket.destroy();
    return;
  }
  handleWs(socket, req);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[OBD Replay] Listening on port ${PORT}`);
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        console.log(`[OBD Replay] Mobile URL: ws://${entry.address}:${PORT}/obd`);
      }
    }
  }
});
