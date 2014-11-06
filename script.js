window.AudioContext = window.AudioContext || window.webkitAudioContext;
navigator.getUserMedia = (navigator.getUserMedia ||
						navigator.webkitGetUserMedia ||
						navigator.mozGetUserMedia ||
						navigator.msGetUserMedia);

function getRandom() {
	return 2 * Math.random() - 1;
}

// =====================================================

function UnknownPleasures (audioCtx, options) {
	this.audioCtx = audioCtx;
	this.options = options;
	this.lines = new Array(options.lines);
}

UnknownPleasures.prototype.init = function (canvas) {
	canvas = canvas || document.createElement('canvas');
	var ctx = this.ctx = canvas.getContext('2d');
	var options = this.options;

	// setup canvas
	ctx.canvas.width = options.width;
	ctx.canvas.height = options.height;
	ctx.strokeStyle = options.strokeStyle;
	ctx.lineWidth = options.lineWidth;
	ctx.fillStyle = options.fillStyle;

	this.setAnalyser();
	this.dataArray = new Uint8Array(this.analyser.fftSize);


	for (var i = 0; i < this.options.lines; i++) {
		this.lines[i] = this.getLine();
	}

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


UnknownPleasures.prototype.render = function () {
	var rAF = window.requestAnimationFrame;
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




UnknownPleasures.prototype.setAnalyser = function (src) {
	var analyser = this.audioCtx.createAnalyser();

	analyser.minDecibels = -90;
	analyser.maxDecibels = -10;
	analyser.smoothingTimeConstant = 1;
	analyser.fftSize = 64;
	this.analyser = analyser;
};




















function Player () {
	this.audioCtx = new AudioContext();
	this.isPlaying = false;
	this._pausePosition = 0;
	this.source = null;
	this._nodes = [];

	this.ui = new Player.UI(this);
}

/**
 * Set source of player
 * @param {ArrayBuffer} src source
 */
Player.prototype.setSource = function (src) {
	this.reset();
	this.source = null;
	this.audioCtx.decodeAudioData(src, this.connect.bind(this));
};

Player.prototype.connect = function (buffer) {
	var source, i;

	if (this.source) {
		this.stop();
		this.source.disconnect();
	}

	source = this.audioCtx.createBufferSource();

	source.onended = this.reset.bind(this);
	source.buffer = buffer || this.source.buffer;
	this.source = source;

	for (i = 0; i < this._nodes.length; i++) {
		this.source.connect(this._nodes[i]);
	}

	this.source.connect(this.audioCtx.destination);
};

Player.prototype.reset = function () {
	if (this.isPlaying) {
		this.isPlaying = false;
		this.source.stop();
	}
};

Player.prototype._getTimeByPosition = function (position) {
	var duration = this.source.buffer.duration;
	position = position || 0;
	return duration * position;
};

Player.prototype._getPosition = function () {
	var duration = this.source.buffer.duration;
	var currentTime = this.audioCtx.currentTime - this._startTime;

	return this.isPlaying ? currentTime / duration : this._pausePosition;
};

Player.prototype.setPosition = function (position) {
	if (this.isPlaying) {
		this.play(position);
	} else {
		this._pausePosition = position;
	}
};

Player.prototype.play = function (position) {
	position = position !== undefined ? position : this._pausePosition;

	var fromTime = this._getTimeByPosition(position);

	this.connect();

	this.isPlaying = true;

	this._startTime = this.audioCtx.currentTime - fromTime;
	this.source.start(0, fromTime);
};

Player.prototype.pause = function () {
	this._pausePosition = this._getPosition();

	this.reset();
};

Player.prototype.stop = function () {
	this._pausePosition = 0;

	this.reset();
};

Player.prototype.addNode = function (node) {
	this._nodes.push(node);
};






Player.UI = function (player) {
	var wrapper = document.createElement('div');
	var playBtn = document.createElement('div');
	var progressBarWrapper = document.createElement('div');
	var progress = document.createElement('div');

	wrapper.classList.add('player');
	playBtn.classList.add('button');
	progressBarWrapper.classList.add('progress-bar');

	progressBarWrapper.appendChild(progress);

	wrapper.appendChild(playBtn);
	wrapper.appendChild(progressBarWrapper);

	this.el = wrapper;
	this.playBtn = playBtn;
	this.progressBarWrapper = progressBarWrapper;
	this.progress = progress;

	this.player = player;
	this._bindEvents();
};

Player.UI.prototype._setProgress = function (progress) {
	this.progress.style.transform = 'translateX(' + (progress*100) + '%)';
};

Player.UI.prototype._bindEvents = function () {
	this.playBtn.addEventListener('click', this._playBtnClick.bind(this));
	this.progressBarWrapper.addEventListener('click', this._progressBarClick.bind(this));
};

Player.UI.prototype.helpers = {};
Player.UI.prototype.helpers._getMouseClick = function (e, element) {
	var totalOffsetX = 0;
	var totalOffsetY = 0;
	var canvasX = 0;
	var canvasY = 0;
	var currentElement = element;

	do{
		totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
		totalOffsetY += currentElement.offsetTop - currentElement.scrollTop;
	}
	while(currentElement = currentElement.offsetParent)

	canvasX = e.pageX - totalOffsetX;
	canvasY = e.pageY - totalOffsetY;

	return {x:canvasX, y:canvasY};
};

// Handlers

Player.UI.prototype._progressBarClick = function (e) {
	var clickPos = this.helpers._getMouseClick(e, this.progressBarWrapper);
	var position = clickPos.x / this.progressBarWrapper.offsetWidth;
	this.player.setPosition(position);
};

Player.UI.prototype._playBtnClick = function (e) {
	var player = this.player;

	if (player.isPlaying) {
		this.player.pause();
		this.playBtn.classList.remove('pause');
	} else {
		this.player.play();
		this.playBtn.classList.add('pause');
	}
};

Player.UI.prototype.render = function () {
	var rAF = window.requestAnimationFrame;
	var self = this;

	function draw () {
		var position = self.player._getPosition();

		self._setProgress(position);
		rAF(draw);
	}

	rAF(draw);
};