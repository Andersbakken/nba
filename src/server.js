#!/usr/bin/env node

/*global require, __dirname, setTimeout */
const argv = require('yargs').usage("Usage: %0 --game [arg] --max-time [time] --log-file [file] --verbose|-v --clear-cache|-C").argv;

const NBA = require('./NBA.js');
const process = require('process');
const safe = require('safetydance');
const express = require('express');
const fs = require('fs');
const clone = require('clone');
const Net = require('./Net.js');
const bsearch = require('binary-search');
const GameParser = require('./GameParser.js');
const Log = require('./Log.js');
const log = Log.log;
const verbose = Log.verbose;
const fatal = Log.fatal;
Log.init(argv);

const port = argv.port || argv.p || 8899;

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
var net = new Net({cacheDir: (argv.cacheDir || __dirname + "/cache/"), clear: (argv.C || argv["clear-cache"]) });

var host = `localhost:${port}`;
function formatGame(game)
{
    var match = /^(.*)\/([A-Z][A-Z][A-Z])([A-Z][A-Z][A-Z])$/.exec(game.gameUrlCode);
    return {
        home: match[3],
        away: match[2],
        gameId: game.gameId,
        gameTime: game.gameTime,
        url: `http://${host}/api/games/${match[1]}/${game.gameId}`
    };
}

// curl -v http://localhost:8899/api/games/list/20170129
function gamesByDate(req, res, next) {
    // console.log(req.params);
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
            req.games.push(formatGame(schedule[idx]));
        } while (++idx < schedule.length && schedule[idx].gameTime.getDate() == date.getDate());
    }
    next();
}

