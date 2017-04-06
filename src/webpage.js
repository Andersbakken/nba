/* global require, setTimeout */

var NBA = require('./NBA.js');

var SliderMax = 1000;

function get(url, cb)
{
    var req = new XMLHttpRequest();
    // req.addEventListener("load", cb);
    req.onreadystatechange = function() {
        if (req.readyState == XMLHttpRequest.DONE) {
            if (req.status != 200) {
                cb("Network error");
            } else {
                var parsed;
                try {
                    parsed = JSON.parse(req.responseText);
                } catch(err) {
                    cb("JSON Parse error: " + err.toString());
                    return;
                }
                cb(undefined, parsed);
            }
        }
    };

    req.open("GET", url);
    req.send();
}

var curDay;
var gamesList;
var league = new NBA.League;
var currentGame;
var quartersExposed = 4;

window.selectGame = function(idx)
{
    window.location.hash = "#day=" + NBA.formatDate(new Date(gamesList[idx].gameTime)) + "#game=" + gamesList[idx].gameId;
};

function renderBoxScore(time)
{
    var box = new NBA.BoxScore(currentGame, league, time);
    // document.getElementById('boxscore').innerHTML = '<pre>' + box.print() + '</pre>';
    // gamesList = result;
    // // console.log(games.innerHtml);
    // var idx = 0;
    // var html = "";
    // for (var i=0; i<gamesList.length; ++i) {
    //     html += '<a href="#" onclick="selectGame(' + i + ')">' + gamesList[i].away + '@' + gamesList[i].home + ' ' + new Date(gamesList[i].gameTime.toLocaleString()) + '</a><br><br/>';
    // }
    // document.getElementById("games").innerHTML = html;
    // console.log(error, result);
    var html = "";
    var headers;
    box.visit(function(context, data) {
        if (context == 'team') {
            html += `<p><a href="${data.link}">${data.name}</a></p>`;
            return;
        } else if (context == 'header') {
            html += '<table class="table"><thead><tr>';
            data.forEach((h) => { html += `<th>${h}</th>`; });
            headers = data;
            html += '</tr></thead><tbody>';
        } else if (context == "teamEnd") {
            html += "</tbody></table>";
        } else if (context == 'player' || context == 'total') {
            if (context == 'total') {
                html += '<tfoot>';
            }
            html += '<tr>';
            var idx = 0;
            data.forEach((d) => {
                if (idx == 0 && context == 'player') {
                    d = '<a href="' + d.link + '">' + d.name + '</a>';
                } else {
                    if (/%$/.exec(headers[idx])) {
                        if (!d) {
                            d = "";
                        } else if (d == 1) {
                            d = "1.000";
                        } else {
                            d = "." + d.toFixed(3).substr(1).substr(1);
                        }
                    } else if (headers[idx] == 'mins') {
                        d = (new NBA.Time(d)).mmss();
                    }
                }
                ++idx;
                html += `<td>${d}</td>`;
            });
            html += '</tr>';
            if (context == 'total') {
                html += '</tfoot>';
            }
        }
    });
    document.getElementById("boxscore").innerHTML = html;
}

function loadGame(gameId, cb)
{
    var fmt = NBA.formatDate(curDay);
    get(`/api/games/${fmt}/${gameId}`, cb);
}

function displayGame(gameId)
{
    document.getElementById("boxscore").innerHTML = "Loading game...";
    quartersExposed = 4;
    currentGame = undefined;
    loadGame(gameId, function(error, result) {
        if (error) {
            document.getElementById("boxscore").innerHTML = "Error... " + error;
            alert(error);
            return;
        }
        // console.log(result);
        currentGame = NBA.Game.decode(result, league);
        //console.log("Got game length", currentGame.length.mmss(), currentGame.length.quarter, currentGame.length.value);
        document.getElementById("timeSlider").value = 0;
        document.getElementById("timeSliderLabel").innerText = "00:00";
        document.getElementById("timeSlider").style.display = 'block';
        document.getElementById("timeSliderLabel").style.display = 'block';
        renderBoxScore(new NBA.Time(0));
        window.displayTime("0");
    });
}

function gameTimeForValue(value)
{
    value = parseInt(value);
    var max = NBA.Time.quarterEnd(quartersExposed - 1);
    if (value === SliderMax) {
        return max; // keep time.end == true
    }
    var length = parseInt(max.value * (value / SliderMax));
    return new NBA.Time(length);
}

function sliderValueForGameTime(time)
{
    var ms = time.value;
    var maxMs = NBA.Time.quarterEnd(quartersExposed - 1).value;
    return (ms / maxMs) * 1000;
}

window.changeTime = function(value) {
    var time = gameTimeForValue(value);
    if (value == 1000 && quartersExposed <= currentGame.length.quarter) {
        ++quartersExposed;
        document.getElementById("timeSlider").value = sliderValueForGameTime(time);
        window.displayTime(value);
    }
    if (!currentGame.gameFinished && currentGame.length && time.value >= currentGame.length.value) {
        loadGame(currentGame.id, function(error, result) {
            console.log("reloading game");
            currentGame = NBA.Game.decode(result, league);
            if (time.value > currentGame.length.value) {
                time = currentGame.length;
                var sliderVal = sliderValueForGameTime(time);
                document.getElementById("timeSlider").value = sliderVal;
                window.displayTime(sliderVal);
            }
            renderBoxScore(time);
        });
    } else {
        renderBoxScore(time);
    }
    // // document.getElementById("timeSliderLabel").innerText = gameTimeForValue(value).mmss();
    // console.log("got value", value);
};

