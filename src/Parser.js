/*global require, module */

const fs = require('fs');
const Player = require('./Player.js');
const Team = require('./Team.js');
const Time = require('./Time.js');
const BoxScore = require('./BoxScore.js');
const Event = require('./Event.js');
const Game = require('./Game.js');
const League = require('./League.js');
const zlib = require('zlib');

function Parser(league, dir) {
    this.league = league;
    this.gamesById = {};
    this.games = {};
    if (!/\/$/.exec(dir))
        dir += "/";
    fs.readdirSync(dir).forEach((file) => {
        var match = /^([0-9][0-9][0-9][0-9])_([0-9][0-9])_([0-9][0-9])_([A-Z][A-Z][A-Z])_([A-Z][A-Z][A-Z]).html.gz$/.exec(file);
        if (match) {
            // this.games(`${match[
            var year = match[1];
            var month = match[2];
            var day = match[3];
            var id = file.substr(0, 18);
            var gameData = {
                date: `${year}/${month}/${day}`,
                home: match[5],
                away: match[4],
                id: id
            };
            if (!this.games[year])
                this.games[year] = {};
            if (!this.games[year][month])
                this.games[year][month] = {};
            if (!this.games[year][month][day])
                this.games[year][month][day] = [];

            this.games[year][month][day].push(gameData);
            this.gamesById[id] = gameData;
        }
    });
    // console.log(JSON.stringify(this.games, null, 4));
};

