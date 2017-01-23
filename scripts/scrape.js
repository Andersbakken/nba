#!/usr/bin/env node

/*global require */
var fs = require('fs');
var Player = require('../src/Player.js');
var Team = require('../src/Team.js');
var Time = require('../src/Time.js');
var PlayerScore = require('../src/PlayerScore.js');
var BoxScore = require('../src/BoxScore.js');
var Event = require('../src/Event.js');
var Game = require('../src/Game.js');

console.log(Object.keys(Team));

function parse(file) {
    var home = new Team("Golden State Warriors");
    var away = new Team("Cleveland Cavaliers");
    var game = new Game(home, away);
    var quarter = undefined;
    var lines = fs.readFileSync(file, "utf-8").split("\n");
    lines.forEach(function(line) {
        var match = /^([0-9][0-9]?):([0-9][0-9])\.0.(.*)/.exec(line); //\.0 (.*)/.exec(line); //\.0 (.*)/.exec(line);
        if (!match)
            return;
        var lineData = match[3];
        var m = /Start of ([0-9])[a-z][a-z] quarter/.exec(lineData);
        if (m) {
            quarter = m[1];
            console.log(`Got quarter ${quarter}`);
            return;
        }
        var minutes = (quarter - 1) * 12 + (12 - match[1]);
        var time = new Time(minutes, match[2]);
        var homeEvent = true;
        m = /^(.*)\t+[0-9]+-[0-9]+$/.exec(lineData);
        if (m) {
            homeEvent = false;
        } else {
            m = /\t+[0-9]+-[0-9]+(.*)/.exec(lineData);
            if (!m) {
                // jump ball, ignore so far
                return;
            }
        }
        lineData = m[1];

        function addPlayer(player) {
            var team = homeEvent ? home : away;
            if (!team.players[player]) {
                var ret = new Player(player);
                team.players[player] = ret;
                return ret;
            }
            return team.players[player];
        }
        m = /Turnover by (.*) \(([^)]*)\)/.exec(lineData);
        if (m) {
            // console.log(`GOT A TURNOVER ${m[1]} ${m[2]}`);
            var player = addPlayer(m[1]);
            game.events.push(new Event(Event.TO, time, player, homeEvent ? home : away));
            var m2 = /steal by (.*)/.exec(m[2]);
            if (m2) {
               game.events.push(new Event(Event.STL, time, addPlayer(m2[1]), homeEvent ? away : home));
            }
            return;
        }

        m = /Personal foul by ([^\t]*)/.exec(lineData);
        if (m) {
            game.events.push(new Event(Event.PF, time, addPlayer(m[1]), homeEvent ? home : away));
            return;
        }

        console.log(`Unhandled event ${time.minute} ${time.second} ${lineData}`);
    });
    console.log("game events: " + game.events.length);
    game.events.forEach(function(event) {
        console.log(`${event.time.minute}:${event.time.second} ${Event.eventNames[event.type]} ${event.data}`);
    });


    // console.log(lines.length);
}

// console.log(Event.eventNames[Event.TO]);

// console.log(Event.TO);
parse("201701160GSW.txt");

