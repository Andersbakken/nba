/*global module */

function Player(name, id)
{
    this.name = name;
    this.id = id;
    this.toString = function() { return this.name; }; // return `Player(${this.name}, ${this.id})`; };
}

Player.prototype.encode = function() {
    return { name: this.name, id: this.id };
};

Player.decode = function(data) {
    return new Player(data.name, data.link);
};

module.exports = Player;
