/* global require, module */

"use strict";
var leftPad = require('left-pad');
var assert = require('assert');
assert = function(cond, msg) {
    if (!msg) {
        console.log(`Failed \"assertion\" ${cond} ${msg}`);
    }
};

// --- misc ---
function currentSeasonYear() { // returns 2017 in 2016-2017 season
    var date = new Date;
    return date.getMonth() >= 9 ? date.getFullYear() + 1 : date.getFullYear();
}

function currentSeasonName() {
    var yearNumber = currentSeasonYear();
    var lastYear = "" + (yearNumber - 1);
    var year = ("" + yearNumber).substr(2);
    return `${lastYear}-${year}`;
}

function formatDate(date)
{
    var ret = "";
    ret += date.getFullYear();
    ret += leftPad((date.getMonth() + 1), 2, '0');
    ret += leftPad(date.getDate(), 2, '0');
    return ret;
}

// --- Time ---

function Time(ms, end)
{
    this.date = new Date(ms);
    this.end = end || false;
}
Time.prototype = {
    get milliseconds() { return this.date.getMilliseconds(); },
    get value() { return this.date.valueOf(); },
    get minutes() { return this.date.getMinutes(); },
    get seconds() { return this.date.getSeconds(); },
    get quarter() {
        var ret;
        var value = this.value;
        // ### what happens if something occurs before the ball is inbounded?
        if (value >= Time.quarterLength * 4) {
            value -= Time.quarterLength * 4;
            ret = parseInt(value / Time.extraTimeLength) + 4;
        } else {
            ret = parseInt(value / Time.quarterLength);
        }
        if (this.end)
            --ret;
        return ret;
    },
    add: function(ms) {
        this.date = new Date(this.value + ms);
        this.end = false;
    },
    compare: function(other) {
        var ret = this.value - other.value;
        if (!ret && this.end != other.end) {
            ret = this.end ? -1 : 1;
        }
        return ret;
    },

    mmss: function() {
        var str = "";
        if (this.minutes < 10)
            str += "0";
        str += this.minutes;
        str += ".";
        if (this.seconds < 10)
            str += "0";
        str += this.seconds;
        return str;
    },
    pretty: function() {
        function th(val) {
            switch (val) {
            case 1: return "1st";
            case 2: return "2nd";
            case 3: return "3rd";
            default:
                return val + "th";
            }
        }
        var ret;
        var q = this.quarter;
        if (q < 4) {
            ret = th(q + 1) + " quarter ";
        } else {
            ret = th(q - 3) + " overtime ";
        }
        var end = Time.quarterEnd(q);
        var left = new Time(end.value - this.value);
        ret += left.mmss();
        return ret;
    },
    toString: function() {
        return "value: " + this.value + " " + this.mmss() + " q: " + this.quarter;
    }
};
Time.quarterLength = 12 * 60 * 1000;
Time.extraTimeLength = 5 * 60 * 1000;
Time.quarterStart = function(idx) {
    if (idx > 4)
        return new Time((4 * Time.quarterLength) + ((idx - 4) * Time.extraTimeLength));
    return new Time(idx * Time.quarterLength);
};

Time.quarterEnd = function(idx) {
    var ret = Time.quarterStart(idx + 1);
    ret.end = true;
    return ret;
};

// --- Player ---

function Player(name, id)
{
    var comma = name.lastIndexOf(', ');
    if (comma == -1) {
        this.names = [name];
    } else {
        this.names = [ name.substr(comma + 2), name.substr(0, comma) ];
    }
    this.id = id;
    this.toString = function() { return this.name; }; // return `Player(${this.name}, ${this.id})`; };
}

Player.prototype =  {
    get name() {
        return this.names.join(' ');
    },
    encode: function() {
        return { names: this.names, id: this.id };
    }
};

Player.decode = function(data) {
    return new Player(data.names, data.id);
};

// --- Team ---

function Team(name, abbrev, id)
{
    this.name = name;
    this.abbrev = abbrev;
    this.division = undefined;
    this.conference = undefined;
    this.players = {};
    this.id = id;
    var date = new Date();
    var year = date.getMonth() >= 9 ? (date.getYear() + 1) : date.getYear();
    this.link = `http://www.basketball-reference.com/teams/${abbrev}/${year}.html`;
}

