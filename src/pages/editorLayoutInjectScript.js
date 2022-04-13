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
            element.classList.remove("clicked__2zZxPmy5ml");
            element.classList.remove(parsedData.className);
        });
    }
});