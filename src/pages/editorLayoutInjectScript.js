document.querySelectorAll("*").forEach(function (element) {
    element.addEventListener("click", () => {
        parent.postMessage(JSON.stringify({"type": "clickedElement", "classList": [...element.classList]}), "*");
    });
});