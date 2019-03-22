(function(){
    var iframe = document.createElement('iframe')
    iframe.id = "p5iframe";
    iframe.src = 'assets/example.html'
    document.querySelector("#iframe").appendChild(iframe);
    document.querySelector('#run').onclick = function(){
        let iframe = document.getElementById('p5iframe').contentWindow.document;
        iframe.body.style.backgroundColor = "#ddd";
        iframe.body.style.height = "100vh";

//        if(iframe.querySelector("#log")){
//            iframe.querySelector("#log").remove();
//        }

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
    document.querySelector('#record').onclick = function(){
        let iframe = document.getElementById('p5iframe').contentWindow.document;
        iframe.body.style.backgroundColor = "#ddd";
        iframe.body.style.height = "100vh";

        var source = window.editor.getValue();
        var userScript = iframe.createElement('script');
        userScript.type = 'text/javascript';
        
        let setup = /setup\(\){([\s\S]*)}/.exec(source);
        let draw = /draw\(\){([\s\S]*)}/gm.exec(source);

        if(setup){
            source = source.replace(/setup\(\){([\s\S]*)}/gm, `setup(){
            recorder = new P5Recorder({gifLength: 300});
            ${setup[1]}
            }`)
        }

        if(draw){
            source = source.replace(/draw\(\){([\s\S]*)}/gm, `draw(){
            ${draw[1]}
            recorder.capture(frameCount);
            }`)
        }

        userScript.text = `
        if(window.canvas){
            window.remove();
            window.recorder=null;
        }

        let recorder;

        ${source}

        new p5();
        `;
        userScript.async = false;

        iframe.body.appendChild(userScript);
    }
    editor.onKeyDown((e) => {
        if (e.code === 'KeyE' && e.ctrlKey === true) {
            e.preventDefault();
            document.querySelector('#run').click()
        }
    });
})();
