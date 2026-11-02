# 页屿 PageIsle 刷机站 · 部署说明

这是一个**纯静态**站点：没有后端、没有构建步骤、不依赖 CDN。
刷机能力由内置的 [esp-web-tools](https://github.com/esphome/esp-web-tools) 提供（浏览器 Web Serial 直刷 ESP32-S3），
固件用 ESP Web Tools 标准的 `firmware/manifest.json` 描述。

## 一、目录

```
site/
├─ index.html                  # 首页：一键刷机 + 功能介绍 + 下载 + FAQ
├─ style.css
├─ favicon.svg
├─ .nojekyll                   # 让 GitHub Pages 不做 Jekyll 处理
├─ web-flasher/                # 内置 esp-web-tools 10.0.0（13 个 js，共 428 KB）
├─ firmware/
│  ├─ manifest.json            # ESP Web Tools 刷机清单（4 个分区镜像与偏移）
│  ├─ bootloader.bin   @0x0
│  ├─ partitions.bin   @0x8000
│  ├─ firmware.bin     @0x10000   ← 页屿应用镜像（3.6 MB）
│  ├─ ota_data_initial.bin @0xd10000
│  ├─ Pico-update.bin          # TF 卡本地升级镜像（与 firmware.bin 逐字节一致）
│  └─ SHA256SUMS.txt
├─ docs/                       # 使用说明 / 改版日志 / 变更清单（Markdown 与 txt 原样下载）
└─ assets/                     # 宣传图（头图 + 新增/优化/删去三页）
```

## 二、发布到 GitHub Pages（纯网页操作，不需要命令行）

1. 登录 GitHub → 右上角 **+** → **New repository**：
   - 仓库名任意，例如 `pageisle-flash`；
   - 选 **Public**（GitHub Pages 免费版需要公开仓库，除非你有 Pro）；
   - **不要**勾选 “Add a README file”；
   - 点 **Create repository**。
2. 进入空仓库 → **Add file** → **Upload files**：
   - 把本目录 `site/` 里的**所有内容**（不是外层文件夹）拖进上传区；
   - 浏览器一次最多 100 个文件，这里是 25 个左右，够用；
   - 底部填提交说明（例如 `页屿 PageIsle 刷机站`），点 **Commit changes**。
3. 仓库 **Settings** → 左侧 **Pages**：
   - **Source** 选 **Deploy from a branch**；
   - **Branch** 选 `main`，目录选 **/ (root)**；点 **Save**。
4. 等 1–2 分钟，刷新 Pages 页面，会给出地址：
   `https://<你的用户名>.github.io/pageisle-flash/`
   打开即用（github.io 自带 HTTPS，满足 Web Serial 的安全上下文要求）。
5. 以后更新固件：替换 `firmware/` 下的 bin 与 `manifest.json`，并同步更新首页里的大小 / sha256 文案，提交即可。

> 如果仓库是私有的，Pages 需要 GitHub Pro；也可以直接把站点的 zip 拖到 [Netlify Drop](https://app.netlify.com/drop) 得到临时 HTTPS 地址，用于测试。

## 三、本地预览

```bash
cd site
python -m http.server 8000
# 打开 http://localhost:8000
```

`localhost` 属于安全上下文，同样可以使用 Web Serial；但**必须**用这个本地服务器，直接双击 `index.html`（file://）不行。

## 四、刷机页面的工作方式

- `index.html` 里的 `<esp-web-install-button manifest="firmware/manifest.json">` 是 esp-web-tools 的自定义元素；
- 点击后：请求串口 → 探测芯片（必须 ESP32-S3）→ 写 `manifest.json` 里四个 part（各自偏移）→ 复位；
- **`new_install_prompt_erase: true` 必须保持为 true**：esp-web-tools 的语义是
  「true = 弹窗询问（复选框默认不勾选）；false = 不询问、直接整片擦除」。
  早期本站点误写成 false，导致安装流程静默执行 `ESP_ERASE_FLASH`，
  把 NVS（设置、阅读进度、阅读统计）和内部 FAT 分区一并擦掉。改成 true 后，
  弹窗里保持 Erase device 不勾选、直接点 Next 即为“只写分区、不擦数据”；
- 页面上的确认复选框只是本地开关（未勾选时刷机按钮禁用），不参与协议；
- 不需要驱动或本地工具；设备端口是 USB-Serial-JTAG 时，esp-web-tools 会自动用对应的复位方式；
- **日常固件更新建议走 TF 卡本地升级**（设置 → 升级和恢复 → 系统升级），完全不擦除，风险最低。

## 五、界面语言

`web-flasher/` 里的厂商构建已做**中文化**：按钮（下一步 / 返回 / 跳过 / 关闭 / 重试 / 连接）、
标题（确认刷机 / 正在刷写 / 刷机完成 / 刷机失败 / 出错了）、进度（正在准备 / 正在擦除 / 正在写入 N%）、
擦除确认页、以及“没有选择串口”帮助页全部为中文。`localize_ewt.py` 是生成脚本，
改文案后重跑它并重新生成本站点即可。原 bundle 里剩余的英文只出现在串口日志（开发信息）中。

## 六、许可与出处

- 固件：基于上游 kiikoread 0.3.3-rc99 的应用层定制，Apache-2.0；
- 刷机组件：esp-web-tools / esptool-js，© Espressif Systems，Apache-2.0
  （`web-flasher/` 为官方构建的本地副本，仅做了界面文案中文化，见 `THIRD_PARTY_NOTICES.md`）；
- 图标：Lucide（ISC）；
- 站点本身可自由修改与再发布，保留出处即可。
