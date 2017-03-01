/* global require, module, fs, process */

var safe = require('safetydance');
var fs = require('fs');
var CircularJSON = require('circular-json');
var verbosity, logFile;
function init(options)
{
    verbosity = (options.verbose || 0) + (options.v || 0);
    logFile = options["log-file"];
    if (logFile)
        safe.fs.unlinkSync(logFile);
}

function appendToLog(arguments)
{
    if (logFile) {
        var ret = "";
        for (var i=0; i<arguments.length; ++i) {
            if (ret)
                ret += ' ';

            if (arguments[i] instanceof Object) {
                ret += CircularJSON.stringify(arguments[i]);
            } else {
                ret += arguments[i];
            }
        }
        ret += '\n';
        fs.appendFileSync(logFile, ret);
    }
}
function log()
{
    if (verbosity >= 0) {
        console.log.apply(console, arguments);
    }
    appendToLog(arguments);
}

function verbose()
{
    if (verbosity >= 1)
        console.log.apply(console, arguments);
    appendToLog(arguments);
}

function fatal()
{
    console.log.apply(console, arguments);
    appendToLog(arguments);
    process.exit(1);
}

module.exports = {
    init: init,
    log: log,
    verbose: verbose,
    fatal: fatal,
    settings: {
        verbosity: verbosity,
        logFile: logFile
    }
};
