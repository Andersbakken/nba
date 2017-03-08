#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR/..src
while true; do
    rm -f log
    ./server -l ./server.log --deploy "$@" | tee log
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
            RESTART=1
        fi
    fi
    [ -z "$RESTART" ] && break
done

