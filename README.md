# 页屿 PageIsle · 固件 / 刷机站 / 源码 / 指南

这是页屿 PageIsle（RDP-G01-W · ESP32-S3 · 16 MB flash）的**唯一仓库**，同时承担：

- **刷机站**：本仓库根目录就是 GitHub Pages 站点，浏览器打开
  <https://aleksandrov-eink.github.io/pageisle/> 可直接用 Web Serial 刷机（Chrome / Edge 89+）。
- **正式版下载**：TF 卡升级镜像、完整交接包、全部源码与中文指南都在 `downloads/`。
- **版本与校验**：以本仓库 `firmware/SHA256SUMS.txt` 与本文件记录的 sha256 为准。

## 当前正式版

- **页屿系统 1.15.52**（2026-11-01），上游 kiikoread 0.3.3-rc99 应用层定制
- 应用镜像：`3,685,648` 字节，ota_0 余量 `508,656` 字节
- sha256：`09c56a67c1cef23603c8e9d8f43dbe06aaa8398bd30b8f0a34db76ddbb07c515`
- 固件文件：`firmware/Pico-update.bin`（TF 卡升级）；`firmware/firmware.bin` 等为 USB 整包分段
- 升级指南：`downloads/改版日志与刷机指南.md`；功能与设置：`downloads/使用说明.txt`

## 本轮更新（1.15.50 → 1.15.52）

- 运行内存削峰：40 个非热路径静态数组（波形裁剪工作区、TTF 字体槽、首页/书架/文件/云界面缓存、
  波形/显示 LUT 等，约 81.5 KiB）搬到 PSRAM；内部 SRAM 静态占用 259,511 B（75.93%）→
  **177,943 B（52.07%）**，静态空闲 163,817 B，每个界面都留出 ≥20% 余量；
- 新增「内存诊断」页（设置 → 升级和恢复 → 内存诊断）：显示内部 SRAM/PSRAM 当前占用与启动基线，
  按峰值列出每个界面的内部 RAM 占用%（>80% 标 !），可重置；离开页面写 TF 卡 pageisle_ram_diag.log；
- 修复大量 EPUB2 书籍没有真实封面：封面提取不再要求 manifest 的 properties 属性，支持
  <meta name="cover">（id 或 href、忽略大小写）与 EPUB3 cover-image，并增加「文件名/ID 含 cover 的
  图片」兜底；封面缓存版本 +1，升级后自动重建（用户书库 114 本中 94 本受此影响）；
- 其余与 1.15.50 相同（文件管理跟随 rc103、书架封面速度/回退修复、水波纹·高清校准、瘦身、
  液态玻璃书架、WebP/渐进 JPEG）。

## 仓库目录

```
index.html                刷机站首页（纯静态，esp-web-tools 已内置）
firmware/                 固件与 ESP Web Tools manifest、SHA256SUMS
downloads/                源码包、完整交接包、TF 卡镜像、中文指南
docs/                     使用说明、刷机指南、变更清单（站点内副本）
assets/ promo 图           站点宣传图
web-flasher/              内置的 esp-web-tools 静态资源（不依赖 CDN）
beta/                     隐藏内测通道（5 次点击标志可见）
```

## TF 卡本地升级（推荐）

1. 把 `downloads/Pico-update-1.15.52.bin` 复制到 TF 卡根目录（FAT32）。
2. 设备开机后在「设置 → 升级和恢复」里选择本地升级/从 TF 卡升级（不同版本菜单名略有差异）。
3. 升级只写应用镜像分区，书、设置与阅读记录保留；升级完可在「更新说明」看到本版条目。

## 源码构建

- 工具链：**ESP-IDF v6.1**，目标 `esp32s3`。
- 解压 `downloads/PageIsle-1.15.52-source.zip`，在工程根目录执行：
  ```
  idf.py set-target esp32s3
  idf.py build
  ```
- 产物：`build/Read_Pico.bin`（应用镜像）、`build/bootloader/bootloader.bin`、`build/partition_table/partitions.bin`。
- 分区表、引导程序与 OTA 元数据布局与上游 kiikoread 官方一致，未改动。

## 版本历史与说明

- 本仓库从 1.15.8 起持续迭代：深色白闪修复、偶发整屏缺字兜底、坚果云联网前内存门控、反色到页
  黑闪整屏清理、主页滑动/设置界面/阅读工具栏菜单/横屏阅读自动去残影、小游戏进页全刷与分数叠影修复。
- 1.15.18–1.15.44：深睡唤醒小锁界面、反黑算法恢复（逐页压黑+整屏 GC16 复位）、浅色淡墨/残影治理、
  阅读页插图去边框并按阅读边距居中缩放、书架删除/最近阅读修复、WiFi 传书/蓝牙翻页器修复、
  面板文字抗锯齿修复、文件页黑块修复、EPUB 二级目录缩进与 h2 自动分页、书内 CSS 字号、
  防褪色只推白、翻页清残影低频整屏 GC16、改名后标题同步、开机每 6 小时自动 WiFi 对时。
- **1.15.51–1.15.52**：内部 SRAM 静态占用 75.9% → 52%（静态数组搬 PSRAM）+ 内存诊断页；
  修复 EPUB2 书籍封面识别（书库中大多数书恢复书内真实封面）。
- **1.15.45–1.15.50**：瘦身第一批、显示算法跟随上游 rc103、液态玻璃书架、WebP/渐进 JPEG 图片栈、
  文件管理跟随 rc103（递归搜索/网格视图/多选/批量/统计/排序）、无封面书籍自动封面跟随系统字体、
  书架封面速度与个别 EPUB 封面消失修复。
- 每一版的改动与真机注意事项见 `downloads/改版日志与刷机指南.md`（含 1.12.0 起的系统版本线）。
- 相对上游 rc99 的逐项改动见 `downloads/变更清单-从原始版到最终版.md`。

## 许可与致谢

- 固件基于 **kiikoread 0.3.3-rc99**（并移植了上游 rc100–rc103 的部分功能）做应用层定制，
  按其原有许可发布；仓库内保留上游许可与第三方声明（`THIRD_PARTY_NOTICES.md`）。
- 刷机能力来自 [esp-web-tools](https://github.com/esphome/esp-web-tools) 与 esptool-js
  （© Espressif Systems，Apache-2.0），已内置在本仓库。
- 图标来自 Lucide（ISC）。
- 每次发布只做过编译/validate/静态分析与真机观感对照；没有真机测试记录被当作已验证结论。

> 本仓库的固件为个人定制版本，刷机有风险；请确认设备型号并优先使用 TF 卡升级。所有校验值都是本仓库构建产物。
