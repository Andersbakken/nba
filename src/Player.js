/*global module */

var nextPlayerId = 1;
function Player(name)
{
    this.name = name;
    this.id = nextPlayerId++;
    this.toString = function() { return `Player(${this.name}, ${this.id})`; };
}

module.exports = Player;
