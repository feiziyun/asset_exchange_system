# Hub 新版票据入口部署说明

原型 `pcp` 的 `4ec3dc3` 已弃用 `/entry/start`、`request_id` 和 `/api/pam/authorize`。本系统由后端以 `X-Integration-Token` 申请 Hub 票据，浏览器再以表单提交 `ticket`。

1. 在 Hub 运维台「安全与凭据 → 接入系统」为本系统单独创建接入凭据。**Hub 运维密码与旧 `hubTradingToken` 都不是该凭据。**
2. 在服务器的 `back/config/audit.integration.local.json` 填写，文件已加入 `.gitignore`，不要提交到 Git：

   ```json
   {
     "hubIntegrationToken": "从 Hub 运维台新建的接入凭据",
     "hubLaunchHttpOrigin": "http://10.112.191.163:3007"
   }
   ```

   `hubLaunchHttpOrigin` 必须是浏览器可访问、能转发 `/api/pam/hub-launch` 到本系统后端的 **HTTP** 源。这里的 `3007` 仅是示例；应按实际公网或内网入口端口填写。前端若使用 HTTPS，HTTP 中转页可避免浏览器阻止直接向 HTTP Hub 提交表单。
3. `back/config/audit.json` 中的 `hubApiBaseUrl` 仍用于后端访问 Hub API，确保服务器可以连通该地址。重启本系统后端并重新构建、发布前端。
4. 用已分配 `HUB` 审计入口的账号进入，预期先到 Hub 的确认页，再进入只读审计页面。Node 登录仍使用已有节点目录和已配置查看账号；需保留原有 `nodeCredentialKey`。

代码也支持 `HUB_INTEGRATION_TOKEN` 和 `HUB_LAUNCH_HTTP_ORIGIN` 环境变量；本地配置文件优先。
