function executeScript(source) {
    console.log(source)
    var script = document.createElement("script");
    script.onload = script.onerror = function(){ this.remove(); };
    script.src = "data:text/plain;base64," + btoa(source);
    document.body.appendChild(script);
}

(function(){
    document.querySelector('#run').onclick = function(){
        const value = window.editor.getValue();
        var p = new p5()
        p.canvas = document.getElementById('canvas');
        executeScript(value);
    }
})();
