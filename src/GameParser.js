/* global require, module */

const NBA = require('./NBA.js');
// var assert = require('assert');
const safe = require('safetydance');

// http://data.nba.net/data/10s/prod/v1/20170209/0021600798_boxscore.json
// is available while the game is going on and can be used to
// determine what personId's are in the game.

var debugLineups = true;
debugLineups = false;

function assert(cond, msg)
{
    if (!cond) {
        console.error("assertion failed", msg);
    }
}
function parseQuarters(league, data) {
    return new Promise(function(resolve) {
        var home = league.find(data.gameData.home);
        var away = league.find(data.gameData.away);
        if (!home)
            throw new Error(`Can't find home team from ${data.gameData.home}`);
        if (!away)
            throw new Error(`Can't find home team from ${data.gameData.away}`);

        var game = new NBA.Game(home, away);
        console.log(away.abbrev, "@", home.abbrev);

        data.quarters.forEach(function(q) {
            q.plays.forEach(function(play) {
                if (play.teamId) {
                    play.team = play.teamId == home.id ? home : away;
                    assert(play.team.id == play.teamId, "wrong team id");

                    if (play.personId) {
                        var player = league.players[play.personId];
                        if (!player) // coaches
                            return;

                        var players;
                        if (play.teamId == home.id) {
                            players = game.homePlayers;
                        } else {
                            players = game.awayPlayers;
                        }

                        players[player.id] = player;
                    }
                }
            });
        });

        var quarter = 0;
        var homeCacheByName = {};
        var awayCacheByName = {};

        data.quarters.forEach(function(q) {
            game.events.push(new NBA.Event(NBA.Event.QUARTER_START, NBA.Time.quarterStart(quarter), undefined, quarter));
            var lastTeamMiss;

            q.plays.forEach(function(play) {
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
                var timeLeft = /^([0-9][0-9]?):([0-9][0-9])\.?([0-9]*)/.exec(play.clock);
                time.add(-(parseInt(timeLeft[1]) * 60 * 1000));
                time.add(-(parseInt(timeLeft[2]) * 1000));
                if (timeLeft[3])
                    time.add(-(parseInt(timeLeft[3])));
                // console.log(match[1], time.mmss(), description);
                var homeEvent = match[1] == home.abbrev;
                assert(homeEvent || match[1] == away.abbrev, "event wrong");
                function addPlayer(playerIdOrName, homeOverride) {
                    var name = /^[0-9]*$/.exec(playerIdOrName) ? undefined : playerIdOrName.split(' ');
                    if (!name) {
                        return league.players[playerIdOrName];
                    }
                    // console.log(name, playerIdOrName);
                    var homePlayer = homeEvent;
                    if (homeOverride != undefined)
                        homePlayer = homeOverride;
                    var teamPlayers = (homePlayer ? game.homePlayers : game.awayPlayers);

                    // console.log("addPlayer", homePlayer, playerIdOrName, name);

                    var cacheByName = (homePlayer ? homeCacheByName : awayCacheByName);
                    if (cacheByName[playerIdOrName])
                        return cacheByName[playerIdOrName];

                    var team = homePlayer ? game.home : game.away;
                    function find(name) {
                        function match(player)
                        {
                            // console.log(player.name, player.toString());
                            var playerNames = player.name.split(' ');
                            if (playerNames.length >= name.length) {
                                var pidx = playerNames.length - name.length;
                                for (var nidx=0; nidx<name.length; ++nidx, ++pidx) {
                                    // console.log("checking startswith", real[i], approx[i], real[i].lastIndexOf(approx[i], 0));
                                    // console.log(pidx, playerNames.length, nidx, name.length);
                                    if (playerNames[pidx] == name[nidx]) {
                                        return player;
                                    }
                                }
                            }
                            return undefined;
                        }

                        var id, ret;
                        // first try players we know have appeared in the game
                        for (id in teamPlayers) {
                            ret = match(teamPlayers[id]);
                            if (ret)
                                return ret;
                        }

                        // try players that are on the squad, should probably get a box score thing for the actual game and use that instead
                        for (id in team.players) {
                            ret = match(team.players[id]);
                            if (ret)
                                return ret;
                        }

                        return undefined;
                    }
                    var ret = find(name);
                    if (!ret && name.length > 1) {
                        var firstLast = [name[0]];
                        ret = find(firstLast);
                    }
                    if (ret) {
                        cacheByName[playerIdOrName] = ret;
                        teamPlayers[ret.id] = ret;
                    } else {
                        var misses = [];
                        for (var id in team.players) {
                            misses.push(team.players[id].name);
                        }
                        console.log("COULDN'T CREATE PLAYER", playerIdOrName, homePlayer, "team", team.name, "name", name, "misses", misses, description);
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
                    var tfp = addPlayer(play.personId);
                    if (tfp) {
                        game.events.push(new NBA.Event(NBA.Event.TF, time, homeEvent ? home : away, addPlayer(play.personId)));
                    } else {
                        // coach, should add some other event thing here
                    }
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

                if (/Ejection:/.exec(description))
                    return;

                console.log("unhandled event", description);
            });
            game.events.push(new NBA.Event(NBA.Event.QUARTER_END, NBA.Time.quarterEnd(quarter), undefined, quarter)); // only if quarter actually ended
            ++quarter;
        });

        var homeLineup = {};
        var awayLineup = {};

        function dumpLineups(header)
        {
            var hh = [];
            for (var h in homeLineup) {
                hh.push(game.homePlayers[h].name);
            }

            var aa = [];

            for (var a in awayLineup) {
                aa.push(game.awayPlayers[a].name);
            }
            console.log((header || ""), "home", JSON.stringify(hh), "away", JSON.stringify(aa));
        }
        quarter = undefined;
        var subs = [];
        game.events.forEach(function(ev) {
            if (ev.type == NBA.Event.QUARTER_START) {
                quarter = ev.data;
                homeLineup = {};
                awayLineup = {};
                if (debugLineups)
                    console.log("resetting lineup");
            } else if (ev.type == NBA.Event.QUARTER_END) {
                if (debugLineups)
                    dumpLineups("quarter end " + quarter);
                var playerId;
                for (playerId in homeLineup) {
                    // console.log(game.home.players[playerId].name + " is in the game, subbing out for " + ev.data + " " + playerId);
                    subs.push(new NBA.Event(NBA.Event.SUBBED_OUT, ev.time, home, game.homePlayers[playerId]));
                }
                assert(Object.keys(homeLineup).length == 5, "Not enough home players");
                for (playerId in awayLineup) {
                    // console.log(game.away.players[playerId].name + " is in the game, subbing out for " + ev.data + " " + playerId);
                    subs.push(new NBA.Event(NBA.Event.SUBBED_OUT, ev.time, away, game.awayPlayers[playerId]));
                }
                assert(Object.keys(awayLineup).length == 5, "Not enough away players");
                // game.events.splice.apply(game.events, subs);
                // i += subs.length - 2;
            } else if (ev.data instanceof NBA.Player) {
                var lineup = ev.team === game.home ? homeLineup : awayLineup;
                if (ev.type == NBA.Event.SUBBED_IN) {
                    lineup[ev.data.id] = true;
                    if (debugLineups) {
                        console.log("subbing adding", ev.toString());
                        dumpLineups();
                    }
                    assert(Object.keys(lineup).length <= 5, "Too many players");
                } else {
                    if (!lineup[ev.data.id]) {
                        if (!quarter)
                            console.log("Adding a sub in at event start", ev.data.toString(), "because of", ev.toString());
                        subs.push(new NBA.Event(NBA.Event.SUBBED_IN, NBA.Time.quarterStart(quarter), ev.team, ev.data));
                        // game.events.splice(lastQuarterStart, 0, new
                        lineup[ev.data.id] = true;
                        if (debugLineups) {
                            console.log("other adding", ev.toString());
                            dumpLineups();
                        }
                        assert(Object.keys(lineup).length <= 5, "Too many players");
                    }

                    if (ev.type == NBA.Event.SUBBED_OUT) {
                        assert(ev.data.id in lineup, "subbed out not in lineup");
                        delete lineup[ev.data.id];
                        if (debugLineups) {
                            console.log("removing", ev.toString());
                            dumpLineups();
                        }
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
        resolve(game);
    }).catch(function(error) {
        console.log("Got error", error);
        // throw new Error(error);
    });
}

module.exports = { parseQuarters: parseQuarters };
