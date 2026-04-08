# 山海灵境 API 部署环境变量清单

上线前请逐项核对（Railway / 其他宿主同理）。

## 必填（生产）

| 变量 | 说明 |
|------|------|
| `NODE_ENV` | 设为 `production` |
| `DATABASE_URL` | Prisma PostgreSQL 连接串 |

## 必填（生产，缺失会阻断启动）

| 变量 | 说明 |
|------|------|
| `JWT_SECRET` | 强随机字符串；未设置时服务启动失败 |
| `ALLOWED_ORIGINS` | CORS 白名单，逗号分隔；未设置时服务启动失败 |

## 强烈建议（不阻断启动）

| 变量 | 说明 |
|------|------|
| `EXPO_PUBLIC_API_URL` 或 `NEXT_PUBLIC_API_URL` | 前端 API 基址（含 `/api`）；未设置时前端回退默认 Railway URL 并 **warn** |

## 业务建议

| 变量 | 说明 |
|------|------|
| `POINTS_GATE_ENFORCED` | 设为 `true` 时对测字/占卜等按规则扣积分 |
| `FRONTEND_URL` | 支付成功/取消跳转页所在域名 |
| `CREEM_API_KEY` | 正式支付；未配置时为模拟收银台 |
| `SMTP_*` | 发邮件验证码；生产发送失败时接口不再在响应中返回验证码 |

## 勿在生产开启

| 变量 | 说明 |
|------|------|
| `ALLOW_MOCK_PAYMENT` | 模拟支付，仅排障时短暂开启 |
| `ENABLE_PAYMENT_DEBUG` / `ENABLE_AUTH_DEBUG` | 暴露支付 / SMTP 调试信息 |
| `DEBUG_AUTH` | 打印 SMTP 相关 debug 日志 |

## 可选：E2E 集成测试

```bash
E2E_DATABASE_URL="postgresql://user:pass@host:5432/db" npm run test:e2e
```

未设置 `E2E_DATABASE_URL` 时 `test:e2e` 会跳过该套件（避免无库环境失败）。

## 前端（Expo / Web）

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_API_URL` | 生产构建**必须**设置，例如 `https://your-api.example.com/api` |

## Webhook

- Creem：`POST /api/payment/webhook/creem`，需原始 body 验签（服务已启用 `rawBody`）。
- Stripe：若使用，配置 `stripe-signature` 与对应 secret。

## 观测与排障

- 所有 HTTP 响应（含异常）都会返回 `x-request-id` 响应头。
- 后端错误 JSON 中也会包含 `requestId` 字段，建议前端/客服反馈时携带该值。
