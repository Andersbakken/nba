/* global require, module */

// --- misc ---
function currentSeasonYear() { // returns 2017 in 2016-2017 season
    var date = new Date;
    return date.getMonth() >= 9 ? date.getFullYear() + 1 : date.getFullYear();
};

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
    this.name = name;
    this.id = id;
    this.toString = function() { return this.name; }; // return `Player(${this.name}, ${this.id})`; };
}

Player.prototype.encode = function() {
    return { name: this.name, id: this.id };
};

Player.decode = function(data) {
    return new Player(data.name, data.id);
};

// --- Team ---

function Team(name, abbrev, id)
{
    this.name = name;
    this.abbrev = abbrev;
    this.division = undefined;
    this.conference = undefined;
    this.id = id;
    var date = new Date();
    var year = date.getMonth() >= 9 ? (date.getYear() + 1) : date.getYear();
    this.link = `http://www.basketball-reference.com/teams/${abbrev}/${year}.html`;
    this.players = {};
}

// --- Division ---

function Division(name, teams)
{
    this.name = name;
    this.conference = undefined;
    this.teams = {};
    teams.forEach((team) => {
        team.division = this;
        this.teams[team.name] = team;
    });
}

Division.prototype.find = function(nameOrAbbrev) {
    var ret;
    if (/^[A-Z][A-Z][A-Z]$/.exec(nameOrAbbrev)) {
        for (var teamName in this.teams) {
            var t = this.teams[teamName];
            if (t.abbrev == nameOrAbbrev) {
                ret = t;
                break;
            }
        }
    } else {
        ret = this.teams[nameOrAbbrev];
    }
    return ret;
};

// --- Conference ---

function Conference(name, divisions)
{
    this.name = name;
    this.divisions = {};
    divisions.forEach((div) => {
        div.conference = this;
        for (var teamName in div.teams) {
            var team = div.teams[teamName];
            team.conference = this;
        }
        this.divisions[div.name] = div;
    });
}

Conference.prototype.find = function(nameOrAbbrev) {
    var ret;
    for (var div in this.divisions) {
        ret = this.divisions[div].find(nameOrAbbrev);
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
    var teamId = 0;
    this.conferences = {
        "Eastern": new Conference("Eastern", [
            new Division("Atlantic", [
                new Team("Boston Celtics", "BOS", ++teamId),
                new Team("Brooklyn Nets", "BKN", ++teamId),
                new Team("New York Knicks", "NYK", ++teamId),
                new Team("Philadelphia 76ers", "PHI", ++teamId),
                new Team("Toronto Raptors", "TOR", ++teamId)
            ]),
            new Division("Central", [
                new Team("Chicago Bulls", "CHI", ++teamId),
                new Team("Cleveland Cavaliers", "CLE", ++teamId),
                new Team("Detroit Pistons", "DET", ++teamId),
                new Team("Indiana Pacers", "IND", ++teamId),
                new Team("Milwaukee Bucks", "MIL", ++teamId)
            ]),
            new Division("Southeast", [
                new Team("Atlanta Hawks", "ATL", ++teamId),
                new Team("Charlotte Hornets", "CHA", ++teamId),
                new Team("Miami Heat", "MIA", ++teamId),
                new Team("Orlando Magic", "ORL", ++teamId),
                new Team("Washington Wizards", "WAS", ++teamId)
            ]),
        ]),
        "Western": new Conference("Western", [
            new Division("Northwest", [
                new Team("Denver Nuggets", "DEV", ++teamId),
                new Team("Minnesota Timberwolves", "MIN", ++teamId),
                new Team("Oklahoma City Thunder", "OKC", ++teamId),
                new Team("Portland Trail Blazers", "POR", ++teamId),
                new Team("Utah Jazz", "UTA", ++teamId)
            ]),
            new Division("Pacific", [
                new Team("Golden State Warriors", "GSW", ++teamId),
                new Team("Los Angeles Clippers", "LAC", ++teamId),
                new Team("Los Angeles Lakers", "LAL", ++teamId),
                new Team("Phoenix Suns", "PHO", ++teamId),
                new Team("Sacramento Kings", "SAC", ++teamId)
            ]),
            new Division("Southwest", [
                new Team("Dallas Mavericks", "DAL", ++teamId),
                new Team("Houston Rockets", "HOU", ++teamId),
                new Team("Memphis Grizzlies", "MEM", ++teamId),
                new Team("New Orleans Pelicans", "NOP", ++teamId),
                new Team("San Antonio Spurs", "SAS", ++teamId)
            ])
        ])
    };
}

League.prototype.encodeTeam = function(team) {
    var ret = {
        name: team.name,
        players: []
    };
    for (var playerId in team.players) {
        ret.players.push(team.players[playerId].encode());
    }
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

League.prototype.find = function(nameOrAbbrev) {
    return this.conferences.Eastern.find(nameOrAbbrev) || this.conferences.Western.find(nameOrAbbrev);
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
    var player = this.data instanceof Player ? this.data.name : "";
    var team = this.team.name;
    var time = this.time.mmss();
    return `Event(${time}: ${evName} ${player} ${team})`;
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

// --- Game ---

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
    var team = object.team === this.home.id ? this.home : this.away;
    if (object.data instanceof Object) {
        if (object.data.player) {
            data = team.players[object.data.player];
        }
    } else {
        data = object.data;
    }
    return new Event(object.type, new Time(object.time.value, object.time.end), team, data);
};

// --- BoxScore ---

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
    function processSubs(subs, teamStats) {
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
        var total = new Time(0);
        for (var id in ms) {
            total.add(ms[id]);
            that.players[id][Event.MINUTES] = (new Time(ms[id])).mmss();
        }
        // ### something about this is not working at all. No idea why.
        // console.log("shit", total.mmss(), teamStats, total.date.valueOf());
        teamStats[Event.MINUTES] = total.mmss();
    }
    processSubs(homeSubs, this.homeStats);
    processSubs(awaySubs, this.awayStats);
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

module.exports = {
    currentSeasonYear: currentSeasonYear,
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
