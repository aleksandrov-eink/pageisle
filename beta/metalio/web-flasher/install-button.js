// 页屿 PageIsle · 设备内测安装按钮（ESP32-S31 / Metalio S31）
// 页面结构与 Pico 内测页完全一致：<esp-web-install-button manifest="firmware/manifest.json">；
// 这里用 esptool-js 0.7.1（官方支持 ESP32-S31）实现同样的"点按钮 → 选串口 → 安装"流程。
// 不在这里静态 import 316 KB 的 esptool-js：静态 import 失败会让整个自定义元素加载失败，
// 页面上的 slot 文案就会原样显示成“不支持”。真正刷机时再动态 import。
const MODAL_ID = 'pageisle-install-dialog';
let active = null;

function styleOnce() {
  if (document.getElementById('pageisle-flasher-style')) return;
  const style = document.createElement('style');
  style.id = 'pageisle-flasher-style';
  style.textContent = `
    #${MODAL_ID}{position:fixed;inset:0;background:rgba(30,26,18,.55);display:none;align-items:center;justify-content:center;z-index:9999;padding:16px}
    #${MODAL_ID}.open{display:flex}
    #${MODAL_ID} .box{max-width:720px;width:100%;background:#fbf8f0;color:#3f382c;border:1px solid #b9a98a;border-radius:14px;padding:18px 20px;box-shadow:0 18px 50px rgba(0,0,0,.25)}
    #${MODAL_ID} h2{margin:0 0 8px}
    #${MODAL_ID} .status{padding:10px 12px;border-radius:8px;background:#f3eee1;margin:10px 0}
    #${MODAL_ID} progress{width:100%;height:14px}
    #${MODAL_ID} pre{max-height:170px;overflow:auto;background:#1f241f;color:#d8e6cf;padding:10px;border-radius:8px;font-size:12px;white-space:pre-wrap}
    #${MODAL_ID} .row{display:flex;gap:10px;justify-content:flex-end;margin-top:8px}
    #${MODAL_ID} button{padding:10px 16px;border:0;border-radius:8px;cursor:pointer}
    #${MODAL_ID} .cancel{background:#e6ddc8}
    #${MODAL_ID} .install{background:#8a5a2b;color:#fff8ec}
    #${MODAL_ID} .close{background:#2e5a45;color:#f6f2e7}
    #${MODAL_ID} button:disabled{opacity:.45;cursor:not-allowed}
  `;
  document.head.appendChild(style);
}

function createModal() {
  styleOnce();
  let root = document.getElementById(MODAL_ID);
  if (root) return root;
  root = document.createElement('div');
  root.id = MODAL_ID;
  root.innerHTML = `<div class="box">
    <h2>安装页屿 PageIsle</h2>
    <div class="device" style="font-size:13px;color:#6a5f4c"></div>
    <div class="status">正在准备…</div>
    <progress value="0" max="100"></progress>
    <p class="pct" style="font-size:12px;color:#6a5f4c;margin:4px 0">0%</p>
    <pre class="log"></pre>
    <p style="font-size:12px;color:#6a5f4c">本操作只写入应用分区、引导、分区表与 OTA 选择区，不擦除书籍、设置和存储卡；过程中不要断电。</p>
    <div class="row">
      <button type="button" class="cancel">取消</button>
      <button type="button" class="install" disabled>开始安装</button>
      <button type="button" class="close" hidden>完成</button>
    </div>
  </div>`;
  document.body.appendChild(root);
  root.querySelector('.cancel').addEventListener('click', () => {
    if (active && active.busy) return;
    if (active) active.abort();
  });
  root.querySelector('.close').addEventListener('click', () => {
    if (active) active.abort();
    root.classList.remove('open');
  });
  const install = root.querySelector('.install');
  install.addEventListener('click', () => { if (active) active.install(); });
  return root;
}

class PageIsleInstallButton extends HTMLElement {
  connectedCallback() {
    const activate = this.querySelector('[slot="activate"]');
    const unsupported = this.querySelector('[slot="unsupported"]');
    const notAllowed = this.querySelector('[slot="not-allowed"]');
    const serial = 'serial' in navigator;
    const secure = window.isSecureContext;
    // style.css 把 .unsupported/.not-allowed 固定成 display:block，仅设置 hidden 属性会被覆盖，
    // 所以这里同时写 inline display，确保支持 Web Serial 时不出现“不支持”提示。
    const show = (node, visible) => {
      if (!node) return;
      node.hidden = !visible;
      node.style.display = visible ? '' : 'none';
    };
    show(activate, serial && secure);
    show(unsupported, !serial);
    show(notAllowed, serial && !secure);
    if (!activate) return;
    activate.addEventListener('click', (event) => {
      event.preventDefault();
      if (active) return;
      active = new InstallSession(this, activate);
      active.start();
    });
  }
}

