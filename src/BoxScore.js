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
    this.awayPlayers = [];
    this.homePlayers = [];

    var player, p;
    for (player in game.away.players) {
        p = game.away.players[player];
        this.players[player] = values();
        this.awayPlayers.push(p);
    }

    for (player in game.home.players) {
        p = game.home.players[player];
        this.players[player] = values();
        this.homePlayers.push(p);
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
                // console.log(game.home.players[playerId].name + " is in the game, subbing out for " + ev.data + " " + playerId);
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
            subs.push({type: Event.SUBBED_IN, time: ev.time, player: ev.data.id, name: ev.data.name, foo: "in1" });
            break;
        case Event.SUBBED_OUT:
            if (!lineup[ev.data.id]) {
                subs.push({ type: Event.SUBBED_IN, time: Time.quarterStart(quarter), player: ev.data.id, name: ev.data.name, foo: "in4" });
            } else {
                delete lineup[ev.data.id];
            }
            subs.push({ type: Event.SUBBED_OUT, time: ev.time, player: ev.data.id, name: ev.data.name, foo: "out1" });
            break;
        }
        var teamStats = home ? this.homeStats : this.awayStats;
        ++teamStats[ev.type];
        teamStats[Event.PTS] += pts;
        if (ev.data instanceof Player) {
            if (!lineup[ev.data.id] && ev.type != Event.SUBBED_OUT && ev.type != Event.SUBBED_IN) {
                lineup[ev.data.id] = true;
                if (quarter == 0)
                    this.players[ev.data.id][Event.STARTED] = true;
                subs.push({ type: Event.SUBBED_IN, time: Time.quarterStart(quarter), player: ev.data.id, name: ev.data.name, foo: "in3" });
            }
            ++this.players[ev.data.id][ev.type];
            this.players[ev.data.id][Event.PTS] += pts;
        }
    }
    var that = this;
    function processSubs(subs) {
        var map = {};
        var ms = {};

        var sorted = subs.sort(function(l, r) { return l.time.compare(r.time); });
        sorted.forEach(function(sub) {
            if (sub.type == Event.SUBBED_IN) {
                // console.log(`processing sub in time: ${sub.time} player: ${sub.name} playerId: ${sub.player} ${sub.foo}`);
                map[sub.player] = sub.time;
            } else {
                // console.log(`processing sub out time: ${sub.time} player: ${sub.name} playerId: ${sub.player} ${sub.foo}`);
                // if (!map[sub.player]) {
                //     console.error(`Somehow ${sub.name} isn't on the court`);
                //     return;
                // }
                var duration = sub.time.value - map[sub.player].value;
                delete map[sub.player];
                if (!ms[sub.player]) {
                    ms[sub.player] = duration;
                } else {
                    ms[sub.player] += duration;
                }
            }
        });
        for (var id in ms) {
            that.players[id][Event.MINUTES] = (new Time(ms[id])).mmss();
        }
    }
    processSubs(homeSubs);
    processSubs(awaySubs);
};

BoxScore.prototype.print = function() {
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

    var that = this;
    function formatTeam(team, players) {
        var stats = (team == that.game.home ? that.homeStats : that.awayStats);
        console.log(team.name + " - " + stats[Event.PTS]);
        console.log("----------------------------------------------------------------------------------------------------------------------------------------");
        console.log("Player                   MIN   FGM   FGA   FG%   3PM   3PA   3P%   FTM   FTA   FT%   ORB   DRB   TRB   AST   STL   BLK   TOV    PF   PTS");
        console.log("----------------------------------------------------------------------------------------------------------------------------------------");

        var sorted = players.sort(function(l, r) {
            var ll = that.players[l.id];
            var rr = that.players[r.id];
            if (ll[Event.STARTED] != rr[Event.STARTED])
                return ll[Event.STARTED] ? -1 : 1;
            return rr[Event.PTS] - ll[Event.PTS];
        });
        function formatLine(name, stats) {
            var str = pad(name, 22);
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
        console.log("----------------------------------------------------------------------------------------------------------------------------------------");
        formatLine("Total", stats);
        console.log("----------------------------------------------------------------------------------------------------------------------------------------");
    }
    formatTeam(this.game.away, this.awayPlayers);
    console.log();
    formatTeam(this.game.home, this.homePlayers);
};

module.exports = BoxScore;
