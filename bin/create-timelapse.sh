#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR/../src/www/garden
rm -f timelapse.tmp.mp4
ffmpeg -r 24 -pattern_type glob -i '*.jpg' -s hd1080 -vcodec libx264 timelapse.tmp.mp4
mv timelapse.tmp.mp4 timelapse.mp4