// --- Division ---

function Division(name, teams)
{
    this.name = name;
    this.conference = undefined;
    this.league = undefined;
    this.teams = {};
    teams.forEach((team) => {
        team.division = this;
        this.teams[team.name] = team;
    });
}

Division.prototype.find = function(key) { // key is abbrev, id or full name
    var ret = this.teams[key];
    if (!ret) {
        for (var teamName in this.teams) {
            var t = this.teams[teamName];
            if (t.abbrev == key || t.id == key) {
                ret = t;
                break;
            }
        }
    }
    return ret;
};

Division.prototype.forEachTeam = function(cb) {
    for (var team in this.teams) {
        cb(this.teams[team]);
    }
};

// --- Conference ---

function Conference(league, name, divisions)
{
    this.name = name;
    this.league = league;
    this.divisions = {};
    divisions.forEach((div) => {
        div.conference = this;
        div.league = league;
        for (var teamName in div.teams) {
            var team = div.teams[teamName];
            team.conference = this;
        }
        this.divisions[div.name] = div;
    });
}

Conference.prototype.forEachDivision = function(cb) {
    for (var div in this.divisions) {
        cb(this.divisions[div]);
    }
};

Conference.prototype.forEachTeam = function(cb) {
    this.forEachDivision(function(div) {
        div.forEachTeam(cb);
    });
};


Conference.prototype.find = function(key) {
    var ret;
    for (var div in this.divisions) {
        ret = this.divisions[div].find(key);
        if (ret)
            break;
    }
    return ret;
};

Conference.prototype.team = function(name) {
    var team;
    for (var divisionName in this.divisions) {
        team = this.divisions[divisionName].teams[name];
        if (team)
            break;
    }
    return team;
};

// --- League ---

function League()
{
    this.conferences = {
        "Eastern": new Conference(this, "Eastern", [
            new Division("Atlantic", [
                new Team("Boston Celtics", "BOS", 1610612738),
                new Team("Brooklyn Nets", "BKN", 1610612751),
                new Team("New York Knicks", "NYK", 1610612752),
                new Team("Philadelphia 76ers", "PHI", 1610612755),
                new Team("Toronto Raptors", "TOR", 1610612761)
            ]),
            new Division("Central", [
                new Team("Chicago Bulls", "CHI", 1610612741),
                new Team("Cleveland Cavaliers", "CLE", 1610612739),
                new Team("Detroit Pistons", "DET", 1610612765),
                new Team("Indiana Pacers", "IND", 1610612754),
                new Team("Milwaukee Bucks", "MIL", 1610612749)
            ]),
            new Division("Southeast", [
                new Team("Atlanta Hawks", "ATL", 1610612737),
                new Team("Charlotte Hornets", "CHA", 1610612766),
                new Team("Miami Heat", "MIA", 1610612748),
                new Team("Orlando Magic", "ORL", 1610612753),
                new Team("Washington Wizards", "WAS", 1610612764)
            ]),
        ]),
        "Western": new Conference(this, "Western", [
            new Division("Northwest", [
                new Team("Denver Nuggets", "DEN", 1610612743),
                new Team("Minnesota Timberwolves", "MIN", 1610612750),
                new Team("Oklahoma City Thunder", "OKC", 1610612760),
                new Team("Portland Trail Blazers", "POR", 1610612757),
                new Team("Utah Jazz", "UTA", 1610612762)
            ]),
            new Division("Pacific", [
                new Team("Golden State Warriors", "GSW", 1610612744),
                new Team("Los Angeles Clippers", "LAC", 1610612746),
                new Team("Los Angeles Lakers", "LAL", 1610612747),
                new Team("Phoenix Suns", "PHX", 1610612756),
                new Team("Sacramento Kings", "SAC", 1610612758)
            ]),
            new Division("Southwest", [
                new Team("Dallas Mavericks", "DAL", 1610612742),
                new Team("Houston Rockets", "HOU", 1610612745),
                new Team("Memphis Grizzlies", "MEM", 1610612763),
                new Team("New Orleans Pelicans", "NOP", 1610612740),
                new Team("San Antonio Spurs", "SAS", 1610612759)
            ])
        ])
    };
    this.players = undefined; // need to stay undefined, look at refreshPlayerCache
}

