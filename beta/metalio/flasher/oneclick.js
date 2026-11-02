// 页屿 PageIsle · Metalio S31 一键刷机（操作流程与 Pico 一致）
// 使用 esptool-js 0.7.1（官方支持 ESP32-S31）；只写应用分区和 OTA 选择区，不擦除书籍/设置。
import { ESPLoader, Transport } from './esptool-js.js';

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
  const box = $('dlg-log');
  if (!box) return;
  const line = String(text).replace(/\s+$/, '');
  if (!line) return;
  box.textContent += line + '\n';
  box.scrollTop = box.scrollHeight;
}
function setStatus(text, kind) {
  const node = $('dlg-status');
  node.textContent = text;
  node.style.color = kind === 'error' ? '#8a2b1d' : kind === 'ok' ? '#2e5a45' : '#4a4133';
}
const terminal = {
  clean() { const box = $('dlg-log'); if (box) box.textContent = ''; },
  writeLine(data) { log(data); },
  write(data) { log(data); },
};
function setBusy(value) {
  busy = value;
  $('dlg-cancel').disabled = value;
  $('dlg-close').hidden = value;
}
async function disconnect() {
  try { if (transport) await transport.disconnect(); } catch (ignored) {}
  transport = null; loader = null; port = null;
}
async function digest(data) {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function loadImage(image) {
  setStatus('正在读取并校验' + image.label + '…');
  const response = await fetch(image.url, { cache: 'no-store' });
  if (!response.ok) throw new Error('下载失败：' + image.url + '（HTTP ' + response.status + '）');
  const data = new Uint8Array(await response.arrayBuffer());
  if (data.length !== image.size) throw new Error(image.label + ' 大小不符：' + data.length + ' / ' + image.size);
  if (await digest(data) !== image.sha256) throw new Error(image.label + ' sha256 校验失败，已停止（未写入任何数据）。');
  log(image.label + ' 校验通过 ' + data.length + ' B');
  return data;
}
async function connectForInstall() {
  if (!('serial' in navigator)) {
    setStatus('当前浏览器不支持 Web Serial：请用电脑版 Chrome 或 Edge。', 'error');
    return;
  }
  if (busy || loader) return;
  setBusy(true);
  try {
    setStatus('请选择设备串口（USB 连接线）…');
    port = await navigator.serial.requestPort();
    transport = new Transport(port, true);
    loader = new ESPLoader({ transport, baudrate: 460800, romBaudrate: 115200, terminal });
    setStatus('正在连接并识别芯片…');
    const chip = await loader.main();
    log('检测到芯片: ' + chip);
    if (chip !== EXPECTED_CHIP) {
      throw new Error('检测到 ' + chip + '，这不是 Metalio S31；已停止，未写入任何数据。');
    }
    $('dlg-device').textContent = '已连接：' + chip + '（Metalio S31）';
    $('dlg-install').disabled = false;
    $('dlg-install').hidden = false;
    setStatus('设备已就绪，点「开始刷入」写入固件。', 'ok');
  } catch (error) {
    setStatus('连接失败：' + ((error && error.message) || error) +
      '。若设备没有响应：断开 USB，按住电源键/BOOT 组合再插线，重新打开一键刷机。', 'error');
    log('连接失败: ' + error);
    await disconnect();
    $('dlg-install').disabled = true;
  } finally {
    setBusy(false);
  }
}
async function install() {
  if (!loader || busy) return;
  setBusy(true);
  $('dlg-install').disabled = true;
  $('dlg-progress').value = 0;
  $('dlg-progress-label').textContent = '0%';
  try {
    const app = await loadImage(APP_IMAGE);
    const ota = await loadImage(OTA_IMAGE);
    setStatus('正在写入 Flash…');
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
        $('dlg-progress').value = percent;
        $('dlg-progress-label').textContent = percent + '%（' + (fileIndex === 0 ? 'OTA 选择区' : '应用镜像') + '）';
      },
    });
    $('dlg-progress').value = 100;
    $('dlg-progress-label').textContent = '100%';
    setStatus('刷入完成，正在复位设备…', 'ok');
    try { await loader.after('hard_reset'); } catch (ignored) { log('复位命令未确认，请手动断电重启。'); }
    setStatus('升级完成：设备应重启进入固件。若没有重启，请手动断电再开机。', 'ok');
    $('dlg-close').hidden = false;
    $('dlg-install').hidden = true;
    await disconnect();
  } catch (error) {
    setStatus('升级失败：' + ((error && error.message) || error) +
      '。设备可能仍在下载模式；可重试，或用 TF 卡升级包回刷。', 'error');
    log('升级失败: ' + error);
    $('dlg-install').disabled = false;
  } finally {
    setBusy(false);
  }
}
function openDialog() {
  const dialog = $('install-dialog');
  if (!dialog) return;
  $('dlg-device').textContent = '等待选择设备…';
  $('dlg-status').textContent = '请选择设备串口…';
  $('dlg-status').style.color = '#4a4133';
  $('dlg-log').textContent = '';
  $('dlg-progress').value = 0;
  $('dlg-progress-label').textContent = '0%';
  $('dlg-install').hidden = true;
  $('dlg-install').disabled = true;
  $('dlg-close').hidden = true;
  $('dlg-cancel').hidden = false;
  dialog.showModal();
  connectForInstall();
}
async function closeDialog() {
  if (busy) return;
  await disconnect();
  $('install-dialog').close();
}
window.addEventListener('DOMContentLoaded', () => {
  const trigger = $('oneclick');
  if (trigger) trigger.addEventListener('click', openDialog);
  const installButton = $('dlg-install');
  if (installButton) installButton.addEventListener('click', install);
  const cancel = $('dlg-cancel');
  if (cancel) cancel.addEventListener('click', closeDialog);
  const close = $('dlg-close');
  if (close) close.addEventListener('click', closeDialog);
  const dialog = $('install-dialog');
  if (dialog) dialog.addEventListener('cancel', (event) => { if (busy) event.preventDefault(); });
});
