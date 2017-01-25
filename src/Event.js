/*global module, require */

const Game = require('./Game.js');
const Team = require('./Team.js');
const Player = require('./Player.js');
const Time = require('./Time.js');

function Event(type, time, team, data)
{
    this.type = type;
    this.time = time;
    this.team = team;
    this.data = data;
}

// scores
Event.PTS = 0;
Event.FGA2 = 1;
Event.FGM2 = 2;
Event.FGA3 = 3;
Event.FGM3 = 4;
Event.FTA = 5;
Event.FTM = 6;
// rebounds
Event.DRB = 7;
Event.ORB = 8;
Event.TRB = 9;
// passing
Event.AST = 10;
Event.TO = 11;
// defense
Event.STL = 12;
Event.BLK = 13;
// fouls
Event.PF = 14;
Event.FF1 = 15;
Event.FF2 = 16;
Event.TF = 17;
// misc
Event.SUBBED_IN = 18;
Event.SUBBED_OUT = 19;
Event.MINUTES = 20;
Event.STARTED = 21;
// team
Event.TIMEOUT = 22;
Event.TIMEOUT_20S = 23;
Event.QUARTER_START = 24;
Event.QUARTER_END = 25;
Event.numEvents = Event.QUARTER_END + 1;
Event.eventNames = (function() {
    var ret = {};
    Object.keys(Event).forEach(function(key) {
        var val = Event[key];
        if (typeof val === 'number') {
            ret[val] = key;
        }
    });
    // console.log(ret);
    return ret;
})();

module.exports = Event;
