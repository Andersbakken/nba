/*global module */

function Team(name, link)
{
    this.name = name;
    this.link = link;
    this.players = {};
}

module.exports.Team = Team;