window.displayTime = function(value) {
    var t = gameTimeForValue(value);
    document.getElementById("timeSliderLabel").innerText = t.pretty() + " " + t.mmss();
    // console.log("got display value", value);
};

window.selectDay = function(day, game)
{
    document.getElementById("timeSlider").style.display = 'none';
    document.getElementById("timeSliderLabel").style.display = 'none';

    curDay = day;
    // console.log("selectDay", day);
    document.getElementById("boxscore").innerHTML = "";
    currentGame = undefined;
    // window.location.hash = 'day=' + fmt;
    var fmt = NBA.formatDate(curDay);
    console.log(curDay, fmt);
    document.getElementById("currentDay").innerText = fmt;
    get("/api/games/" + fmt, function(error, result) {
        if (error) {
            alert(error);
            return;
        }
        gamesList = result;
        // console.log(games.innerHtml);
        var idx = 0;
        var html = "";
        for (var i=0; i<gamesList.length; ++i) {
            var key = i;
            if (key >= 10)
                key = String.fromCharCode((i - 10) + 'a'.charCodeAt(0));
            html += '<a href="javascript:selectGame(' + i + ')">' + key + ": " + gamesList[i].away + '@' + gamesList[i].home + ' ' + new Date(gamesList[i].gameTime.toLocaleString()) + '</a><br><br/>';
        }
        document.getElementById("games").innerHTML = html;
        if (game)
            displayGame(game);
        // console.log(error, result);
    });
};

function handleUrl()
{
    // console.log("got a url", window.location);
    var day, game;
    window.location.hash.split('#').filter(function(e) { return e.length != 0; }).forEach(function(item) {
        var split = item.split('=');
        if (split.length == 2) {
            switch (split[0]) {
            case 'day':
                day = split[1];
                break;
            case 'game':
                game = split[1];
                break;
            default:
                console.error("unhandled hash", item);
                break;
            }
        }
    });
    if (!day) {
        window.location.hash = "#day=" + NBA.formatDate(new Date());
        return;
    }
    var match = /(^[0-9][0-9][0-9][0-9])([0-9][0-9])([0-9][0-9])$/.exec(day);
    if (!day) {
        console.error("Invalid date", day);
        window.location.hash = "#day=" + NBA.formatDate(new Date());
        return;
    }
    // console.log("shitbitch", match, day);
    var date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    if (!curDay || date.valueOf() != curDay.valueOf()) {
        window.selectDay(date, game);
        return;
    }

    if (game) {
        displayGame(game);
    }
}

window.onhashchange = handleUrl;
window.nextDay = function()
{
    var date = addDays(curDay, 1);
    window.location.hash = "#day=" + NBA.formatDate(date);
};

window.prevDay = function()
{
    window.location.hash = "#day=" + NBA.formatDate(addDays(curDay, -1));
};

function addDays(date, days)
{
    var dat = new Date(date.valueOf());
    dat.setDate(dat.getDate() + days);
    return dat;
}

window.onload = function() {
    handleUrl();
};

document.onkeydown = function(e) {
    function changeSliderBy(amount) {
        var val = parseInt(document.getElementById("timeSlider").value);
        val += amount;
        if (val < 0)
            val = 0;
        if (val > SliderMax)
            val = SliderMax;
        var value = "" + val;
        document.getElementById("timeSlider").value = value;
        window.displayTime(value);
        window.changeTime(value);
    }
    switch (e.keyCode) {
    case 37: // left
        if (currentGame) {
            changeSliderBy(e.ctrlKey ? -50 : -3);
        }
        return;
    case 39: // right
        if (currentGame) {
            changeSliderBy(e.ctrlKey ? 50 : 3);
        }
        return;
    }

    switch (String.fromCharCode(e.keyCode).toLowerCase()) {
    case 'n': window.nextDay(); break;
    case 'p': window.prevDay(); break;
    case '0': window.selectGame(0); break;
    case '1': window.selectGame(1); break;
    case '2': window.selectGame(2); break;
    case '3': window.selectGame(3); break;
    case '4': window.selectGame(4); break;
    case '5': window.selectGame(5); break;
    case '6': window.selectGame(6); break;
    case '7': window.selectGame(7); break;
    case '8': window.selectGame(8); break;
    case '9': window.selectGame(9); break;
    case 'a': window.selectGame(10); break;
    case 'b': window.selectGame(11); break;
    case 'c': window.selectGame(12); break;
    case 'd': window.selectGame(13); break;
    case 'e': window.selectGame(14); break;
    case 'f': window.selectGame(15); break;
    case 'g': window.selectGame(16); break;
    case 'h': window.selectGame(17); break;
    case 'i': window.selectGame(18); break;
    case 'j': window.selectGame(19); break;
    case 'k': window.selectGame(20); break;
    }
};