class InstallSession {
  constructor(host, button) {
    this.host = host;
    this.button = button;
    this.modal = createModal();
    this.busy = false;
    this.port = null;
    this.transport = null;
    this.loader = null;
    this.images = null;
    this.cancelled = false;
    this.modal.querySelector('.device').textContent = '';
    this.modal.querySelector('.status').textContent = '请选择设备串口…';
    this.modal.querySelector('.log').textContent = '';
    this.modal.querySelector('progress').value = 0;
    this.modal.querySelector('.pct').textContent = '0%';
    this.modal.querySelector('.install').hidden = false;
    this.modal.querySelector('.install').disabled = true;
    this.modal.querySelector('.close').hidden = true;
    this.modal.querySelector('.cancel').hidden = false;
  }
  setStatus(text, kind) {
    const node = this.modal.querySelector('.status');
    node.textContent = text;
    node.style.color = kind === 'error' ? '#8a2b1d' : kind === 'ok' ? '#2e5a45' : '#3f382c';
  }
  log(text) {
    const box = this.modal.querySelector('.log');
    box.textContent += String(text) + '\n';
    box.scrollTop = box.scrollHeight;
  }
  async start() {
    this.modal.classList.add('open');
    if (!('serial' in navigator)) {
      this.setStatus('当前浏览器不支持 Web Serial：请用电脑版 Chrome/Edge，并通过 https 打开本页。', 'error');
      return;
    }
    this.setStatus('正在打开串口选择框…');
    let portPromise;
    try {
      portPromise = navigator.serial.requestPort();
    } catch (error) {
      this.setStatus('无法打开串口选择框：' + ((error && error.message) || error), 'error');
      return;
    }
    try {
      this.port = await portPromise;
    } catch (error) {
      this.setStatus('未选择串口：' + ((error && error.message) || error), 'error');
      return;
    }
    this.setStatus('已选择串口，正在加载刷机组件…');
    let module;
    try {
      module = await import('./esptool-js.js');
    } catch (error) {
      this.setStatus('刷机组件加载失败：' + ((error && error.message) || error) + '，请刷新页面重试。', 'error');
      return;
    }
    try {
      this.transport = new module.Transport(this.port, true);
      this.loader = new module.ESPLoader({
        transport: this.transport,
        baudrate: 460800,
        romBaudrate: 115200,
        terminal: { clean: () => {}, writeLine: (line) => this.log(line), write: (line) => this.log(line) },
      });
      this.setStatus('正在连接并识别芯片…');
      const chip = await this.loader.main();
      this.log('检测到芯片: ' + chip);
      if (chip !== 'ESP32-S31') {
        throw new Error('检测到 ' + chip + '，这不是 Metalio S31；已停止，未写入任何数据。');
      }
      this.modal.querySelector('.device').textContent = '已连接：' + chip + '（Metalio S31）';
      const manifestUrl = this.host.getAttribute('manifest') || 'firmware/manifest.json';
      const response = await fetch(manifestUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error('读取安装清单失败（HTTP ' + response.status + '）');
      const manifest = await response.json();
      const build = (manifest.builds || [])[0];
      if (!build || !Array.isArray(build.parts) || !build.parts.length) throw new Error('安装清单没有可写入的分区');
      if (build.chipFamily && build.chipFamily !== 'ESP32-S31') throw new Error('安装清单芯片类型不匹配：' + build.chipFamily);
      this.images = [];
      for (const part of build.parts) {
        this.setStatus('正在读取 ' + part.path + '…');
        const fileResponse = await fetch(new URL(part.path, new URL(manifestUrl, location.href)).href, { cache: 'no-store' });
        if (!fileResponse.ok) throw new Error('下载 ' + part.path + ' 失败（HTTP ' + fileResponse.status + '）');
        this.images.push({ data: new Uint8Array(await fileResponse.arrayBuffer()), address: Number(part.offset) });
        this.log(part.path + ' 已读取，将写入 0x' + Number(part.offset).toString(16));
      }
      this.modal.querySelector('.install').disabled = false;
      this.setStatus('设备已就绪，点「开始安装」写入固件。', 'ok');
    } catch (error) {
      this.setStatus('连接失败：' + ((error && error.message) || error) +
        '。若设备没有响应：断开 USB，按住电源键/BOOT 组合再插线，然后重试。', 'error');
      this.log('连接失败: ' + error);
      await this.abort();
    }
  }
  async install() {
    if (!this.loader || !this.images || this.busy) return;
    this.busy = true;
    const installButton = this.modal.querySelector('.install');
    installButton.disabled = true;
    try {
      this.setStatus('正在写入 Flash…');
      await this.loader.writeFlash({
        fileArray: this.images,
        flashMode: 'dio',
        flashFreq: '80m',
        flashSize: 'keep',
        eraseAll: false,
        compress: true,
        reportProgress: (fileIndex, written, total) => {
          const percent = total ? Math.round((written / total) * 100) : 0;
          this.modal.querySelector('progress').value = percent;
          this.modal.querySelector('.pct').textContent = percent + '%';
        },
      });
      this.modal.querySelector('progress').value = 100;
      this.modal.querySelector('.pct').textContent = '100%';
      this.setStatus('刷入完成，正在复位设备…', 'ok');
      try { await this.loader.after('hard_reset'); } catch (ignored) { this.log('复位命令未确认，请手动断电重启。'); }
      this.setStatus('升级完成：设备应重启进入固件。若没有重启，请手动断电再开机。', 'ok');
      this.modal.querySelector('.close').hidden = false;
      installButton.hidden = true;
      await this.abort(false);
    } catch (error) {
      this.setStatus('升级失败：' + ((error && error.message) || error) + '。可重试，或用 TF 卡升级包回刷。', 'error');
      this.log('升级失败: ' + error);
      installButton.disabled = false;
    } finally {
      this.busy = false;
      active = null;
    }
  }
  async abort(close = true) {
    try { if (this.transport) await this.transport.disconnect(); } catch (ignored) {}
    this.transport = null;
    this.loader = null;
    if (close) {
      this.modal.classList.remove('open');
      active = null;
    }
  }
}

if (!customElements.get('esp-web-install-button')) {
  customElements.define('esp-web-install-button', PageIsleInstallButton);
}
