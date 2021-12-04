const teams = {
    West: ["DAL", "DEN", "GSW", "HOU", "LAC", "LAL", "MEM", "MIN", "NOP", "OKC", "PHX", "POR", "SAC", "SAS", "UTA"],
    East: ["ATL", "BKN", "BOS", "CHA", "CHI", "CLE", "DET", "IND", "MIA", "MIL", "NYK", "ORL", "PHI", "TOR", "WAS"]
};

const contestants = {
    Anders: {
        West: ["DEN", "UTA", "GSW", "LAL", "PHX", "DAL", "POR", "LAC", "MEM", "NOP", "SAC", "OKC", "MIN", "SAS", "HOU"],
        East: ["BKN", "MIL", "PHI", "ATL", "MIA", "NYK", "BOS", "CHI", "CHA", "IND", "DET", "WAS", "ORL", "TOR", "CLE"]
    },
    Magnus: {
        West: ["LAL", "UTA", "GSW", "DEN", "PHX", "POR", "LAC", "DAL", "MEM", "NOP", "MIN", "SAS", "SAC", "OKC", "HOU"],
        East: ["BKN", "MIL", "PHI", "BOS", "ATL", "NYK", "MIA", "IND", "CHI", "WAS", "TOR", "DET", "CHA", "CLE", "ORL"]
    },
    Kim: {
        West: ["UTA", "PHX", "LAL", "DAL", "DEN", "GSW", "LAC", "NOP", "MEM", "MIN", "POR", "SAC", "SAS", "HOU", "OKC"],
        East: ["MIL", "BOS", "BKN", "MIA", "ATL", "NYK", "PHI", "CHA", "CHI", "IND", "TOR", "WAS", "CLE", "DET", "ORL"]
    },
    Henrik: {
        West: ["PHX", "UTA", "DAL", "LAL", "DEN", "GSW", "MEM", "POR", "LAC", "NOP", "SAS", "MIN", "SAC", "OKC", "HOU"],
        East: ["MIL", "BOS", "PHI", "BKN", "NYK", "MIA", "ATL", "CHI", "IND", "TOR", "CHA", "WAS", "CLE", "DET", "ORL"]
    }
};

function processResponse(conf, response, table, final) {
    let tr;
    let td;

    function addCell(text) {
        td = tr.insertCell();
        td.appendChild(document.createTextNode(text));
        td.style.border = "1px solid black";
    }
    console.log(response);
    const body = document.body;
    let tbl = document.createElement("table");
    tbl.style.width = "100%";
    tbl.style.border = "1px solid black";

    tr = tbl.insertRow();
    addCell(`${conf} Team`);
    addCell("W");
    addCell("L");
    addCell("Pct");

    let numContestants = 0;
    let confPoints = {};
    for (let key in contestants) {
        confPoints[key] = 0;
        addCell(key);
        if (contestants[key].points === undefined) {
            contestants[key].points = 0;
        }
        ++numContestants;
    }
    addCell("Average");
    response.forEach((team, idx) => {
        tr = tbl.insertRow();
        addCell(`${idx + 1}/${response.length} ${team.teamSitesOnly.teamName} ${team.teamSitesOnly.teamNickname}`);
        addCell(team.win);
        addCell(team.loss);
        addCell(team.winPct);
        const code = team.teamSitesOnly.teamTricode;
        let total = 0;
        for (let key in contestants) {
            const guessIdx = contestants[key][conf].indexOf(code);
            const points = Math.abs(guessIdx - idx);
            contestants[key].points += points;
            confPoints[key] += points;
            let str = guessIdx + 1 + " (";
            if (guessIdx < idx) {
                str += "-";
            } else if (guessIdx > idx) {
                str += "+";
            }
            str += points + ")";
            addCell(str);
            total += points;
        }
        addCell(total / numContestants);
    });
    tr = tbl.insertRow();
    addCell("Total");
    addCell("");
    addCell("");
    addCell("");
    for (let key in confPoints) {
        addCell(confPoints[key]);
    }

    body.appendChild(tbl);
    body.appendChild(document.createElement("p"));

    if (final) {
        const tbl = document.createElement("table");
        tbl.style.width = "100%";
        tbl.style.border = "1px solid black";
        tr = tbl.insertRow();
        addCell("Name");
        addCell("Points");
        Object.keys(contestants)
            .sort((a, b) => {
                return contestants[a].points - contestants[b].points;
            })
            .forEach((name) => {
                tr = tbl.insertRow();
                addCell(name);
                addCell(contestants[name].points);
            });
        body.appendChild(tbl);
    }
}

function init() {
    const eastTable = document.getElementById("east");
    const westTable = document.getElementById("west");
    fetch("https://data.nba.net/10s/prod/v1/current/standings_conference.json")
        .then((response) => {
            return response.json();
        })
        .then((response) => {
            processResponse("East", response.league.standard.conference.east, eastTable);
            processResponse("West", response.league.standard.conference.west, westTable, true);
        });
    // console.log(table);
}
window.onload = init;
