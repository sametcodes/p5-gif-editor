(function(){
    var iframe = document.createElement('iframe')
    iframe.id = "p5iframe";
    iframe.src = 'assets/example.html'
    document.querySelector("#iframe").appendChild(iframe);

    document.querySelector('#run').onclick = function(){
        let iframe = document.getElementById('p5iframe').contentWindow.document;
        iframe.body.style.backgroundColor = "#ddd";
        iframe.body.style.height = "100vh";

        let source = window.editor.getValue();
        var userScript = iframe.createElement('script');
        userScript.type = 'text/javascript';
        userScript.text = `${source}

        if(window.canvas){
            window.remove();
        }
        new p5();
        `;
        userScript.async = false;

        iframe.body.appendChild(userScript);
    }
})();
