# outlook-share-worker

这是一个 Cloudflare Worker，用于生成“Outlook 账号分享链接”，并在对方输入查看密码后展示账号信息与 TOTP 原始密钥，同时限制链接有效期与仅可查看一次。

## 本地开发（可选）

1. 安装并登录 Wrangler（如果你尚未配置）：

```bash
npm i -g wrangler
wrangler login
```

2. 创建并绑定 KV（将得到的 namespace id 填入 `src/wrangler.toml` 的 `[[kv_namespaces]].id`）：

```bash
wrangler kv namespace create SHARE_KV
wrangler kv namespace create SHARE_KV --preview
```

3. 启动本地开发：

```bash
wrangler dev src/index.js
```

## 安全发布/审核说明

本项目按“源码审核（source_only）”流程提交：只进行代码扫描与密钥扫描，不生成构建产物与 Attestation，也不需要 GitHub Actions release workflow。

