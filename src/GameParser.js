/* global require, module */

const NBA = require('./NBA.js');
const assert = require('assert');
const safe = require('safetydance');

/*
 "GAME_ID",
 "EVENTNUM",
 "EVENTMSGTYPE",
 "EVENTMSGACTIONTYPE",
 "PERIOD",
 "WCTIMESTRING",
 "PCTIMESTRING",
 "HOMEDESCRIPTION",
 "NEUTRALDESCRIPTION",
 "VISITORDESCRIPTION",
 "SCORE",
 "SCOREMARGIN",
 "PERSON1TYPE",
 "PLAYER1_ID",
 "PLAYER1_NAME",
 "PLAYER1_TEAM_ID",
 "PLAYER1_TEAM_CITY",
 "PLAYER1_TEAM_NICKNAME",
 "PLAYER1_TEAM_ABBREVIATION",
 "PERSON2TYPE",
 "PLAYER2_ID",
 "PLAYER2_NAME",
 "PLAYER2_TEAM_ID",
 "PLAYER2_TEAM_CITY",
 "PLAYER2_TEAM_NICKNAME",
 "PLAYER2_TEAM_ABBREVIATION",
 "PERSON3TYPE",
 "PLAYER3_ID",
 "PLAYER3_NAME",
 "PLAYER3_TEAM_ID",
 "PLAYER3_TEAM_CITY",
 "PLAYER3_TEAM_NICKNAME",
 "PLAYER3_TEAM_ABBREVIATION"
 */


