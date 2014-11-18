Player.UI = (function () {
	PlayerUI = function (player) {
		var template =
		'.button.record$recBtn+' +
		'.button.play$playBtn+' +
		'.progress-bar$progressBar>' +
			'div$progress^' +
		'.progress-bar$volumeBar>' +
			'div$volume^' +
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

	PlayerUI.prototype._bindEvents = function () {
		var player = this.player;
		var elems = this.elems;

		// Interaction

		elems.playBtn.addEventListener('click', this._playBtnClick.bind(this));
		elems.recBtn.addEventListener('click', this._recBtnClick.bind(this));

		elems.fileSelector.addEventListener('change', this._selectFile.bind(this));

		this.helpers.slider(elems.progressBar, elems.progress, player.setPosition.bind(player));
		this.helpers.slider(elems.volumeBar, elems.volume, player.volume.bind(player), true);

		// Model listeners

		function onPause() {
			elems.playBtn.classList.remove('pause');
		}

		player.on('volumechange', function (e) {
			elems.volume.style.transform = 'translateX(' + (e.value * 100) + '%)';
		});

		player.on('play', function () {
			elems.playBtn.classList.add('pause');
		});

		player.on('pause', onPause);
		player.on('stop', onPause);

		player.on('loadstart', function () {
			elems.playBtn.classList.add('loading');
		});

		player.on('load', function () {
			elems.playBtn.classList.remove('loading');
		});

		player.on('record', function () {
			elems.recBtn.classList.add('in-progress');
		});
		player.on('recordstop', function () {
			elems.recBtn.classList.remove('in-progress');
		});


		player.on('error', function (e) {
			elems.status.innerHTML = 'ERORR: ' + e.message;
			elems.status.classList.add('hide');
		});

		elems.status.addEventListener('transitionend', function (e) {
			elems.status.innerHTML = '';
			elems.status.classList.remove('hide');
		});
	};

	PlayerUI.prototype.helpers = {};
	PlayerUI.prototype.helpers.slider = function (wrapper, progressElem, callback, changeOnMove) {
		var clickPos = null;
		var mousePos = this._getMouseClick;

		function update(e) {
			var value = mousePos(e, wrapper).x / wrapper.offsetWidth;
			value = value > 1 ? 1 : value < 0 ? 0 : value;
			callback(value);
		}

		function mousedown(e) {
			if (e.button === 0) {
				if (changeOnMove) {
					update(e);
				}
				window.addEventListener('mousemove', mousemove);
				window.addEventListener('mouseup', mouseup);
			}
		}

		function mousemove (e) {
			if (changeOnMove) {
				update(e);
			}
		}

		function mouseup (e) {
			update(e);
			window.removeEventListener('mousemove', mousemove);
			window.removeEventListener('mouseup', mouseup);
		}

		wrapper.addEventListener('mousedown', mousedown);
	};

	PlayerUI.prototype.helpers._getMouseClick = function (e, element) {
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

	PlayerUI.prototype._playBtnClick = function (e) {
		var player = this.player;

		if (player.is('play')) {
			player.pause();
		} else {
			player.play();
		}
	};

	PlayerUI.prototype._recBtnClick = function() {
		var player = this.player;

		if (player.is('record')) {
			player.stopRecord();
		} else {
			player.record();
		}
	};

	PlayerUI.prototype._selectFile = function(e) {
		this.player.readFile(e.target.files[0]);
	};

	// Render

	PlayerUI.prototype.render = function () {
		var rAF = window.requestAnimationFrame;
		var self = this;

		this.elems.volume.style.transform = 'translateX(' + (this.player.volume() * 100) + '%)';

		function draw () {
			var position = self.player.getPosition();

			self.elems.progress.style.transform = 'translateX(' + (position*100) + '%)';
			rAF(draw);
		}

		rAF(draw);
	};

	return PlayerUI;
})();