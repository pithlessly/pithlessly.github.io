const random = {
    int: n => Math.floor(Math.random() * n),
};

let board = new Map();

function isMine(x, y) {
    const DENSITY = 0.3;
    const key = x + "," + y;
    if (board.has(key)) return board.get(key);
    const status = Math.random() < DENSITY;
    board.set(key, status);
    return status;
}

function adjMines(x, y) {
    let total = 0;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (!(dx == 0 && dy == 0)) {
                total += isMine(x + dx, y + dy);
            }
        }
    }
    return total;
}

board.set("-1,-1", false);
board.set("-1,0", false);
board.set("-1,1", false);
board.set("0,-1", false);
board.set("0,0", false);
board.set("0,1", false);
board.set("1,-1", false);
board.set("1,0", false);
board.set("1,1", false);

let curX = 0, curY = 0;

const VIEW_WIDTH = 31;
const VIEW_HEIGHT = 21;
const cells = [];
const table = document.getElementById("main-table");
{
    const body = document.createElement("tbody");
    for (let y = 0; y < VIEW_HEIGHT; y++) {
        const row = document.createElement("tr");
        for (let x = 0; x < VIEW_WIDTH; x++) {
            const cell = document.createElement("td");
            cells.push(cell);
            row.appendChild(cell);
        }
        body.appendChild(row);
    }
    table.appendChild(body);
}
cells[(cells.length - 1)/2].classList.add("cursor");

// 0/undefined = unknown, 1 = cleared, 2 = flagged
const knownCells = new Map();

function adjFlags(x, y) {
    let total = 0;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (!(dx == 0 && dy == 0)) {
                const key = (x + dx) + "," + (y + dy);
                total += (knownCells.get(key) == 2);
            }
        }
    }
    return total;
}

let isDead = false;
let nUncovered = 0;
const notification = 500;
let startTime = undefined;

function uncover() {
    if (isDead) return;
    const MAX_DIST = 7;
    function go(x, y, initial = false) {
        const key = x + "," + y;
        switch (knownCells.get(key)) {
            case 0:
            case undefined:
                {
                    const dx = x - curX;
                    const dy = y - curY;
                    if (dx*dx + dy*dy > MAX_DIST*MAX_DIST && Math.random() > 0.3) return;
                }
                if (isMine(x, y)) {
                    die();
                    return;
                } else {
                    if (startTime == undefined)
                        startTime = new Date();
                    nUncovered++;
                    if (nUncovered == notification) {
                        // 104.842
                        let msg = `Uncovered ${notification} in ${(new Date() - startTime)/1000}s`;
                        alert(msg);
                        console.log(msg);
                    }
                    knownCells.set(key, 1);
                    if (adjMines(x, y) == 0) {
                        go(x - 1, y - 1);
                        go(x, y - 1);
                        go(x + 1, y - 1);
                        go(x - 1, y);
                        go(x + 1, y);
                        go(x - 1, y + 1);
                        go(x, y + 1);
                        go(x + 1, y + 1);
                    }
                }
                break;
            case 1:
                if (initial) {
                    const flags = adjFlags(x, y);
                    if (flags > 0 && flags == adjMines(x, y)) {
                        go(x - 1, y - 1);
                        go(x, y - 1);
                        go(x + 1, y - 1);
                        go(x - 1, y);
                        go(x + 1, y);
                        go(x - 1, y + 1);
                        go(x, y + 1);
                        go(x + 1, y + 1);
                    }
                }
                break;
            case 2:
                // don't try to uncover flagged cells
                break;
        }
    }
    go(curX, curY, initial = true);
}

uncover();
startTime = undefined; // ignore timings from this

function redraw() {
    let i = 0;
    for (let vy = 0; vy < VIEW_HEIGHT; vy++) {
        for (let vx = 0; vx < VIEW_WIDTH; vx++) {
            const y = vy - (VIEW_HEIGHT-1)/2 + curY;
            const x = vx - (VIEW_WIDTH-1)/2 + curX;
            const key = x + "," + y;
            const cell = cells[i++];
            switch (knownCells.get(key)) {
                case 1:
                    cell.innerText = adjMines(x, y) || "";
                    cell.style.color = "";
                    cell.style.backgroundColor = "";
                    break;
                case 2:
                    cell.innerText = "F";
                    cell.style.color = "#f80";
                    cell.style.backgroundColor = "#f55";
                    break;
                default:
                    cell.innerText = "?";
                    cell.style.color = "#444";
                    cell.style.backgroundColor = "#999";
                    break;
            }
        }
    }
}

redraw();

function flag() {
    if (isDead) return;
    const key = curX + "," + curY;
    switch (knownCells.get(key)) {
        case undefined:
        case 0:
            knownCells.set(key, 2);
            break;
        case 2:
            knownCells.set(key, 0);
            break;
    }
}

function die() {
    let correctFlags = 0;
    let incorrectFlags = 0;
    let uncovers = 0;
    for (const [k, status] of knownCells) {
        switch (status) {
            case 1:
                uncovers++;
                break;
            case 2:
                if (isMine(...k.split(","))) {
                    correctFlags++;
                } else {
                    incorrectFlags++;
                }
                break;
            default:
                break;
        }
    }
    const alertBox = document.getElementById("alert-box");
    alertBox.innerText = `you died\ncells uncovered: ${uncovers}\nflags: ${correctFlags + incorrectFlags} (${correctFlags} correct, ${incorrectFlags} incorrect)`;
    isDead = true;
}

function handleKeypress(evt) {
    if (evt.ctrlKey || evt.metaKey || evt.altKey) return;
    switch (evt.key) {
        case "h":
        case "ArrowLeft":
            curX -= 1;
            redraw();
            evt.preventDefault();
            break;
        case "l":
        case "ArrowRight":
            curX += 1;
            redraw();
            evt.preventDefault();
            break;
        case "k":
        case "ArrowUp":
            curY -= 1;
            redraw();
            evt.preventDefault();
            break;
        case "j":
        case "ArrowDown":
            curY += 1;
            redraw();
            evt.preventDefault();
            break;
        case " ":
            uncover();
            redraw();
            evt.preventDefault();
            break;
        case "f":
            flag();
            redraw();
            evt.preventDefault();
            break;
    }
}

addEventListener("keydown", handleKeypress);
