#!/usr/bin/env node

/*global require, __dirname */
const argv = require('yargs').usage("Usage: %0 --game [arg] --max-time [time]").argv;

const NBA = require('./NBA.js');
const process = require('process');
const safe = require('safetydance');
const express = require('express');
const fs = require('fs');
const Net = require('./Net.js');
const bsearch = require('binary-search');
const parseGame = require('./GameParser.js');

const lowerBound = function(haystack, needle, comparator) {
    var idx = bsearch(haystack, needle, comparator);
    if (idx < 0) {
        idx = -idx;
        while (idx > 0 && comparator(haystack[idx - 1], needle) > 0)
            --idx;
    } else {
        while (idx > 0 && !comparator(haystack[idx - 1], needle))
            --idx;
    }
    return idx;
};
var schedule;
var gamesById = {};

var league = new NBA.League;

var app = express();
var net = new Net({cacheDir: (argv.cacheDir || __dirname + "/cache/") });

// curl -v http://localhost:8899/api/games/list/20170129
function gamesByDate(req, res, next) {
    var date = new Date(parseInt(req.params.date.substr(0, 4)),
                        parseInt(req.params.date.substr(4, 2)) - 1,
                        parseInt(req.params.date.substr(6)));
    // console.log(date, req.params.date);

    var obj = { gameTime: date };
    if (!(obj.gameTime instanceof Date)) {
        next(new Error("Bad date"));
        return;
    }
    var idx = lowerBound(schedule, obj, function(l, r) {
        return l.gameTime.valueOf() - r.gameTime.valueOf();
    });
    req.games = [];
    if (idx < schedule.length) {
        do {
            var teams = /([A-Z][A-Z][A-Z])([A-Z][A-Z][A-Z])$/.exec(schedule[idx].gameUrlCode);
            req.games.push({ home: teams[2], away: teams[1], gameId: schedule[idx].gameId, gameTime: schedule[idx].gameTime });
        } while (++idx < schedule.length && schedule[idx].gameTime.getDate() == date.getDate());
    }
    next();
}

app.get('/api/games/list/:date', gamesByDate, (req, res, next) => {
    if (req.games) {
        res.send(JSON.stringify(req.games));
    } else {
        res.sendStatus(404);
    }
});

function findGame(req, res, next) {
    console.log("requesting game", req.params.gameid);
    var url = `http://stats.nba.com/stats/playbyplayv2?GameId=${req.params.gameid}&StartPeriod=1&EndPeriod=14`;
    net.get(url, function(err, data) {
        if (err) {
            next(new Error(err));
            return;
        }
        // console.log("GOT GAME", JSON.stringify(JSON.parse(data.body), undefined, 4));
        req.game = data.body;
        safe.fs.writeFileSync("/tmp/game.json", JSON.stringify(JSON.parse(data.body), undefined, 4));
        try {
            parseGame(league, JSON.parse(data.body), function(error, game) {
                if (error) {
                    net.clearCache(url);
                    next(new Error(error));
                } else {
                    req.game = game;
                    // if (!req.game.events.length || req.game
                    next();
                }
            });
        } catch (err) {
            net.clearCache(url);
            next(new Error(err));
        }
    });
}

app.get('/api/games/:gameid', findGame, (req, res, next) => {
    if (req.game) {
        res.send(req.game.encode(league));
        var box = new NBA.BoxScore(req.game, new NBA.Time(1451000));
        box.print();
    } else {
        res.sendStatus(404);
    }
});

app.get("/", (req, res) => {
    res.redirect("/index.html");
});

fs.readdirSync(__dirname + "/www/").forEach((file) => {
    app.get("/" + file, (req, res) => {
        res.contentType(file);
        fs.createReadStream(__dirname + "/www/" + file).pipe(res);
    });
});

net.get('http://www.nba.com/data/10s/prod/v1/' + (NBA.currentSeasonYear() - 1) + '/schedule.json', (error, response) => {
    if (error) {
        console.error("Couldn't get schedule", error);
        process.exit(1);
        return;
    }
    var parsed = safe.JSON.parse(response.body);
    if (!parsed) {
        console.error("Couldn't parse schedule " + response.url);
        net.clearCache(response.url);
        process.exit(1);
        return;
    }
    schedule = parsed.league.standard;
    for (var idx=0; idx<schedule.length; ++idx) {
        schedule[idx].gameTime = new Date(schedule[idx].startTimeUTC);
        gamesById[schedule[idx].gameId] = schedule[idx];
    }
    // console.log(JSON.stringify(schedule[0], null, 4));
    // console.log("GOT RESPONSE", error, response);
    // console.log(response);
    // console.log(JSON.stringify(schedule, undefined, 4));
    // process.exit(0);
    // console.log(Object.keys(schedule.league.standard));
    app.listen(argv.port || argv.p || 8899, () => {
        console.log("Listening on port", (argv.port || argv.p || 8899));
    });
    // console.log(gamesByDate(new Date()));
});

// console.log(Date.parse('2017-01-09T02:00:00.000Z'));
// var d = new Date('2017-01-09T02:00:00.000Z');
// console.log("typeof", typeof d);
// console.log(d instanceof Date);
// process.exit(1);

// argv._.forEach((arg) => {
//     var game = parse(arg);
//     var box = new BoxScore(game, argv["max-time"] || argv.m);
//     // box.print();
//     // console.log(JSON.stringify(game.encode(league), null, 4));
// });


// ### TODO
// Make sure cache doesn't grow too large? maybe not
// Use https
// need to deal with ongoing games, revalidate caches (304, if-modified-since etc)
