/* global require, module */

const Game = require('./Game.js');
const League = require('./League.js');
const Team = require('./Team.js');
const Time = require('./Time.js');
const Player = require('./Player.js');
const Event = require('./Event.js');
const assert = require('assert');

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


function GameParser(league, nbaData, cb) {
    // var title = html.indexOf("<title>");
    // var titleEnd = html.indexOf(" Play-By-Play", title + 7);
    // if (title == -1 || titleEnd == -1) {
    //     cb("Bad HTML!");
    //     return;
    // }
    // var teams = /^(.*) at (.*)$/.exec(html.substring(title + 7, titleEnd));

    assert(nbaData instanceof Object);
    assert(Array.isArray(nbaData.resultSets));
    const resultSets0 = nbaData.resultSets[0];
    var indexes = {};
    assert(Array.isArray(resultSets0.headers));
    var i;
    for (i=0; i<resultSets0.headers.length; ++i)
        indexes[resultSets0.headers[i]] = i;

    const rowSet = resultSets0.rowSet;
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

    var game = new Game(home, away);
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
                game.events.push(new Event(Event.QUARTER_END, Time.quarterEnd(currentQuarter), undefined, quarter));
            currentQuarter = quarter;
            game.events.push(new Event(Event.QUARTER_START, Time.quarterStart(quarter), undefined, quarter));
        }
        var time = Time.quarterEnd(quarter);
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
                        players[id] = new Player(piece(`PLAYER${idx}_NAME`), id);
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
                    game.events.push(new Event(Event.AST, time, homeEvent ? home : away, player));
            }
            function madeShot(attempt, make)
            {
                var shooter = addPlayer(1);
                game.events.push(new Event(attempt , time, homeEvent ? home : away, shooter));
                game.events.push(new Event(make, time, homeEvent ? home : away, shooter));
            }
            var description = homeEvent ? piece("HOMEDESCRIPTION") : piece("VISITORDESCRIPTION");
            if (!description)
                return;
            // ### need to handle team turnover
            if (/ Turnover \(/.exec(description)) {
                game.events.push(new Event(Event.TO, time, homeEvent ? home : away, addPlayer(1)));
                return;
            }

            if (/ STL\)$/.exec(description)) {
                game.events.push(new Event(Event.STL, time, homeEvent ? home : away, addPlayer(2)));
                return;
            }

            if (/Timeout: Short/.exec(description)) {
                game.events.push(new Event(Event.TIMEOUT_20S, time, homeEvent ? home : away));
                return;
            }

            if (/Timeout: Regular/.exec(description)) {
                game.events.push(new Event(Event.TIMEOUT, time, homeEvent ? home : away));
                return;
            }

            if (/ Rebound$/.exec(description)) { // team rebound
                game.events.push(new Event(Event.TRB, time, homeEvent ? home : away));
                return;
            }

            if (/ REBOUND \(/.exec(description)) {
                var reboundType = piece(`PLAYER1_TEAM_ID`) == lastTeamMiss ? Event.ORB : Event.DRB;
                game.events.push(new Event(reboundType, time, homeEvent ? home : away, addPlayer(1)));
                return;
            }

            if (/ Foul \(/.exec(description) || /\.FOUL \(/.exec(description) || /\.Foul \(/.exec(description)) {
                game.events.push(new Event(Event.PF, time, homeEvent ? away : home, addPlayer(1)));
                return;
            }

            if (/^SUB: /.exec(description)) {
                game.events.push(new Event(Event.SUBBED_OUT, time, homeEvent ? home : away, addPlayer(1)));
                game.events.push(new Event(Event.SUBBED_IN, time, homeEvent ? home : away, addPlayer(2)));
                return;
            }

            if (/^Miss .*Free Throw [123] of/.exec(description)) {
                game.events.push(new Event(Event.FTA, time, homeEvent ? home : away, addPlayer(1)));
                return;
            }

            if (/ Free Throw [123] of/.exec(description)) {
                madeShot(Event.FTA, Event.FTM);
                return;
            }

            if (/^MISS .* 3PT $/.exec(description)) {
                game.events.push(new Event(Event.FGA3, time, homeEvent ? home : away, addPlayer(1)));
                return;
            }

            if (/^MISS /.exec(description)) {
                game.events.push(new Event(Event.FGA2, time, homeEvent ? home : away, addPlayer(1)));
                return;
            }

            if (/ 3PT .* [0-9] PTS\)/.exec(description)) {
                assist();
                madeShot(Event.FGA3, Event.FGM3);
                return;
            }

            if (/\([0-9]+ PTS\)/.exec(description)) {
                assist();
                madeShot(Event.FGA2, Event.FGM2);
                return;
            }

            if (/\([0-9]+ BLK\)/.exec(description)) {
                game.events.push(new Event(Event.BLK, time, homeEvent ? away : home, addPlayer(3)));
                return;
            }

            if (/ Violation:/.exec(description))
                return;

            console.log("unhandled event", home, description, rowSet[i]);
        }
        process(true);
        process(false);
    }
    game.events.push(new Event(Event.QUARTER_END, Time.quarterEnd(currentQuarter), undefined, quarter));

        // var otherDescription = homeEvent ? visitorDescription : homeDescription;

        /*

        function addPlayer(player, homePlayer) {
            if (homePlayer == undefined) {
                homePlayer = homeEvent;
            } else {
                // console.log("YO YO YO", player, homePlayer);
            }
            var team = homePlayer ? home : away;
            if (player == 'TEAM' || player == 'Team')
                return team;
            var map = homePlayer ? homePlayers : awayPlayers;
            // var lineup = homePlayer ? homeLineup : awayLineup;
            // console.log(`ADDING ${player} ${homePlayer} ${JSON.stringify(lineup)} ${lineup === homeLineup}`);
            if (!map[player]) {
                // var linkEnd = html.indexOf(">" + player + "</a>");
                // var linkStart = html.lastIndexOf("<a href=\"", linkEnd);
                // if (linkEnd == -1 || linkStart == -1)
                //     throw new Error("Couldn't find " + player + " link");
                // var link = html.substring(linkStart + 9, linkEnd - 1);
                // var fullName = that.allPlayers[link];
                // var p = new Player(fullName || player, link);
                // console.log("ADDED PLAYER", player);
                // map[player] = p;
                // team.players[p.id] = p;
            }
            var ret = map[player];
            // if (!lineup[player]) {
            //     var subbedInTime = new Time((quarter - 1) * 12, 0);
            //     game.events.push(new Event(Event.SUBBED_IN, subbedInTime, homePlayer ? home : away, ret));
            // }
            // lineup[player] = ++lineUpIdx;
            return ret;
        }
        // if (Object.keys(homeEvent ? homeLineup : awayLineup).length > 5) {
        //     console.log("TOOOOOOOOOOO MANY");
        // }
        // console.log(Object.keys(homeEvent ? homeLineup : awayLineup).length,
        //             JSON.stringify(Object.keys(homeEvent ? homeLineup : awayLineup)), lastLineData);
        // console.log(lineData);
        m = /Turnover by (.*) \(([^)]*)\)/.exec(lineData);
        if (m) {
            // console.log(`GOT A TURNOVER ${m[1]} ${m[2]}`);
            var player = addPlayer(m[1]);
            game.events.push(new Event(Event.TO, time, homeEvent ? home : away, player));
            var m2 = /steal by (.*)/.exec(m[2]);
            if (m2) {
                game.events.push(new Event(Event.STL, time, homeEvent ? away : home, addPlayer(m2[1], !homeEvent)));
            }
            continue;
        }

        if (lineData.indexOf('full timeout') !== -1) {
            game.events.push(new Event(Event.TIMEOUT, time, homeEvent ? home : away));
            continue;
        }

        m = /Defensive rebound by (.*)/.exec(lineData);
        if (m) {
            game.events.push(new Event(Event.DRB, time, homeEvent ? home : away, addPlayer(m[1])));
            continue;
        }

        m = /Offensive rebound by (.*)/.exec(lineData);
        if (m) {
            game.events.push(new Event(Event.ORB, time, homeEvent ? home : away, addPlayer(m[1])));
            continue;
        }

        if (lineData.indexOf('Def 3 sec tech foul by') !== -1) {
            game.events.push(new Event(Event.TF, time, homeEvent ? home : away));
            continue;
        }

        m = / foul by (.*) \(drawn by [^)]*\)/.exec(lineData);
        if (m) {
            game.events.push(new Event(Event.PF, time, homeEvent ? away : home, addPlayer(m[1], !homeEvent)));
            continue;
        }

        m = /Personal foul by ([^\t]*)/.exec(lineData);
        if (m) {
            game.events.push(new Event(Event.PF, time, homeEvent ? home : away, addPlayer(m[1])));
            continue;
        }

        m = / foul by (.*)/.exec(lineData);
        if (m) {
            game.events.push(new Event(Event.PF, time, homeEvent ? home : away, addPlayer(m[1])));
            continue;
        }

        m = /[Ff]lagrant foul type ([12]) by (.*)/.exec(lineData);
        if (m) {
            game.events.push(new Event(m[1] == '1' ? Event.FF1 : Event.FF2, time, homeEvent ? home : away, addPlayer(m[2])));
            continue;
        }

        m = /(.*) enters the game for (.*)/.exec(lineData);
        if (m) {
            // var lineup = homeEvent ? homeLineup : awayLineup;
            game.events.push(new Event(Event.SUBBED_OUT, time, homeEvent ? home : away, addPlayer(m[2])));
            game.events.push(new Event(Event.SUBBED_IN, time, homeEvent ? home : away, addPlayer(m[1])));
            // delete lineup[m[2]];
            continue;
        }

        m = /(.*) makes ([23])-pt shot /.exec(lineData);
        if (m) {
            game.events.push(new Event(m[2] == '2' ? Event.FGA2 : Event.FGA3, time, homeEvent ? home : away, addPlayer(m[1])));
            game.events.push(new Event(m[2] == '2' ? Event.FGM2 : Event.FGM3, time, homeEvent ? home : away, addPlayer(m[1])));
            continue;
        }

        m = /(.*) misses ([23])-pt shot .* \(block by (.*)\)/.exec(lineData);
        if (m) {
            game.events.push(new Event(Event.BLK, time, homeEvent ? away : home, addPlayer(m[3], !homeEvent)));
            game.events.push(new Event(m[2] == '2' ? Event.FGA2 : Event.FGA3, time, homeEvent ? home : away, addPlayer(m[1])));
            continue;
        }

        m = /(.*) misses ([23])-pt shot/.exec(lineData);
        if (m) {
            game.events.push(new Event(m[2] == '2' ? Event.FGA2 : Event.FGA3, time, homeEvent ? home : away, addPlayer(m[1])));
            continue;
        }

        m = /(.*) misses.*free throw/.exec(lineData);
        if (m) {
            game.events.push(new Event(Event.FTA, time, homeEvent ? home : away, addPlayer(m[1])));
            continue;
        }

        m = /(.*) makes.*free throw/.exec(lineData);
        if (m) {
            game.events.push(new Event(Event.FTA, time, homeEvent ? home : away, addPlayer(m[1])));
            game.events.push(new Event(Event.FTM, time, homeEvent ? home : away, addPlayer(m[1])));
            continue;
        }

     // console.log(`Unhandled event ${time.minute} ${time.second} ${lineData}`);
         */
    cb(undefined, game);
}

module.exports = GameParser;
