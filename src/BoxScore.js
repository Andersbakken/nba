/*global module */
function BoxScore()
{
    this.homePlayers = {}; // playerId to array
    this.awayPlayers = {};
    this.homeScore = undefined;
    this.awayScore = undefined;

    this.addPlayer = function(home, player)
    {
        this.players[player.id] = [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ];
    };
    this.apply = function(stat) {
        ++this.players[stat.player.id][stat.type];
        switch (stat.type) {
        case Stat.FGM2: this.players[stat.player.id][Stat.PTS] += 2; break;
        case Stat.FGM3: this.players[stat.player.id][Stat.PTS] += 3; break;
        case Stat.FTM: ++this.players[stat.player.id][Stat.PTS]; break;
        }
    };
}

module.exports.BoxScore = BoxScore;
