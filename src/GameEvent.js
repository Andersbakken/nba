/*global module, require */

var Game = require('./Game.js');
var Team = require('./Team.js');
var Player = require('./Player.js');
var Time = require('./Time.js');

function GameEvent(type, time, team, data)
{
    this.type = type;
    this.time = time;
    this.team = team;
    this.data = data;
}

GameEvent.prototype.toString = function() {
    var evName = GameEvent.eventNames[this.type];
    var player = this.data instanceof Player ? this.data.name : "";
    var team = this.team.name;
    var time = this.time.mmss();
    return `GameEvent(${time}: ${evName} ${player} ${team})`;
};

// scores
GameEvent.PTS = 0;
GameEvent.FGA2 = 1;
GameEvent.FGM2 = 2;
GameEvent.FGA3 = 3;
GameEvent.FGM3 = 4;
GameEvent.FTA = 5;
GameEvent.FTM = 6;
// rebounds
GameEvent.DRB = 7;
GameEvent.ORB = 8;
GameEvent.TRB = 9;
// passing
GameEvent.AST = 10;
GameEvent.TO = 11;
// defense
GameEvent.STL = 12;
GameEvent.BLK = 13;
// fouls
GameEvent.PF = 14;
GameEvent.FF1 = 15;
GameEvent.FF2 = 16;
GameEvent.TF = 17;
// misc
GameEvent.SUBBED_IN = 18;
GameEvent.SUBBED_OUT = 19;
GameEvent.MINUTES = 20;
GameEvent.STARTED = 21;
// team
GameEvent.TIMEOUT = 22;
GameEvent.TIMEOUT_20S = 23;
GameEvent.QUARTER_START = 24;
GameEvent.QUARTER_END = 25;
GameEvent.numEvents = GameEvent.QUARTER_END + 1;
GameEvent.eventNames = (function() {
    var ret = {};
    Object.keys(GameEvent).forEach(function(key) {
        var val = GameEvent[key];
        if (typeof val === 'number') {
            ret[val] = key;
        }
    });
    // console.log(ret);
    return ret;
})();

module.exports = GameEvent;
