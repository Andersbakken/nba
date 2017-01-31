/* global require */

var BoxScore = require('./BoxScore.js');
var Game = require('./Game.js');
var Player = require('./Player.js');

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
var currentDay, boxscore, games;
var gamesList;

window.selectGame = function(idx)
{
    get("/api/games/" + gamesList[idx].gameId, function(error, result) {
        if (error) {
            alert(error);
            return;
        }
        // gamesList = result;
        // // console.log(games.innerHtml);
        // var idx = 0;
        // var html = "";
        // for (var i=0; i<gamesList.length; ++i) {
        //     html += '<a href="#" onclick="selectGame(' + i + ')">' + gamesList[i].away + '@' + gamesList[i].home + ' ' + new Date(gamesList[i].gameTime.toLocaleString()) + '</a><br><br/>';
        // }
        // document.getElementById("games").innerHTML = html;
        // console.log(error, result);
        console.log("GOT GAME", result);
    });
    // console.log("selectGame(" + idx + ")");
}

window.selectDay = function(day)
{
    curDay = day;
    var fmt = formatDate(day);
    currentDay.innerText = fmt;
    get("/api/games/list/" + fmt, function(error, result) {
        if (error) {
            alert(error);
            return;
        }
        gamesList = result;
        // console.log(games.innerHtml);
        var idx = 0;
        var html = "";
        for (var i=0; i<gamesList.length; ++i) {
            html += '<a href="#" onclick="selectGame(' + i + ')">' + gamesList[i].away + '@' + gamesList[i].home + ' ' + new Date(gamesList[i].gameTime.toLocaleString()) + '</a><br><br/>';
        }
        document.getElementById("games").innerHTML = html;
        // console.log(error, result);
    });
}

window.nextDay = function()
{
    console.log("nextDay");
    selectDay(addDays(curDay, 1));
}

window.prevDay = function()
{
    console.log("prevDay");
    selectDay(addDays(curDay, -1));
}

function formatDate(date)
{
    return "" + date.getFullYear() + date.getMonth() + 1 + date.getDate();
}

function addDays(date, days)
{
    var dat = new Date(date.valueOf());
    dat.setDate(dat.getDate() + days);
    return dat;
}

window.onload = function() {
    currentDay = document.getElementById("currentDay");
    boxscore = document.getElementById("boxscore");
    games = document.getElementById("games");
    var today = new Date();
    selectDay(today);
    // console.log("inited");
    // get("/api/years", (error, response) => {
    //     if (error) {
    //         alert(error);
    //         return;
    //     }
    //     // var dropdown = $('#years-dropdown');
    //     response.sort((l, r) => { return r - l; }).forEach((year) => {
    //         var html = '<li><a href="#" onclick="selectYear(' + year +')">' + year + '</a></li>';
    //         $('#years-dropdown').append(html);
    //     });
    // });
}
