/* global require, module */

var NBA = {
    currentSeasonYear: function() { // returns 2017 in 2016-2017 season
        var date = new Date;
        return date.getMonth() >= 9 ? date.getFullYear() + 1 : date.getFullYear();
    }
};

module.exports = NBA;
