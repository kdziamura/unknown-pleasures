window.Player = (function () {
	window.AudioContext = window.AudioContext || window.webkitAudioContext;
	navigator.getUserMedia = (navigator.getUserMedia ||
							navigator.webkitGetUserMedia ||
							navigator.mozGetUserMedia ||
							navigator.msGetUserMedia);

	function Player () {
		this.audioCtx = new AudioContext();
		this._pausePosition = 0;
		this.source = null;
		this._nodes = [];
		this.handlers = [];

		this._defineStatuses();

		this.analyser = this.audioCtx.createAnalyser();
		this.addNode(this.analyser);
		this._gainNode = this.audioCtx.createGain();
		this.addNode(this._gainNode);

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
	};

	Player.prototype._connectNodes = function (source) {
		var node = source || this.source;
		var i;

		for (i = 0; i < this._nodes.length; i++) {
			node.connect(this._nodes[i]);
			node = this._nodes[i];
		}
		node.connect(this.audioCtx.destination);
	};

	Player.prototype.reset = function () {
		if (this.is('play')) {
			this.source.stop();
		}
	};

	Player.prototype.volume = function (value) {
		var gain = this._gainNode.gain;
		if (typeof value !== 'undefined') {
			if (gain.value !== value) {
				gain.value = value;
				this.trigger('volumechange', {
					value: value
				});
			}
		}
		return gain.value;
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
		this._startTime = this.audioCtx.currentTime - fromTime;


		if (position >= 1) {
			this._onended();
		} else {
			this.connect();
			this.source.start(0, fromTime);

			if (isTrigger) {
				this._setStatus('play', true);
				this.trigger('play');
			}
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

	return Player;
})();