app.get('/api/games/:date', gamesByDate, (req, res, next) => {
    if (req.games) {
        res.send(JSON.stringify(req.games) + "\n");
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

    var gameSpec;
    var gameId = parseInt(req.params.game);
    if (!gameId) {
        gameSpec = req.params.game;
    }

    var game;
    for (var i=0; i<req.games.length; ++i) {
        if (gameId) {
            if (req.games[i].gameId == gameId) {
                game = req.games[i];
                break;
            }
        } else if (gameSpec == `${req.games[i].away}@${req.games[i].home}`) {
            game = req.games[i];
            break;
        }
    }
    if (!game) {
        next(new Error(`Can't find game ${req.params.game}`));
        return;
    }

    var quarters = [];
    function getNextQuarter() {
        return net.get(`http://data.nba.net/data/10s/prod/v1/${req.params.date}/${game.gameId}_pbp_${quarters.length + 1}.json`).then(function(data) {
            if (data.statusCode != 200) {
                done = true;
            } else {
                var quarterData = JSON.parse(data.body);
                if (!(quarterData.plays instanceof Array)) {
                    throw new Error("Invalid quarter data: " + data.url);
                }
                quarters.push(quarterData);

                var lastPlay = quarterData.plays[quarterData.plays.length - 1];
                var done = false;
                if (!lastPlay || lastPlay.description != 'End Period') {
                    net.clearCache(data.url);
                    done = true;
                } else if (quarters.length >= 4 && lastPlay.hTeamScore != lastPlay.vTeamScore) {
                    done = true;
                }
                safe.fs.writeFileSync(`/tmp/quarter_${quarters.length}.json`, JSON.stringify(quarterData, undefined, 4));
            }
            if (done) {
                return GameParser.parseQuarters(league, { gameData: game, quarters: quarters});
            } else {
                return getNextQuarter();
            }
        });
    }
    getNextQuarter().then(function(response) {
        // console.log(Object.keys(response), response instanceof NBA.Game);
        req.game = response;
        next();
    }).catch(function(error) {
        console.log("Got error", error);
        // next(new Error(error));
    });
}

app.get('/api/games/:date/:game', findGame, (req, res, next) => {
    verbose("Requested", req.url);
    if (req.game) {
        var encoded = req.game.encode(league);
        res.send(JSON.stringify(encoded) + "\n");
    } else {
        res.sendStatus(404);
    }
});

function query(req, res, next)
{
    var id = parseInt(req.params.spec);
    var ret = [];
    // console.log(gameId, req.params.spec);
    if (!id) {
        schedule.forEach((game) => {
            var match = /([A-Z][A-Z][A-Z])([A-Z][A-Z][A-Z])$/.exec(game.gameUrlCode);
            // console.log(`${match[1]}@${match[2]}`, req.params.spec);
            if (`${match[1]}@${match[2]}` == req.params.spec)
                ret.push(formatGame(game));
        });
    } else {
        schedule.forEach((game) => {
            if (id == game.gameId) {
                ret.push(formatGame(game));
            }
        });
        var p = league.players[id];
        if (p)
            ret.push(p.encode());
    }

    var t = league.find(req.params.spec);
    if (t)
        ret.push(league.encodeTeam(t));
    req.matches = ret;
    next();
}

app.get('/api/query/:spec', query, (req, res, next) => {
    // verbose("Requested", req.url);
    if (req.matches.length == 1) {
        res.send(JSON.stringify(req.matches[0]) + "\n");
    } else if (req.matches.length > 1) {
        res.send(JSON.stringify(req.matches) + "\n");
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

var season = NBA.currentSeasonName(); // ### The server has to restart between seasons
function refreshPlayerCache()
{
    function work(resolve) {
        net.get({url: `http://stats.nba.com/stats/commonallplayers/?LeagueId=00&Season=${season}&IsOnlyCurrentSeason=1`, validate: league.players != undefined })
            .then(function(result) {
                if (result.statusCode == 200) {
                    var start = resolve && !league.players;
                    league.players = {};
                    if (!start) {
                        league.forEachTeam(function(team) {
                            team.players = {};
                        });
                    }
                    var data = JSON.parse(result.body);
                    var resultSet0 = data.resultSets[0];
                    var indexes = {};
                    for (var i=0; i<resultSet0.headers.length; ++i) {
                        indexes[resultSet0.headers[i]] = i;
                    }
                    resultSet0.rowSet.forEach((player) => {
                        var p = new NBA.Player(player[indexes.DISPLAY_LAST_COMMA_FIRST], player[indexes.PERSON_ID]);
                        league.players[p.id] = p;
                        var team = player[indexes.TEAM_ABBREVIATION];
                        if (team)
                            league.find(team).players[p.id] = p;

                    });
                    // console.log(`GOT ${Object.keys(league.players).length} PLAYERS`);
                    safe.fs.writeFileSync(`/tmp/allplayers.json`, JSON.stringify(JSON.parse(result.body), undefined, 4));
                    if (start)
                        resolve();
                } else if (result.statusCode == 304) {
                    verbose("validated players");
                } else {
                    console.log("Can't get commonallplayers");
                }
                // setTimeout(refreshPlayerCache, 5 * 60 * 1000);
                setTimeout(work, 60 * 60000); // refresh every hour
            });

    }
    return new Promise(function(resolve) { work(resolve); });
}

var all = [
    net.get('http://www.nba.com/data/10s/prod/v1/' + (NBA.currentSeasonYear() - 1) + '/schedule.json'),
    refreshPlayerCache()
];
// league.forEachTeam(function(team) {
//     all.push(net.get(`http://stats.nba.com/stats/commonteamroster/?TeamId=${team.id}&Season=${season}`));
// });

Promise.all(all).then(function(responses) {
    var response = responses[0];
    var parsed = safe.JSON.parse(response.body);

    if (!parsed) {
        throw new Error("Couldn't parse schedule " + response.url);
        net.clearCache(response.url);
        return undefined;
    }
    safe.fs.writeFileSync("/tmp/schedule.json", JSON.stringify(parsed, undefined, 4));

    schedule = parsed.league.standard;
    for (var idx=0; idx<schedule.length; ++idx) {
        schedule[idx].gameTime = new Date(schedule[idx].startTimeUTC);
        gamesById[schedule[idx].gameId] = schedule[idx];
    }

    // console.log("Got responses", responses.length);

    app.listen(port, () => {
        console.log("Listening on port", (argv.port || argv.p || 8899));
    });

    if (argv["test"]) {
        // /api/games/20170204/0021600758 doesn't work
        return net.get({url: "http://localhost:8899/api/games/20170204/0021600758", nocache: true }).then((response) => {
            safe.fs.writeFileSync("/tmp/game.json", response.body);
            safe.fs.writeFileSync("/tmp/game.pretty.json", JSON.stringify(JSON.parse(response.body), null, 4));
            var game = NBA.Game.decode(JSON.parse(response.body), league);
            var box = new NBA.BoxScore(game, league);
            box.print();
            process.exit();
        });
    }
    return undefined;
}).catch(fatal);
