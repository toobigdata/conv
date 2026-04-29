// ==UserScript==
// @name         URLClash Fetch Helper
// @namespace    wss.moe/urlclash-converter/fetch-helper
// @version      2026.2.19.2
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

  // 向页面全局作用域注入初始化脚本
  const injectScript = () => {
    const script = document.createElement('script');
    script.textContent = `
      window.__fetchListeners = window.__fetchListeners || {};
      
      window.__fetchWithoutCORS = function(url) {
        return new Promise((resolve, reject) => {
          const id = Math.random().toString(36);
          const timeout = setTimeout(() => {
            delete window.__fetchListeners[id];
            reject(new Error('请求超时 (Request Timed Out)'));
          }, 30000);
          
          window.__fetchListeners[id] = (data) => {
            clearTimeout(timeout);
            delete window.__fetchListeners[id];
            if (data.error) {
              reject(new Error(data.error));
            } else {
              resolve({
                ok: data.status >= 200 && data.status < 300,
                status: data.status,
                statusText: data.statusText,
                text: () => Promise.resolve(data.responseText),
                json: () => Promise.resolve(JSON.parse(data.responseText)) || null
              });
            }
          };
          
          // 通过自定义事件向油猴脚本发送请求
          window.dispatchEvent(new CustomEvent('__fetchWithoutCORSRequest', {
            detail: { url, id }
          }));
        });
      };
    `;
    document.documentElement.appendChild(script);
    script.remove();
  };

  // 在文档开始时就注入
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectScript);
  } else {
    injectScript();
  }

  // 油猴脚本监听来自页面的请求事件
  window.addEventListener('__fetchWithoutCORSRequest', (event) => {
    const { url, id } = event.detail;
    
    GM_xmlhttpRequest({
      method: 'GET',
      url: url,
      headers: {
        'User-Agent': navigator.userAgent,
      },
      onload: (response) => {
        // 通过自定义事件返回响应
        window.dispatchEvent(new CustomEvent('__fetchWithoutCORSResponse', {
          detail: {
            id,
            status: response.status,
            statusText: response.statusText,
            responseText: response.responseText,
          }
        }));
      },
      onerror: (error) => {
        window.dispatchEvent(new CustomEvent('__fetchWithoutCORSResponse', {
          detail: {
            id,
            error: error.message || '网络错误 (Network Error)',
          }
        }));
      },
      ontimeout: () => {
        window.dispatchEvent(new CustomEvent('__fetchWithoutCORSResponse', {
          detail: {
            id,
            error: '请求超时 (Request Timed Out)',
          }
        }));
      },
      timeout: 30000,
    });
  });

  // 监听响应事件，调用回调
  window.addEventListener('__fetchWithoutCORSResponse', (event) => {
    const { id, ...data } = event.detail;
    if (window.__fetchListeners && window.__fetchListeners[id]) {
      window.__fetchListeners[id](data);
    }
  });
})();