League.prototype.encodeTeam = function(team) {
    var ret = {
        name: team.name,
        id: team.id
    };
    var players = [];
    for (var playerId in team.players) {
        players.push(team.players[playerId].encode());
    }
    if (players.length)
        ret.players = players;

    return ret;
};
League.prototype.decodeTeam = function(object) {
    var team = this.find(object.name);
    if (!team)
        throw new Error("Bad team object: " + object);
    object.players.forEach((data) => {
        var player = Player.decode(data);
        if (!(player instanceof Player)) {
            throw new Error("Bad player data: " + data);
        }
        team.players[player.id] = player;
    });
    return team;
};

League.prototype.find = function(key) {
    return this.conferences.Eastern.find(key) || this.conferences.Western.find(key);
};

League.prototype.forEachConference = function(cb) {
    for (var conf in this.conferences) {
        cb(this.conferences[conf]);
    }
};

League.prototype.forEachDivision = function(cb) {
    this.forEachConference(function(conf) {
        conf.forEachDivision(cb);
    });
};

League.prototype.forEachTeam = function(cb) {
    this.forEachConference(function(conf) {
        conf.forEachDivision(function(div) {
            div.forEachTeam(cb);
        });
    });
};

// --- Event ---

function Event(type, time, team, data)
{
    this.type = type;
    this.time = time;
    this.team = team;
    this.data = data;
}

Event.prototype.toString = function() {
    var evName = Event.eventNames[this.type];
    var player = this.data instanceof Player ? (" " + this.data.name) : "";
    var team = this.team ? (" " + this.team.name) : "";
    var time = this.time.mmss();
    return `Event(${time}: ${evName}${player}${team})`;
};

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
Event.PLUSMINUS = 22;
// team
Event.TIMEOUT = 23;
Event.TIMEOUT_20S = 24;
Event.QUARTER_END = 25;
Event.QUARTER_START = 26;
Event.numEvents = Event.QUARTER_START + 1;
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

// --- Game ---

function Game(home, away, id)
{
    this.home = home;
    this.away = away;
    this.events = [];
    this.homePlayers = {};
    this.awayPlayers = {};
    this.gameFinished = undefined;
    this.id = id;
}
Game.decode = function(object, league) {
    var home = league.find(object.home);
    var away = league.find(object.away);
    var ret = new Game(home, away, object.id);
    ret.gameFinished = object.gameFinished;
    league.players = {};
    object.homePlayers.forEach((player) => {
        var p = Player.decode(player);
        // console.log("player", player, "p", p);
        league.players[p.id] = p;
        ret.homePlayers[p.id] = p;
    });
    object.awayPlayers.forEach((player) => {
        var p = Player.decode(player);
        league.players[p.id] = p;
        ret.awayPlayers[p.id] = p;
    });

    ret.events = object.events.map((event) => { return ret.decodeEvent(league, event); });

    return ret;
};
Game.prototype = {
    get length() {
        return this.events.length ? this.events[this.events.length - 1].time : undefined;
    },
    encode: function(league) {
        var ret = {
            home: this.home.name,
            away: this.away.name,
            events: this.events.map((event) => { return this.encodeEvent(event); }),
            gameFinished: this.gameFinished,
            id: this.id
        };

        ["homePlayers", "awayPlayers"].forEach((key) => {
            ret[key] = [];
            for (var id in this[key]) {
                ret[key].push(this[key][id].encode());
            }
        });

        return ret;
    },

    encodeEvent: function(event) {
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
    },
    decodeEvent: function(league, object) {
        var data;
        var team = object.team === this.home.id ? this.home : this.away;
        if (object.data instanceof Object) {
            if (object.data.player) {
                data = league.players[object.data.player];
            }
        } else {
            data = object.data;
        }
        return new Event(object.type, new Time(object.time.value, object.time.end), team, data);
    }
};

