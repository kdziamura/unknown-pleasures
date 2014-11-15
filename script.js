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

	this.el = document.createElement('canvas');
	var ctx = this.ctx = this.el.getContext('2d');

	// setup canvas
	this.el.width = options.width;
	this.el.height = options.height;
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

	this.render();
}

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

		if (tempTranslateY % 5 === 0) {
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
	this._pausePosition = 0;
	this.source = null;
	this._nodes = [];
	this.handlers = [];

	this._defineStatuses();

	this.ui = new Player.UI(this);

	this.on('play', this.stopRecord.bind(this));
	this.on('record', this.pause.bind(this));
}

/**
 * Set source of player
 * @param {ArrayBuffer} src source
 */
Player.prototype._setSource = function (src) {
	this.audioCtx.decodeAudioData(src, function (audioBuffer) {
		this.connect(audioBuffer);

		this._setStatus('pending', false);
		this.trigger('load');
	}.bind(this));
};

Player.prototype.readFile = function (file) {
	var reader = new FileReader();

	reader.onload = function (e) {
		this._setSource(e.target.result);
	}.bind(this);

	reader.onerror = function (e) {
		this._setStatus('pending', false);
		this.trigger('error', {
			message: 'Error on loading file'
		});
	};

	if (file) {
		if (file.type.indexOf('audio') !== -1) {
			this.stop();
			this.source = null;
			this._setStatus('pending', true);
			reader.readAsArrayBuffer(file);
			this.trigger('loadstart');
		} else {
			this.trigger('error', {
				message: 'Not valid file type ' + file.type
			});
		}
	}
};

Player.prototype.connect = function (buffer) {
	var source, i;

	if (this.source) {
		this.reset();
		this.source.disconnect();
	}

	source = this.audioCtx.createBufferSource();

	source.onended = this._onended.bind(this);

	if (buffer) {
		source.buffer = buffer;
	} else {
		source.buffer = this.source.buffer;
	}

	this.source = source;

	this._connectNodes();

	this.source.connect(this.audioCtx.destination);
};

Player.prototype._connectNodes = function (source) {
	source = source || this.source;

	for (i = 0; i < this._nodes.length; i++) {
		source.connect(this._nodes[i]);
	}
};

Player.prototype.reset = function () {
	if (this.is('play')) {
		this.source.stop();
	}
};

Player.prototype._getTimeByPosition = function (position) {
	var duration = this.source.buffer.duration;
	position = position || 0;
	return duration * position;
};

Player.prototype.getPosition = function () {
	if (this.is('play')) {
		var duration = this.source.buffer.duration;
		var currentTime = this.audioCtx.currentTime - this._startTime;

		return currentTime / duration;
	} else {
		return this._pausePosition;
	}
};

Player.prototype.setPosition = function (position) {
	if (this.is('play')) {
		this.play(position);
	} else if (this.source) {
		this._pausePosition = position;
	} else {
		this.trigger('error', {
			message: 'Can\'t get source'
		});
	}
};

Player.prototype.play = function (position) {
	if (!this.source) {
		this.trigger('error', {
			message: 'Can\'t get source'
		});
		return;
	}

	var fromTime;
	var isTrigger = false;

	if (position === undefined) {
		position = this._pausePosition;
		isTrigger = true;
	}

	fromTime = this._getTimeByPosition(position);

	this.connect();

	this._startTime = this.audioCtx.currentTime - fromTime;
	this.source.start(0, fromTime);

	if (isTrigger) {
		this._setStatus('play', true);
		this.trigger('play');
	}
};

Player.prototype.pause = function () {
	this._pausePosition = this.getPosition();
	this.reset();

	this._setStatus('play', false);
	this.trigger('pause');
};

Player.prototype.stop = function () {
	this._pausePosition = 0;
	this.reset();

	this._setStatus('play', false);
	this.trigger('stop');
};

Player.prototype.addNode = function (node) {
	this._nodes.push(node);
};

Player.prototype._onended = function () {
	if (!this.source) { return; }

	var currentTime = this.audioCtx.currentTime;
	if (currentTime >= this._startTime + this.source.buffer.duration) {
		this.stop();
		this.trigger('ended');
	}
};

// Status manager

Player.prototype._defineStatuses = function(status) {
	this._status = {
		play: false,
		record: false,
		pending: false
	};
};

Player.prototype._setStatus = function(status, value) {
	var prevStatus = this._status[status];
	if (typeof prevStatus !== undefined) {
		this._status[status] = value;
		this.trigger('statuschanged', {
			status: status,
			prev: prevStatus,
			now: value
		});
	} else {
		console.log('Unknown status');
	}
};

Player.prototype.is = function(status) {
	if (status in this._status) {
		return this._status[status];
	} else {
		console.log('Unknown status');
	}
};



// Event manager

Player.prototype.trigger = function (eventName, e) {
	var handlers = this.handlers[eventName];
	var i;

	if (handlers) {
		for (i = 0; i < handlers.length; i++) {
			handlers[i](e);
		}
	}
};

