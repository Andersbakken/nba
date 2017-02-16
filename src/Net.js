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

function Request(req, headers, filename, promise) {
    this.req = req;
    this.promises = [promise];

    var options = {
        url: req.url,
        headers: headers
    };

    verbose("Net: Actually requesting", JSON.stringify(options));

    request(options, (error, response, body) => {
        verbose("Net: Got response", response.statusCode, req.url);
        if (error) {
            throw new Error("Got error: " + error.toString());
            return;
        }

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
        this.promises.forEach((resolve) => {
            resolve(data);
        });
    });
}

Net.prototype.get = function(req) {
    return new Promise((resolve) => {
        if (!(req instanceof Object)) {
            req = { url: req };
        }
        var fileName = this.options.cacheDir + encodeURIComponent(req.url);
        var contents = safe.fs.readFileSync(fileName, 'utf8');
        var headers = {};
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
        if (this.requests[req.url]) {
            this.requests[req.url].promises.push(resolve);
        }

        this.requests[req.url] = new Request(req, headers, fileName, resolve);
    });
};

Net.prototype.clearCache = function(url) {
    if (url instanceof Object)
        url = url.url;
    var fileName = this.options.cacheDir + encodeURIComponent(url);
    safe.fs.unlinkSync(fileName);
};

module.exports = Net;
