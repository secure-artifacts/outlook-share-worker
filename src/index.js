addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// ==================== 所有函数定义放在最前面 ====================

// 管理页面（生成链接的表单）
function getAdminHTML() {
  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="utf-8">
      <title>Outlook 账号安全分发</title>
      <style>
        body { font-family: system-ui, sans-serif; max-width: 620px; margin: 40px auto; padding: 20px; }
        input, button, textarea { width: 100%; padding: 12px; margin: 8px 0; font-size: 16px; box-sizing: border-box; }
        button { background:#0070f3; color:white; border:none; cursor:pointer; font-weight:bold; height:48px; }
        .warning { color:#d32f2f; }
        label { display:block; margin:12px 0 4px; font-weight:500; }
      </style>
    </head>
    <body>
      <h1>生成 Outlook 账号分享链接</h1>
      <form action="/generate" method="POST">
        <label>备注（对方可见）</label>
        <input type="text" name="note" placeholder="给小李的临时账号 - 请尽快修改密码" maxlength="120">

        <label>邮箱地址</label>
        <input type="email" name="email" placeholder="example@outlook.com" required>

        <label>密码</label>
        <input type="text" name="password" placeholder="输入完整密码" required>

        <label>TOTP 原始密钥 (Base32，可带空格)</label>
        <input type="text" name="totpSecret" placeholder="JBSWY3DPEHPK3PXP" required>

        <label>查看密码（对方打开链接时需要输入，至少4位）</label>
        <input type="text" name="viewPassword" placeholder="设置一个查看密码，例如: 123456 或 Abc888" minlength="4" required>

        <button type="submit">生成分享链接</button>
      </form>
      <p class="warning">⚠️ 生成后把链接发给对方，对方需要输入你设置的查看密码才能看到内容</p>
    </body>
    </html>
  `;
}

// 输入查看密码的表单页面
function getPasswordFormHTML(note, isError) {
  const errorMsg = isError ? '<p style="color:red; font-weight:bold;">❌ 密码错误，请重试</p>' : '';
  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="utf-8">
      <title>输入查看密码</title>
      <style>
        body { font-family: system-ui, sans-serif; max-width: 500px; margin: 100px auto; padding: 20px; text-align: center; }
        input, button { padding: 14px; margin: 10px 0; width: 100%; font-size: 17px; }
        button { background: #0070f3; color: white; border: none; cursor: pointer; font-weight: bold; }
        .note { background: #fff3cd; padding: 16px; border-radius: 8px; color: #856404; margin: 20px 0; }
      </style>
    </head>
    <body>
      <h1>🔒 请输入查看密码</h1>
      ${errorMsg}
      <div class="note">📝 备注： ${note}</div>
      <form method="POST">
        <input type="password" name="viewPassword" placeholder="输入查看密码" required autofocus>
        <button type="submit">确认查看账号信息</button>
      </form>
    </body>
    </html>
  `;
}

// 显示实际账号内容的页面
function getViewHTML(data) {
  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="utf-8">
      <title>您的 Outlook 账号</title>
      <style>
        body { font-family: system-ui, sans-serif; max-width: 640px; margin: 40px auto; padding: 20px; text-align: center; }
        .note-box { background: #fff3cd; color: #856404; padding: 18px; border-radius: 12px; margin: 20px 0; font-size: 18px; font-weight: 500; }
        .info-box { background: #f8f9fa; padding: 25px; border-radius: 12px; margin: 20px 0; text-align: left; }
        .totp-box { font-size: 54px; letter-spacing: 12px; font-weight: bold; color: #0066ff; background: white; padding: 25px; border: 4px solid #0066ff; border-radius: 16px; margin: 30px 0; }
        .secret { font-family: monospace; background: #f0f0f0; padding: 12px; border-radius: 8px; word-break: break-all; font-size: 15px; }
        .warning { color: #d32f2f; font-size: 17px; line-height: 1.7; margin-top: 30px; }
      </style>
    </head>
    <body>
      <h1>分配给您的 Outlook 账号</h1>
      
      <div class="note-box">📝 ${data.note}</div>

      <div class="info-box">
        <p><strong>邮箱：</strong>${data.email}</p>
        <p><strong>密码：</strong>${data.password}</p>
      </div>

      <h2>TOTP 设置</h2>
      <div class="info-box">
        <p><strong>原始 TOTP 密钥</strong></p>
        <div class="secret">${data.totpSecret}</div>
        <p style="margin-top:10px;color:#555;">复制此密钥到 Authenticator App 中手动添加</p>
      </div>

      <h2>当前 TOTP 验证码（实时刷新）</h2>
      <div class="totp-box" id="totp">------</div>
      <p>每 30 秒自动更新，可直接复制使用</p>

      <p class="warning">
        ⚠️ 查看后请立即修改密码！此页面仅允许查看一次。
      </p>

      <script>
        const secret = "${data.totpSecret}";

        async function generateTOTP() {
          try {
            const decoded = base32Decode(secret);
            const timeStep = Math.floor(Date.now() / 1000 / 30);
            const buffer = new ArrayBuffer(8);
            new DataView(buffer).setBigUint64(0, BigInt(timeStep), false);
            const key = await crypto.subtle.importKey("raw", decoded, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
            const hmac = await crypto.subtle.sign("HMAC", key, buffer);
            const hmacArray = new Uint8Array(hmac);
            const offset = hmacArray[19] & 0xf;
            let code = ((hmacArray[offset] & 0x7f) << 24) |
                       ((hmacArray[offset + 1] & 0xff) << 16) |
                       ((hmacArray[offset + 2] & 0xff) << 8) |
                       (hmacArray[offset + 3] & 0xff);
            return (code % 1000000).toString().padStart(6, '0');
          } catch (e) {
            return "计算错误";
          }
        }

        function base32Decode(input) {
          const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
          let bits = 0, value = 0, index = 0;
          const output = new Uint8Array(Math.ceil(input.length * 5 / 8));
          for (let i = 0; i < input.length; i++) {
            value = (value << 5) | alphabet.indexOf(input[i].toUpperCase());
            bits += 5;
            if (bits >= 8) {
              output[index++] = (value >>> (bits - 8)) & 255;
              bits -= 8;
            }
          }
          return output.slice(0, index);
        }

        async function refreshTOTP() {
          const code = await generateTOTP();
          document.getElementById("totp").textContent = code;
        }

        refreshTOTP();
        setInterval(refreshTOTP, 1000);
      </script>
    </body>
    </html>
  `;
}

// ==================== 处理请求的核心函数 ====================

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/' || path === '') {
    return new Response(getAdminHTML(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  if (path === '/generate' && request.method === 'POST') {
    return await handleGenerate(request, url);
  }

  if (path.startsWith('/view/')) {
    return await handleView(request, url);
  }

  return new Response('Not found', { status: 404 });
}

// 生成分享链接
async function handleGenerate(request, url) {
  try {
    const formData = await request.formData();
    const email = formData.get('email')?.trim();
    const password = formData.get('password')?.trim();
    let totpSecret = formData.get('totpSecret')?.trim();
    const note = formData.get('note')?.trim() || '无备注';
    const viewPassword = formData.get('viewPassword')?.trim();

    if (!email || !password || !totpSecret || !viewPassword) {
      return new Response('所有字段都不能为空', { status: 400 });
    }
    if (viewPassword.length < 4) {
      return new Response('查看密码至少需要 4 个字符', { status: 400 });
    }

    totpSecret = totpSecret.toUpperCase().replace(/\s+/g, '');

    const id = 's' + Math.random().toString(36).substring(2, 15);
    const token = crypto.randomUUID() + crypto.randomUUID();

    const data = {
      email,
      password,
      totpSecret,
      note,
      viewPassword,
      token,
      viewed: false
    };

    await SHARE_KV.put(`share:${id}`, JSON.stringify(data), { expirationTtl: 86400 });

    const shareUrl = `https://${url.hostname}/view/${id}?token=${token}`;

    const successHTML = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head><meta charset="utf-8"><title>生成成功</title>
      <style>body{font-family:system-ui;margin:40px auto;max-width:720px;padding:20px;}</style>
      </head>
      <body>
        <h1>✅ 分享链接生成成功</h1>
        <p>请把以下链接发给对方：</p>
        <input type="text" value="${shareUrl}" style="width:100%;padding:12px;font-size:16px;" readonly onclick="this.select()">
        <p style="color:#d32f2f;margin:20px 0;">
          ⚠️ 对方打开后需要输入你设置的“查看密码”才能看到内容<br>
          链接有效期 24 小时，仅允许查看一次
        </p>
        <a href="/">← 返回继续生成</a>
      </body>
      </html>
    `;

    return new Response(successHTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' }});
  } catch (e) {
    return new Response('生成失败: ' + e.message, { status: 500 });
  }
}

// 查看页面（带密码验证）
async function handleView(request, url) {
  const pathParts = url.pathname.split('/');
  const id = pathParts[2];
  const token = url.searchParams.get('token');

  if (!id || !token) return new Response('参数错误', { status: 400 });

  const dataStr = await SHARE_KV.get(`share:${id}`);
  if (!dataStr) return new Response('链接已过期或不存在', { status: 404 });

  const data = JSON.parse(dataStr);

  if (data.token !== token) {
    return new Response('链接无效', { status: 410 });
  }

  if (data.viewed === true) {
    return new Response('此链接已被查看或已失效', { status: 410 });
  }

  // 处理密码提交
  if (request.method === 'POST') {
    const formData = await request.formData();
    const inputPassword = formData.get('viewPassword')?.trim();

    if (inputPassword === data.viewPassword) {
      data.viewed = true;
      await SHARE_KV.put(`share:${id}`, JSON.stringify(data), { expirationTtl: 3600 });
      return new Response(getViewHTML(data), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    } else {
      return new Response(getPasswordFormHTML(data.note, true), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
  }

  // 首次访问显示输入密码页面
  return new Response(getPasswordFormHTML(data.note, false), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}