/* global $ */

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

function selectYear(year) {
    $('#year-button').text(year);
    $('#year-button').append('<span class="caret"></span>');
}

function init()
{
    // console.log("inited");
    get("/api/years", (error, response) => {
        if (error) {
            alert(error);
            return;
        }
        // var dropdown = $('#years-dropdown');
        response.sort((l, r) => { return r - l; }).forEach((year) => {
            var html = '<li><a href="#" onclick="selectYear(' + year +')">' + year + '</a></li>';
            $('#years-dropdown').append(html);
        });
    });
}
