# Railway 部署配置

## 环境变量

在 Railway 项目设置中添加以下环境变量：

```env
# 必需
PORT=3000
NODE_ENV=production

# JWT 密钥
JWT_SECRET=your-super-secret-jwt-key

# 多模态 (Gemini) - 手写识别等需要图片的
LLM_API_KEY=your_gemini_api_key_here
LLM_API_URL=https://api.apiyi.com/v1/chat/completions
LLM_MODEL=gemini-2.5-flash

# 纯文本 (DeepSeek) - 测字解读、八字解读、抽签、对话等
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions
DEEPSEEK_MODEL=deepseek-chat
```

## 部署步骤

### 方式一：Railway CLI（推荐）

```bash
# 1. 安装 Railway CLI
npm install -g @railway/cli

# 2. 登录
railway login

# 3. 初始化项目
cd shanhai-server
railway init

# 4. 部署
railway deploy
```

### 方式二：GitHub 自动部署

1. **推送代码到 GitHub**
   ```bash
   cd /Users/wangjie/Documents/山海灵境
   git add .
   git commit -m "Add Railway config"
   git push origin main
   ```

2. **在 Railway 创建项目**
   - 访问 https://railway.app
   - 使用 GitHub 登录
   - 点击 "New Project" → "Deploy from GitHub repo"
   - 选择 `shanhai-server` 仓库
   - 添加环境变量

3. **配置自动部署**
   - 每次推送到 main 分支会自动部署

### 方式三：直接从仪表盘部署

1. 访问 https://railway.app
2. 创建新项目
3. 选择 "Deploy from GitHub repo"
4. 选择仓库后，Railway 会自动检测 NestJS 项目
5. 添加环境变量
6. 点击 Deploy

## 部署完成后的 API 地址

部署成功后，Railway 会提供一个类似以下的 URL：
```
https://your-project-name.up.railway.app
```

将 `localhost:3000` 替换为这个 URL 用于测试。

## 监控和日志

```bash
# 查看日志
railway logs

# 查看状态
railway status

# 打开仪表盘
railway open
```

## 扩展（可选）

### 添加数据库

```bash
# 创建 PostgreSQL 数据库
railway add postgresql
```

Railway 会自动设置 `DATABASE_URL` 环境变量。

### 扩展配置

在 `railway.json` 中修改：
```json
{
  "deploy": {
    "numReplicas": 2  // 增加实例数量
  }
}
```

## 常见问题

### Q: 部署失败怎么办？
A: 查看日志 `railway logs` 排查问题。常见错误：
- 端口未正确配置 → 检查 PORT 环境变量
- 依赖安装失败 → 检查 package.json

### Q: 如何更新部署？
A: 推送代码到 GitHub，Railway 会自动重新部署

### Q: 如何绑定域名？
A: Railway Pro 用户可以在项目设置中添加自定义域名
