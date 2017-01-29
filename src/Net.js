/* global require, module */

const safe = require('safetydance');
const fs = require('fs');
const request = require('request');

function Net(options)
{
    this.options = options;
    if (!/\/$/.exec(options.cacheDir) || (!safe.fs.statSync(options.cacheDir).isDirectory() && !safe.fs.mkdirSync(options.cacheDir))) {
        throw new Error("Bad cacheDir " + options.cacheDir);
    }

    this.requests = {};
}

function Request(url, filename, cb) {
    this.url = url;
    this.callbacks = [cb];
    request(url, (error, response, body) => {
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

        if (response.statusCode == 200) {
            safe.fs.writeFileSync(filename, JSON.stringify(data));
        }
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
            data.source = "cache";
            cb(undefined, data);
            return;
        }
    }
    if (this.requests[req.url]) {
        this.requests[req.url].callbacks.push(cb);
        return;
    }

    this.requests[req.url] = new Request(req.url, fileName, cb);
};

module.exports = Net;
