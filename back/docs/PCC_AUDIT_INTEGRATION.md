# PCC 审计接入部署说明

交易后端在创建 HE、PRE、FL 合同和计算批次时，将各自的结果通知地址传给 PCC。PCC 完成计算后提交 Hub，Hub 分发给 Node；只有 PCC 审计放行并签发下载凭据后，交易后端才开放结果下载和订单完成。

部署前，在服务器现有的 `back/config/pcp.local.json` 中补充以下键；保留文件里的既有 PCC 地址和调用凭据。该文件包含密钥，不提交 Git：

```json
{
  "callbackBaseUrl": "http://交易后端可从PCC访问的地址:3007",
  "notifyClientId": "PCC 中 download.token_notify_client_id 的值",
  "notifyClientSecret": "PCC 中 download.token_notify_client_secret 的值"
}
```

`callbackBaseUrl` 必须指向本系统后端，不能指向原型系统的 3000 端口。PCC 若运行在容器中，需使用它能访问的宿主机或服务地址，不要填容器自己的 `127.0.0.1`。通知密钥是 PCC 向交易系统发通知使用的密钥，可能与交易系统调用 PCC 的 `clientSecret` 不同。三种通知路径分别是 `/api/privacy/he/result-notify`、`/api/privacy/pre/result-notify`、`/api/privacy/fl/result-notify`。

部署顺序：先在本系统数据库执行 `back/sql/2026-11-19-pcc-fl-attempt.sql`，再部署后端和前端并重启后端。检查 PCC 到三个通知路径的网络连通性。旧合同创建时保存的回调地址不会因修改配置自动更新；需要通过状态查询或 PCC `/tokens/resend` 恢复其结果凭据。审计失败或 Hub 不可用时不得手工设置 `PAM_PASSED` 或写入下载令牌。

HE、PRE 使用 `current_attempt_id`；FL 新增同名字段，从既有 JSON 批次编号迁移。交易编号保存在 `business_contract_id`，PCC 编号保存在 `pcp_contract_id`，不需要复制 Hub 的审计事件表。

旧的手工 `POST /api/privacy/{he,pre,fl}/result` 元数据入口已停用，避免用户直接写入审计通过状态或下载令牌。买卖双方仍使用原有状态查询和结果下载接口。交易系统自己的下载代理会携带短时内部令牌；PCC 的签名回调不使用用户登录令牌。

交易流程要求：买方付款后由卖方确认交易，双方才可提交 HE/PRE/FL 材料；卖方必须先向 PCC 提交计算批次，才能把订单推进到已交付。`PAMING` 期间仍不可下载或确认收货；`PAM_PASSED` 还需有下载令牌或已保存的结果。计算或审计失败时，卖方可重新提交批次。状态查询与订单列表均返回前端所需的 `result_ready` 等字段。
