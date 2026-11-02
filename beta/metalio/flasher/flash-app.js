// 备用：独立刷机页（两步式），主页面已使用一键式流程。
import { ESPLoader, Transport } from './flasher/esptool-js.js';
const APP_IMAGE = {
  url: './firmware/Metalio-S31-update.bin',
  address: 0x10000,
  size: 5004960,
  sha256: 'd5dfc25f624edb7181af893ca036d5eb24d9ef73f4e9bd7110c1d0d57bf9d171',
  label: '应用镜像（App）',
};
const OTA_IMAGE = {
  url: './firmware/ota_data_initial.bin',
  address: 0xd000,
  size: 8192,
  sha256: '7d2c7ac4888bfd75cd5f56e8d61f69595121183afc81556c876732fd3782c62f',
  label: 'OTA 选择区',
};
const EXPECTED_CHIP = 'ESP32-S31';

const $ = (id) => document.getElementById(id);
let port = null, transport = null, loader = null, busy = false;
function log(text) { const box = $('log'); box.textContent += String(text) + '\n'; box.scrollTop = box.scrollHeight; }
function setStatus(text, kind) { const node = $('status'); node.textContent = text; node.style.color = kind === 'error' ? '#8a2b1d' : kind === 'ok' ? '#2e5a45' : '#4a4133'; }
const terminal = { clean() { $('log').textContent = ''; }, writeLine(data) { log(data); }, write(data) { log(data); } };
function setBusy(value) { busy = value; $('connect').disabled = value || !!loader; $('flash').disabled = value || !loader; $('disconnect').disabled = value || !transport; }
async function digest(data) { const hash = await crypto.subtle.digest('SHA-256', data); return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join(''); }
async function loadImage(image) { setStatus('读取' + image.label + '…'); const response = await fetch(image.url, { cache: 'no-store' }); if (!response.ok) throw new Error('下载失败'); const data = new Uint8Array(await response.arrayBuffer()); if (data.length !== image.size) throw new Error('大小不符'); if (await digest(data) !== image.sha256) throw new Error('sha256 校验失败'); return data; }
async function connect() { if (!('serial' in navigator)) { setStatus('请用 Chrome/Edge 桌面版', 'error'); return; } setBusy(true); try { port = await navigator.serial.requestPort(); transport = new Transport(port, true); loader = new ESPLoader({ transport, baudrate: 460800, romBaudrate: 115200, terminal }); const chip = await loader.main(); if (chip !== EXPECTED_CHIP) throw new Error('检测到 ' + chip + '，不是 Metalio S31'); setStatus('已连接 Metalio S31，可以开始升级。', 'ok'); } catch (error) { setStatus('连接失败：' + error, 'error'); try { if (transport) await transport.disconnect(); } catch (ignored) {} transport = null; loader = null; port = null; } finally { setBusy(false); } }
async function flash() { if (!loader || busy) return; setBusy(true); try { const app = await loadImage(APP_IMAGE); const ota = await loadImage(OTA_IMAGE); await loader.writeFlash({ fileArray: [{ data: ota, address: OTA_IMAGE.address }, { data: app, address: APP_IMAGE.address }], flashMode: 'dio', flashFreq: '80m', flashSize: 'keep', eraseAll: false, compress: true, reportProgress: (i, w, t) => { const p = t ? Math.round(w / t * 100) : 0; $('progress').value = p; $('progress-label').textContent = p + '%'; } }); try { await loader.after('hard_reset'); } catch (ignored) {} setStatus('升级完成。', 'ok'); } catch (error) { setStatus('升级失败：' + error, 'error'); } finally { setBusy(false); } }
async function disconnect() { if (busy) return; setBusy(true); try { if (transport) await transport.disconnect(); } catch (ignored) {} transport = null; loader = null; port = null; setStatus('已断开。'); setBusy(false); }
window.addEventListener('DOMContentLoaded', () => { $('connect').addEventListener('click', connect); $('flash').addEventListener('click', flash); $('disconnect').addEventListener('click', disconnect); setBusy(false); });
