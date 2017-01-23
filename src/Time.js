/*global module */

function Time(minute, second)
{
    this.minute = minute;
    this.second = second;
    this.value = (minute * 60 * 1000) + second * 1000;
    this.quarter = function() {
        var value = this.value;
        // ### what happens if something occurs before the ball is inbounded?
        if (value > this.quarterLength * 4) {
            value -= this.quarterLength * 4;
            return parseInt(value % Time.extraTimeLength) + 4;
        }
        return parseInt(value % Time.quarterLength);
    };
}
Time.quarterLength = 12 * 60 * 1000;
Time.extraTimeLength = 5 * 60 * 1000;

module.exports.Time = Time;
