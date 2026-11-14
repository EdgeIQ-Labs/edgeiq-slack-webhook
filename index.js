const https = require('https');
const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const EDGEIQ_API_KEY = process.env.EDGEIQ_API_KEY || '';
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || '';
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || '';

function verifySlackSignature(req, body) {
  const timestamp = req.headers['x-slack-request-timestamp'];
  const signature = req.headers['x-slack-signature'];
  if (!timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) return false;
  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = 'v0=' + crypto.createHmac('sha256', SLACK_SIGNING_SECRET).update(sigBasestring).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(signature));
}

async function runScan(url) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ url });
    const options = {
      hostname: 'edgeiqlabs.com',
      path: '/api/v1/repo-scan',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EDGEIQ_API_KEY}`,
        'Content-Length': data.length
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch(e) { reject(new Error('Invalid response')); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function postToSlack(channel, blocks) {
  const data = JSON.stringify({ channel, blocks });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'slack.com',
      path: '/api/chat.postMessage',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function buildBlocks(result, scanUrl) {
  const grade = result.grade || 'N/A';
  const score = result.score || 0;
  const emoji = grade.startsWith('A') ? ':large_green_circle:' : grade.startsWith('B') ? ':large_yellow_circle:' : grade.startsWith('C') ? ':large_orange_circle:' : ':red_circle:';
  const findings = (result.findings || []).slice(0, 5);
  const findingLines = findings.map(f => `• *${(f.severity || f.level || 'info').toUpperCase()}*: ${f.description || f.message || f.name || 'Unknown'}`).join('\n');
  return [
    { type: 'header', text: { type: 'plain_text', text: `${emoji} EdgeIQ Security Scan: Grade ${grade} (${score}/100)` }},
    { type: 'section', text: { type: 'mrkdwn', text: `*Repository:* ${scanUrl}\n${findingLines || '_No findings — looking good! :tada:_'}\n\n<https://edgeiqlabs.com/free-repo-scanner/?url=${encodeURIComponent(scanUrl)}|View full report> · <https://edgeiqlabs.com/developers/|Get API Key>` }}
  ];
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200); res.end('ok'); return;
  }
  if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    if (SLACK_SIGNING_SECRET && !verifySlackSignature(req, body)) {
      res.writeHead(401); res.end('Invalid signature'); return;
    }
    try {
      const payload = new URLSearchParams(body);
      const text = payload.get('text') || '';
      const channelId = payload.get('channel_id') || '';
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({response_type:'in_channel',text:'Running EdgeIQ security scan...'}));
      if (text) {
        const result = await runScan(text);
        const blocks = buildBlocks(result, text);
        await postToSlack(channelId, blocks);
      }
    } catch(err) {
      console.error('Error:', err.message);
    }
  });
});

server.listen(PORT, () => console.log(`EdgeIQ Slack webhook listening on :${PORT}`));
module.exports = { runScan, buildBlocks, postToSlack };
