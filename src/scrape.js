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

function parse(file, time) {
    var home = new Team("Golden State Warriors", "GSW");
    var away = new Team("Cleveland Cavaliers", "CLE");
    var game = new Game(home, away);
    var quarter = undefined;
    var lines = fs.readFileSync(file, "utf-8").split("\n");
    var homeLineup = {};
    var awayLineup = {};
    var lineUpIdx = 0;
    var lastLineData = "";
    lines.forEach(function(line) {
        var match = /^([0-9][0-9]?):([0-9][0-9])\.0.(.*)/.exec(line);
        if (!match)
            return;
        var lineData = match[3];
        var m = /Start of ([0-9])[a-z][a-z] quarter/.exec(lineData);
        if (m) {
            quarter = m[1];
            console.log(`Got quarter ${quarter}`);
            if (quarter > 1) {
                console.log(`DUDES AT END OF QUARTER ${quarter - 1}: ` + JSON.stringify(homeLineup, null, 4) + " " + JSON.stringify(awayLineup, null, 4));
            }
            homeLineup = {};
            awayLineup = {};
            return;
        }
        var minutes = (quarter - 1) * 12 + (12 - match[1]);
        var time = new Time(minutes, match[2]);
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
            var lineup = homePlayer ? homeLineup : awayLineup;
            // console.log(`ADDING ${player} ${homePlayer} ${JSON.stringify(lineup)} ${lineup === homeLineup}`);
            lineup[player] = ++lineUpIdx;
            if (!team.players[player]) {
                var ret = new Player(player);
                team.players[player] = ret;
                return ret;
            }
            return team.players[player];
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
            var lineup = homeEvent ? homeLineup : awayLineup;
            game.events.push(new Event(Event.SUBBED_OUT, time, homeEvent ? home : away, addPlayer(m[2])));
            game.events.push(new Event(Event.SUBBED_IN, time, homeEvent ? home : away, addPlayer(m[1])));
            delete lineup[m[2]];
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
    var box = new BoxScore(game, time);
    for (var i=0; i<game.events.length; ++i) {
        var event = game.events[i];
        if (event.time.value > time.value)
            break;
        // console.log(`${event.time.minute}:${event.time.second} ${event.team.abbrev} ${Event.eventNames[event.type]} ${event.data}`);
    }
    // console.log(`${game.away.abbrev} ${box.awayScore} - ${box.homeScore} ${game.home.abbrev}`);
}

// console.log(Event.eventNames[Event.TO]);

// console.log(Event.TO);
parse("../testdata/201701160GSW.txt", new Time(49, 0));

