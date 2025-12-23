let sections = document.getElementsByTagName("section");
let keep = [...sections].map(e => e.classList.contains("keep"));

function advance() {
    currSection++;
    sections[currSection].style.display = "block";
    if (!keep[currSection]) {
        let i = currSection;
        while (keep[--i]) {
            sections[i].style.display = "none";
        }
        sections[i].style.display = "none";
    }
}

let currSection = 0;
sections[0].style.display = "block";
