const teams = {
    West: ["DAL", "DEN", "GSW", "HOU", "LAC", "LAL", "MEM", "MIN", "NOP", "OKL", "PHO", "POR", "SAC", "SAS", "UTA"],
    East: ["ATL", "BKN", "BOS", "CHA", "CHI", "CLE", "DET", "IND", "MIA", "MIL", "NYK", "ORL", "PHI", "TOR", "WAS"]
};

const contestants = {
    Anders: {
        East: ["MIL", "PHI", "BOS", "BKN", "MIA", "TOR", "CLE", "ATL", "NYK", "CHI", "CHA", "DET", "WAS", "ORL", "IND"],
        West: ["GSW", "LAC", "DEN", "MIN", "MEM", "PHO", "NOP", "DAL", "SAC", "LAL", "POR", "HOU", "OKL", "UTA", "SAS"]
    },
    Magnus: {
        East: ["BOS", "MIL", "PHI", "BKN", "CLE", "MIA", "CHI", "ATL", "TOR", "CHA", "NYK", "WAS", "DET", "ORL", "IND"],
        West: ["GSW", "LAC", "PHO", "MIN", "MEM", "DEN", "DAL", "NOP", "LAL", "POR", "SAC", "OKL", "HOU", "SAS", "UTA"]
    },
    Kim: {
        East: ["MIL", "PHI", "MIA", "BOS", "BKN", "CLE", "ATL", "TOR", "CHI", "NYK", "WAS", "DET", "IND", "ORL", "CHA"],
        West: ["MIN", "GSW", "LAC", "PHO", "MEM", "DEN", "NOP", "DAL", "LAL", "POR", "SAC", "HOU", "OKL", "SAS", "UTA"]
    },
    Henrik: {
        East: ["PHI", "MIL", "BOS", "BKN", "CLE", "MIA", "ATL", "TOR", "CHI", "NYK", "DET", "WAS", "CHA", "ORL", "IND"],
        West: ["GSW", "MIN", "LAC", "MEM", "PHO", "DEN", "DAL", "NOP", "LAL", "SAC", "POR", "OKL", "HOU", "UTA", "SAS"]
    },
    Jameel: {
        East: ["PHI", "BKN", "MIL", "BOS", "CLE", "MIA", "ATL", "CHI", "TOR", "WAS", "NYK", "CHA", "DET", "ORL", "IND"],
        West: ["LAC", "DEN", "GSW", "MIN", "NOP", "LAL", "PHO", "MEM", "DAL", "SAC", "POR", "OKL", "HOU", "UTA", "SAS"]
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
    fetch("/standings")
        .then((response) => {
            return response.json();
        })
        .then((response) => {
            processResponse("East", response.east, eastTable);
            processResponse("West", response.west, westTable, true);
        })
        .catch((err) => {
            console.error("Failed to fetch", err);
            console.error(err);
        });
    // console.log(table);
}
window.onload = init;