function parseGame(league, nbaData, cb) {
    // var title = html.indexOf("<title>");
    // var titleEnd = html.indexOf(" Play-By-Play", title + 7);
    // if (title == -1 || titleEnd == -1) {
    //     cb("Bad HTML!");
    //     return;
    // }
    // var teams = /^(.*) at (.*)$/.exec(html.substring(title + 7, titleEnd));

    assert(nbaData instanceof Object);
    assert(Array.isArray(nbaData.resultSets));
    var resultSets0 = nbaData.resultSets[0];
    var indexes = {};
    assert(Array.isArray(resultSets0.headers));
    var i;
    for (i=0; i<resultSets0.headers.length; ++i)
        indexes[resultSets0.headers[i]] = i;

    var rowSet = resultSets0.rowSet;
    assert(Array.isArray(rowSet));
    // assert(rowSet[1].

    var home = league.find(rowSet[1][indexes.PLAYER1_TEAM_ABBREVIATION]);
    var away = league.find(rowSet[1][indexes.PLAYER2_TEAM_ABBREVIATION]);
    if (!home) {
        cb("Can't find home team from " + rowSet[1][indexes.PLAYER1_TEAM_ABBREVIATION]);
        return;
    }
    if (!away) {
        cb("Can't find away team from " + rowSet[1][indexes.PLAYER2_TEAM_ABBREVIATION]);
        return;
    }
    var homeId = rowSet[1][indexes.PLAYER1_TEAM_ID];
    var awayId = rowSet[1][indexes.PLAYER2_TEAM_ID];

    // var plain = html.replace(/<[^>]*>/g, '');
    // var lines = plain.split('\n');
    // // console.log(lines);
    // // return;
    // // console.log(lines);

    var game = new NBA.Game(home, away);
    var homePlayers = {};
    var awayPlayers = {};

    // 0 is empty, 1 is jump ball, ### What if there's a foul on the jump ball?
    function piece(name) { return rowSet[i][indexes[name]]; }
    var lastTeamMiss;
    var currentQuarter;
    for (i=2; i<rowSet.length; ++i) {
        if (piece("NEUTRALDESCRIPTION"))
            continue;
        var quarter = piece("PERIOD") - 1;
        if (quarter != currentQuarter) {
            if (currentQuarter != undefined)
                game.events.push(new NBA.Event(NBA.Event.QUARTER_END, NBA.Time.quarterEnd(currentQuarter), undefined, quarter));
            currentQuarter = quarter;
            game.events.push(new NBA.Event(NBA.Event.QUARTER_START, NBA.Time.quarterStart(quarter), undefined, quarter));
        }
        var time = NBA.Time.quarterEnd(quarter);
        var timeLeft = piece("PCTIMESTRING").split(':');
        time.add(-(parseInt(timeLeft[0]) * 60 * 1000));
        time.add(-(parseInt(timeLeft[1]) * 1000));
        function process(homeEvent) {
            function addPlayer(idx) {
                var teamId = piece(`PLAYER${idx}_TEAM_ID`);
                if (teamId) {
                    var players = teamId == homeId ? homePlayers : awayPlayers;
                    var id = piece(`PLAYER${idx}_ID`);
                    if (!players[id]) {
                        players[id] = new NBA.Player(piece(`PLAYER${idx}_NAME`), id);
                        var team = teamId == homeId ? home : away;
                        team.players[id] = players[id];
                    }
                    return players[id];
                }
                return undefined;
            }
            function assist()
            {
                var player = addPlayer(2);
                if (player)
                    game.events.push(new NBA.Event(NBA.Event.AST, time, homeEvent ? home : away, player));
            }
            function madeShot(attempt, make)
            {
                var shooter = addPlayer(1);
                game.events.push(new NBA.Event(attempt , time, homeEvent ? home : away, shooter));
                game.events.push(new NBA.Event(make, time, homeEvent ? home : away, shooter));
            }
            var description = homeEvent ? piece("HOMEDESCRIPTION") : piece("VISITORDESCRIPTION");
            if (!description)
                return;
            // ### need to handle team turnover
            if (/ Turnover \(/.exec(description)) {
                game.events.push(new NBA.Event(NBA.Event.TO, time, homeEvent ? home : away, addPlayer(1)));
                return;
            }

            if (/ Turnover: /.exec(description)) {
                game.events.push(new NBA.Event(NBA.Event.TO, time, homeEvent ? home : away));
                return;
            }

            if (/ STL\)$/.exec(description)) {
                game.events.push(new NBA.Event(NBA.Event.STL, time, homeEvent ? home : away, addPlayer(2)));
                return;
            }

            if (/Timeout: Short/.exec(description)) {
                game.events.push(new NBA.Event(NBA.Event.TIMEOUT_20S, time, homeEvent ? home : away));
                return;
            }

            if (/Timeout: Regular/.exec(description)) {
                game.events.push(new NBA.Event(NBA.Event.TIMEOUT, time, homeEvent ? home : away));
                return;
            }

            if (/ Rebound$/.exec(description)) { // team rebound
                game.events.push(new NBA.Event(NBA.Event.TRB, time, homeEvent ? home : away));
                return;
            }

            if (/ REBOUND \(/.exec(description)) {
                var reboundType = piece(`PLAYER1_TEAM_ID`) == lastTeamMiss ? NBA.Event.ORB : NBA.Event.DRB;
                game.events.push(new NBA.Event(reboundType, time, homeEvent ? home : away, addPlayer(1)));
                return;
            }

            var match = /FLAGRANT\.FOUL\.TYPE([12]) /.exec(description);
            if (match) {
                game.events.push(new NBA.Event(match[1] == '1' ? NBA.Event.FF1 : NBA.Event.FF2, time, homeEvent ? home : away, addPlayer(1)));
                return;
            }

            if (/T\.FOUL \(/.exec(description)) {
                game.events.push(new NBA.Event(NBA.Event.TF, time, homeEvent ? home : away, addPlayer(1)));
                return;
            }

            if (/ Foul \(/.exec(description) || /\.FOUL \(/.exec(description) || /\.Foul \(/.exec(description)) {
                game.events.push(new NBA.Event(NBA.Event.PF, time, homeEvent ? home : away, addPlayer(1)));
                return;
            }

            if (/^SUB: /.exec(description)) {
                game.events.push(new NBA.Event(NBA.Event.SUBBED_OUT, time, homeEvent ? home : away, addPlayer(1)));
                game.events.push(new NBA.Event(NBA.Event.SUBBED_IN, time, homeEvent ? home : away, addPlayer(2)));
                return;
            }

            if (/^MISS .*Free Throw [123] of/.exec(description)) {
                lastTeamMiss = (homeEvent ? home : away).id;
                game.events.push(new NBA.Event(NBA.Event.FTA, time, homeEvent ? home : away, addPlayer(1)));
                return;
            }

            if (/ Free Throw [123] of/.exec(description)) {
                madeShot(NBA.Event.FTA, NBA.Event.FTM);
                return;
            }

            if (/^MISS .* 3PT /.exec(description)) {
                lastTeamMiss = (homeEvent ? home : away).id;
                game.events.push(new NBA.Event(NBA.Event.FGA3, time, homeEvent ? home : away, addPlayer(1)));
                return;
            }

            if (/^MISS /.exec(description)) {
                lastTeamMiss = (homeEvent ? home : away).id;
                game.events.push(new NBA.Event(NBA.Event.FGA2, time, homeEvent ? home : away, addPlayer(1)));
                return;
            }

            if (/ 3PT .* \([0-9]+ PTS\)/.exec(description)) {
                assist();
                madeShot(NBA.Event.FGA3, NBA.Event.FGM3);
                return;
            }

            if (/\([0-9]+ PTS\)/.exec(description)) {
                assist();
                madeShot(NBA.Event.FGA2, NBA.Event.FGM2);
                return;
            }

            if (/\([0-9]+ BLK\)/.exec(description)) {
                game.events.push(new NBA.Event(NBA.Event.BLK, time, homeEvent ? home : away, addPlayer(3)));
                return;
            }

            if (/ Violation:/.exec(description))
                return;

            if (/^Jump Ball /.exec(description))
                return;

            console.log("unhandled event", home, description, rowSet[i]);
        }
        process(true);
        process(false);
    }
    game.events.push(new NBA.Event(NBA.Event.QUARTER_END, NBA.Time.quarterEnd(currentQuarter), undefined, quarter));
    cb(undefined, game);
}

function parseQuarters(league, net, data, cb) {
    // var title = html.indexOf("<title>");
    // var titleEnd = html.indexOf(" Play-By-Play", title + 7);
    // if (title == -1 || titleEnd == -1) {
    //     cb("Bad HTML!");
    //     return;
    // }
    // var teams = /^(.*) at (.*)$/.exec(html.substring(title + 7, titleEnd));

    // assert(Array.isArray(data.quarters));
    // console.log(`got ${JSON.stringify(data.gameData)} and ${data.quarters.length} quarters`);
    // console.log(data.quarters[0].plays[0]);
    // console.log("shit", data);
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
    // var homeId = rowSet[1][indexes.PLAYER1_TEAM_ID];
    // var awayId = rowSet[1][indexes.PLAYER2_TEAM_ID];

    // var plain = html.replace(/<[^>]*>/g, '');
    // var lines = plain.split('\n');
    // // console.log(lines);
    // // return;
    // // console.log(lines);

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
                console.log(match[1], time.mmss(), description);
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
                    forEachPlayer(homePlayer, function(player) {
                        if (!name) {
                            // console.log("trying by id", playerIdOrName, player[playerDataIndexes.PLAYER_ID], JSON.stringify(player));
                            if (player[playerDataIndexes.PLAYER_ID] == playerIdOrName) {
                                // console.log("found dude");
                                matched = player;
                                return false;
                            }
                            return true;
                        } else {
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
                    });
                    var ret;
                    if (matched) {
                        ret = new NBA.Player(matched[playerDataIndexes.PLAYER], matched[playerDataIndexes.PLAYER_ID]);
                        (homePlayer ? home : away).players[ret.id] = ret;
                        players[ret.name] = ret;
                        players[ret.id] = ret;
                        players[playerIdOrName] = ret;
                    } else {
                        console.log("COULDN'T CREATE PLAYER", playerIdOrName, homePlayer, "name", name, "misses", misses);
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

                if (description.indexOf('lagrant') != -1) {
                    console.log("UNHANDLED FLAGRANT", description);
                    assert(false);
                }
                match = /Flagrant Foul: ([12]) /.exec(description);
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

                if (/ Violation:/.exec(description))
                    return;

                if (/^Jump Ball /.exec(description))
                    return;

                console.log("unhandled event", description);
            });
            game.events.push(new NBA.Event(NBA.Event.QUARTER_END, NBA.Time.quarterEnd(quarter), undefined, quarter));
            ++quarter;
        }
        // for (var i=0; i<game.events.length; ++i) {
        //     console.log(game.events[i].type, game.events[i].toString());
        // }
        cb(undefined, game);
    }
}

module.exports = { parseGame: parseGame, parseQuarters: parseQuarters };
