/*global module */

var nextPlayerId = 1;
function Player(name, link, id)
{
    this.name = name;
    this.id = id || nextPlayerId++;
    this.link = link;
    this.toString = function() { return this.name; }; // return `Player(${this.name}, ${this.id})`; };
}

Player.prototype.encode = function() {
    return { name: this.name, id: this.id, link: this.link };
};

Player.decode = function(data) {
    return new Player(data.name, data.link, data.id);
};

module.exports = Player;
