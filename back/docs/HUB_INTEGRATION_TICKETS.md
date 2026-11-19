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

   `hubLaunchHttpOrigin` 必须是浏览器可访问、能转发 `/api/pam/hub-launch` 和 `/api/pam/node-login` 到本系统后端的 **HTTP** 源。这里的 `3007` 仅是示例；按实际入口端口填写。前端若使用 HTTPS，HTTP 中转页可避免浏览器阻止直接向 HTTP Hub 或 Node 提交表单。若本系统页面本身就在 HTTP 下且同源可访问上述路径，此项可留空。
3. `back/config/audit.json` 中的 `hubApiBaseUrl` 仍用于后端访问 Hub API，确保服务器可以连通该地址。重启本系统后端并重新构建、发布前端。
4. 用已分配 `HUB` 审计入口的账号进入，预期先到 Hub 的确认页，再进入只读审计页面。此系统仍按自身权限规则允许审计用户（已分配 Hub）和管理员进入；普通买卖用户没有审计入口。
5. 如需 Node 登录，在各 Node 的 `/ops → 安全与凭据` 创建或确认查看账号，并由管理员给审计用户分配对应的 `NODE:<node_id>` 入口。用户进入时在本系统中转页输入账号和密码，浏览器直接向该 Node 的 `{web_origin}/auditor/web/login` 提交。本系统不再使用 `pam_node_credentials` 中保存的旧密码，也不要求配置 `nodeCredentialKey` 来完成新登录。旧表保留以免破坏现有数据，可后续单独迁移清理。

Hub 接入无需授权回调 URL、登录回执或合同编号；PCC 的 `callback_url` 只用于计算任务交付。Hub 运维台「部署配置 → 浏览器会话」的公开地址应是浏览器可访问的 `http://10.112.191.163:15140`。

代码也支持 `HUB_INTEGRATION_TOKEN` 和 `HUB_LAUNCH_HTTP_ORIGIN` 环境变量；本地配置文件优先。
