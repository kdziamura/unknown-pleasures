window.Complex = (function() {
	var sinh = Math.sinh || function(number) {
		var temp = Math.exp(number);
		return (temp - 1/temp) / 2;
	};

	var cosh = Math.cosh || function(number) {
		var temp = Math.exp(number);
		return (temp + 1/temp) / 2;
	};

	function parsePart (string) {
		var number = parseFloat(string);
		if (isNaN(number)) {
			if (string.indexOf('-') !== -1) {
				number = -1;
			} else {
				number = 1;
			}
		}
		return number;
	};

	function registerAliases (options) {
		var method, i, aliases, alias;
		for (method in options) {
			aliases = options[method];
			for (i = 0; i < aliases.length; i++) {
				alias = aliases[i];
				Complex.prototype[alias] = Complex.prototype[method];
			}
		}
	};

	function Complex (re, im) {
		if (this instanceof Complex) {
			this.re = re;
			this.im = im !== undefined ? im : 0;
		} else if (im === undefined) {
			if (re instanceof Complex) {
				return re.copy();
			} else if (typeof re === 'number') {
				return new Complex(re);
			} else if (typeof re === 'string') {
				return Complex.fromString(re);
			}
		} else {
			return new Complex(re, im);
		};
	};

	Complex.toComplex = function (number) {
		if (number instanceof Complex) {
			return number;
		} else {
			return new Complex(number);
		}
	};

	Complex.fromPolar = function (r, phi) {
		var re = r * Math.cos(phi),
			im = r * Math.sin(phi);
		return new Complex(re, im);
	};

	Complex.fromString = function (string) {
		var complexRegexp = /([-+]?(?:\d*\.?\d+)?i)|([-+]?\d*\.?\d+)/g,
			values = string.match(complexRegexp),
			i, value,
			re = 0,
			im = 0;

		for (i = 0; i < values.length; i++) {
			value = parsePart(values[i]);
			if (values[i].indexOf('i') !== -1) {
				im += value;
			} else {
				re += value;
			}
		}

		return new Complex(re, im);
	};

	Complex.prototype = {
		copy: function() {
			return new Complex(this.re, this.im);
		},

		add: function(number) {
			var complex = Complex.toComplex(number);

			this.re += complex.re;
			this.im += complex.im;

			return this;
		},

		sub: function(number) {
			var complex = Complex.toComplex(number);

			this.re -= complex.re;
			this.im -= complex.im;

			return this;
		},

		mul: function(number) {
			var complex = Complex.toComplex(number);

			var a = this.re,
				b = this.im,
				c = complex.re,
				d = complex.im;

			this.re = a * c - b * d;
			this.im = b * c + a * d;

			return this;
		},

		div: function(number) {
			var complex = Complex.toComplex(number);

			var a = this.re,
				b = this.im,
				c = complex.re,
				d = complex.im,
				divider = c * c + d * d,
				result;

			if (a === 1 && b === 0) {
				this.re = c / divider;
				this.im = -(d / divider);
			} else {
				this.re = (a * c + b * d) / divider;
				this.im = (b * c - a * d) / divider;
			}

			return this;
		},

		conj: function() {
			this.im = -this.im;
			return this;
		},

		pow: function(number) {
			var complex = Complex.toComplex(number);

			var x = Complex(Math.log(this.abs()), Math.atan2(this.im, this.re)).mul(complex),
				r = Math.exp(x.re);

			this.re = r * Math.cos(x.im);
			this.im = r * Math.sin(x.im);

			return this;
		},

		sqrt: function() {
			var r = this.abs(),
				re, im;

			if (this.re >= 0) {
				re = 0.5 * Math.sqrt(2 * (r + this.re));
			} else {
				re = Math.abs(this.im) / Math.sqrt(2 * (r - this.re));
			}

			if (this.re <= 0) {
				im = 0.5 * Math.sqrt(2 * (r - this.re));
			} else {
				im = Math.abs(this.im) / Math.sqrt(2 * (r + this.re));
			}

			if (this.im >= 0) {
				this.re = re;
				this.im = im;
			} else {
				this.re = re;
				this.im = -im;
			}

			return this;
		},

		neg: function() {
			this.re = -this.re;
			this.im = -this.im;
			return this;
		},

		sin: function() {
			var re = this.re,
				im = this.im;

			this.re = Math.sin(re) * cosh(im);
			this.im = Math.cos(re) * sinh(im);
			return this;
		},

		cos: function() {
			var re = this.re,
				im = this.im;

			this.re = Math.cos(re) * cosh(im);
			this.im = - Math.sin(re) * sinh(im);
			return this;
		},

		sinh: function() {
			var re = this.re,
				im = this.im;

			this.re = sinh(re) * Math.cos(im);
			this.im = cosh(re) * Math.sin(im);
			return this;
		},

		cosh: function() {
			var re = this.re,
				im = this.im;

			this.re = cosh(re) * Math.cos(im);
			this.im = sinh(re) * Math.sin(im);
			return this;
		},

		tan: function() {
			var re = this.re,
				im = this.im,
				divider = Math.cos(2 * re) + cosh(2 * im);
			
			this.re = Math.sin(2 * re) / divider;
			this.im = sinh(2 * im) / divider;
			return this;
		},

		tanh: function() {
			var re = this.re,
				im = this.im,
				divider = cosh(2 * a) + Math.cos(2 * b);
			
			this.re = sinh(2 * re) / divider;
			this.im = Math.sin(2 * im) / divider;
			return this;
		},

		log: function(base) {
			var re, im;

			base = base || 0;

			re = Math.log(this.abs());
			im = this.arg() + base * 2 * Math.PI;

			this.re = re;
			this.im = im;

			return this;
		},

		exp: function() {
			var complex = Complex.fromPolar(Math.exp(this.real), this.im);
			this.re = complex.re;
			this.im = complex.im;

			return this;
		},

		abs: function() {
			return Math.sqrt(this.re * this.re + this.im * this.im);
		},

		arg: function() {
			return Math.atan2(this.im, this.re);
		},

		is: function(number) {
			var complex = Complex.toComplex(number);

			return this.re === complex.re && this.im === complex.im;
		},

		toString: function() {
			var text = '',
				re = this.re,
				im = this.im;

			if (re !== 0) {
				text += re;
			}
			
			if (im > 0) {
				text += (re === 0 ? '' : '+') + (im === 1 ? '' : im) + 'i';
			} else if (im < 0) {
				text += im + 'i';
			}

			return text || '0';
		}
	};

	var aliases = {
		arg: ['angle', 'phase'],
		copy: ['clone']
	};

	registerAliases(aliases);


	return Complex;
})();