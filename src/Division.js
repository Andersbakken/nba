/* global module */

var nextDivisionId = 3072;
function Division(name, teams)
{
    this.name = name;
    this.id = ++nextDivisionId;
    this.conference = undefined;
    this.teams = {};
    teams.forEach((team) => {
        team.division = this;
        this.teams[team.name] = team;
    });
}

module.exports = Division;
