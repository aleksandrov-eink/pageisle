# 第三方组件（本页面内置）

| 组件 | 版本 | 位置 | 许可 |
|---|---|---|---|
| esp-web-tools | 10.0.0 | `web-flasher/*.js` | Apache-2.0，© Espressif Systems |
| esptool-js（esp-web-tools 依赖，已打包） | — | `web-flasher/install-dialog-*.js` | Apache-2.0，© Espressif Systems |
| Lucide 图标 | — | 同上 | ISC |

`web-flasher/` 内的文件来自 `https://unpkg.com/esp-web-tools@10.0.0/dist/web/`，
仅在本仓库内**本地托管**（去掉对 CDN 的运行时依赖）并做了**界面文案中文化**：
所有替换只改用户可见的字符串（按钮、标题、进度、错误与提示句），
不改任何逻辑、状态机键、类名或通信代码。原始英文构建可从上面的 unpkg 地址取回对照。
