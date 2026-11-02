// 页屿 PageIsle · Metalio S31 浏览器一键升级
// 使用 esptool-js 0.7.1（官方支持 ESP32-S31）。只写应用分区与 OTA 选择区，不擦除 NVS/书籍。
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

function log(text) {
  const box = $('log');
  const line = String(text).replace(/\s+$/, '');
  if (!line) return;
  box.textContent += line + '\n';
  box.scrollTop = box.scrollHeight;
}
function setStatus(text, kind) {
  const node = $('status');
  node.textContent = text;
  node.style.color = kind === 'error' ? '#8a2b1d' : kind === 'ok' ? '#2e5a45' : '#4a4133';
}
const terminal = {
  clean() { $('log').textContent = ''; },
  writeLine(data) { log(data); },
  write(data) { log(data); },
};
function setBusy(value) {
  busy = value;
  $('connect').disabled = value || !!loader;
  $('flash').disabled = value || !loader;
  $('disconnect').disabled = value || !transport;
}
async function digest(data) {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function loadImage(image, progressLabel) {
  setStatus('读取' + image.label + '…');
  const response = await fetch(image.url, { cache: 'no-store' });
  if (!response.ok) throw new Error('下载失败：' + image.url + '（HTTP ' + response.status + '）');
  const buffer = await response.arrayBuffer();
  const data = new Uint8Array(buffer);
  if (data.length !== image.size) throw new Error(image.label + ' 大小不符：' + data.length + ' / ' + image.size);
  setStatus('校验' + image.label + 'sha256…');
  const actual = await digest(data);
  if (actual !== image.sha256) throw new Error(image.label + ' sha256 校验失败，已停止。');
  log(progressLabel + ' OK ' + data.length + ' B');
  return data;
}
async function connect() {
  if (!('serial' in navigator)) {
    setStatus('当前浏览器不支持 Web Serial：请用电脑版 Chrome 或 Edge。', 'error');
    return;
  }
  if (busy) return;
  setBusy(true);
  try {
    setStatus('请选择设备串口（USB 连接线）…');
    port = await navigator.serial.requestPort();
    transport = new Transport(port, true);
    loader = new ESPLoader({
      transport,
      baudrate: 460800,
      romBaudrate: 115200,
      terminal,
    });
    setStatus('正在连接并识别芯片（必要时设备可能自动复位）…');
    const chip = await loader.main();
    log('检测到芯片: ' + chip);
    if (chip !== EXPECTED_CHIP) {
      throw new Error('检测到 ' + chip + '，这不是 Metalio S31；已停止，未写入任何数据。');
    }
    setStatus('已连接 Metalio S31（ESP32-S31），可以开始升级。', 'ok');
    setBusy(false);
  } catch (error) {
    setStatus('连接失败：' + (error && error.message ? error.message : error) +
      '。若设备没有响应：断开 USB，按住设备电源键/BOOT 组合再插线，然后重新连接。', 'error');
    log('连接失败: ' + error);
    try { if (transport) await transport.disconnect(); } catch (ignored) {}
    transport = null; loader = null; port = null; setBusy(false);
  }
}
async function flash() {
  if (!loader || busy) return;
  if (!confirm('将写入 Metalio S31 的应用分区与 OTA 选择区（不擦除书籍和设置）。\n\n刷入过程中不要断电、不要拔线。确认继续？')) return;
  setBusy(true);
  try {
    const app = await loadImage(APP_IMAGE, '应用镜像');
    const ota = await loadImage(OTA_IMAGE, 'OTA 选择区');
    setStatus('准备写入 Flash…');
    $('progress').value = 0;
    await loader.writeFlash({
      fileArray: [
        { data: ota, address: OTA_IMAGE.address },
        { data: app, address: APP_IMAGE.address },
      ],
      flashMode: 'dio',
      flashFreq: '80m',
      flashSize: 'keep',
      eraseAll: false,
      compress: true,
      reportProgress: (fileIndex, written, total) => {
        const percent = total ? Math.round((written / total) * 100) : 0;
        $('progress').value = percent;
        $('progress-label').textContent = percent + '%（' + (fileIndex === 0 ? 'OTA 选择区' : '应用镜像') + '）';
      },
    });
    $('progress').value = 100;
    $('progress-label').textContent = '100%';
    setStatus('刷入完成，正在复位设备…', 'ok');
    try { await loader.after('hard_reset'); } catch (ignored) { log('复位命令未确认，请手动断电重启。'); }
    setStatus('升级完成：设备应重启进入新版固件。若没有重启，请手动断电再开机。', 'ok');
  } catch (error) {
    setStatus('升级失败：' + (error && error.message ? error.message : error) +
      '。设备可能仍在下载模式；可重试，或用 TF 卡升级包回刷。', 'error');
    log('升级失败: ' + error);
  } finally {
    setBusy(false);
  }
}
async function disconnect() {
  if (busy) return;
  setBusy(true);
  try { if (transport) await transport.disconnect(); } catch (ignored) {}
  transport = null; loader = null; port = null;
  setStatus('已断开连接。');
  setBusy(false);
}
window.addEventListener('DOMContentLoaded', () => {
  $('connect').addEventListener('click', connect);
  $('flash').addEventListener('click', flash);
  $('disconnect').addEventListener('click', disconnect);
  setBusy(false);
});
