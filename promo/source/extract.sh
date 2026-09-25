#!/bin/bash
# Extract 30fps JPEG frames from recorded clips (hi-DPI clips downscaled to 2400px wide).
FF=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
mkdir -p frames
for c in join paint place views intent pot objects making teacher kit; do
  rm -rf frames/$c; mkdir -p frames/$c
  w=$($FF -i clips/$c.mp4 2>&1 | grep -oP ', \K\d+(?=x\d+)' | head -1)
  sc=""; [ "$w" -gt 1600 ] && sc=",scale=2400:1350:flags=lanczos"
  $FF -loglevel error -y -i clips/$c.mp4 -vf "fps=30$sc" -q:v 3 frames/$c/%05d.jpg
  echo $c $(ls frames/$c | wc -l)
done
# hero background: landscaped school in 360° view (real app frame)
$FF -loglevel error -y -ss 3.6 -i clips/views.mp4 -frames:v 1 -q:v 2 frames/hero.jpg
