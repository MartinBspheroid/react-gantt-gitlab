# 部署指南

本指南說明如何將此 React Gantt 應用程式部署到 GitHub Pages 和 GitLab Pages。

## 目錄

- [部署選項](#部署選項)
- [CORS 跨域問題與解決方案](#cors-跨域問題與解決方案)
- [建置指令](#建置指令)
- [環境變數](#環境變數)
- [疑難排解](#疑難排解)

---

## 部署選項

### 選項 1：GitLab Pages

**優點：**

- 與 GitLab 在同一組織內
- 自動 CI/CD 部署

**限制：**

- ⚠️ **網域不同仍有 CORS 問題**
  - GitLab API: `gitlab.rayark.com`
  - GitLab Pages: `pages.rayark.io`
  - 需要額外配置 CORS proxy

**部署步驟：**

1. 推送程式碼到 GitLab repository：

   ```bash
   git push gitlab main
   ```

2. CI/CD pipeline 會自動執行（`.gitlab-ci.yml`）

3. Pipeline 完成後，網站將部署至：

   ```
   https://<project-name>-<hash>.pages.rayark.io/
   ```

4. 檢查部署狀態：
   - Pipeline: `https://gitlab.rayark.com/<username>/<project-name>/-/pipelines`
   - Pages 設定: Settings > Pages

### 選項 2：GitHub Pages

**優點：**

- 免費託管
- 支援自訂網域

**限制：**

- 跨域存取 GitLab API 會有 CORS 問題
- 需要 CORS proxy 處理 API 呼叫

**部署步驟：**

1. 推送程式碼到 GitHub repository：

   ```bash
   git push origin main
   ```

2. 啟用 GitHub Pages：

   - 前往：Repository Settings > Pages
   - Source：選擇 "GitHub Actions"

3. GitHub Actions 會自動建置並部署（`.github/workflows/deploy-github-pages.yml`）

4. 網站將部署至：
   ```
   https://<username>.github.io/<repository-name>/
   ```

---

## CORS 跨域問題與解決方案

### 什麼是 CORS？

跨來源資源共用（Cross-Origin Resource Sharing, CORS）是瀏覽器的安全機制，會阻擋從一個網域向另一個網域發送請求，除非伺服器明確允許。

### 問題說明

當你的應用程式部署在：

- `pages.rayark.io` (GitLab Pages)
- 或 `github.io` (GitHub Pages)

但試圖存取 `gitlab.rayark.com` 的 GitLab API 時，瀏覽器會因為 CORS 政策而阻擋這些請求。

**錯誤訊息範例：**

```
Access to fetch at 'https://gitlab.rayark.com/api/v4/...' from origin 'https://pages.rayark.io'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the
requested resource.
```

### 解決方案

#### 方案 1：使用 Cloudflare Workers（推薦）

**特點：**

- ✅ 免費方案可用（每天 100,000 requests）
- ✅ 設定簡單，部署快速
- ✅ 全球 CDN，速度快
- ✅ 適合 Rayark 內部使用

**設定步驟：**

1. **註冊 Cloudflare Workers**

   - 前往：https://workers.cloudflare.com/
   - 使用公司帳號註冊或登入

2. **建立新的 Worker**

   - 點擊 "Create a Service"
   - 服務名稱：`gitlab-cors-proxy`（或其他名稱）
   - 選擇 "HTTP handler"

3. **貼上以下程式碼**：

```javascript
// Cloudflare Worker for GitLab CORS Proxy
addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  // 處理 CORS preflight OPTIONS 請求
  if (request.method === 'OPTIONS') {
    return handleOptions(request);
  }

  // 從 URL path 取得目標 GitLab URL
  // 例如：https://your-worker.workers.dev/https://gitlab.rayark.com/api/v4/user
  const targetUrl = url.pathname.slice(1); // 移除開頭的 /

  // 安全檢查：只允許 gitlab.rayark.com
  if (!targetUrl.startsWith('https://gitlab.rayark.com')) {
    return new Response('Forbidden: Only gitlab.rayark.com is allowed', {
      status: 403,
    });
  }

  try {
    // 複製原始請求的 headers
    const headers = new Headers(request.headers);

    // 如果有 X-GitLab-Token，轉換為 PRIVATE-TOKEN
    if (headers.has('X-GitLab-Token')) {
      headers.set('PRIVATE-TOKEN', headers.get('X-GitLab-Token'));
      headers.delete('X-GitLab-Token');
    }

    // 轉發請求到 GitLab
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body:
        request.method !== 'GET' && request.method !== 'HEAD'
          ? await request.blob()
          : null,
    });

    // 建立新的 Response 並加上 CORS headers
    const newResponse = new Response(response.body, response);

    // 加入 CORS headers
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS',
    );
    newResponse.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, PRIVATE-TOKEN, X-GitLab-Token',
    );
    newResponse.headers.set('Access-Control-Max-Age', '86400');

    return newResponse;
  } catch (error) {
    return new Response(`Error: ${error.message}`, {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

function handleOptions(request) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, PRIVATE-TOKEN, X-GitLab-Token',
      'Access-Control-Max-Age': '86400',
    },
  });
}
```

4. **部署 Worker**

   - 點擊 "Save and Deploy"
   - 記下你的 Worker URL：`https://gitlab-cors-proxy.你的帳號.workers.dev`

5. **設定環境變數**

   建立 `.env.production`：

   ```env
   VITE_CORS_PROXY=https://gitlab-cors-proxy.你的帳號.workers.dev
   ```

6. **更新 CI/CD 配置**

   **GitHub Actions** (`.github/workflows/deploy-github-pages.yml`)：

   ```yaml
   - name: Build
     run: npm run build:pages
     env:
       VITE_BASE_PATH: /react-gantt-gitlab/
       VITE_CORS_PROXY: https://gitlab-cors-proxy.你的帳號.workers.dev
   ```

   **GitLab CI** (`.gitlab-ci.yml`)：

   ```yaml
   pages:
     script:
       - npm ci
       - npm run build:pages
       - mkdir -p public
       - cp -r dist-demos/* public/
     variables:
       VITE_CORS_PROXY: 'https://gitlab-cors-proxy.你的帳號.workers.dev'
   ```

#### 方案 2：使用公司內部 Nginx 反向代理（最安全）

如果 Rayark 有自己的伺服器，可以設定 Nginx 反向代理。

**Nginx 配置範例：**

```nginx
# /etc/nginx/sites-available/gitlab-proxy

server {
    listen 80;
    server_name gitlab-proxy.rayark.com;  # 或內部網域

    # CORS headers
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization, PRIVATE-TOKEN' always;

    # Handle preflight OPTIONS requests
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Max-Age' 1728000;
        add_header 'Content-Type' 'text/plain charset=UTF-8';
        add_header 'Content-Length' 0;
        return 204;
    }

    location / {
        # 轉發到 GitLab
        proxy_pass https://gitlab.rayark.com;
        proxy_set_header Host gitlab.rayark.com;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 保留 Authorization headers
        proxy_pass_request_headers on;
    }
}
```

**使用方式：**

```env
VITE_CORS_PROXY=https://gitlab-proxy.rayark.com
```

#### 方案 3：請 IT 在 GitLab 上啟用 CORS（最理想）

如果可以的話，直接在 `gitlab.rayark.com` 上設定 CORS headers 是最好的解決方案。

**需要在 GitLab 伺服器上設定：**

```
Access-Control-Allow-Origin: https://pages.rayark.io, https://farl.github.io
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, PRIVATE-TOKEN
```

這需要聯絡 IT 部門或 GitLab 管理員。

---

## 建置指令

### 本地開發

```bash
npm run dev
```

### 正式環境建置

```bash
# 建置 demo/pages 版本
npm run build:pages

# 建置函式庫版本
npm run build

# 建置完整 CSS
npm run build:full-css
```

### 預覽正式環境建置

```bash
npm run build:pages
npm run preview
```

---

## 環境變數

建立 `.env.local` 用於本地開發：

```env
# GitLab 配置
VITE_GITLAB_URL=https://gitlab.rayark.com
VITE_GITLAB_TOKEN=你的-token
VITE_GITLAB_PROJECT_ID=你的-project-id

# 選用：CORS Proxy（用於正式環境不同網域）
# VITE_CORS_PROXY=https://your-cors-proxy.workers.dev
```

**注意：** 永遠不要將 `.env.local` 或真實的 token 提交到 git！

---

## 疑難排解

### 問題：GitLab CI Pipeline 沒有執行

**原因：** Runner 未配置或 tag 錯誤

**解決方案：** 確認 `.gitlab-ci.yml` 有正確的 tags：

```yaml
pages:
  tags:
    - docker # 使用你的 GitLab instance 的正確 tag
```

### 問題：GitLab Pages 出現 404

**原因：** `public/` 目錄結構錯誤

**解決方案：** 確認 CI script 正確複製檔案：

```yaml
script:
  - npm ci
  - npm run build:pages
  - mkdir -p public
  - cp -r dist-demos/* public/ # 複製內容，不是目錄本身
```

檢查 artifacts：`index.html` 應該在 `public/` 根目錄，不是 `public/dist-demos/`

### 問題：CORS 錯誤

**症狀：**

```
Access to fetch at 'https://gitlab.rayark.com/...' has been blocked by CORS policy
```

**解決方案：** 使用上述的 CORS 解決方案之一：

1. Cloudflare Workers CORS proxy（推薦）
2. 公司內部 Nginx 反向代理
3. 請 IT 在 GitLab 上啟用 CORS

### 問題：Assets 無法載入

**原因：** 路徑配置錯誤

**解決方案：** 檢查 `vite.config.js` 的 base 配置：

```javascript
// GitLab Pages 使用根路徑 '/'
// GitHub Pages 使用子路徑（透過 VITE_BASE_PATH 環境變數設定）
const base = process.env.VITE_BASE_PATH || '/';
```

---

## 多個 Remote 設定

可以同時推送到 GitHub 和 GitLab：

```bash
# 加入 remotes
git remote add origin git@github.com:username/repo.git
git remote add gitlab git@gitlab.rayark.com:username/repo.git

# 推送到兩個 remote
git push origin main
git push gitlab main

# 查看 remotes
git remote -v
```

---

## 安全注意事項

1. **永遠不要提交 GitLab tokens** 到 repository
2. 使用 GitHub Secrets 儲存敏感的環境變數
3. 如果使用 CORS proxy，**只允許 GitLab 網域的白名單**
4. 正式環境考慮使用短期 token 或 OAuth

---

## CORS Proxy 比較

| 方案                   | 優點                 | 缺點               | 適用情境               |
| ---------------------- | -------------------- | ------------------ | ---------------------- |
| **Cloudflare Workers** | 免費、快速、全球 CDN | 需要註冊帳號       | 最推薦，適合大多數情況 |
| **Nginx 反向代理**     | 完全掌控、內部網路   | 需要自己的伺服器   | 有內部伺服器時使用     |
| **GitLab CORS 設定**   | 最簡單、無需額外服務 | 需要 IT/管理員權限 | 理想方案，但需要權限   |
| **公開 CORS Proxy**    | 快速測試             | 不安全、不穩定     | 僅限開發測試           |

---

## 推薦部署流程

1. **開發階段**

   - 使用 `npm run dev`
   - Vite proxy 自動處理 CORS

2. **測試階段**

   - 部署到 GitLab Pages
   - 設定 Cloudflare Workers CORS proxy
   - 測試所有 API 功能

3. **正式環境**
   - 根據需求選擇：
     - GitLab Pages + Cloudflare Workers
     - GitHub Pages + Cloudflare Workers
     - 公司內部伺服器 + Nginx

---

## 額外資源

- [Vite 部署指南](https://vitejs.dev/guide/static-deploy.html)
- [GitHub Pages 文件](https://docs.github.com/en/pages)
- [GitLab Pages 文件](https://docs.gitlab.com/ee/user/project/pages/)
- [CORS MDN 文件](https://developer.mozilla.org/zh-TW/docs/Web/HTTP/CORS)
- [Cloudflare Workers 文件](https://developers.cloudflare.com/workers/)
