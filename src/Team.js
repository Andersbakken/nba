/*global module, require */
const Player = require('./Player.js');

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

module.exports = Team;
