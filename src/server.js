#!/usr/bin/env node

/*global require, __dirname */
const argv = require('yargs').usage("Usage: %0 --game [arg] --max-time [time]").argv;

const Parser = require('./Parser.js');
const League = require('./League.js');
const express = require('express');
const fs = require('fs');

var league = new League;
var parser = new Parser(league, argv.d || argv.dir || (__dirname + "/../nba-gamedata/data"));

var app = express();

app.get('/api/piallgames', (req, res) => {
    res.send(JSON.stringify(parser.games));
});

app.get('/api/years', (req, res) => {
    res.send(JSON.stringify(Object.keys(parser.games)));
});

app.get('/api/games', (req, res) => {
    console.log(req.query);
    // res.send(JSON.stringify(Object.keys(parser.games)));
});

app.get("/", (req, res) => {
    res.redirect("/index.html");
});

fs.readdirSync(__dirname + "/www/").forEach((file) => {
    app.get("/" + file, (req, res) => {
        res.contentType(file);
        fs.createReadStream(__dirname + "/www/" + file).pipe(res);
    });
});

app.listen(argv.port || argv.p || 8899, () => {
    console.log("Listening on port", (argv.port || argv.p || 8899));
});

// argv._.forEach((arg) => {
//     var game = parse(arg);
//     var box = new BoxScore(game, argv["max-time"] || argv.m);
//     // box.print();
//     // console.log(JSON.stringify(game.encode(league), null, 4));
// });
