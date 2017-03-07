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
            html += `<p><pre>${data.name}</pre></p>`;
            return;
        } else if (context == 'header') {
            html += '<table><tr>';
            data.forEach((h) => { html += `<th><pre>${h}</pre></th>`; });
            headers = data;
            html += '</tr>';
        } else if (context == "teamEnd") {
            html += "</table>";
        } else if (context == 'player' || context == 'total') {
            html += '<tr>';
            var idx = 0;
            data.forEach((d) => {
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
                ++idx;
                html += `<td><pre>${d}</pre></td>`;
            });
            html += '</tr>';
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
    setTimeout(function() { document.getElementById("timeSlider").focus(); }, 100);
    document.getElementById("boxscore").innerHTML = "Loading game...";
    quartersExposed = 4;
    currentGame = undefined;
    loadGame(gameId, function(error, result) {
        if (error) {
            document.getElementById("boxscore").innerHTML = "Error... " + error;
            alert(error);
            return;
        }
        console.log(result);
        currentGame = NBA.Game.decode(result, league);
        console.log("Got game length", currentGame.length.mmss(), currentGame.length.quarter, currentGame.length.value);
        document.getElementById("timeSlider").value = 0;
        document.getElementById("timeSliderLabel").innerText = "00:00";
        document.getElementById("timeSlider").style.display = 'block';
        document.getElementById("timeSliderLabel").style.display = 'block';
        renderBoxScore(new NBA.Time(0));
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
            html += '<a href="javascript:selectGame(' + i + ')">' + gamesList[i].away + '@' + gamesList[i].home + ' ' + new Date(gamesList[i].gameTime.toLocaleString()) + '</a><br><br/>';
        }
        document.getElementById("games").innerHTML = html;
        if (game)
            displayGame(game);
        // console.log(error, result);
    });
};

function handleUrl()
{
    console.log("got a url", window.location);
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
    case 37:
        if (currentGame) {
            changeSliderBy(-5);
        }
        break;
    case 39:
        if (currentGame) {
            changeSliderBy(5);
        }
        break;
    }
};

