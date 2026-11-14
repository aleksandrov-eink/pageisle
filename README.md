# 页屿 PageIsle · 固件 / 刷机站 / 源码 / 指南

这是页屿 PageIsle（RDP-G01-W · ESP32-S3 · 16 MB flash）的**唯一仓库**，同时承担：

- **刷机站**：本仓库根目录就是 GitHub Pages 站点，浏览器打开
  <https://aleksandrov-eink.github.io/pageisle/> 可直接用 Web Serial 刷机（Chrome / Edge 89+）。
- **正式版下载**：TF 卡升级镜像、完整交接包、全部源码与中文指南都在 `downloads/`。
- **版本与校验**：以本仓库 `firmware/SHA256SUMS.txt` 与本文件记录的 sha256 为准。

## 当前正式版

- **页屿系统 1.15.77**（2026-11-14），上游 kiikoread 0.3.3-rc99 应用层定制
- 应用镜像：`3,714,016` 字节，ota_0 余量 `480,288` 字节（约 11.45%）
- sha256：`265720ec6d154f60c9b802252b7233c53c2c250b480773e717a12b3e1c4374ed`
- 固件文件：`firmware/Pico-update.bin`（TF 卡升级）；`firmware/firmware.bin` 等为 USB 整包分段
- 升级指南：`downloads/改版日志与刷机指南.md`；功能与设置：`downloads/使用说明.txt`

## 本轮更新（1.15.72 → 1.15.77）

- **蓝牙翻页器兼容性补丁**：针对「智联纵维」等标准 BLE HID 翻页器——Legacy Just Works 配对失败后自动改用
  LE Secure Connections + 身份密钥重试一次（宏 `BLE_PT_SEC_SC_FALLBACK` 默认开，可 `-D=0` 回退）；扫描列表不再
  隐藏没有广播名的 BLE 设备（显示「未命名」+ 地址）；无设备时提示让翻页器进入配对模式（指示灯闪烁）。
- 同时保留 1.15.72 的竖排阅读设置恢复修复；分区表 / bootloader / OTA 布局未改，书、设置与阅读记录保留。
- 详细验收步骤见 `downloads/改版日志与刷机指南.md` 0.82 节。

## 仓库目录

```
index.html                刷机站首页（纯静态，esp-web-tools 已内置）
firmware/                 固件与 ESP Web Tools manifest、SHA256SUMS
downloads/                源码包、完整交接包、TF 卡镜像、中文指南、历史归档
docs/                     使用说明、刷机指南、变更清单（站点内副本）
assets/ promo 图           站点宣传图
web-flasher/              内置的 esp-web-tools 静态资源（不依赖 CDN）
beta/                     隐藏内测通道（5 次点击标志可见）
```

## TF 卡本地升级（推荐）

1. 把 `downloads/Pico-update-1.15.77.bin` 复制到 TF 卡根目录（FAT32）。
2. 设备开机后在「设置 → 升级和恢复」里选择本地升级/从 TF 卡升级（不同版本菜单名略有差异）。
3. 升级只写应用镜像分区，书、设置与阅读记录保留；若设备提示“与当前版本相同”而拒绝（上游应用版本号仍为
   0.3.3-rc99，属固件既有同版本检查），请改用首页的浏览器一键刷机或完整交接包里的全量镜像。

## 源码构建

- 工具链：**ESP-IDF v6.1**，目标 `esp32s3`。
- 解压 `downloads/PageIsle-1.15.77-source.zip`，在工程根目录执行：
  ```
  idf.py set-target esp32s3
  idf.py build
  ```
- 产物：`build/Read_Pico.bin`（应用镜像）、`build/bootloader/bootloader.bin`、`build/partition_table/partitions.bin`。
- 分区表、引导程序与 OTA 元数据布局与上游 kiikoread 官方一致，未改动。

## 版本历史与说明

- 1.15.77：蓝牙翻页器兼容性补丁（Legacy 配对失败后 LE Secure Connections 重试、无名 BLE 设备可见、配对提示与日志）。
- 1.15.72：竖排阅读设置重启/深睡唤醒后丢失修复。
- 1.15.71：蓝牙翻页器连接修复（BLE HID 配对/连接、明文回退、状态显示、`blept:` 日志）。
- 1.15.70：文字残影低闪微调（每页纯白像素补推 + 翻页表黑→白补白相；+44ms/页；无新增整屏闪）。
- 1.15.69：蓝牙 BLE 翻页器修复（P0）、水波·高清残影优化、横屏图文并排（P2）。
- 1.15.53：封面诊断/放宽解码 + 页面内存策略 Phase1。
- 更早版本与逐项改动见 `downloads/改版日志与刷机指南.md` 与 `downloads/变更清单-从原始版到最终版.md`。

## 回滚

- `downloads/Pico-update-1.15.71.bin`（1.15.71 正式版应用镜像）、`downloads/Pico-update-1.15.70.bin`
  （1.15.70）与 `downloads/Pico-update-1.15.53.bin`（1.15.53）保留在 `downloads/`；完整交接包与源码包也保留
  1.15.71/1.15.70/1.15.53 历史归档。
- 回滚只需重刷应用镜像，分区表/bootloader/OTA 布局未变；若 TF 同版本检查拒绝，请用浏览器一键刷机
  或完整交接包里的全量镜像。

## 许可与致谢

- 固件基于 **kiikoread 0.3.3-rc99**（并移植了上游 rc100–rc103 的部分功能）做应用层定制，
  按其原有许可发布；仓库内保留上游许可与第三方声明（`THIRD_PARTY_NOTICES.md`）。
- 刷机能力来自 [esp-web-tools](https://github.com/esphome/esp-web-tools) 与 esptool-js
  （© Espressif Systems，Apache-2.0），已内置在本仓库。
- 图标来自 Lucide（ISC）。
- 每次发布只做过编译/validate/静态分析；没有真机测试记录被当作已验证结论。

> 本仓库的固件为个人定制版本，刷机有风险；请确认设备型号并优先使用 TF 卡升级或浏览器一键刷机。所有校验值都是本仓库构建产物。
