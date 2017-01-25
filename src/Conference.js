/* global module */

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

module.exports = Conference;