Parser.prototype.parse = function(id, cb) {
    var html;
    var file = this.games[id];
    if (!file) {
        cb("Invalid id " + id);
        return;
    }

    if (/\.gz$/.exec(file)) {
        fs.readFileSync(file, function(error, gz) {
            if (error) {
                cb(error);
                return;
            }
            zlib.gunzip(gz, function(error, buffer) {
                if (error) {
                    cb(error);
                    return;
                }
                parse(buffer.toString());
            });
        });
    } else {
        html = fs.readFile(file, "utf-8", function(error, html) {
            if (error) {
                cb(error);
                return;
            }
            parse(html);
        });
    }

    var that = this;
    function parse(html) {
        var title = html.indexOf("<title>");
        var titleEnd = html.indexOf(" Play-By-Play", title + 7);
        if (title == -1 || titleEnd == -1) {
            cb("Bad HTML!");
            return;
        }
        var teams = /^(.*) at (.*)$/.exec(html.substring(title + 7, titleEnd));

        var home = this.league.find(teams[2]);
        var away = this.league.find(teams[1]);
        if (!home) {
            cb("Can't find home team from " + teams[2]);
            return;
        }
        if (!away) {
            cb("Can't find away team from " + teams[2]);
            return;
        }

        var plain = html.replace(/<[^>]*>/g, '');
        var lines = plain.split('\n');
        // console.log(lines);
        // return;
        // console.log(lines);

        var game = new Game(home, away);
        var quarter = undefined;
        var homePlayers = {};
        var awayPlayers = {};
        for (var i=0; i<lines.length; ++i) {
            var line = lines[i];
            var match = /^([0-9][0-9]?):([0-9][0-9])\.0$/.exec(line);
            if (!match)
                continue;
            var lineData = lines[++i];
            // console.log(line, match[1], match[2], lineData);
            // console.log("Got line", match[1], match[2], lineData);
            var m = /Start of ([0-9])[a-z][a-z] quarter/.exec(lineData);
            if (m) {
                quarter = parseInt(m[1]) - 1;
                // console.log(`Got quarter ${quarter}`);
                game.events.push(new Event(Event.QUARTER_START, Time.quarterStart(quarter), undefined, quarter));
                continue;
            }
            m = /End of [0-9]/.exec(lineData);
            if (m) {
                game.events.push(new Event(Event.QUARTER_END, Time.quarterEnd(quarter), undefined, quarter));
                continue;
            }
            var ot = /Start of ([0-9])[a-z][a-z] overtime/.exec(lineData);
            if (ot) {
                var overtime = ot[1];
                quarter = 3 + parseInt(overtime); // 0-indexed
                game.events.push(new Event(Event.QUARTER_START, Time.quarterStart(quarter), undefined, quarter));
                continue;
            }
            var time = Time.quarterEnd(quarter);
            time.add(-(parseInt(match[1]) * 60 * 1000));
            time.add(-(parseInt(match[2]) * 1000));
            var homeEvent = true;
            if (lineData.indexOf('&nbsp;') == -1) {
                // console.log("lost a line", lineData);
                // jump ball, ignore so far
                continue;
            }

            var old = lineData;
            // console.log(lineData.charCodeAt(0), lineData);
            if (lineData.charCodeAt(0) == 38) { // &
                lineData = lineData.substr(lineData.lastIndexOf('&nbsp;') + 6);
                var score = /([0-9]+-[0-9]+\+[0-9]+)(.*)/.exec(lineData);
                if (score) {
                    // console.log(lineData, "->", score[2]);
                    lineData = score[2];
                }
            } else {
                lineData = lineData.substr(0, lineData.indexOf('&nbsp;'));
                homeEvent = false;
                // console.log(lineData);
            }
            // console.log(time.mmss(), lineData, old);
            // continue;

            function addPlayer(player, homePlayer) {
                if (homePlayer == undefined) {
                    homePlayer = homeEvent;
                } else {
                    // console.log("YO YO YO", player, homePlayer);
                }
                var team = homePlayer ? home : away;
                if (player == 'TEAM' || player == 'Team')
                    return team;
                var map = homePlayer ? homePlayers : awayPlayers;
                // var lineup = homePlayer ? homeLineup : awayLineup;
                // console.log(`ADDING ${player} ${homePlayer} ${JSON.stringify(lineup)} ${lineup === homeLineup}`);
                if (!map[player]) {
                    var linkEnd = html.indexOf(">" + player + "</a>");
                    var linkStart = html.lastIndexOf("<a href=\"", linkEnd);
                    if (linkEnd == -1 || linkStart == -1)
                        throw new Error("Couldn't find " + player + " link");
                    var link = html.substring(linkStart + 9, linkEnd - 2);
                    var p = new Player(player, link);
                    // console.log("ADDED PLAYER", player);
                    map[player] = p;
                    team.players[p.id] = p;
                }
                var ret = map[player];
                // if (!lineup[player]) {
                //     var subbedInTime = new Time((quarter - 1) * 12, 0);
                //     game.events.push(new Event(Event.SUBBED_IN, subbedInTime, homePlayer ? home : away, ret));
                // }
                // lineup[player] = ++lineUpIdx;
                return ret;
            }
            // if (Object.keys(homeEvent ? homeLineup : awayLineup).length > 5) {
            //     console.log("TOOOOOOOOOOO MANY");
            // }
            // console.log(Object.keys(homeEvent ? homeLineup : awayLineup).length,
            //             JSON.stringify(Object.keys(homeEvent ? homeLineup : awayLineup)), lastLineData);
            // console.log(lineData);
            m = /Turnover by (.*) \(([^)]*)\)/.exec(lineData);
            if (m) {
                // console.log(`GOT A TURNOVER ${m[1]} ${m[2]}`);
                var player = addPlayer(m[1]);
                game.events.push(new Event(Event.TO, time, homeEvent ? home : away, player));
                var m2 = /steal by (.*)/.exec(m[2]);
                if (m2) {
                    game.events.push(new Event(Event.STL, time, homeEvent ? away : home, addPlayer(m2[1], !homeEvent)));
                }
                continue;
            }

            if (lineData.indexOf('full timeout') !== -1) {
                game.events.push(new Event(Event.TIMEOUT, time, homeEvent ? home : away));
                continue;
            }

            m = /Defensive rebound by (.*)/.exec(lineData);
            if (m) {
                game.events.push(new Event(Event.DRB, time, homeEvent ? home : away, addPlayer(m[1])));
                continue;
            }

            m = /Offensive rebound by (.*)/.exec(lineData);
            if (m) {
                game.events.push(new Event(Event.ORB, time, homeEvent ? home : away, addPlayer(m[1])));
                continue;
            }

            if (lineData.indexOf('Def 3 sec tech foul by') !== -1) {
                game.events.push(new Event(Event.TF, time, homeEvent ? home : away));
                continue;
            }

            m = / foul by (.*) \(drawn by [^)]*\)/.exec(lineData);
            if (m) {
                game.events.push(new Event(Event.PF, time, homeEvent ? away : home, addPlayer(m[1], !homeEvent)));
                continue;
            }

            m = /Personal foul by ([^\t]*)/.exec(lineData);
            if (m) {
                game.events.push(new Event(Event.PF, time, homeEvent ? home : away, addPlayer(m[1])));
                continue;
            }

            m = / foul by (.*)/.exec(lineData);
            if (m) {
                game.events.push(new Event(Event.PF, time, homeEvent ? home : away, addPlayer(m[1])));
                continue;
            }

            m = /[Ff]lagrant foul type ([12]) by (.*)/.exec(lineData);
            if (m) {
                game.events.push(new Event(m[1] == '1' ? Event.FF1 : Event.FF2, time, homeEvent ? home : away, addPlayer(m[2])));
                continue;
            }

            m = /(.*) enters the game for (.*)/.exec(lineData);
            if (m) {
                // var lineup = homeEvent ? homeLineup : awayLineup;
                game.events.push(new Event(Event.SUBBED_OUT, time, homeEvent ? home : away, addPlayer(m[2])));
                game.events.push(new Event(Event.SUBBED_IN, time, homeEvent ? home : away, addPlayer(m[1])));
                // delete lineup[m[2]];
                continue;
            }

            m = /(.*) makes ([23])-pt shot /.exec(lineData);
            if (m) {
                game.events.push(new Event(m[2] == '2' ? Event.FGA2 : Event.FGA3, time, homeEvent ? home : away, addPlayer(m[1])));
                game.events.push(new Event(m[2] == '2' ? Event.FGM2 : Event.FGM3, time, homeEvent ? home : away, addPlayer(m[1])));
                continue;
            }

            m = /(.*) misses ([23])-pt shot .* \(block by (.*)\)/.exec(lineData);
            if (m) {
                game.events.push(new Event(Event.BLK, time, homeEvent ? away : home, addPlayer(m[3], !homeEvent)));
                game.events.push(new Event(m[2] == '2' ? Event.FGA2 : Event.FGA3, time, homeEvent ? home : away, addPlayer(m[1])));
                continue;
            }

            m = /(.*) misses ([23])-pt shot/.exec(lineData);
            if (m) {
                game.events.push(new Event(m[2] == '2' ? Event.FGA2 : Event.FGA3, time, homeEvent ? home : away, addPlayer(m[1])));
                continue;
            }

            m = /(.*) misses.*free throw/.exec(lineData);
            if (m) {
                game.events.push(new Event(Event.FTA, time, homeEvent ? home : away, addPlayer(m[1])));
                continue;
            }

            m = /(.*) makes.*free throw/.exec(lineData);
            if (m) {
                game.events.push(new Event(Event.FTA, time, homeEvent ? home : away, addPlayer(m[1])));
                game.events.push(new Event(Event.FTM, time, homeEvent ? home : away, addPlayer(m[1])));
                continue;
            }

            // console.log(`Unhandled event ${time.minute} ${time.second} ${lineData}`);
        }
        cb(undefined, game);
    }
};

module.exports = Parser;
