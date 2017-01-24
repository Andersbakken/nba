#!/usr/bin/env node

/*global require */
var fs = require('fs');
var Player = require('./Player.js');
var Team = require('./Team.js');
var Time = require('./Time.js');
var PlayerScore = require('./PlayerScore.js');
var BoxScore = require('./BoxScore.js');
var Event = require('./Event.js');
var Game = require('./Game.js');

console.log(Object.keys(Team));

function parse(file, home, away, maxTime) {
    var game = new Game(home, away);
    var quarter = undefined;
    var lines = fs.readFileSync(file, "utf-8").split("\n");
    var homePlayers = {};
    var awayPlayers = {};
    var lastLineData = "";
    lines.forEach(function(line) {
        var match = /^([0-9][0-9]?):([0-9][0-9])\.0.(.*)/.exec(line);
        if (!match)
            return;
        var lineData = match[3];
        var m = /Start of ([0-9])[a-z][a-z] quarter/.exec(lineData);
        if (m) {
            quarter = parseInt(m[1]) - 1;
            // console.log(`Got quarter ${quarter}`);
            game.events.push(new Event(Event.QUARTER_START, Time.quarterStart(quarter), undefined, quarter));
            return;
        }
        m = /End of [0-9]/.exec(lineData);
        if (m) {
            game.events.push(new Event(Event.QUARTER_END, Time.quarterEnd(quarter), undefined, quarter));
            return;
        }
        var ot = /Start of ([0-9])[a-z][a-z] overtime/.exec(lineData);
        if (ot) {
            var overtime = ot[1];
            quarter = 3 + parseInt(overtime); // 0-indexed
            game.events.push(new Event(Event.QUARTER_START, Time.quarterStart(quarter), undefined, quarter));
            return;
        }
        var time = Time.quarterEnd(quarter);
        time.ms -= parseInt(match[1]) * 60 * 1000;
        time.ms -= parseInt(match[2]) * 1000;
        var homeEvent = true;
        if (!/\t+[0-9]+-[0-9]+/.exec(lineData)) {
            // jump ball, ignore so far
            return;
        }

        if (lineData.charCodeAt(0) == 32) { // space
            lineData = lineData.substr(lineData.lastIndexOf('\t') + 1);
        } else {
            lineData = lineData.substr(0, lineData.indexOf('\t'));
            homeEvent = false;
        }

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
                var p = new Player(player);
                map[player] = p;
                team.players[p.id] = p;
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
        lastLineData = lineData;
        m = /Turnover by (.*) \(([^)]*)\)/.exec(lineData);
        if (m) {
            // console.log(`GOT A TURNOVER ${m[1]} ${m[2]}`);
            var player = addPlayer(m[1]);
            game.events.push(new Event(Event.TO, time, homeEvent ? home : away, player));
            var m2 = /steal by (.*)/.exec(m[2]);
            if (m2) {
                game.events.push(new Event(Event.STL, time, homeEvent ? away : home, addPlayer(m2[1], !homeEvent)));
            }
            return;
        }

        m = /Personal foul by ([^\t]*)/.exec(lineData);
        if (m) {
            game.events.push(new Event(Event.PF, time, homeEvent ? home : away, addPlayer(m[1])));
            return;
        }

        if (lineData.indexOf('full timeout') !== -1) {
            game.events.push(new Event(Event.TIMEOUT, time, homeEvent ? home : away));
            return;
        }

        m = /Defensive rebound by (.*)/.exec(lineData);
        if (m) {
            game.events.push(new Event(Event.DRB, time, homeEvent ? home : away, addPlayer(m[1])));
            return;
        }

        m = /Offensive rebound by (.*)/.exec(lineData);
        if (m) {
            game.events.push(new Event(Event.ORB, time, homeEvent ? home : away, addPlayer(m[1])));
            return;
        }

        if (lineData.indexOf('Def 3 sec tech foul by') !== -1) {
            game.events.push(new Event(Event.TF, time, homeEvent ? home : away));
            return;
        }

        m = / foul by (.*) \(drawn by [^)]*\)/.exec(lineData);
        if (m) {
            game.events.push(new Event(Event.PF, time, homeEvent ? away : home, addPlayer(m[1], !homeEvent)));
            return;
        }

        m = / foul by (.*)/.exec(lineData);
        if (m) {
            game.events.push(new Event(Event.PF, time, homeEvent ? home : away, addPlayer(m[1])));
            return;
        }

        m = /[Ff]lagrant foul type ([12]) by (.*)/.exec(lineData);
        if (m) {
            game.events.push(new Event(m[1] == '1' ? Event.FF1 : Event.FF2, time, homeEvent ? home : away, addPlayer(m[2])));
            return;
        }

        m = /(.*) enters the game for (.*)/.exec(lineData);
        if (m) {
            // var lineup = homeEvent ? homeLineup : awayLineup;
            game.events.push(new Event(Event.SUBBED_OUT, time, homeEvent ? home : away, addPlayer(m[2])));
            game.events.push(new Event(Event.SUBBED_IN, time, homeEvent ? home : away, addPlayer(m[1])));
            // delete lineup[m[2]];
            return;
        }

        m = /(.*) makes ([23])-pt shot /.exec(lineData);
        if (m) {
            game.events.push(new Event(m[2] == '2' ? Event.FGA2 : Event.FGA3, time, homeEvent ? home : away, addPlayer(m[1])));
            game.events.push(new Event(m[2] == '2' ? Event.FGM2 : Event.FGM3, time, homeEvent ? home : away, addPlayer(m[1])));
            return;
        }

        m = /(.*) misses ([23])-pt shot .* \(block by (.*)\)/.exec(lineData);
        if (m) {
            game.events.push(new Event(Event.BLK, time, homeEvent ? away : home, addPlayer(m[3], !homeEvent)));
            game.events.push(new Event(m[2] == '2' ? Event.FGA2 : Event.FGA3, time, homeEvent ? home : away, addPlayer(m[1])));
            return;
        }

        m = /(.*) misses ([23])-pt shot/.exec(lineData);
        if (m) {
            game.events.push(new Event(m[2] == '2' ? Event.FGA2 : Event.FGA3, time, homeEvent ? home : away, addPlayer(m[1])));
            return;
        }

        m = /(.*) misses.*free throw/.exec(lineData);
        if (m) {
            game.events.push(new Event(Event.FTA, time, homeEvent ? home : away, addPlayer(m[1])));
            return;
        }

        m = /(.*) makes.*free throw/.exec(lineData);
        if (m) {
            game.events.push(new Event(Event.FTA, time, homeEvent ? home : away, addPlayer(m[1])));
            game.events.push(new Event(Event.FTM, time, homeEvent ? home : away, addPlayer(m[1])));
            return;
        }

        // console.log(`Unhandled event ${time.minute} ${time.second} ${lineData}`);
    });
    // console.log("game events: " + game.events.length);
    // console.log(lines.length);
    var box = new BoxScore(game, maxTime);
    // for (var i=0; i<game.events.length; ++i) {
    //     var event = game.events[i];
    //     if (event.time.value > time.value)
    //         break;
    //     if (event.team) {
    //         console.log(`${event.time.minute}:${event.time.second} ${event.team.abbrev} ${Event.eventNames[event.type]} ${event.data}`);
    //     } else {
    //         console.log(`${event.time.minute}:${event.time.second} ${Event.eventNames[event.type]} ${event.data}`);
    //     }
    // }
    // console.log(`${game.away.abbrev} ${box.awayScore} - ${box.homeScore} ${game.home.abbrev}`);
}

// console.log(Event.eventNames[Event.TO]);

// console.log(Event.TO);
var home = new Team("Golden State Warriors", "GSW");
var away = new Team("Cleveland Cavaliers", "CLE");
parse("../testdata/201701160GSW.txt", home, away);

// var home = new Team("Portland Trail Blazers", "POR");
// var away = new Team("Detroit Pistons", "DET");
// parse("../testdata/201701080POR.txt", home, away);

// var t = new Time(1000);
// console.log(t.toString());

// var names = ["First", "Second", "Third", "Fourth", "1st OT", "2nd OT"];
// for (var i=0; i<6; ++i) {
//     var s = Time.quarterStart(i);
//     var e = Time.quarterEnd(i);
//     console.log(`${names[i]} ${i} start ${s} --- end ${e}`);
// }
