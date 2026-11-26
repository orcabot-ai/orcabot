# Security

This early-stage project currently supports security fixes on the main branch.
Do not post exploit details, service keys, private endpoints or conversations in
public issues. Use the repository's GitHub **Security → Report a vulnerability**
channel when available. If private reporting is unavailable, open a minimal issue
requesting a private contact without technical details. No response-time SLA is
promised. Include affected revision, deployment topology, impact and a private
reproduction once a private channel is established.

The service key represents one trusted operator. Keep worker stdout/data private,
use HTTPS/trusted networks remotely, and do not treat that key as a scoped Agent
credential. Unknown execution results must never trigger blind resubmission.

## 中文

请勿在公开 Issue 发布漏洞利用细节、密钥、私有地址或对话。优先使用 GitHub
Security 的私密漏洞报告；不可用时只公开请求私密联系方式，不附技术细节。
目前维护 main 分支，不承诺响应时限。共享密钥不是独立 Agent 的受限凭证。
