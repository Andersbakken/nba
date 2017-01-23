/*global module */

function Event(type, time, data, team)
{
    this.type = type;
    this.time = time;
    this.data = data;
    this.team = team;
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
Event.STARTED = 18;
Event.SUBBED_IN = 19;
Event.SUBBED_OUT = 20;
Event.numEvents = Event.SUBBED_OUT + 1;
Event.eventNames = (function() {
    var ret = {};
    Object.keys(Event).forEach(function(key) {
        var val = Event[key];
        if (typeof val == 'number') {
            ret[val] = key;
        }
    });
    // console.log(ret);
    return ret;
})();

module.exports.Event = Event;
