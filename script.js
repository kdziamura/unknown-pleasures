var rAF = window.requestAnimationFrame;
window.AudioContext = window.AudioContext || window.webkitAudioContext;
navigator.getUserMedia = (navigator.getUserMedia ||
						navigator.webkitGetUserMedia ||
						navigator.mozGetUserMedia ||
						navigator.msGetUserMedia);

function getRandom() {
	return 2 * Math.random() - 1;
}

// =====================================================

function UnknownPleasures (options) {
	this.options = options;
	this.lines = new Array(options.lines);
}

UnknownPleasures.prototype.init = function (canvas) {
	canvas = canvas || document.createElement('canvas');
	var ctx = this.ctx = canvas.getContext('2d');
	var options = this.options;

	// setup audio
	this.audio = new Audio();
	this.audio.autoplay = true;
	this.audio.controls = true;
	this.audio.style.display = 'none';

	this.audioCtx = new AudioContext();
	this._source = this.audioCtx.createMediaElementSource(this.audio);

	// setup canvas
	ctx.canvas.width = options.width;
	ctx.canvas.height = options.height;
	ctx.strokeStyle = options.strokeStyle;
	ctx.lineWidth = options.lineWidth;
	ctx.fillStyle = options.fillStyle;

	this.setAnalyser();
	this.dataArray = new Uint8Array(this.analyser.fftSize);

	ctx.fillRect(0, 0, options.width, options.height);
	ctx.translate(options.padding[1], options.padding[0]);

	return canvas;
};

UnknownPleasures.prototype.renderLine = function (line) {
	var a,b,c,d;
	var length = line.length - 2;

	var start = line[0];
	var end = line[length];

	ctx = this.ctx;

	ctx.beginPath();
	ctx.moveTo(start.re, start.im);

	for (var i = 0; i < length; i+=2) {

		a = line[i];
		d = line[i+2];
		b = Complex(a).add(line[i+1]);
		c = Complex(d).sub(line[i+3]);

		ctx.bezierCurveTo(b.re, b.im, c.re, c.im, d.re, d.im);
	}


	ctx.stroke();

	// hardcoded 100px fill under the line
	ctx.lineTo(end.re, end.im + 100);
	ctx.lineTo(start.re, start.im + 100);

	ctx.closePath();

	ctx.fill();
};

UnknownPleasures.prototype.getLine = function () {
	var line = [];
	var m, r, v;
	var points = this.options.points;
	var offset = Math.floor(points / 4);
	var centerPart = points - 2 * offset;
	var hStep = Math.ceil((this.options.width - 2 * this.options.padding[1]) / points);

	this.analyser.getByteTimeDomainData(this.dataArray);

	var indexMul = centerPart / this.dataArray.length;

	for (var i = 0; i < points+1; i++) {
		if ((i > offset) && (i < points - offset)) {

			v = this.dataArray[Math.floor((i - offset) / indexMul)];
			m = Math.sin((i - offset) / centerPart * Math.PI);

			line.push(Complex( hStep * i, -20 * m * (m + (v-128)/64 )));
			line.push(Complex.fromPolar(hStep / 2, Math.PI * (getRandom() / 8)));

		} else { // if offset part

			line.push(Complex(hStep * i, 0));
			line.push(Complex.fromPolar(hStep / 4, Math.PI * (getRandom() / 8)));
		}

	}

	return line;
};

UnknownPleasures.prototype.updateData = function (onlyLast) {
	var line = this.getLine();
	if (onlyLast) {
		this.lines[this.lines.length - 1] = line;
	} else {
		this.lines.shift();
		this.lines.push(line);
	}
};

UnknownPleasures.prototype.preRender = function () {
	for (var i = 0; i < this.options.lines; i++) {
		this.lines[i] = this.getLine();
	}
};

UnknownPleasures.prototype.render = function () {
	var points = this.options.points;
	var vStep = Math.ceil((this.options.height - 2 * this.options.padding[0]) / this.options.lines);
	var lines = this.lines;
	var ctx = this.ctx;
	var padding = this.options.padding;
	var self = this;


	var tempTranslateY = 0;

	function anim () {
		ctx.fillRect(-padding[1], -padding[0], ctx.canvas.width, ctx.canvas.height);


		ctx.translate(0, tempTranslateY);
		self.renderLine(lines[0]);
		ctx.translate(0, -tempTranslateY);

		for (var i = 1; i < lines.length - 1; i++) {
			ctx.translate(0, vStep);
			self.renderLine(lines[i]);
		}

		ctx.translate(0, tempTranslateY);
		self.renderLine(lines[lines.length-1]);
		ctx.translate(0, -tempTranslateY);

		ctx.translate(0, -vStep * (lines.length-2));
		ctx.translate(0, -1);

		tempTranslateY++;

		if (tempTranslateY > vStep) {
			ctx.translate(0, tempTranslateY);
			tempTranslateY = 0;
			self.updateData();
		}

		if (!(tempTranslateY % 5)) {
			self.updateData(true);
		}
		rAF(anim);
	}

	rAF(anim);
};











UnknownPleasures.prototype.setSource = function (src) {
	var audio = this.audio;
	var analyser = this.analyser;
	var audioCtx = this.audioCtx;
	var self = this;

	if (this.source) this.source.disconnect();

	if (typeof src === 'string') {
		audio.style.display = '';
		audio.src = src;
		this.source = this._source;
		this.source.connect(analyser);
		this.source.connect(audioCtx.destination);
	} else if (src === undefined) {
		audio.style.display = 'none';
		audio.src = '';
		navigator.getUserMedia ({ audio: true },
			function(stream) {
				self.source = audioCtx.createMediaStreamSource(stream);
				self.source.connect(analyser);
			},
			function(err) {
				console.log("The following error occured: " + err);
			}
		);
	}

	// else { // arrayBuffer
	// 	source = audioCtx.createBufferSource();

	// 	audioCtx.decodeAudioData(src, function(audioBuffer) {
	// 		source.buffer = audioBuffer;
	// 		source.connect(analyser);
	// 		source.connect(audioCtx.destination);
	// 		source.start();
	// 	});
	// }

}



UnknownPleasures.prototype.setAnalyser = function (src) {
	var analyser = this.audioCtx.createAnalyser();

	analyser.minDecibels = -90;
	analyser.maxDecibels = -10;
	analyser.smoothingTimeConstant = 1;
	analyser.fftSize = 64;
	this.analyser = analyser;
};