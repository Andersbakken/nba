/* global require, module */

var safe = require('safetydance');
var fs = require('fs-extra');
var request = require('request');
var Log = require('./Log.js');
var log = Log.log;
var verbose = Log.verbose;

// console.log("settings", Log.settings);

function Net(options)
{
    this.options = options;
    var good = false;
    if (/\/$/.exec(options.cacheDir)) {
        var stat = safe.fs.statSync(options.cacheDir);
        if (stat && options.clear) {
            fs.removeSync(options.cacheDir);
            stat = false;
        }
        if ((!stat && safe.fs.mkdirSync(options.cacheDir)) || (stat && stat.isDirectory())) {
            good = true;
        }
    }
    if (!good) {
        throw new Error("Bad cacheDir " + options.cacheDir);
    }

    this.requests = {};
}

// curl 'http://data.nba.net/data/10s/prod/v2/20170501/scoreboard.json' -H 'Origin: http://www.nba.com' -H 'Accept-Encoding: gzip, deflate, sdch' -H 'Accept-Language: en-US,en;q=0.8,nb;q=0.6' -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36' -H 'Accept: */*' -H 'Connection: keep-alive' -H 'If-Modified-Since: Tue, 02 May 2017 02:06:00 GMT' --compressed

function Request(req, headers, filename, promise, net) {
    this.req = req;
    this.promises = [promise];

    var options = {
        url: req.url,
        headers: headers
    };

    verbose("Net: Actually requesting", JSON.stringify(options));

    request(options, (error, response, body) => {
        delete net.requests[req.url];
        verbose("Net: Got response", response.statusCode, req.url);
        if (error) {
            log("Got error: " + error.toString());
        }

        var data = {
            headers: response ? response.headers : {},
            body: body,
            statusCode: response ? response.statusCode : 500
        };

        if (response.statusCode == 200 && !req.nocache) {
            safe.fs.writeFileSync(filename, JSON.stringify(data));
        }
        data.url = req.url;
        data.source = "network";
        this.promises.forEach((resolve) => {
            resolve(data);
        });
    });
}

Net.prototype.get = function(req) {
    console.log("requesting", req);
    return new Promise((resolve) => {
        if (!(req instanceof Object)) {
            req = { url: req };
        }
        var fileName = this.options.cacheDir + encodeURIComponent(req.url);
        var headers = {};
        if (!req.nocache) {
            var contents = safe.fs.readFileSync(fileName, 'utf8');
            if (contents) {
                var data = safe.JSON.parse(contents);
                if (!data) { // cache gone bad, repair
                    safe.fs.unlinkSync(fileName);
                    verbose("Net: cache is bad", req.url, fileName);
                } else {
                    verbose("Net: Cache hit", req.url, fileName);
                    if (req.validate) {
                        headers["If-Modified-Since"] = data.headers["Last-Modified"] || data.headers["last-modified"];
                    } else {
                        data.url = req.url;
                        data.source = "cache";
                        resolve(data);
                        return;
                    }
                }
            }
        }
        if (this.requests[req.url]) {
            this.requests[req.url].promises.push(resolve);
            verbose("Tacked on to request");
        } else {
            if (req.spoof) {
                headers['Origin'] = 'http://www.nba.com';
                headers['User-Agent'] = 'Cool story browser';
            }
            console.log("getting shit", req.url);
            this.requests[req.url] = new Request(req, headers, fileName, resolve, this);
        }
    });
};

Net.prototype.clearCache = function(url) {
    if (url instanceof Object)
        url = url.url;
    var fileName = this.options.cacheDir + encodeURIComponent(url);
    safe.fs.unlinkSync(fileName);
};

module.exports = Net;
