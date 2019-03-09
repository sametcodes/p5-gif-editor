function executeScript(source) {
    var script = document.createElement("script");
    script.onerror = function(){ this.remove(); };
    script.onload = function(){ this.remove();  }
    script.src = "data:text/plain;base64," + btoa(source);
    document.body.appendChild(script);
}

(function(){
    document.querySelector('#run').onclick = function(){
        if(window.p){
            window.p.remove();
            window.p = null;
        }
        const value = window.editor.getValue();
        window.p = new p5()
        executeScript(value);
    }
})();
