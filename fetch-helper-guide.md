# 油猴脚本使用指南

## 概述

为了帮助用户绕过 CORS（跨源资源共享）限制，项目提供了一个油猴脚本。如果在加载远程配置文件或节点链接时遇到 CORS 错误，安装此脚本即可解决。

## 什么时候需要这个脚本？

- 加载远程配置文件时出现 `No 'Access-Control-Allow-Origin' header` (前端多显示为 `NetworkError`) 错误
- 某些网站的链接无法跨域加载
- 需要加载自己私人服务器上的配置文件

## 安装步骤

### 1. 安装油猴管理器 (如已安装可跳过)

选择适合你的浏览器的油猴扩展：

- **Chrome / Edge**: [Tampermonkey](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- **Firefox**: [Tampermonkey](https://addons.mozilla.org/firefox/addon/tampermonkey/) or [Greasemonkey](https://addons.mozilla.org/firefox/addon/greasemonkey/)
- **其他浏览器**: [Tampermonkey](https://tampermonkey.net/)

### 2. 添加脚本

安装油猴后，点击下方链接直接安装脚本：

[📥 GitHub 源](https://raw.githubusercontent.com/siiway/urlclash-converter/main/fetch-helper.user.js)

或手动添加：
1. 打开你的油猴管理面板
2. 点击 `创建新脚本` 或 `+` 按钮
3. 将 [urlclash-fetch-helper.js](./public/urlclash-fetch-helper.js) 的内容复制到其中
4. 保存脚本

### 3. 配置脚本匹配地址（可选）

默认脚本会匹配以下网址：
- `*://convert.siiway.top/*`
- `*://localhost/*`
- `*://127.0.0.1/*`
- `*://[::1]/*`

如果你在自己的服务器上部署，需要修改脚本的 `@match` 规则。例如，如果你的网站是 `https://example.com/converter/`，添加：

```
// @match        https://example.com/converter/*
```

## 工作原理

油猴脚本使用以下机制绕过 CORS 限制：

1. **GM_xmlhttpRequest**: 油猴提供的特殊函数，可以发送无受限跨域请求
2. **窗口监听器**: 脚本在页面加载时注入 `__fetchWithoutCORS` 函数到全局作用域
3. **自动回退**: 如果脚本不可用或失败，应用会自动回退到普通 fetch

---

## 工作流程

```
用户点击"从 URL 加载"
    ↓
应用检查是否有油猴脚本 (__fetchWithoutCORS)
    ↓
┌─── 有 ──→ 使用油猴脚本请求（无 CORS 限制）
│
└─── 无 ──→ 使用普通 fetch（有 CORS 限制）
```

## 常见问题

### Q: 使用这个脚本安全吗？

**A**: 是的。脚本只在 URLClash Converter 网站上运行，并且只处理 HTTP(S) 请求，且默认会拦截本地/内网目标（如 `localhost`、`127.0.0.1`、`192.168.x.x` 等）。你拥有完全的控制权：
- 脚本代码是开源的，你可以完整审核
- 它不会修改你的浏览器设置或其他网站
- 请求从你的浏览器直接发送到目标服务器，不经过任何中介

### Q: 为什么不用公共 CORS 代理？

**A**: 项目特殊性：
- 可能涉及私人配置文件，不应该通过第三方服务器
- 更好的隐私保护
- 更多的安全控制
- 用户油猴脚本拥有完全的透明控制

### Q: 油猴脚本和普通 fetch 有什么区别？

| 对比项     | 油猴脚本 | 普通 fetch   |
| ---------- | -------- | ------------ |
| CORS 限制  | ❌ 无     | ✅ 有         |
| 跨域请求   | ✅ 支持   | ❌ 大多数失败 |
| 跟随重定向 | ✅ 支持   | ✅ 支持       |
| 需要扩展   | ✅ 是     | ❌ 否         |

### Q: 如果脚本安装失败怎么办？

**A**: 尝试以下步骤：
1. 确保油猴扩展已安装并启用
2. 检查脚本的 `@match` 规则是否匹配你的网址
3. 刷新页面（Ctrl+F5 或 Cmd+Shift+R）
4. 在浏览器控制台检查是否有错误信息
5. 如果仍不可行，普通 fetch 将作为备选方案

### Q: 能在离线环境下使用吗？

**A**: 不能。油猴脚本只是帮助绕过 CORS 限制，仍然需要网络连接来获取远程资源。

## 故障排查

### 检查脚本是否正确安装

在浏览器控制台（F12）执行：
```javascript
typeof window.__fetchWithoutCORS === 'function'
```

- 返回 `true` → 脚本已正确安装
- 返回 `false` → 脚本未安装或未加载

### 查看请求日志

在脚本加载时，会在控制台输出信息：
```js
油猴脚本请求成功
// 或
油猴脚本请求失败，使用普通 fetch: [错误信息]
```

## 许可证

油猴脚本遵循同项目的许可证。详见 [LICENSE](./LICENSE)
