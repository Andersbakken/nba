/*global module, require */

var Event = require('./Event.js');
var Player = require('./Player.js');

function BoxScore(game, time)
{
    function values() { return [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]; }

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

    for (var i=0; i<game.events.length; ++i) {
        var ev = game.events[i];
        if (ev.time.value > time.value)
            break;
        var home = ev.team === game.home;
        var pts = 0;
        switch (ev.type) {
        case Event.FGM2: pts = 2; break;
        case Event.FGM3: pts = 3; break;
        case Event.FTM: pts = 1; break;
        }
        var teamStats = home ? this.homeStats : this.awayStats;
        ++teamStats[ev.type];
        teamStats[Event.PTS] += pts;
        if (ev.data instanceof Player) {
            ++this.players[ev.data.id][ev.type];
            this.players[ev.data.id][Event.PTS] += pts;
        }
    }
    // console.log(this.players);
    var that = this;

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
        console.log("Player             FGM   FGA   FG%   3PM   3PA   3P%   FTM   FTA   FT%   ORB   DRB   TRB   AST   STL   BLK   TOV    PF   PTS");
        console.log("----------------------------------------------------------------------------------------------------------------------------");

        var sorted = players.sort(function(l, r) { return that.players[r.id][Event.PTS] - that.players[l.id][Event.PTS]; });
        function formatLine(name, stats) {
            var str = pad(name, 16);
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
