#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR/../src/www/garden
rm -rf tmp
mkdir tmp
cd tmp
echo 1 > idx
find -maxdepth 1 .. -name "*.jpg" | sort | while read i; do
    IDX=`cat idx`
    # echo $IDX
    ln -s "$i" "$(printf %05d ${IDX}).jpg"
    IDX=$(($IDX + 1))
    echo $IDX > idx
done

if ffmpeg -r 24 -i '%05d.jpg' -s hd1080 -crf 24 -preset superfast -vcodec libx264 timelapse.mp4; then
    /bin/mv timelapse.mp4 ../timelapse.mp4
fi

rm -rf "$PWD"

