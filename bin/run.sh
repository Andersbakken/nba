#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR/../src
if [ -z "$NBA_SECRET" ]; then
    echo "No secret passed"
    exit 1
fi

BROWSERIFY="browserify -o $DIR/../src/www/bundle.js $DIR/../src/webpage.js"
eval $BROWSERIFY

while true; do
    rm -f log
    ./server.js -l ./server.log --deploy "$NBA_SECRET" "$@" | tee log
    RESTART=
    if [ ! "$?" -eq 0 ]; then
        /bin/mv log crash.log.`date +%s`
        RESTART=1
    fi
    if [ -e '.deploy.pull' ]; then
        rm ".deploy.pull"
        STASHED=
        if [[ `git status --porcelain | grep -v "??"` ]]; then
            STASHED=1
            git stash
        fi
        if git pull; then
            if [ -n "$STASHED" ]; then
                git stash pop
            fi
            npm install
            eval $BROWSERIFY
            RESTART=1
        fi
    fi
    [ -z "$RESTART" ] && break
done

