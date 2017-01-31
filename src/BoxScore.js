/*global module, require */

var GameEvent = require('./GameEvent.js');
var Player = require('./Player.js');
var Time = require('./Time.js');

function BoxScore(game, maxTime)
{
    function values() { var ret = []; ret[GameEvent.numEvents - 1] = 0; ret.fill(0, 0, GameEvent.numEvents - 1); return ret; }

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
        if (ev.type == GameEvent.QUARTER_START) {
            quarter = ev.data;
            homeLineup = {};
            awayLineup = {};
            continue;
        } else if (ev.type == GameEvent.QUARTER_END) {
            var playerId;
            for (playerId in homeLineup) {
                // console.log(game.home.players[playerId].name + " is in the game, subbing out for " + ev.data + " " + playerId);
                homeSubs.push({type: GameEvent.SUBBED_OUT, time: ev.time, player: playerId, name: game.home.players[playerId].name, foo: "out2" });
            }
            for (playerId in awayLineup) {
                awaySubs.push({type: GameEvent.SUBBED_OUT, time: ev.time, player: playerId, name: game.away.players[playerId].name, foo: "out2"  });
            }
            continue;
        }

        var home = ev.team === game.home;
        var lineup = home ? homeLineup : awayLineup;
        var subs = home ? homeSubs : awaySubs;
        var pts = 0;
        switch (ev.type) {
        case GameEvent.FGM2: pts = 2; break;
        case GameEvent.FGM3: pts = 3; break;
        case GameEvent.FTM: pts = 1; break;
        case GameEvent.SUBBED_IN:
            lineup[ev.data.id] = true;
            subs.push({type: GameEvent.SUBBED_IN, time: ev.time, player: ev.data.id, name: ev.data.name, foo: "in1" });
            break;
        case GameEvent.SUBBED_OUT:
            if (!lineup[ev.data.id]) {
                subs.push({ type: GameEvent.SUBBED_IN, time: Time.quarterStart(quarter), player: ev.data.id, name: ev.data.name, foo: "in4" });
            } else {
                delete lineup[ev.data.id];
            }
            subs.push({ type: GameEvent.SUBBED_OUT, time: ev.time, player: ev.data.id, name: ev.data.name, foo: "out1" });
            break;
        }
        var teamStats = home ? this.homeStats : this.awayStats;
        ++teamStats[ev.type];
        teamStats[GameEvent.PTS] += pts;
        if (ev.data instanceof Player) {
            if (!lineup[ev.data.id] && ev.type != GameEvent.SUBBED_OUT && ev.type != GameEvent.SUBBED_IN) {
                lineup[ev.data.id] = true;
                if (quarter == 0)
                    this.players[ev.data.id][GameEvent.STARTED] = true;
                subs.push({ type: GameEvent.SUBBED_IN, time: Time.quarterStart(quarter), player: ev.data.id, name: ev.data.name, foo: "in3" });
            }
            ++this.players[ev.data.id][ev.type];
            this.players[ev.data.id][GameEvent.PTS] += pts;
        }
    }
    var that = this;
    function processSubs(subs) {
        var map = {};
        var ms = {};

        var sorted = subs.sort(function(l, r) { return l.time.compare(r.time); });
        sorted.forEach(function(sub) {
            if (sub.type == GameEvent.SUBBED_IN) {
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
            that.players[id][GameEvent.MINUTES] = (new Time(ms[id])).mmss();
        }
    }
    processSubs(homeSubs);
    processSubs(awaySubs);
};

BoxScore.prototype.encode = function() {
    var that = this;
    function formatTeam(team, players, stats) {
        var sorted = players.sort(function(l, r) {
            var ll = that.players[l.id];
            var rr = that.players[r.id];
            if (ll[GameEvent.STARTED] != rr[GameEvent.STARTED])
                return ll[GameEvent.STARTED] ? -1 : 1;
            return rr[GameEvent.PTS] - ll[GameEvent.PTS];
        });
        var ret = [["Player", "pts", "mins", "fgm", "fga", "fg%", "3pa", "3pm", "3p%", "fta", "ftm", "ft%", "orb", "drb", "trb", "ast", "stl", "blk", "to", "pf"]];

        function formatLine(name, stats) {
            var arr = [ name ];
            arr.push(stats[GameEvent.PTS]);
            arr.push(stats[GameEvent.MINUTES]);
            arr.push(stats[GameEvent.FGM2] + stats[GameEvent.FGM3]);
            arr.push(stats[GameEvent.FGA2] + stats[GameEvent.FGA3]);
            arr.pushcentage(stats[GameEvent.FGM2] + stats[GameEvent.FGM3]);
            arr.push(stats[GameEvent.FGM3]);
            arr.push(stats[GameEvent.FGA3]);
            arr.pushcentage(stats[GameEvent.FGM3]);
            arr.push(stats[GameEvent.FTM]);
            arr.push(stats[GameEvent.FTA]);
            arr.pushcentage(stats[GameEvent.FTM]);
            arr.push(stats[GameEvent.ORB]);
            arr.push(stats[GameEvent.DRB]);
            arr.push(stats[GameEvent.ORB] + stats[GameEvent.DRB]);
            arr.push(stats[GameEvent.AST]);
            arr.push(stats[GameEvent.STL]);
            arr.push(stats[GameEvent.BLK]);
            arr.push(stats[GameEvent.TO]);
            arr.push(stats[GameEvent.PF]);
            return arr;
        }
        sorted.forEach(function(player) { ret.push(formatLine(player.name, that.players[player.id])); });
        formatLine("Total", stats);
        return ret;
    }

    return {
        home: {
            name: this.game.home.name,
            rows: formatTeam(this.game.home, this.game.homePlayers, this.game.homeStats)
        },
        away: {
            name: this.game.away.name,
            rows: formatTeam(this.game.away, this.game.awayPlayers, this.game.awayStats)
        }
    };
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
        console.log(team.name + " - " + stats[GameEvent.PTS]);
        console.log("----------------------------------------------------------------------------------------------------------------------------------------");
        console.log("Player                   MIN   FGM   FGA   FG%   3PM   3PA   3P%   FTM   FTA   FT%   ORB   DRB   TRB   AST   STL   BLK   TOV    PF   PTS");
        console.log("----------------------------------------------------------------------------------------------------------------------------------------");

        var sorted = players.sort(function(l, r) {
            var ll = that.players[l.id];
            var rr = that.players[r.id];
            if (ll[GameEvent.STARTED] != rr[GameEvent.STARTED])
                return ll[GameEvent.STARTED] ? -1 : 1;
            return rr[GameEvent.PTS] - ll[GameEvent.PTS];
        });
        function formatLine(name, stats) {
            var str = pad(name, 22);
            str += pad(stats[GameEvent.MINUTES], 6);
            str += pad(stats[GameEvent.FGM2] + stats[GameEvent.FGM3], 6);
            str += pad(stats[GameEvent.FGA2] + stats[GameEvent.FGA3], 6);
            str += percentage(stats[GameEvent.FGM2] + stats[GameEvent.FGM3], stats[GameEvent.FGA2] + stats[GameEvent.FGA3]);
            str += pad(stats[GameEvent.FGM3], 6);
            str += pad(stats[GameEvent.FGA3], 6);
            str += percentage(stats[GameEvent.FGM3], stats[GameEvent.FGA3]);
            str += pad(stats[GameEvent.FTM], 6);
            str += pad(stats[GameEvent.FTA], 6);
            str += percentage(stats[GameEvent.FTM], stats[GameEvent.FTA]);
            str += pad(stats[GameEvent.ORB], 6);
            str += pad(stats[GameEvent.DRB], 6);
            str += pad(stats[GameEvent.ORB] + stats[GameEvent.DRB], 6);
            str += pad(stats[GameEvent.AST], 6);
            str += pad(stats[GameEvent.STL], 6);
            str += pad(stats[GameEvent.BLK], 6);
            str += pad(stats[GameEvent.TO], 6);
            str += pad(stats[GameEvent.PF], 6);
            str += pad(stats[GameEvent.PTS], 6);
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

/*
BoxScore.prototype.toHTML = function() {
    var html = "";
    var fields = [
        for (var teamData in [ [ this.away, this.awayPlayers, this.away.Stats ] [ this.home, this.homePlayers, that.homeStats ] ]) {
        var team = teamData[0];
        var players = teamData[1];
        html += '<div>' + team.name + '</div><br/>';
        html += '<table width="100%">';
        html += '<tr width="100%">';
        html += '<td>

    }
    var html = ('<div>' + this.game.home.name + '</div>'
                + '<table width="100%">'



};

 */

module.exports = BoxScore;
