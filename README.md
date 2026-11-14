# EdgeIQ Slack Webhook

Automated security scanning delivered directly to your Slack channels. Schedule daily scans or trigger on-demand via slash commands.

## Setup

### 1. Create Slack App

Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From an app manifest** → paste `slack-manifest.yaml` from this repo.

### 2. Get Credentials

- **Bot Token**: OAuth & Permissions → Install to Workspace → copy `xoxb-` token
- **Signing Secret**: Basic Information → App Credentials → Signing Secret
- **EdgeIQ API Key**: [edgeiqlabs.com/developers](https://edgeiqlabs.com/developers/)

### 3. Deploy

```bash
export EDGEIQ_API_KEY="eiq_live_..."
export SLACK_BOT_TOKEN="xoxb-..."
export SLACK_SIGNING_SECRET="..."
node index.js
```

Or deploy via Docker:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json index.js ./
EXPOSE 3000
CMD ["node", "index.js"]
```

### 4. Configure Slash Command

In Slack App settings → Slash Commands → Create:
- Command: `/edgeiq-scan`
- Request URL: `https://your-server.com/`
- Description: Scan a repository for security issues
- Usage hint: `[repository-url]`

## Usage

In any Slack channel where the bot is invited:

```
/edgeiq-scan https://github.com/myorg/myrepo
```

The bot responds with a formatted message showing the security grade, score, top findings, and a link to the full report.

### Scheduled Scans

Use a cron job to POST to the webhook endpoint daily:

```bash
curl -X POST https://your-server.com/scan \
  -H "Content-Type: application/json" \
  -d '{"url":"https://github.com/myorg/myrepo","channel":"#security"}'
```

## Pricing

Uses the EdgeIQ Developer API. Free tier (10 req/min) works for most teams. Upgrade to Pro ($19/mo) for higher limits.

- [Get API Key](https://edgeiqlabs.com/developers/)
- [Compliance Reports](https://edgeiqlabs.com/compliance-report/)

Built by [EdgeIQ Labs](https://edgeiqlabs.com)
