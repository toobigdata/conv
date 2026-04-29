// ==UserScript==
// @name         URLClash Fetch Helper
// @namespace    wss.moe/urlclash-converter/fetch-helper
// @version      2026.4.29.1
// @description  帮助 URLClash Converter 绕过 CORS 限制，支持跨域获取配置文件
// @icon 
// @supportURL   https://github.com/siiway/urlclash-converter/blob/main/fetch-helper-guide.md
// @author       siiway
// @match        *://convert.siiway.top/*
// @match        *://localhost/*
// @match        *://127.0.0.1/*
// @match        *://[::1]/*
// @note         注意: 如果使用你自己部署的实例而非公共实例，请在此增加一行 @match 匹配你的部署地址
// @grant        GM_xmlhttpRequest
// @connect      *
// @run-at       document-start
// @license      GPL-3.0-or-later
// ==/UserScript==

(function () {
  'use strict';

  const REQUEST_EVENT = '__fetchWithoutCORSRequest';
  const RESPONSE_EVENT = '__fetchWithoutCORSResponse';
  const HELPER_TOKEN = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');

  const normalizeHost = (hostname) => hostname.replace(/^\[|\]$/g, '').toLowerCase();

  const isPrivateIPv4 = (hostname) => {
    const parts = hostname.split('.').map((n) => Number(n));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return false;
    }
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 0) return true;
    return false;
  };

  const extractMappedIPv4FromIPv6 = (hostname) => {
    const lower = hostname.toLowerCase();
    const marker = '::ffff:';
    const idx = lower.lastIndexOf(marker);
    if (idx < 0) return null;
    const mapped = lower.slice(idx + marker.length);
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(mapped)) return mapped;
    if (/^[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(mapped)) {
      const [hi, lo] = mapped.split(':').map((v) => parseInt(v, 16));
      if (Number.isNaN(hi) || Number.isNaN(lo)) return null;
      const octets = [(hi >> 8) & 255, hi & 255, (lo >> 8) & 255, lo & 255];
      return octets.join('.');
    }
    return null;
  };

  const isPrivateIPv6 = (hostname) => {
    const host = hostname.toLowerCase();
    const mappedIPv4 = extractMappedIPv4FromIPv6(host);
    if (mappedIPv4 && isPrivateIPv4(mappedIPv4)) return true;
    return host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb');
  };

  const isBlockedHost = (hostname) => {
    if (!hostname) return true;
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
      return true;
    }
    if (isPrivateIPv4(hostname) || isPrivateIPv6(hostname)) {
      return true;
    }
    return false;
  };

  const validateTargetUrl = (rawUrl) => {
    if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
      return { ok: false, error: 'URL 不能为空 (URL is required)' };
    }
    try {
      const parsed = new URL(rawUrl.trim());
      if (!/^https?:$/.test(parsed.protocol)) {
        return { ok: false, error: '仅允许 HTTP/HTTPS 协议 (Only HTTP/HTTPS URLs are allowed)' };
      }
      const hostname = normalizeHost(parsed.hostname);
      if (isBlockedHost(hostname)) {
        return { ok: false, error: '不允许访问本地/内网地址 (Local/private network targets are blocked)' };
      }
      return { ok: true, url: parsed.toString() };
    } catch {
      return { ok: false, error: '无效 URL (Invalid URL)' };
    }
  };

  const emitResponse = (id, payload) => {
    window.dispatchEvent(new CustomEvent(RESPONSE_EVENT, {
      detail: { id, ...payload },
    }));
  };

  // 向页面全局作用域注入初始化脚本
  const injectScript = () => {
    const script = document.createElement('script');
    script.textContent = `
      (() => {
        const REQUEST_EVENT = ${JSON.stringify(REQUEST_EVENT)};
        const RESPONSE_EVENT = ${JSON.stringify(RESPONSE_EVENT)};
        const HELPER_TOKEN = ${JSON.stringify(HELPER_TOKEN)};
        const listeners = new Map();

        Object.defineProperty(window, '__fetchWithoutCORS', {
          configurable: false,
          writable: false,
          value: function(url) {
            return new Promise((resolve, reject) => {
              const id = Math.random().toString(36).slice(2);
              const timeout = setTimeout(() => {
                listeners.delete(id);
                reject(new Error('请求超时 (Request Timed Out)'));
              }, 30000);

              listeners.set(id, (data) => {
                clearTimeout(timeout);
                listeners.delete(id);
                if (data.error) {
                  reject(new Error(data.error));
                  return;
                }
                resolve({
                  ok: data.status >= 200 && data.status < 300,
                  status: data.status,
                  statusText: data.statusText,
                  text: () => Promise.resolve(data.responseText),
                  json: () => Promise.resolve(JSON.parse(data.responseText)),
                });
              });

              window.dispatchEvent(new CustomEvent(REQUEST_EVENT, {
                detail: { url, id, token: HELPER_TOKEN },
              }));
            });
          },
        });

        window.addEventListener(RESPONSE_EVENT, (event) => {
          const detail = event && event.detail ? event.detail : {};
          const { id, ...data } = detail;
          if (typeof id !== 'string') return;
          const callback = listeners.get(id);
          if (callback) callback(data);
        });
      })();
    `;
    document.documentElement.appendChild(script);
    script.remove();
  };

  // 在文档开始时就注入
  if (document.documentElement) {
    injectScript();
  } else {
    document.addEventListener('DOMContentLoaded', injectScript, { once: true });
  }

  // 油猴脚本监听来自页面的请求事件
  window.addEventListener(REQUEST_EVENT, (event) => {
    const detail = event && event.detail ? event.detail : {};
    const { url, id, token } = detail;
    if (token !== HELPER_TOKEN || typeof id !== 'string' || id.length > 64) return;

    const validated = validateTargetUrl(url);
    if (!validated.ok) {
      emitResponse(id, { error: validated.error });
      return;
    }

    GM_xmlhttpRequest({
      method: 'GET',
      url: validated.url,
      headers: {
        'User-Agent': navigator.userAgent,
      },
      onload: (response) => {
        emitResponse(id, {
          status: response.status,
          statusText: response.statusText,
          responseText: response.responseText,
        });
      },
      onerror: (error) => {
        emitResponse(id, {
          error: error.message || '网络错误 (Network Error)',
        });
      },
      ontimeout: () => {
        emitResponse(id, {
          error: '请求超时 (Request Timed Out)',
        });
      },
      timeout: 30000,
    });
  });
})();