// --- BoxScore ---

function BoxScore(game, league, maxTime)
{
    function values() { var ret = []; ret[Event.numEvents - 1] = 0; ret.fill(0, 0, Event.numEvents - 1); return ret; }

    this.game = game;
    this.players = {}; // playerId to array
    this.awayStats = values();
    this.homeStats = values();
    this.awayPlayers = [];
    this.homePlayers = [];

    var player, p;
    for (player in game.awayPlayers) {
        p = game.awayPlayers[player];
        this.players[player] = values();
        this.awayPlayers.push(p);
    }

    for (player in game.homePlayers) {
        p = game.homePlayers[player];
        this.players[player] = values();
        this.homePlayers.push(p);
    }

    var homeLineup = {};
    var awayLineup = {};
    var quarter = undefined;
    var expired = false;
    for (var i=0; i<game.events.length; ++i) {
        var ev = game.events[i];

        if (!expired && maxTime && ev.time.value > maxTime.value)
            expired = true;
        if (ev.type == Event.QUARTER_START) {
            quarter = ev.data;
            continue;
        } else if (ev.type == Event.QUARTER_END) {
            continue;
        }

        var home = ev.team === game.home;
        var lineup = home ? homeLineup : awayLineup;
        var otherLineup = home ? awayLineup : homeLineup;
        var pts = 0;
        var dump;
        switch (ev.type) {
        case Event.FGM2: pts = 2; break;
        case Event.FGM3: pts = 3; break;
        case Event.FTM: pts = 1; break;
        case Event.SUBBED_IN:
            assert(!(ev.data.id in lineup), `${ev.data.toString()}  already in lineup`);

            dump = [];
            for (let jj in lineup) {
                dump.push(league.players[jj].toString());
            }
            // console.log("got event", i, game.events.length, ev.toString(), JSON.stringify(dump));

            lineup[ev.data.id] = ev.time;
            if (quarter == 0)
                this.players[ev.data.id][Event.STARTED] = true;
            break;
        case Event.SUBBED_OUT:
            // console.log("got event", i, game.events.length, ev.toString());
            assert(ev.data.id in lineup, `${ev.data.toString()} not in lineup`);
            if (!lineup[ev.data.id]) {
                console.log("bad lineup not containing " + ev.data.toString());
                for (var jj in lineup) {
                    console.log(league.players[jj].toString());
                }
                console.log(Object.keys(lineup));
                break;
            }
            var start = lineup[ev.data.id].value;

            dump = [];
            for (let jj in lineup) {
                dump.push(league.players[jj].toString());
            }
            // console.log("got event", i, game.events.length, ev.toString(), JSON.stringify(dump));

            var end = ev.time.value;
            if (maxTime) {
                start = Math.min(start, maxTime.value);
                end = Math.min(end, maxTime.value);
            }
            var duration = end - start;
            this.players[ev.data.id][Event.MINUTES] += duration;
            teamStats[Event.MINUTES] += duration;

            delete lineup[ev.data.id];
            break;
        }

        if (!expired) {
            var teamStats = home ? this.homeStats : this.awayStats;
            ++teamStats[ev.type];
            teamStats[Event.PTS] += pts;
            teamStats[Event.PLUSMINUS] += pts;
            var otherTeamStats = home ? this.awayStats : this.homeStats;
            otherTeamStats[Event.PLUSMINUS] -= pts;
            if (ev.data instanceof Player) {
                ++this.players[ev.data.id][ev.type];
                this.players[ev.data.id][Event.PTS] += pts;
            }
            if (pts) {
                assert(Object.keys(lineup).length == 5, "lineup size wrong: " + Object.keys(lineup));
                assert(Object.keys(otherLineup).length == 5, "other lineup size wrong: " + Object.keys(otherLineup));
                var id;
                for (id in lineup)
                    this.players[id][Event.PLUSMINUS] += pts;
                for (id in otherLineup)
                    this.players[id][Event.PLUSMINUS] -= pts;
            }
        }
    }
};

