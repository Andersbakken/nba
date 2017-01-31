/* global require, module */

// --- misc ---
function currentSeasonYear() { // returns 2017 in 2016-2017 season
    var date = new Date;
    return date.getMonth() >= 9 ? date.getFullYear() + 1 : date.getFullYear();
};

// --- Time ---

function Time(ms, end)
{
    this.time = new Date(ms);
    this.end = end || false;
}
Time.prototype = {
    get milliseconds() { return this.time.getMilliseconds(); },
    get value() { return this.time.valueOf(); },
    get minutes() { return this.time.getMinutes(); },
    get seconds() { return this.time.getSeconds(); },
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
        this.time = new Date(this.value + ms);
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
    return new Player(data.name, data.link);
};

// --- Team ---

var nextTeamId = 1024;
function Team(name, abbrev)
{
    this.name = name;
    this.abbrev = abbrev;
    this.division = undefined;
    this.id = ++nextTeamId;
    this.conference = undefined;
    var date = new Date();
    var year = date.getMonth() >= 9 ? date.getYear() + 1 : date.getYear();
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
    this.conferences = {
        "Eastern": new Conference("Eastern", [
            new Division("Atlantic", [
                new Team("Boston Celtics", "BOS"),
                new Team("Brooklyn Nets", "BKN"),
                new Team("New York Knicks", "NYK"),
                new Team("Philadelphia 76ers", "PHI"),
                new Team("Toronto Raptors", "TOR")
            ]),
            new Division("Central", [
                new Team("Chicago Bulls", "CHI"),
                new Team("Cleveland Cavaliers", "CLE"),
                new Team("Detroit Pistons", "DET"),
                new Team("Indiana Pacers", "IND"),
                new Team("Milwaukee Bucks", "MIL")
            ]),
            new Division("Southeast", [
                new Team("Atlanta Hawks", "ATL"),
                new Team("Charlotte Hornets", "CHA"),
                new Team("Miami Heat", "MIA"),
                new Team("Orlando Magic", "ORL"),
                new Team("Washington Wizards", "WAS")
            ]),
        ]),
        "Western": new Conference("Western", [
            new Division("Northwest", [
                new Team("Denver Nuggets", "DEV"),
                new Team("Minnesota Timberwolves", "MIN"),
                new Team("Oklahoma City Thunder", "OKC"),
                new Team("Portland Trail Blazers", "POR"),
                new Team("Utah Jazz", "UTA")
            ]),
            new Division("Pacific", [
                new Team("Golden State Warriors", "GSW"),
                new Team("Los Angeles Clippers", "LAC"),
                new Team("Los Angeles Lakers", "LAL"),
                new Team("Phoenix Suns", "PHO"),
                new Team("Sacramento Kings", "SAC")
            ]),
            new Division("Southwest", [
                new Team("Dallas Mavericks", "DAL"),
                new Team("Houston Rockets", "HOU"),
                new Team("Memphis Grizzlies", "MEM"),
                new Team("New Orleans Pelicans", "NOP"),
                new Team("San Antonio Spurs", "SAS")
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

// --- GameEvent ---

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

// --- BoxScore ---

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

module.exports = {
    currentSeasonYear: currentSeasonYear,
    Time: Time,
    Player: Player,
    Team: Team,
    Division: Division,
    Conference: Conference,
    League: League,
    GameEvent: GameEvent,
    Game: Game,
    BoxScore: BoxScore
};
