/*global module */

function Time(ms)
{
    this.time = new Date(ms);
    this.end = false;
}
Time.prototype = {
    get milliseconds() { return this.time.getMilliseconds(); },
    get value() { return this.time.valueOf(); },
    get minutes() { return this.time.getMinutes(); },
    get seconds() { return this.time.getSeconds(); },
    get quarter() {
        var ret;
        var value = this.value;
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
    add: function(ms) {
        this.time = new Date(this.value + ms);
        this.end = false;
    },
    compare: function(other) {
        var ret = this.value - other.value;
        if (!ret && this.end != other.end) {
            ret = this.end ? -1 : 1;
        }
        return ret;
    },

    mmss: function() {
        var str = "";
        if (this.minutes < 10)
            str += "0";
        str += this.minutes;
        str += ".";
        if (this.seconds < 10)
            str += "0";
        str += this.seconds;
        return str;
    },
    toString: function() {
        return "value: " + this.value + " " + this.mmss() + " q: " + this.quarter;
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
