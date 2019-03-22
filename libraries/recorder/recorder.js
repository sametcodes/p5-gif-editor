class P5Recorder {
  constructor({
    gifLength = 50
  }) {
    this.gifLength = gifLength;
    this.capturer = new CCapture({
      format: 'gif',
      workersPath: '/libraries/recorder/',
      framerate: 60 
    });
    this.capturer.start();
    this.createLog();
  }

  createLog() {
    var log = document.createElement('div');
    log.innerText = "";
    log.id = "log";
    log.style = "position:absolute;top:10px;left:10px;padding:5px 10px;background-color:green;color:#fff;font-size: 12px";
    document.body.append(log);
  }

  updateLog(text) {
    window.document.getElementById("log").innerText = text;
  }

  capture(frameCount, stopStatement=null) {
    if (frameCount <= this.gifLength) {
      this.updateLog(`capturing: ${frameCount}/${this.gifLength}`);
      this.capturer.capture(document.getElementById('defaultCanvas0'));
    }else if(stopStatement){
    }else if (frameCount === this.gifLength + 1) {
      this.updateLog('rendering...');
      this.capturer.stop();
      this.capturer.save();
    }
  }
}

