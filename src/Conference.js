/* global module */

var nextConferenceId = 2048;
function Conference(name, divisions)
{
    this.name = name;
    this.id = ++nextConferenceId;
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

Conference.team = function(name) {
    var team;
    for (var divisionName in this.divisions) {
        team = this.divisions[divisionName].teams[name];
        if (team)
            break;
    }
    return team;
};

module.exports = Conference;
