const base_src = "1ml-common/1ml-jfp-official.pdf#";

function pdf_display() {
    if (window.paper_iframe !== undefined) return;
    let aside = document.createElement("aside");
    let iframe = document.createElement("iframe");
    window.paper_iframe = iframe;
    iframe.src = base_src;
    aside.appendChild(iframe);
    aside.classList.add("paper-right-side")
    iframe.classList.add("paper-right-side")
    document.body.style.margin = "0";
    document.body.style.display = "flex";
    document.querySelector("main").style.width = "50%";
    document.body.appendChild(aside);
    for (let link of [...document.getElementsByClassName("paper-link")]) {
        let old_href = link.href;
        link.href = "javascript:void(0)";
        link.onclick = function(event) {
            iframe.src = base_src;
            iframe.src = old_href;
            return false;
        }
    }
}
