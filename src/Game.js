/*global module, require */

var League = require('./League.js');
var GameEvent = require('./GameEvent.js');
var Team = require('./Team.js');
var Player = require('./Player.js');
var Time = require('./Time.js');

function Game(home, away)
{
    this.home = home;
    this.away = away;
    this.events = [];
}
Game.decode = function(object, league) {
    var home = league.decodeTeam(object.home);
    var away = league.decodeTeam(object.away);
    var ret = new Game(home, away);
    ret.events = object.events.map((event) => { return ret.decodeEvent(event); });
    return ret;
};

Game.prototype.encode = function(league) {
    var ret = {
        home: league.encodeTeam(this.home),
        away: league.encodeTeam(this.away),
        events: this.events.map((event) => { return this.encodeEvent(event); })
    };
    return ret;
};

Game.prototype.encodeEvent = function(event) {
    var ret = {
        type: event.type,
        time: { value: event.time.value, end: event.time.end },
        team: event.team ? event.team.id : undefined
    };
    if (event.data instanceof Team) {
        ret.data = { team: event.data.id };
    } else if (event.data instanceof Player) {
        ret.data = { player: event.data.id };
    } else {
        ret.data = event.data;
    }
    return ret;
};

Game.prototype.decodeEvent = function(object) {
    var data;
    if (object.data instanceof Object) {
        if (object.data.team) {
            data = this.home.id === object.data.team ? this.home : this.away;
        } else {
            data = this.players[object.data.player];
        }
    } else {
        data = object.data;
    }
    console.log("gris", typeof GameEvent, Object.keys(GameEvent));
    return new GameEvent(object.type, new Time(object.time.value, object.time.end), object.team === this.home.id ? this.home : this.away, data);
};


module.exports = Game;


