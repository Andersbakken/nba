/* global require, module */

var safe = require('safetydance');
var fs = require('fs');
var request = require('request');
var Log = require('./Log.js');
var log = Log.log;
var verbose = Log.verbose;

function Net(options)
{
    this.options = options;
    var good = false;
    if (/\/$/.exec(options.cacheDir)) {
        var stat = safe.fs.statSync(options.cacheDir);
        if ((!stat && safe.fs.mkdirSync(options.cacheDir)) || stat.isDirectory()) {
            good = true;
        }
    }
    if (!good) {
        throw new Error("Bad cacheDir " + options.cacheDir);
    }

    this.requests = {};
}

function Request(req, filename, cb) {
    this.req = req;
    this.callbacks = [cb];
    request(req.url, (error, response, body) => {
        if (error) {
            this.callbacks.forEach((callback) => {
                callback(error);
            });
            return;
        }

        // console.log(response);
        // console.log(body);
        var data = {
            headers: response.headers,
            body: body,
            statusCode: response.statusCode
        };

        if (response.statusCode == 200 && !req.nocache) {
            safe.fs.writeFileSync(filename, JSON.stringify(data));
        }
        data.url = req.url;
        data.source = "network";
        this.callbacks.forEach((callback) => {
            callback(undefined, data);
        });
    });
}

Net.prototype.get = function(req, cb) {
    if (!(req instanceof Object)) {
        req = { url: req };
    }
    var fileName = this.options.cacheDir + encodeURIComponent(req.url);
    var contents = safe.fs.readFileSync(fileName, 'utf8');
    if (contents) {
        var data = safe.JSON.parse(contents);
        if (!data) { // cache gone bad, repair
            safe.fs.unlinkSync(fileName);
        } else {
            data.url = req.url;
            data.source = "cache";
            cb(undefined, data);
            return;
        }
    }
    if (this.requests[req.url]) {
        this.requests[req.url].callbacks.push(cb);
        return;
    }

    this.requests[req.url] = new Request(req, fileName, cb);
};

Net.prototype.clearCache = function(url) {
    if (url instanceof Object)
        url = url.url;
    var fileName = this.options.cacheDir + encodeURIComponent(url);
    safe.fs.unlinkSync(fileName);
};

module.exports = Net;
