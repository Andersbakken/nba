/* global module, require */

const Conference = require('./Conference.js');
const Division = require('./Division.js');
const Player = require('./Player.js');
const Team = require('./Team.js');

function League()
{
    this.conferences = {
        "Eastern": new Conference("Eastern", [
            new Division("Atlantic", [
                new Team("Boston Celtics", "BOS"),
                new Team("Brooklyn Nets", "BRK"),
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

module.exports = League;
