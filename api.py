from flask import Flask, request, send_file, Response
import subprocess, os, uuid, json

app = Flask(__name__)

# helper: get duration in seconds
def get_duration(url: str) -> int:
    proc = subprocess.run(
        ["yt-dlp", "--dump-json", "--skip-download", url],
        stdout=subprocess.PIPE, text=True
    )
    if proc.returncode != 0:
        return 0
    try:
        info = json.loads(proc.stdout.splitlines()[0])
        return int(info.get("duration", 0))
    except Exception:
        return 0

# helper: pick format based on rules
def pick_format(duration: int) -> str:
    if duration <= 8*60:      # 8 min
        return "bestvideo[height<=720]+bestaudio/best[height<=720]"
    elif duration <= 18*60:   # 18 min
        return "bestvideo[height<=480]+bestaudio/best[height<=480]"
    elif duration <= 38*60:   # 38 min
        return "bestvideo[height<=360]+bestaudio/best[height<=360]"
    else:                     # above
        return "bestvideo[height<=240]+bestaudio/best[height<=240]"

@app.route("/stream")
def stream():
    url = request.args.get("url")
    if not url:
        return {"error": "missing url"}, 400
    
    duration = get_duration(url)
    fmt = pick_format(duration)

    process = subprocess.Popen(
        ["yt-dlp", "-o", "-", "-f", fmt, url],
        stdout=subprocess.PIPE
    )
    return Response(process.stdout, content_type="video/webm")

@app.route("/download")
def download():
    url = request.args.get("url")
    if not url:
        return {"error": "missing url"}, 400
    
    duration = get_duration(url)
    fmt = pick_format(duration)

    filename = f"{uuid.uuid4()}.webm"
    out_path = os.path.join("/tmp", filename)

    subprocess.run(["yt-dlp", "-o", out_path, "-f", fmt, url])

    return send_file(out_path, mimetype="video/webm",
                     as_attachment=True, download_name="video.webm")
