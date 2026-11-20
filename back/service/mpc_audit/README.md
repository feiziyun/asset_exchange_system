# MPC 多节点审计接入

这条链路对应 PCP 的 `MPC_COMPOSITE`：买家创建任务，卖家上传原始 CSV，后端按用户计算 `y=(a+b)*c`，提交证据给 Hub，等待 Node 共识。旧 `service/mpc` 的 GC 任务代码保留，用于读取已有记录。新任务的订单确认和 VM 导出以 `AUDIT_PASSED` 为门槛。

## 部署

1. 在业务数据库执行 `back/sql/2026-11-16-mpc-audit-jobs.sql`，然后部署前后端代码。数据库迁移必须先于启动新版后端，否则订单查询中的 `mpc_audit_jobs` 关联会失败。
2. 在服务器创建不提交 Git 的 `back/config/mpcAudit.local.json`：

   ```json
   {
     "hubApiBaseUrl": "http://127.0.0.1:18140",
     "pccAuditToken": "填入 Hub 的 PCC 服务凭据"
   }
   ```

   若后端与 Hub 在同一服务器，优先使用 Hub API 实际监听地址。`15140` 是浏览器入口；请根据部署端口映射核实 API 是否为 `18140`。`pccAuditToken` 要与 Hub 配置的 `security.pcc_access_token` 对应，以 `X-PCC-Token` 调用审计 API。它**不是**浏览器进入 Hub 用的 `X-Integration-Token`，也不是 Hub 运维密码或 Node 查看密码。文件建议仅后端运行账号可读。
3. 重启后端，重新构建并部署前端。确认 Hub 中有支持 MPC 且已启用的 Node。

## 接口和数据

- `POST /api/privacy/mpc-audit/create`：买家传 `transactionId`、`threshold`；身份和数字合约从数据库读取。
- `POST /api/privacy/mpc-audit/data`：卖家表单传 `transactionId` 和原始 CSV 文件；`files` 多文件按前 N-1 个为 A、最后一个为 B 分组，与 PCP 相同。也支持单文件 `file`，列为 `user_id,a,b[,c]`。
- `POST /api/privacy/mpc-audit/submit`：卖家传 `transactionId`，后端向 Hub 提交 `MPC_COMPOSITE` 证据。
- `GET /api/privacy/mpc-audit/status?transactionId=...&refresh=1`：买卖双方查询共识。
- `GET /api/privacy/mpc-audit/result?transactionId=...`：买卖双方查询结果；前端在审计通过后展示。

默认提交前 20 条样本供 Hub 核验，本地结果仍计算全部样本。这与 PCP 默认行为一致；如需全量核验，可按原型通过 `MPC_AUDIT_MAX_SAMPLES=0` 设置。上线前应使用真实交易、CSV 和 Hub 节点完成联调。
