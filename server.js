const express = require("express");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const app = express();
const port = 8000;

// helper to get duration
function getDuration(url, cb) {
  exec(`yt-dlp --dump-json --skip-download "${url}"`, (err, stdout) => {
    if (err) return cb(0);
    try {
      const info = JSON.parse(stdout.split("\n")[0]);
      cb(info.duration || 0);
    } catch {
      cb(0);
    }
  });
}

// pick format based on duration
function pickFormat(duration) {
  if (duration <= 8*60) return "bestvideo[height<=720]+bestaudio/best[height<=720]";
  if (duration <= 18*60) return "bestvideo[height<=480]+bestaudio/best[height<=480]";
  if (duration <= 38*60) return "bestvideo[height<=360]+bestaudio/best[height<=360]";
  return "bestvideo[height<=240]+bestaudio/best[height<=240]";
}

// streaming endpoint
app.get("/stream", (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({error:"missing url"});

  getDuration(url, duration => {
    const fmt = pickFormat(duration);
    const cmd = `yt-dlp -o - -f "${fmt}" "${url}"`;
    const proc = exec(cmd, { maxBuffer: Infinity });
    res.setHeader("Content-Type", "video/webm");
    proc.stdout.pipe(res);
  });
});

// download endpoint
app.get("/download", (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({error:"missing url"});

  getDuration(url, duration => {
    const fmt = pickFormat(duration);
    const filename = `${Date.now()}.webm`;
    const filepath = path.join("/tmp", filename);
    const cmd = `yt-dlp -o "${filepath}" -f "${fmt}" "${url}"`;

    exec(cmd, (err) => {
      if (err) return res.status(500).json({error:"download failed"});

      res.download(filepath, "video.webm", (err) => {
        fs.unlink(filepath, () => {}); // auto-clean tmp
      });
    });
  });
});

app.listen(port, () => console.log(`YT-DLP API running on port ${port}`));
