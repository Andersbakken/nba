/* global require, module */

const NBA = require('./NBA.js');
const assert = require('assert');
const safe = require('safetydance');

function parseQuarters(league, net, data, cb) {
    var home = league.find(data.gameData.home);
    var away = league.find(data.gameData.away);
    if (!home) {
        cb(`Can't find home team from ${data.gameData.home}`);
        return;
    }
    if (!away) {
        cb(`Can't find home team from ${data.gameData.away}`);
        return;
    }

    var game = new NBA.Game(home, away);
    var season = NBA.currentSeasonName();
    var homePlayerData = -1, awayPlayerData = -1;
    var playerDataIndexes = {};
    var errors = [];

    // ### this code is atrocious and needs promises
    net.get(`http://stats.nba.com/stats/commonteamroster/?TeamId=${home.id}&Season=${season}`, function(error, result) {
        if (error) {
            homePlayerData = error;
        } else {
            try {
                homePlayerData = JSON.parse(result.body);
                if (homePlayerData) {
                    for (var i=0; i<homePlayerData.resultSets[0].headers.length; ++i) {
                        playerDataIndexes[homePlayerData.resultSets[0].headers[i]] = i;
                    }
                }
            } catch (err) {
                homePlayerData = err;
            }
        }
        parse();
    });
    net.get(`http://stats.nba.com/stats/commonteamroster/?TeamId=${away.id}&Season=${season}`, function(error, result) {
        if (error) {
            awayPlayerData = error;
        } else {
            try {
                awayPlayerData = JSON.parse(result.body);
            } catch (err) {
                awayPlayerData = err;
            }
        }
        parse();
    });

    function parse() {
        if (homePlayerData == -1 || awayPlayerData == -1)
            return;

        if (typeof homePlayerData == 'string') {
            cb(`Couldn't get home team data: ${homePlayerData}`);
            return;
        }
        if (typeof awayPlayerData == 'string') {
            cb(`Couldn't get away team data: ${awayPlayerData}`);
            return;
        }

        safe.fs.writeFileSync(`/tmp/home.json`, JSON.stringify(homePlayerData, undefined, 4));
        safe.fs.writeFileSync(`/tmp/away.json`, JSON.stringify(awayPlayerData, undefined, 4));

        var seenPlayerIds = {};

        data.quarters.forEach(function(q) {
            q.plays.forEach(function(play) {
                if (play.personId)
                    seenPlayerIds[play.personId] = true;
            });
        });

        var homePlayers = {};
        var awayPlayers = {};
        var lastTeamMiss;
        var quarter = 0;

        while (true) {
            if (data.quarters.length <= quarter)
                break;
            var plays = data.quarters[quarter].plays;
            game.events.push(new NBA.Event(NBA.Event.QUARTER_START, NBA.Time.quarterStart(quarter), undefined, quarter));

            plays.forEach(function(play) {
                var description = play.description;
                // console.log("description", description);
                if (!description)
                    return;
                var match = /\[([A-Z][A-Z][A-Z])[ \]]/.exec(description);
                if (!match) {
                    // console.log("no match", description);
                    return;
                }
                var time = NBA.Time.quarterEnd(quarter);
                var timeLeft = play.clock.split(':');
                time.add(-(parseInt(timeLeft[0]) * 60 * 1000));
                time.add(-(parseInt(timeLeft[1]) * 1000));
                // console.log(match[1], time.mmss(), description);
                var homeEvent = match[1] == home.abbrev;
                assert(homeEvent || match[1] == away.abbrev);
                function forEachPlayer(homeTeam, cb) {
                    var data = (homeTeam ? homePlayerData : awayPlayerData).resultSets[0].rowSet;
                    for (var i=0; i<data.length; ++i) {
                        // console.log("trying", i, data[i]);
                        if (!cb(data[i]))
                            break;
                    }
                }
                function addPlayer(playerIdOrName, homeOverride) {
                    var name = /^[0-9]*$/.exec(playerIdOrName) ? undefined : playerIdOrName.split(' ');
                    // console.log(name, playerIdOrName);
                    var homePlayer = homeEvent;
                    if (homeOverride != undefined)
                        homePlayer = homeOverride;

                    // console.log("addPlayer", homePlayer, playerIdOrName, name);

                    var players = (homePlayer ? homePlayers : awayPlayers);
                    if (players[playerIdOrName])
                        return players[playerIdOrName];

                    var matched;
                    var misses = [];
                    var ignoreSeen = false;
                    function tryPlayer(player) {
                        var id = player[playerDataIndexes.PLAYER_ID];
                        if (!name) {
                            // console.log("trying by id", playerIdOrName, player[playerDataIndexes.PLAYER_ID], JSON.stringify(player));
                            if (id == playerIdOrName) {
                                // console.log("found dude");
                                matched = player;
                                return false;
                            }
                            return true;
                        } else {
                            if (!ignoreSeen && !(id in seenPlayerIds))
                                return true;
                            var playerNames = player[playerDataIndexes.PLAYER].split(' ');
                            misses.push(player[playerDataIndexes.PLAYER]);
                            // console.log("checking names", name, playerNames);
                            if (name.length == 1) {
                                // console.log("considering", name[0], playerNames);
                                if (playerNames[playerNames.length - 1] == name[0]) {
                                    matched = player;
                                    return false;
                                }
                                return true;
                            }
                            if (playerNames.length < name.length) {
                                return true;
                            }
                            var pidx = playerNames.length - name.length;
                            for (var nidx=0; nidx<name.length; ++nidx, ++pidx) {
                                // console.log("checking startswith", real[i], approx[i], real[i].lastIndexOf(approx[i], 0));
                                // console.log(pidx, playerNames.length, nidx, name.length);
                                if (playerNames[pidx].lastIndexOf(name[nidx], 0) != 0)
                                    return true;
                            }
                            matched = player;
                            return false;
                        }
                    }
                    forEachPlayer(homePlayer, tryPlayer);
                    if (!matched) {
                        ignoreSeen = true;
                        forEachPlayer(homePlayer, tryPlayer);
                    }

                    var ret;
                    if (matched) {
                        ret = new NBA.Player(matched[playerDataIndexes.PLAYER], matched[playerDataIndexes.PLAYER_ID]);
                        (homePlayer ? home : away).players[ret.id] = ret;
                        players[ret.name] = ret;
                        players[ret.id] = ret;
                        players[playerIdOrName] = ret;
                    } else {
                        console.log("COULDN'T CREATE PLAYER", playerIdOrName, homePlayer, "name", name, "misses", misses, description);
                    }
                    return ret;
                }

                function assist()
                {
                    var ast = /Assist: (.*) \([0-9]+ AST\)/.exec(description);
                    if (ast) {
                        var player = addPlayer(ast[1]);
                        if (player)
                            game.events.push(new NBA.Event(NBA.Event.AST, time, homeEvent ? home : away, player));
                    }
                }
                function block()
                {
                    var blk = /Block: (.*) \([0-9]+ BLK\)/.exec(description);
                    if (blk) {
                        var player = addPlayer(blk[1], !homeEvent);
                        if (player)
                            game.events.push(new NBA.Event(NBA.Event.BLK, time, homeEvent ? away : home, player));
                    }
                }

                function madeShot(attempt, make)
                {
                    assert(attempt in NBA.Event.eventNames, "attempt is bad: " + attempt);
                    assert(make in NBA.Event.eventNames, "make is bad: " + attempt);
                    var shooter = addPlayer(play.personId);
                    game.events.push(new NBA.Event(attempt , time, homeEvent ? home : away, shooter));
                    game.events.push(new NBA.Event(make, time, homeEvent ? home : away, shooter));
                }

                // ### need to handle team turnover
                if (/ Turnover : /.exec(description)) {
                    var player = play.personId ? addPlayer(play.personId) : undefined;
                    // console.log(JSON.stringify(play), player, "drit", play.personId, "baesj", homeEvent);
                    game.events.push(new NBA.Event(NBA.Event.TO, time, homeEvent ? home : away, player));
                    if (player) {
                        var toMatch = /Turnover :.*\) Steal:([^(]*) \(/.exec(description);
                        if (toMatch) {
                            game.events.push(new NBA.Event(NBA.Event.STL, time, homeEvent ? away : home, addPlayer(toMatch[1], !homeEvent)));
                        }
                    }
                    return;
                }

                if (/Timeout : Short/.exec(description)) {
                    game.events.push(new NBA.Event(NBA.Event.TIMEOUT_20S, time, homeEvent ? home : away));
                    return;
                }

                if (/Timeout : Regular/.exec(description)) {
                    game.events.push(new NBA.Event(NBA.Event.TIMEOUT, time, homeEvent ? home : away));
                    return;
                }

                if (/ Team Rebound$/.exec(description)) { // team rebound
                    game.events.push(new NBA.Event(NBA.Event.TRB, time, homeEvent ? home : away));
                    return;
                }

                if (/ Rebound \(/.exec(description)) {
                    var reboundType = play.teamId == lastTeamMiss ? NBA.Event.ORB : NBA.Event.DRB;
                    game.events.push(new NBA.Event(reboundType, time, homeEvent ? home : away, addPlayer(play.personId)));
                    return;
                }

                if (/Free Throw .* Missed$/.exec(description)) {
                    lastTeamMiss = (homeEvent ? home : away).id;
                    game.events.push(new NBA.Event(NBA.Event.FTA, time, homeEvent ? home : away, addPlayer(play.personId)));
                    return;
                }

                if (/3pt Shot: Missed/.exec(description)) {
                    lastTeamMiss = (homeEvent ? home : away).id;
                    block();
                    game.events.push(new NBA.Event(NBA.Event.FGA3, time, homeEvent ? home : away, addPlayer(play.personId)));
                    return;
                }

                if (/: Missed/.exec(description)) {
                    lastTeamMiss = (homeEvent ? home : away).id;
                    block();
                    game.events.push(new NBA.Event(NBA.Event.FGA2, time, homeEvent ? home : away, addPlayer(play.personId)));
                    return;
                }

                if (/ Free Throw ([123] of|Technical |Flagrant )/.exec(description)) {
                    madeShot(NBA.Event.FTA, NBA.Event.FTM);
                    return;
                }

                if (/ Technical \(/.exec(description)) {
                    game.events.push(new NBA.Event(NBA.Event.TF, time, homeEvent ? home : away, addPlayer(play.personId)));
                    return;
                }

                match = /Foul: Flagrant Type ([12]) /.exec(description);
                if (match) {
                    game.events.push(new NBA.Event(match[1] == '1' ? NBA.Event.FF1 : NBA.Event.FF2, time, homeEvent ? home : away, addPlayer(play.personId)));
                    return;
                }

                if (/Defense 3 Second/.exec(description)) { // nothing to do, could count them somewhere
                    return;
                }

                if (/ Foul: /.exec(description)) {
                    game.events.push(new NBA.Event(NBA.Event.PF, time, homeEvent ? home : away, addPlayer(play.personId)));
                    return;
                }

                match = / Substitution replaced by (.*)$/.exec(description);
                if (match) {
                    game.events.push(new NBA.Event(NBA.Event.SUBBED_OUT, time, homeEvent ? home : away, addPlayer(play.personId)));
                    var p = addPlayer(match[1], homeEvent);
                    // console.log("PLAYER", p, homeEvent, match);
                    game.events.push(new NBA.Event(NBA.Event.SUBBED_IN, time, homeEvent ? home : away, addPlayer(match[1], homeEvent)));
                    return;
                }

                if (/ 3pt Shot: Made/.exec(description)) {
                    assist();
                    madeShot(NBA.Event.FGA3, NBA.Event.FGM3);
                    return;
                }

                if (/\([0-9]+ PTS\)/.exec(description)) {
                    assist();
                    madeShot(NBA.Event.FGA2, NBA.Event.FGM2);
                    return;
                }

                if (/ Violation *:/.exec(description))
                    return;

                if (/^Jump Ball /.exec(description))
                    return;

                console.log("unhandled event", description);
            });
            game.events.push(new NBA.Event(NBA.Event.QUARTER_END, NBA.Time.quarterEnd(quarter), undefined, quarter)); // only if quarter actually ended
            ++quarter;
        }

        var homeLineup = {};
        var awayLineup = {};
        quarter = undefined;
        var subs = [];
        game.events.forEach(function(ev) {
            if (ev.type == NBA.Event.QUARTER_START) {
                quarter = ev.data;
                homeLineup = {};
                awayLineup = {};
            } else if (ev.type == NBA.Event.QUARTER_END) {
                var playerId;
                assert(home instanceof NBA.Team);
                for (playerId in homeLineup) {
                    // console.log(game.home.players[playerId].name + " is in the game, subbing out for " + ev.data + " " + playerId);
                    subs.push(new NBA.Event(NBA.Event.SUBBED_OUT, ev.time, home, homePlayers[playerId]));
                }
                assert(away instanceof NBA.Team);
                for (playerId in awayLineup) {
                    subs.push(new NBA.Event(NBA.Event.SUBBED_OUT, ev.time, away, awayPlayers[playerId]));
                }
                // game.events.splice.apply(game.events, subs);
                // i += subs.length - 2;
            } else if (ev.data instanceof NBA.Player) {
                var lineup = ev.team === game.home ? homeLineup : awayLineup;
                if (ev.type == NBA.Event.SUBBED_IN) {
                    // console.log("adding", ev.toString());
                    lineup[ev.data.id] = true;
                    assert(Object.keys(lineup).length <= 5);
                } else {
                    if (!lineup[ev.data.id]) {
                        subs.push(new NBA.Event(NBA.Event.SUBBED_IN, NBA.Time.quarterStart(quarter), ev.team, ev.data));
                        // game.events.splice(lastQuarterStart, 0, new
                        // console.log("adding", ev.toString());
                        lineup[ev.data.id] = true;
                        assert(Object.keys(lineup).length <= 5);
                    }

                    if (ev.type == NBA.Event.SUBBED_OUT) {
                        // console.log("removing", ev.toString());
                        assert(ev.data.id in lineup);
                        delete lineup[ev.data.id];
                    }
                }
            }
        });
        // for (var i=0; i<game.events.length; ++i) {
        //     // console.log(game.events[i].type);
        //     console.log(game.events[i].toString());
        // }
        game.events.push.apply(game.events, subs);
        game.events.sort(function(l, r) {
            var ret = l.time.compare(r.time);
            if (!ret) {
                function typeScore(type) {
                    switch (type) {
                    case NBA.Event.QUARTER_END:
                        return -1;
                    case NBA.Event.QUARTER_START:
                        return 3;
                    case NBA.Event.SUBBED_OUT:
                        return 2;
                    case NBA.Event.SUBBED_IN:
                        return 1;
                    default:
                        break;
                    }
                    return 0;
                }

                var lscore = typeScore(l.type);
                var rscore = typeScore(r.type);
                return rscore - lscore;
            }
            return ret;
        });

        // for (var i=0; i<game.events.length; ++i) {
        //     // console.log(game.events[i].type);
        //     console.log(game.events[i].toString());
        // }
        cb(undefined, game);
    }
}

module.exports = { parseQuarters: parseQuarters };
