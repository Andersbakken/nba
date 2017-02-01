/* global require, module */

var NBA = require('./NBA.js');
var assert = require('assert');

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

module.exports = GameParser;
