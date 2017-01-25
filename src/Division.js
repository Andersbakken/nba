/* global module */

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

module.exports = Division;