Player.prototype.on = function (eventName, handler) {
	if (!this.handlers[eventName]) {
		this.handlers[eventName] = [];
	}

	this.handlers[eventName].push(handler);
};

Player.prototype.off = function (eventName, handler) {
	var handlers = this.handlers[eventName];
	var index;


	if (handlers) {
		index = handlers.indexOf(handler);

		if (index != -1) {
			handlers.splice(index, 1);
		}
	}
};




Player.prototype.record = function () {
	if (this.is('record') || this.is('pending')) return;

	this._setStatus('pending', true);

	navigator.getUserMedia({audio: true},

		function(stream) {
			this._stream = stream;
			this._connectNodes(this.audioCtx.createMediaStreamSource(stream));
			this._setStatus('record', true);
			this._setStatus('pending', false);
			this.trigger('record');
		}.bind(this),

		function(err) {
			this._setStatus('pending', false);
			console.log("The following error occured: " + err);
		}.bind(this)
	);
};

Player.prototype.stopRecord = function stopRecord () {
	if (this.is('record')) {
		this._stream.stop();
		this._stream = null;
		this._setStatus('record', false);
		this.trigger('recordstop');
	}
};






Player.UI = function (player) {
	var template =
	'.button.record$recBtn+' +
	'.button.play$playBtn+' +
	'.progress-bar$progressBar>' +
		'div$progress^' +
	'label.button>' +
		// '{open}+' +
		'input[type=file]$fileSelector^' +
	'.status$status';

	var elem = new createNode('.player', template);
	this.elems = elem.storage;

	this.el = elem.el;
	this.player = player;
	this._bindEvents();

	this.render();
};

Player.UI.prototype._setProgress = function (progress) {
	this.elems.progress.style.transform = 'translateX(' + (progress*100) + '%)';
};

Player.UI.prototype._bindEvents = function () {
	var player = this.player;

	this.elems.playBtn.addEventListener('click', this._playBtnClick.bind(this));
	this.elems.progressBar.addEventListener('click', this._progressBarClick.bind(this));
	this.elems.fileSelector.addEventListener('change', this._selectFile.bind(this));
	this.elems.recBtn.addEventListener('click', this._recBtnClick.bind(this));

	player.on('play', function () {
		this.elems.playBtn.classList.add('pause');
	}.bind(this));

	player.on('pause', this._onPause.bind(this));
	player.on('stop', this._onPause.bind(this));
	player.on('load', this._onPause.bind(this));

	player.on('loadstart', function () {
		this.elems.playBtn.classList.add('loading');
	}.bind(this));

	player.on('load', function () {
		this.elems.playBtn.classList.remove('loading');
	}.bind(this));

	player.on('record', function () {
		this.elems.recBtn.classList.add('in-progress');
	}.bind(this));
	player.on('recordstop', function () {
		this.elems.recBtn.classList.remove('in-progress');
	}.bind(this));


	player.on('error', function (e) {
		this.elems.status.innerHTML = 'ERORR: ' + e.message;
		this.elems.status.classList.add('hide');
	}.bind(this));

	this.elems.status.addEventListener('transitionend', function (e) {
		this.elems.status.innerHTML = '';
		this.elems.status.classList.remove('hide');
	}.bind(this));
};

Player.UI.prototype.helpers = {};
Player.UI.prototype.helpers._getMouseClick = function (e, element) {
	var totalOffsetX = 0;
	var totalOffsetY = 0;
	var canvasX = 0;
	var canvasY = 0;
	var currentElement = element;

	do {
		totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
		totalOffsetY += currentElement.offsetTop - currentElement.scrollTop;
		currentElement = currentElement.offsetParent;
	} while (currentElement);

	canvasX = e.pageX - totalOffsetX;
	canvasY = e.pageY - totalOffsetY;

	return {x:canvasX, y:canvasY};
};

// Handlers

Player.UI.prototype._progressBarClick = function (e) {
	var clickPos = this.helpers._getMouseClick(e, this.elems.progressBar);
	var position = clickPos.x / this.elems.progressBar.offsetWidth;
	this.player.setPosition(position);
};

Player.UI.prototype._playBtnClick = function (e) {
	var player = this.player;

	if (player.is('play')) {
		player.pause();
	} else {
		player.play();
	}
};

Player.UI.prototype._recBtnClick = function() {
	var player = this.player;

	if (player.is('record')) {
		player.stopRecord();
	} else {
		player.record();
	}
};

Player.UI.prototype._selectFile = function(e) {
	this.player.readFile(e.target.files[0]);
};

Player.UI.prototype._onPause = function() {
	this.elems.playBtn.classList.remove('pause');
};

// Render

Player.UI.prototype.render = function () {
	var rAF = window.requestAnimationFrame;
	var self = this;

	function draw () {
		var position = self.player.getPosition();

		self._setProgress(position);
		rAF(draw);
	}

	rAF(draw);
};