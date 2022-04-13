let didClick = false;
document.querySelectorAll("*").forEach(function (element) {
    element.addEventListener("click", () => {
        if (!didClick) {
            didClick = true;
            document.querySelectorAll(".clicked__2zZxPmy5ml").forEach(function (element) { element.classList.remove("clicked__2zZxPmy5ml"); });
            parent.postMessage(JSON.stringify({"type": "clickedElement", "classList": [...element.classList]}), "*");
            element.classList.add("clicked__2zZxPmy5ml");
            setTimeout(() => {
                didClick = false;
            }, 10);
        }
    });
});

window.addEventListener("message", function (event) {
    const parsedData = JSON.parse(event.data);
    if(parsedData.type === "removeClass") {
        document.querySelectorAll(".clicked__2zZxPmy5ml").forEach(function (element) {
            element.classList.remove(parsedData.className);
            sendSiteHTML();
        });
    } else if(parsedData.type === "addClass") {
        document.querySelectorAll(".clicked__2zZxPmy5ml").forEach(function (element) {
            element.classList.add(parsedData.className);
            sendSiteHTML();
        });
    }
});

function sendSiteHTML() {
    let siteHTML = new XMLSerializer().serializeToString(document);
    // Remove the editorLayoutInjectScript from the siteHTML, AKA remove any script with editorLayoutInjectScript as a part of its src
    siteHTML = siteHTML.replace(/<script.*editorLayoutInjectScript.js.*<\/script>/g, "");

    // Remove all clicked__2zZxPmy5ml classes from the siteHTML
    siteHTML = siteHTML.replace(/clicked__2zZxPmy5ml/g, "");

    parent.postMessage(JSON.stringify({
        "type": "siteHTML", 
        "html": siteHTML,
        "currentPage": window.location.href
    }), "*");
}