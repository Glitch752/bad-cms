const clickedClassRandom = "clicked__" + Math.random().toString(36).substring(2);

let didClick = false;
document.querySelectorAll("*").forEach(function (element) {
    element.addEventListener("click", () => {
        if (!didClick) {
            didClick = true;
            document.querySelectorAll(`.${clickedClassRandom}`).forEach(function (element) { element.classList.remove(clickedClassRandom); });
            parent.postMessage(JSON.stringify({
                "type": "clickedElement", 
                "classList": [...element.classList],
                "styles": getCssRules(element),
                "properties": getProperties(element),
            }), "*");
            element.classList.add(clickedClassRandom);
            setTimeout(() => {
                didClick = false;
            }, 10);
        }
    });
});

window.addEventListener("message", function (event) {
    const parsedData = JSON.parse(event.data);
    if(parsedData.type === "removeClass") {
        document.querySelectorAll(`.${clickedClassRandom}`).forEach(function (element) {
            element.classList.remove(parsedData.className);
            sendSiteHTML();
        });
    } else if(parsedData.type === "addClass") {
        document.querySelectorAll(`.${clickedClassRandom}`).forEach(function (element) {
            element.classList.add(parsedData.className);
            sendSiteHTML();
        });
    } else if(parsedData.type === "reloadCss") {
        reloadCss();
    } else if(parsedData.type === "changeProperty") {
        document.querySelectorAll(`.${clickedClassRandom}`).forEach(function (element) {
            element.setAttribute(parsedData.property, parsedData.value);
            sendSiteHTML();
        });
    }
});

window.addEventListener("scroll", function (event) {
    parent.postMessage(JSON.stringify({
        "type": "scroll",
        "scroll": window.scrollY
    }), "*");
});

function getProperties(element) {
    const properties = [];
    for (let i = 0; i < element.attributes.length; i++) {
        const attribute = element.attributes[i];
        if(attribute.name === "class") continue
        properties.push({
            "name": attribute.name,
            "value": attribute.value
        });
    }
    return properties;
}

function getCssRules(element) {
    const allCSS = [...document.styleSheets].map(styleSheet => {
        try {
            return [...styleSheet.cssRules].map(cssRule => {
                if(element.matches(cssRule.selectorText)) {
                    return {
                        "selectorText": cssRule.selectorText,
                        "cssRules": cssRule.style,
                        "cssText": cssRule.cssText
                    };
                }
            }).filter(cssRule => cssRule !== undefined);
        } catch (e) {
            console.log('Access to stylesheet %s is denied. Ignoring...', styleSheet.href);
        }
    });

    // Next, find what file or section of the file each CSS rule is loaded from.
    // Loop through all the linked CSS files and find the first one that contains the rule. 
    //If it's not in any file, try to find it in the HTML of the page and get the lines.
    const siteHTML = getSiteHTML();
    const cssFiles = [...document.querySelectorAll("link[rel='stylesheet']")].map(link => link.href);

    const styleSheetContent = [...document.styleSheets].map(styleSheet => {
        return [...styleSheet.cssRules].map(cssRule => {
            return cssRule.cssText;
        }).join("\n");
    }); 

    const cssFileContent = cssFiles.map((cssFile, index) => {
        return {
            "cssFile": cssFile.replace(/%20/g, " "),
            "cssFileContent": styleSheetContent[index]
        }
    });

    for(let i = 0; i < allCSS.length; i++) {
        for(let j = 0; j < allCSS[i].length; j++) {
            for(let k = 0; k < cssFileContent.length; k++) {
                if(cssFileContent[k].cssFileContent.includes(allCSS[i][j].cssText)) {
                    allCSS[i][j].cssFile = cssFileContent[k].cssFile;
                }
            }
            if(allCSS[i][j].cssFile === undefined) {
                if(siteHTML.replace(/\s+/g, "").includes(allCSS[i][j].cssText.replace(/\s+/g, ""))) {
                    allCSS[i][j].cssFile = "HTML";
                }
            }
            if(allCSS[i][j].cssFile === undefined) {
                allCSS[i][j].cssFile = "Unknown";
            }
        }
    }

    return allCSS.flat(1);
}

function getSiteHTML() {return new XMLSerializer().serializeToString(document)}

function sendSiteHTML() {
    let siteHTML = getSiteHTML();
    // Remove the editorLayoutInjectScript from the siteHTML, AKA remove any script with editorLayoutInjectScript as a part of its src
    siteHTML = siteHTML.replace(/<script.*editorLayoutInjectScript.js.*<\/script>/g, "");

    // Remove all {clickedClassRandom} classes from the siteHTML
    let replaceRegex = new RegExp(`\\b${clickedClassRandom}\\b`, "g");
    siteHTML = siteHTML.replace(replaceRegex, "");

    parent.postMessage(JSON.stringify({
        "type": "siteHTML", 
        "html": siteHTML,
    }), "*");
}

function reloadCss() {
    console.log("reloading css");
    var links = document.getElementsByTagName("link");
    for (var cl in links) {
        var link = links[cl];
        if (link.rel === "stylesheet")
            link.href += "";
    }
}