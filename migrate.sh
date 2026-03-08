#!/bin/bash
# Railway数据库迁移脚本

# 在Railway上运行迁移
railway run -- npx prisma migrate deploy
