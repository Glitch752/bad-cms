document.querySelectorAll("*").forEach(function (element) {
    element.addEventListener("click", () => {
        alert("Element clicked! Classlist is " + element.classList);
    });
});