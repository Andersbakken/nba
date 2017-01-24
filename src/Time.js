/*global module */

function Time(ms)
{
    this.ms = ms;
    this.end = false;
}
Time.prototype = {
    get value() { return this.ms; },
    get minutes() { return parseInt(this.ms / (60 * 1000)); },
    get seconds() { return Math.round(this.ms % (60 * 1000) / 1000); },
    get quarter() {
        var ret;
        var value = this.ms;
        // ### what happens if something occurs before the ball is inbounded?
        if (value >= Time.quarterLength * 4) {
            value -= Time.quarterLength * 4;
            ret = parseInt(value / Time.extraTimeLength) + 4;
        } else {
            ret = parseInt(value / Time.quarterLength);
        }
        if (this.end)
            --ret;
        return ret;
    },
    compare: function(other) {
        var ret = this.ms - other.ms;
        if (!ret && this.end != other.end) {
            ret = this.end ? -1 : 1;
        }
        return ret;
    },
    toString: function() {
        var str = "ms: ";
        str += this.ms;
        str += " ";
        if (this.minutes < 10)
            str += "0";
        str += this.minutes;
        str += ".";
        if (this.seconds < 10)
            str += "0";
        str += this.seconds;
        str += " q: " + this.quarter;
        return str;
    }
};
Time.quarterLength = 12 * 60 * 1000;
Time.extraTimeLength = 5 * 60 * 1000;
Time.quarterStart = function(idx) {
    if (idx > 4)
        return new Time((4 * Time.quarterLength) + ((idx - 4) * Time.extraTimeLength));
    return new Time(idx * Time.quarterLength);
};

Time.quarterEnd = function(idx) {
    var ret = Time.quarterStart(idx + 1);
    ret.end = true;
    return ret;
};

module.exports = Time;
