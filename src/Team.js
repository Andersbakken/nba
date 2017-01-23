/*global module */

var nextTeamId = 1;
function Team(name, abbrev)
{
    this.name = name;
    this.abbrev = abbrev;
    this.id = nextTeamId++;
    this.players = {};
}

module.exports = Team;
