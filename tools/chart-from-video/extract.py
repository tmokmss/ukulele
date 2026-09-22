#!/usr/bin/env python3
"""
コードが画面に表示されるウクレレ練習動画から、譜面を読むための素材を作る。

動画を落として下部のコード帯を切り出し、表示が切り替わった瞬間でページに分割して、
ラベル付きのタイル画像にまとめる。コード名を実際に読むのは目の仕事で、
ここはその手前までを自動化する。

  python extract.py <YouTube URL> -o out/

出来るもの:
  out/pages.json   ページごとの開始・終了秒
  out/tileNN.png   数ページ分を縦に並べた画像。これを読んでコードを書き起こす
"""
import argparse
import glob
import json
import os
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw


def run(cmd):
    subprocess.run(cmd, check=True, capture_output=True)


def download(url, workdir):
    """yt-dlp で 720p までの mp4 を取る。"""
    out = os.path.join(workdir, "video.mp4")
    if os.path.exists(out):
        return out
    run([sys.executable, "-m", "yt_dlp", "--no-warnings",
         "-f", "bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720]",
         "-o", out, url])
    return out


def strip_frames(video, workdir, crop, fps):
    """コード帯だけを切り出した連番画像にする。"""
    d = os.path.join(workdir, "strip")
    shutil.rmtree(d, ignore_errors=True)
    os.makedirs(d)
    run(["ffmpeg", "-loglevel", "error", "-i", video,
         "-vf", f"crop={crop},fps={fps}", "-q:v", "3",
         os.path.join(d, "s%05d.jpg"), "-y"])
    return sorted(glob.glob(os.path.join(d, "*.jpg")))


def find_pages(files, fps, threshold):
    """前のフレームとの差が大きいところをページの切れ目とみなす。

    コード帯は表示が変わるまで完全に静止しているので、差はほぼ 0 か
    はっきり大きいかのどちらかに割れる。しきい値は緩くてよい。
    """
    small = [np.asarray(Image.open(f).convert("L").resize((320, 70)), dtype=np.float32)
             for f in files]
    diff = [0.0] + [float(np.abs(small[i] - small[i - 1]).mean())
                    for i in range(1, len(small))]
    cuts = [i for i, v in enumerate(diff) if v > threshold]
    pages = []
    for k, c in enumerate(cuts):
        end = cuts[k + 1] if k + 1 < len(cuts) else len(files)
        pages.append({"page": k + 1, "start": c / fps, "end": end / fps})
    return pages


def page_images(video, pages, crop, outdir):
    """各ページの代表フレームを 1 枚ずつ書き出す。切り替わり直後は避ける。"""
    d = os.path.join(outdir, "pages")
    os.makedirs(d, exist_ok=True)
    paths = []
    for p in pages:
        t = p["start"] + min(1.2, (p["end"] - p["start"]) / 2)
        path = os.path.join(d, f"p{p['page']:02d}.jpg")
        run(["ffmpeg", "-loglevel", "error", "-ss", str(t), "-i", video,
             "-frames:v", "1", "-vf", f"crop={crop}", "-q:v", "2", path, "-y"])
        paths.append(path)
    return paths


def tiles(paths, outdir, per_tile):
    """読みやすいように数ページずつ縦に連結し、ページ番号を焼き込む。"""
    made = []
    for g in range(0, len(paths), per_tile):
        group = paths[g:g + per_tile]
        ims = [Image.open(f) for f in group]
        canvas = Image.new("RGB", (ims[0].width, sum(i.height for i in ims)), "white")
        y = 0
        for f, im in zip(group, ims):
            canvas.paste(im, (0, y))
            dr = ImageDraw.Draw(canvas)
            dr.rectangle([0, y, 150, y + 26], fill="black")
            dr.text((6, y + 7), os.path.basename(f).replace(".jpg", ""), fill="yellow")
            y += im.height
        path = os.path.join(outdir, f"tile{g // per_tile + 1:02d}.png")
        canvas.save(path)
        made.append(path)
    return made


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("-o", "--out", default="out")
    # 既定は 1280x720 の下 280px。コード帯の位置は動画ごとに違うので、
    # まず適当なフレームを 1 枚見て w:h:x:y を決める。
    ap.add_argument("--crop", default="1280:280:0:440")
    ap.add_argument("--fps", type=float, default=4.0)
    ap.add_argument("--threshold", type=float, default=1.0)
    ap.add_argument("--per-tile", type=int, default=3)
    a = ap.parse_args()

    os.makedirs(a.out, exist_ok=True)
    work = os.path.join(a.out, "work")
    os.makedirs(work, exist_ok=True)

    video = download(a.url, work)
    files = strip_frames(video, work, a.crop, a.fps)
    pages = find_pages(files, a.fps, a.threshold)
    with open(os.path.join(a.out, "pages.json"), "w") as f:
        json.dump(pages, f, indent=2)
    made = tiles(page_images(video, pages, a.crop, work), a.out, a.per_tile)

    span = pages[-1]["start"] - pages[0]["start"]
    per = span / max(len(pages) - 1, 1)
    print(f"ページ {len(pages)} / 1ページ {per:.2f}s / タイル {len(made)}")
    print(f"1ページ4小節4拍なら BPM {4 / (per / 4) * 60:.0f}")


if __name__ == "__main__":
    main()
