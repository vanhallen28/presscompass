// Stand-in for Cloudinary under /fake-cloudinary: signed direct uploads (multipart), the Admin API
// resource read, signed destroy, and image delivery. It checks signatures exactly like Cloudinary,
// so a wrong signature in the app fails the E2E tests. Images live in memory for the run.
import { createHash } from 'node:crypto';

export const FAKE_KEY = process.env.FAKE_CLOUDINARY_KEY ?? 'fake-key';
export const FAKE_SECRET = process.env.FAKE_CLOUDINARY_SECRET ?? 'fake-secret';
const PREFIX = '/fake-cloudinary';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
const TYPES = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif' };

const assets = new Map();

function sign(params) {
  const serialized = Object.keys(params)
    .filter((key) => params[key] !== '' && params[key] !== undefined)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1').update(serialized + FAKE_SECRET).digest('hex');
}

/** Format and size from the file header (PNG, JPEG, GIF, WebP VP8X), or null. */
function probe(bytes) {
  if (bytes.length > 24 && bytes.readUInt32BE(0) === 0x89504e47) return { format: 'png', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (bytes.length > 10 && bytes.toString('ascii', 0, 4) === 'GIF8') return { format: 'gif', width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  if (bytes.length > 30 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 16) === 'WEBPVP8X') {
    return { format: 'webp', width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) return null;
      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { format: 'jpg', height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  return null;
}

const resourceJson = (publicId, asset) => ({
  public_id: publicId,
  format: asset.format,
  version: asset.version,
  resource_type: 'image',
  type: 'upload',
  width: asset.width,
  height: asset.height,
  bytes: asset.bytes,
  secure_url: `https://res.cloudinary.com/demo/image/upload/v${asset.version}/${publicId}.${asset.format}`,
});

async function upload(req, raw, send) {
  const form = await new Request('http://fake/upload', { method: 'POST', headers: { 'content-type': req.headers['content-type'] }, body: raw }).formData();
  const fields = {};
  let file = null;
  for (const [key, value] of form.entries()) {
    if (key === 'file') file = value;
    else fields[key] = String(value);
  }
  const { api_key: apiKey, signature, ...signed } = fields;
  if (apiKey !== FAKE_KEY) return send(401, { error: { message: 'Unknown API key' } });
  if (signature !== sign(signed)) return send(401, { error: { message: `Invalid Signature ${signature}. String to sign - '${Object.keys(signed).sort().map((k) => `${k}=${signed[k]}`).join('&')}'.` } });
  if (Math.abs(Date.now() / 1000 - Number(signed.timestamp)) > 3600) return send(400, { error: { message: 'Stale request' } });
  if (!file || typeof file === 'string') return send(400, { error: { message: 'Missing required parameter - file' } });
  const bytes = Buffer.from(await file.arrayBuffer());
  const found = probe(bytes);
  if (!found) return send(400, { error: { message: 'Invalid image file' } });
  if (signed.allowed_formats && !signed.allowed_formats.split(',').includes(found.format)) {
    return send(400, { error: { message: `Image format ${found.format} not allowed` } });
  }
  const publicId = signed.public_id;
  if (assets.has(publicId) && signed.overwrite === 'false') return send(200, { ...resourceJson(publicId, assets.get(publicId)), existing: true });
  let { width, height } = found;
  const limit = /c_limit,w_(\d+)/.exec(signed.transformation ?? '');
  if (limit && width > Number(limit[1])) {
    height = Math.round((height * Number(limit[1])) / width);
    width = Number(limit[1]);
  }
  const asset = { format: found.format, width, height, bytes: bytes.length, data: bytes, version: Math.floor(Date.now() / 1000) };
  assets.set(publicId, asset);
  send(200, { ...resourceJson(publicId, asset), signature: sign({ public_id: publicId, version: String(asset.version) }) });
}

/** Handles /fake-cloudinary/* requests. Returns false for other paths. */
export async function handleCloudinary(req, url, raw, res) {
  if (!url.pathname.startsWith(PREFIX)) return false;
  const send = (status, body, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', ...CORS, ...headers });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };
  const path = url.pathname.slice(PREFIX.length);
  if (req.method === 'OPTIONS') return send(204), true;

  let match;
  if (req.method === 'POST' && (match = /^\/v1_1\/[^/]+\/image\/upload$/.exec(path))) {
    await upload(req, raw, send);
  } else if (req.method === 'GET' && (match = /^\/v1_1\/[^/]+\/resources\/image\/upload\/(.+)$/.exec(path))) {
    if (req.headers.authorization !== `Basic ${Buffer.from(`${FAKE_KEY}:${FAKE_SECRET}`).toString('base64')}`) {
      send(401, { error: { message: 'Invalid credentials' } });
    } else {
      const publicId = match[1].split('/').map(decodeURIComponent).join('/');
      const asset = assets.get(publicId);
      if (asset) send(200, resourceJson(publicId, asset));
      else send(404, { error: { message: `Resource not found - ${publicId}` } });
    }
  } else if (req.method === 'POST' && /^\/v1_1\/[^/]+\/image\/destroy$/.test(path)) {
    const fields = Object.fromEntries(new URLSearchParams(raw.toString()));
    const { api_key: apiKey, signature, ...signed } = fields;
    if (apiKey !== FAKE_KEY || signature !== sign(signed)) send(401, { error: { message: 'Invalid Signature' } });
    else send(200, { result: assets.delete(signed.public_id) ? 'ok' : 'not found' });
  } else if (req.method === 'GET' && path === '/__assets') {
    send(200, [...assets.keys()]);
  } else if (req.method === 'GET' && (match = /^\/[^/]+\/image\/upload\/(.+)$/.exec(path))) {
    const segments = match[1].split('/');
    if (segments[0].includes(',') || /^[a-z]{1,2}_/.test(segments[0])) segments.shift();
    const asset = assets.get(segments.map(decodeURIComponent).join('/'));
    if (!asset) send(404, { error: { message: 'Not found' } });
    else {
      res.writeHead(200, { 'content-type': TYPES[asset.format], 'cache-control': 'public, max-age=60', ...CORS });
      res.end(asset.data);
    }
  } else {
    send(404, { error: { message: `Fake Cloudinary has no route for ${req.method} ${path}` } });
  }
  return true;
}
