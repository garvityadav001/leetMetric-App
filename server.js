const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

function serveStaticFile(res, filePath) {
  const safePath = path.normalize(filePath);

  fs.readFile(safePath, (err, content) => {
    if (err) {
      if (filePath.endsWith('/index.html')) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }

      serveStaticFile(res, path.join(ROOT, 'index.html'));
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    };

    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

async function fetchLeetCodeUser(username) {
  const query = `
    query userSessionProgress($username: String!) {
      allQuestionsCount {
        difficulty
        count
      }
      matchedUser(username: $username) {
        submitStats {
          acSubmissionNum {
            difficulty
            count
            submissions
          }
          totalSubmissionNum {
            difficulty
            count
            submissions
          }
        }
      }
    }
  `;

  const response = await fetch('https://leetcode.com/graphql/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Referer': 'https://leetcode.com/',
      'Origin': 'https://leetcode.com',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    },
    body: JSON.stringify({
      query,
      variables: { username }
    })
  });

  if (!response.ok) {
    throw new Error(`LeetCode request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data;
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (requestUrl.pathname === '/api/leetcode-user') {
    const username = requestUrl.searchParams.get('username') || '';

    if (!username.trim()) {
      sendJson(res, 400, { error: 'Username is required' });
      return;
    }

    try {
      const data = await fetchLeetCodeUser(username);
      if (data.errors || !data.data || !data.data.matchedUser) {
        sendJson(res, 404, { error: 'User not found or profile is private' });
        return;
      }
      sendJson(res, 200, data);
    } catch (error) {
      sendJson(res, 500, { error: error.message || 'Unable to fetch user details' });
    }
    return;
  }

  const relativePath = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
  const filePath = path.join(ROOT, relativePath);

  if (filePath.startsWith(ROOT)) {
    serveStaticFile(res, filePath);
    return;
  }

  res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Forbidden');
});

server.listen(PORT, () => {
  console.log(`LeetMetric server running on http://localhost:${PORT}`);
});
