const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

const PORT = 4173;
const DIST_DIR = path.join(__dirname, '..', 'dist');
const OUT_DIR = path.join(__dirname, '..', 'docs', 'screenshots');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  let filePath = path.join(DIST_DIR, urlPath === '/' ? 'index.html' : urlPath);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch (err) {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, async () => {
  console.log(`Server listening on http://localhost:${PORT}`);

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const tempProfile = path.join(os.tmpdir(), 'filemint-edge-profile-' + Date.now());

  const targets = [
    {
      name: 'app-main.png',
      url: `http://localhost:${PORT}/?demo=image&lang=en`,
      desc: 'Studio view with live preview & image configuration',
    },
    {
      name: 'dropzone.png',
      url: `http://localhost:${PORT}/?demo=dropzone&lang=en`,
      desc: 'Drag & drop landing screen',
    },
    {
      name: 'pdf-compression.png',
      url: `http://localhost:${PORT}/?demo=pdf&lang=en`,
      desc: 'PDF optimization profiles',
    },
    {
      name: 'results-summary.png',
      url: `http://localhost:${PORT}/?demo=results&lang=en`,
      desc: 'Batch processing results and savings summary',
    },
  ];

  for (const t of targets) {
    const outFile = path.join(OUT_DIR, t.name);
    console.log(`Capturing ${t.name}...`);
    try {
      const cmd = `"${edgePath}" --headless --disable-gpu --hide-scrollbars --window-size=1280,820 --virtual-time-budget=1500 "--user-data-dir=${tempProfile}" "--screenshot=${outFile}" "${t.url}"`;
      await execAsync(cmd);
      if (fs.existsSync(outFile)) {
        const stat = fs.statSync(outFile);
        console.log(`✓ Saved ${t.name} (${Math.round(stat.size / 1024)} KB)`);
      } else {
        console.warn(`! Output not found for ${t.name}`);
      }
    } catch (e) {
      console.error(`Error capturing ${t.name}:`, e.message);
    }
  }

  try {
    fs.rmSync(tempProfile, { recursive: true, force: true });
  } catch {}

  server.close(() => {
    console.log('Screenshots capture complete.');
    process.exit(0);
  });
});
