#!/usr/bin/env node

/*global require, __dirname */
const argv = require('yargs').usage("Usage: %0 --game [arg] --max-time [time] --log-file [file] --verbose").argv;

const NBA = require('./NBA.js');
const process = require('process');
const safe = require('safetydance');
const express = require('express');
const fs = require('fs');
const Net = require('./Net.js');
const bsearch = require('binary-search');
const GameParser = require('./GameParser.js');
var Log = require('./Log.js');
var log = Log.log;
var verbose = Log.verbose;
Log.init(argv);

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

app.get('/api/games/:date', gamesByDate, (req, res, next) => {
    if (req.games) {
        res.send(JSON.stringify(req.games));
    } else {
        res.sendStatus(404);
    }
});

function findGame(req, res, next) {
    var err;
    gamesByDate(req, res, function(error) { err = error; });
    if (err) {
        next(err);
        return;
    }

    if (!req.games) {
        next(new Error("Couldn't find games"));
        return;
    }

    var game;
    for (var i=0; i<req.games.length; ++i) {
        if (req.games[i].gameId == req.params.gameid) {
            game = req.games[i];
            break;
        }
    }
    if (!game) {
        next(new Error(`Can't find game ${req.params.gameid}`));
        return;
    }

    console.log(`requesting game http://localhost:8899/api/games/${req.params.date}/${req.params.gameid}`);
    var quarters = [];
    function getNextQuarter() {
        var url = `http://data.nba.net/data/10s/prod/v1/${req.params.date}/${req.params.gameid}_pbp_${quarters.length + 1}.json`;
        net.get(url, function(err, data) {
            if (err) {
                next(new Error(err));
                return;
            }
            if (data.statusCode != 200) {
                next(new Error(`Got ${data.statusCode} for ${url}`));
                return;
            }
            var quarterData;
            try {
                quarterData = JSON.parse(data.body);
            } catch (err) {
                next(new Error(err));
                return;
            }
            if (!quarterData || !(quarterData.plays instanceof Array)) {
                next(new Error("Invalid quarter data: " + url));
                return;
            }
            if (!quarterData.plays.length) {
                GameParser.parseQuarters(league, net, { gameData: game, quarters: quarters}, function(error, result) {
                    if (error) {
                        next(new Error(error));
                    } else {
                        req.game = result;
                        next();
                    }
                });
            } else {
                safe.fs.writeFileSync(`/tmp/quarter_${quarters.length + 1}.json`, JSON.stringify(quarterData, undefined, 4));
                quarters.push(quarterData);
                getNextQuarter();
            }
        });
    }
    getNextQuarter();
}

app.get('/api/games/:date/:gameid', findGame, (req, res, next) => {
    if (req.game) {
        res.send(req.game.encode(league));
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
    if (argv["test"]) {
        net.get({url: "http://localhost:8899/api/games/20170206/0021600770", nocache: true }, function(err, response) {
            if (err || response.statusCode != 200) {
                console.log("BAD", response.statusCode, err);
            } else {
                var game = NBA.Game.decode(JSON.parse(response.body), league);
                var box = new NBA.BoxScore(game);
                box.print();
            }
            process.exit();
        });
    }
    // console.log(gamesByDate(new Date()));
});
