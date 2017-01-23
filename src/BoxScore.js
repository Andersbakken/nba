/*global module, require */

var Event = require('./Event.js');

function BoxScore(game, time)
{
    function values() { return [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]; }

    this.game = game;
    this.players = {}; // playerId to array
    this.awayStats = values();
    this.homeStats = values();
    this.homeScore = 0;
    this.awayScore = 0;

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
        homePlayers.push(game.away.players[player]);
        // longest = Math.max(longest, player.length);
    }

    for (var i=0; i<game.events.length; ++i) {
        var ev = game.events[i];
        if (ev.time.value > time.value)
            break;
        var home = ev.team === game.home;
        var pts = 0;
        switch (ev.type) {
        case Event.FGM2: this.players[ev.data.id][Event.PTS] += 2; pts = 2; break;
        case Event.FGM3: this.players[ev.data.id][Event.PTS] += 3; pts = 3; break;
        case Event.FTM: ++this.players[ev.data.id][Event.PTS]; pts = 1; break;
        }
        if (pts) {
            if (home) {
                this.homeScore += pts;
            } else {
                this.awayScore += pts;
            }
        }
    }
    var that = this;

    function pad(text, width) {
        if (typeof text !== 'string')
            text = '' + text;
        var str = '';
        while (text.length + str.length < width)
            str += ' ';
        if (text.charCodeAt(text.length - 1) >= 48 && text.charCodeAt(text.length - 1) <= 57)
            return str + text;
        return text + str;
    }

    function formatTeam(team, players) {
        console.log(team.name);
        console.log("Player           FGM  FGA  FG%  3PM  3PA  3P%  FTM  FTA  FT%  ORB  DRB  TRB  AST  STL  BLK  TOV  PF PTS");
        console.log("---------------------------------------------------------------------------------------------------------");

        var sorted = players.sort(function(l, r) { return that.players[l.id][Event.PTS] - that.players[r.id][Event.PTS]; });
        sorted.forEach(function(player) {
            var str = pad(player.name, 17);
            var stats = that.players[player.id];
            str += pad(stats[Event.FGM2] + stats[Event.FGM3], 5);
            str += pad(stats[Event.FGA2] + stats[Event.FGA3], 5);
            console.log(str);
        });
    }
    formatTeam(game.away, awayPlayers);
    formatTeam(game.home, homePlayers);
}

module.exports = BoxScore;