BoxScore.prototype.visit = function(cb) {
    var that = this;
    function formatTeam(team, players, stats) {
        var sorted = players.sort(function(l, r) {
            var ll = that.players[l.id];
            var rr = that.players[r.id];
            if (ll[Event.STARTED] != rr[Event.STARTED])
                return ll[Event.STARTED] ? -1 : 1;
            return rr[Event.PTS] - ll[Event.PTS];
        });
        cb("team", team);
        cb("header", ["Player", "pts", "mins", "fgm", "fga", "fg%", "3pa", "3pm", "3p%", "fta", "ftm", "ft%", "orb", "drb", "trb", "ast", "stl", "blk", "to", "pf"]);

        function percentage(m, a) {
            return a ? m / a : 0;
        }

        function formatLine(name, stats, context) {
            var arr = [ name ];
            arr.push(stats[Event.PTS]);
            arr.push(stats[Event.MINUTES]);
            arr.push(stats[Event.FGM2] + stats[Event.FGM3]);
            arr.push(stats[Event.FGA2] + stats[Event.FGA3]);
            arr.push(percentage(stats[Event.FGM2] + stats[Event.FGM3], stats[Event.FGA2] + stats[Event.FGA3]));
            arr.push(stats[Event.FGM3]);
            arr.push(stats[Event.FGA3]);
            arr.push(percentage(stats[Event.FGM3], stats[Event.FGA3]));
            arr.push(stats[Event.FTM]);
            arr.push(stats[Event.FTA]);
            arr.push(percentage(stats[Event.FTM], stats[Event.FTA]));
            arr.push(stats[Event.ORB]);
            arr.push(stats[Event.DRB]);
            arr.push(stats[Event.ORB] + stats[Event.DRB]);
            arr.push(stats[Event.AST]);
            arr.push(stats[Event.STL]);
            arr.push(stats[Event.BLK]);
            arr.push(stats[Event.TO]);
            arr.push(stats[Event.PF]);
            cb(context, arr);
        }
        sorted.forEach(function(player) { formatLine(player.name, that.players[player.id], "player"); });
        formatLine("Total", stats, "total");
        cb("teamEnd");
    }
    formatTeam(this.game.away, this.awayPlayers, this.awayStats);
    formatTeam(this.game.home, this.homePlayers, this.homeStats);
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
        console.log("--------------------------------------------------------------------------------------------------------------------------------------------------");
        console.log("Player                       MIN   PTS   FGM   FGA   FG%   3PM   3PA   3P%   FTM   FTA   FT%   ORB   DRB   TRB   AST   STL   BLK   TOV    PF   +/-");
        console.log("--------------------------------------------------------------------------------------------------------------------------------------------------");

        var sorted = players.sort(function(l, r) {
            var ll = that.players[l.id];
            var rr = that.players[r.id];
            if (ll[Event.STARTED] != rr[Event.STARTED])
                return ll[Event.STARTED] ? -1 : 1;
            return rr[Event.PTS] - ll[Event.PTS];
        });
        function formatLine(name, stats) {
            var str = pad(name, 26);
            str += pad((new Time(stats[Event.MINUTES])).mmss(), 6);
            str += pad(stats[Event.PTS], 6);
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
            str += pad(stats[Event.PLUSMINUS], 6);

            console.log(str);
        }
        sorted.forEach(function(player) { formatLine(player.name, that.players[player.id]); });
        console.log("----------------------------------------------------------------------------------------------------------------------------------------------");
        formatLine("Total", stats);
        console.log("----------------------------------------------------------------------------------------------------------------------------------------------");
    }
    formatTeam(this.game.away, this.awayPlayers);
    console.log();
    formatTeam(this.game.home, this.homePlayers);
};

module.exports = {
    currentSeasonYear: currentSeasonYear,
    currentSeasonName: currentSeasonName,
    formatDate: formatDate,
    Time: Time,
    Player: Player,
    Team: Team,
    Division: Division,
    Conference: Conference,
    League: League,
    Event: Event,
    Game: Game,
    BoxScore: BoxScore
};
