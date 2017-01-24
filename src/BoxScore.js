/*global module, require */

var Event = require('./Event.js');
var Player = require('./Player.js');
var Time = require('./Time.js');

function BoxScore(game, maxTime)
{
    function values() { var ret = []; ret[Event.numEvents - 1] = 0; ret.fill(0, 0, Event.numEvents - 1); return ret; }

    this.game = game;
    this.players = {}; // playerId to array
    this.awayStats = values();
    this.homeStats = values();

    var awayPlayers = [];
    var homePlayers = [];

    var player;
    // var longest = 0;
    for (player in game.away.players) {
        this.players[game.away.players[player].id] = values();
        awayPlayers.push(game.away.players[player]);
        // longest = Math.max(longest, player.length);
    }

    for (player in game.home.players) {
        this.players[game.home.players[player].id] = values();
        homePlayers.push(game.home.players[player]);
        // console.log("players", player, game.home.players[player]);
        // longest = Math.max(longest, player.length);
    }

    var homeLineup = {};
    var awayLineup = {};
    var quarter = undefined;
    var homeSubs = [];
    var awaySubs = [];
    for (var i=0; i<game.events.length; ++i) {
        var ev = game.events[i];
        if (maxTime && ev.time.value > maxTime.value) {
            break;
        }
        if (ev.type == Event.QUARTER_START) {
            quarter = ev.data;
            homeLineup = {};
            awayLineup = {};
            continue;
        } else if (ev.type == Event.QUARTER_END) {
            var playerId;
            for (playerId in homeLineup) {
                console.log(game.home.players[playerId].name + " is in the game, subbing out for " + ev.data + " " + playerId);
                homeSubs.push({type: Event.SUBBED_OUT, time: ev.time, player: playerId, name: game.home.players[playerId].name, foo: "out2" });
            }
            for (playerId in awayLineup) {
                awaySubs.push({type: Event.SUBBED_OUT, time: ev.time, player: playerId, name: game.away.players[playerId].name, foo: "out2"  });
            }
            continue;
        }

        var home = ev.team === game.home;
        var lineup = home ? homeLineup : awayLineup;
        var subs = home ? homeSubs : awaySubs;
        var pts = 0;
        switch (ev.type) {
        case Event.FGM2: pts = 2; break;
        case Event.FGM3: pts = 3; break;
        case Event.FTM: pts = 1; break;
        case Event.SUBBED_IN:
            lineup[ev.data.id] = true;
            // if (ev.data.id == 12) {
            //     console.log("IGGY SUBBED IN", ev.time);
            // }
            // if (ev.data.id == 4) {
            //     console.log("KLAY SUBBED IN", ev.time);
            // }
            subs.push({type: Event.SUBBED_IN, time: ev.time, player: ev.data.id, name: ev.data.name, foo: "in1" });
            break;
        case Event.SUBBED_OUT:
            // if (ev.data.id == 12) {
            //     console.log("IGGY SUBBED OUT", ev.time);
            // }
            // if (ev.data.id == 4) {
            //     console.log("KLAY SUBBED OUT", ev.time);
            // }


            // console.log("FUCKING SUBBED OUT", JSON.stringify(ev));
            if (!lineup[ev.data.id]) {
                subs.push({ type: Event.SUBBED_IN, time: new Time((quarter - 1) * 12, 0), player: ev.data.id, name: ev.data.name, foo: "in4" });
            } else {
                delete lineup[ev.data.id];
            }
            // console.log("SUBBOUT", JSON.stringify(ev), JSON.stringify(Object.keys(lineup)));
            subs.push({ type: Event.SUBBED_OUT, time: ev.time, player: ev.data.id, name: ev.data.name, foo: "out1" });
            break;
        }
        var teamStats = home ? this.homeStats : this.awayStats;
        ++teamStats[ev.type];
        teamStats[Event.PTS] += pts;
        if (ev.data instanceof Player) {
            if (!lineup[ev.data.id] && ev.type != Event.SUBBED_OUT && ev.type != Event.SUBBED_IN) {
                lineup[ev.data.id] = true;
                subs.push({ type: Event.SUBBED_IN, time: Time.quarterStart(quarter), player: ev.data.id, name: ev.data.name, foo: "in3" });
            }
            ++this.players[ev.data.id][ev.type];
            this.players[ev.data.id][Event.PTS] += pts;
            // if (!lineup[ev.data.id]) {
            //     lineup =
            // }
        }
    }
    var that = this;
    function processSubs(subs) {
        var map = {};
        var ms = {};
        // subs.forEach(function(sub) {
        //     console.log(sub.time.value);
        // });

        var sorted = subs.sort(function(l, r) {
            var ret = l.time.value - r.time.value;
            if (!ret && l.type != r.type) {
                return l.type == Event.SUBBED_OUT ? -1 : 1;
            }
            return ret;
        });
        // sorted.forEach(function(sub) {
        //     console.log(sub.time.value);
        // });

        sorted.forEach(function(sub) {
            // console.log(JSON.stringify(sub));
            // return;
            if (sub.type == Event.SUBBED_IN) {
                console.log(`processing sub in time: ${sub.time} player: ${sub.name} playerId: ${sub.player} ${sub.foo}`);
                // console.log("processing sub in", sub);
                // map[sub.player] = sub.time;
            } else {
                console.log(`processing sub out time: ${sub.time} player: ${sub.name} playerId: ${sub.player} ${sub.foo}`);
                // var duration = sub.time.value - map[sub.player].value;
                // delete map[sub.player];
                // if (!ms[sub.player]) {
                //     ms[sub.player] = duration;
                // } else {
                //     ms[sub.player] += duration;
                // }
            }
        });
        for (var id in ms) {
            that.players[id][Event.MINUTES] = parseInt(ms[id] / 60000);
        }
    }
    processSubs(homeSubs);
    processSubs(awaySubs);
    // console.log(this.players);

    function pad(text, width, padChar) {
        if (typeof text !== 'string')
            text = '' + text;
        if (!padChar)
            padChar = ' ';
        var str = '';
        while (text.length + str.length < width)
            str += padChar;
        if (text.charCodeAt(text.length - 1) >= 48 && text.charCodeAt(text.length - 1) <= 57)
            return str + text;
        return text + str;
    }

    function percentage(m, a) {
        if (!a)
            return '      ';
        if (m == a)
            return ' 1.000';
        return pad((m / a).toFixed(3).substr(1), 6);
    }

    function formatTeam(team, players) {
        var stats = (team == game.home ? that.homeStats : that.awayStats);
        console.log(team.name + " - " + stats[Event.PTS]);
        console.log("----------------------------------------------------------------------------------------------------------------------------");
        console.log("Player             MIN   FGM   FGA   FG%   3PM   3PA   3P%   FTM   FTA   FT%   ORB   DRB   TRB   AST   STL   BLK   TOV    PF   PTS");
        console.log("----------------------------------------------------------------------------------------------------------------------------");

        var sorted = players.sort(function(l, r) { return that.players[r.id][Event.PTS] - that.players[l.id][Event.PTS]; });
        function formatLine(name, stats) {
            var str = pad(name, 16);
            str += pad(stats[Event.MINUTES], 6);
            str += pad(stats[Event.FGM2] + stats[Event.FGM3], 6);
            str += pad(stats[Event.FGA2] + stats[Event.FGA3], 6);
            str += percentage(stats[Event.FGM2] + stats[Event.FGM3], stats[Event.FGA2] + stats[Event.FGA3]);
            str += pad(stats[Event.FGM3], 6);
            str += pad(stats[Event.FGA3], 6);
            str += percentage(stats[Event.FGM3], stats[Event.FGA3]);
            str += pad(stats[Event.FTM], 6);
            str += pad(stats[Event.FTA], 6);
            str += percentage(stats[Event.FTM], stats[Event.FTA]);
            str += pad(stats[Event.ORB], 6);
            str += pad(stats[Event.DRB], 6);
            str += pad(stats[Event.ORB] + stats[Event.DRB], 6);
            str += pad(stats[Event.AST], 6);
            str += pad(stats[Event.STL], 6);
            str += pad(stats[Event.BLK], 6);
            str += pad(stats[Event.TO], 6);
            str += pad(stats[Event.PF], 6);
            str += pad(stats[Event.PTS], 6);
            console.log(str);
        }
        sorted.forEach(function(player) { formatLine(player.name, that.players[player.id]); });
        console.log("----------------------------------------------------------------------------------------------------------------------------");
        formatLine("Total", stats);
        console.log("----------------------------------------------------------------------------------------------------------------------------");
    }
    formatTeam(game.away, awayPlayers);
    console.log();
    formatTeam(game.home, homePlayers);
}

module.exports = BoxScore;
