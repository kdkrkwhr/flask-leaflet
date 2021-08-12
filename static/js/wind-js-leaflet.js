'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

L.DomUtil.setTransform = L.DomUtil.setTransform || function (el, offset, scale) {
	var pos = offset || new L.Point(0, 0);

	el.style[L.DomUtil.TRANSFORM] = (L.Browser.ie3d ? 'translate(' + pos.x + 'px,' + pos.y + 'px)' : 'translate3d(' + pos.x + 'px,' + pos.y + 'px,0)') + (scale ? ' scale(' + scale + ')' : '');
};

L.CanvasLayer = (L.Layer ? L.Layer : L.Class).extend({
	initialize: function initialize(options) {
		this._map = null;
		this._canvas = null;
		this._frame = null;
		this._delegate = null;
		L.setOptions(this, options);
	},

	delegate: function delegate(del) {
		this._delegate = del;
		return this;
	},

	needRedraw: function needRedraw() {
		if (!this._frame) {
			this._frame = L.Util.requestAnimFrame(this.drawLayer, this);
		}
		return this;
	},

	_onLayerDidResize: function _onLayerDidResize(resizeEvent) {
		this._canvas.width = resizeEvent.newSize.x;
		this._canvas.height = resizeEvent.newSize.y;
	},
	_onLayerDidMove: function _onLayerDidMove() {
		var topLeft = this._map.containerPointToLayerPoint([0, 0]);
		L.DomUtil.setPosition(this._canvas, topLeft);
		this.drawLayer();
	},
	getEvents: function getEvents() {
		var events = {
			resize: this._onLayerDidResize,
			moveend: this._onLayerDidMove
		};
		if (this._map.options.zoomAnimation && L.Browser.any3d) {
			events.zoomanim = this._animateZoom;
		}

		return events;
	},
	onAdd: function onAdd(map) {
		this._map = map;
		this._canvas = L.DomUtil.create('canvas', 'leaflet-layer');
		this.tiles = {};

		var size = this._map.getSize();
		this._canvas.width = size.x;
		this._canvas.height = size.y;

		var animated = this._map.options.zoomAnimation && L.Browser.any3d;
		L.DomUtil.addClass(this._canvas, 'leaflet-zoom-' + (animated ? 'animated' : 'hide'));

		map._panes.overlayPane.appendChild(this._canvas);

		map.on(this.getEvents(), this);

		var del = this._delegate || this;
		del.onLayerDidMount && del.onLayerDidMount();
		this.needRedraw();
	},

	onRemove: function onRemove(map) {
		var del = this._delegate || this;
		del.onLayerWillUnmount && del.onLayerWillUnmount();


		map.getPanes().overlayPane.removeChild(this._canvas);

		map.off(this.getEvents(), this);

		this._canvas = null;
	},

	addTo: function addTo(map) {
		map.addLayer(this);
		return this;
	},
	LatLonToMercator: function LatLonToMercator(latlon) {
		return {
			x: latlon.lng * 6378137 * Math.PI / 180,
			y: Math.log(Math.tan((90 + latlon.lat) * Math.PI / 360)) * 6378137
		};
	},

	drawLayer: function drawLayer() {
		var size = this._map.getSize();
		var bounds = this._map.getBounds();
		var zoom = this._map.getZoom();

		var center = this.LatLonToMercator(this._map.getCenter());
		var corner = this.LatLonToMercator(this._map.containerPointToLatLng(this._map.getSize()));

		var del = this._delegate || this;
		del.onDrawLayer && del.onDrawLayer({
			layer: this,
			canvas: this._canvas,
			bounds: bounds,
			size: size,
			zoom: zoom,
			center: center,
			corner: corner
		});
		this._frame = null;
	},
	_setTransform: function _setTransform(el, offset, scale) {
		var pos = offset || new L.Point(0, 0);

		el.style[L.DomUtil.TRANSFORM] = (L.Browser.ie3d ? 'translate(' + pos.x + 'px,' + pos.y + 'px)' : 'translate3d(' + pos.x + 'px,' + pos.y + 'px,0)') + (scale ? ' scale(' + scale + ')' : '');
	},

	_animateZoom: function _animateZoom(e) {
		var scale = this._map.getZoomScale(e.zoom);
		var offset = L.Layer ? this._map._latLngToNewLayerPoint(this._map.getBounds().getNorthWest(), e.zoom, e.center) : this._map._getCenterOffset(e.center)._multiplyBy(-scale).subtract(this._map._getMapPanePos());

		L.DomUtil.setTransform(this._canvas, offset, scale);
	}
});

L.canvasLayer = function () {
	return new L.CanvasLayer();
};

var Windy = function Windy(params) {

	var VELOCITY_SCALE = 0.005 * (Math.pow(window.devicePixelRatio, 1 / 3) || 1);
	var MIN_TEMPERATURE_K = 261.15;
	var MAX_TEMPERATURE_K = 317.15;
	var MAX_PARTICLE_AGE = 90; 
	var PARTICLE_LINE_WIDTH = 1;
	var PARTICLE_MULTIPLIER = 1 / 200;
	var PARTICLE_REDUCTION = Math.pow(window.devicePixelRatio, 1 / 3) || 1.6;
	var FRAME_RATE = 15,
	    FRAME_TIME = 1000 / FRAME_RATE;

	var NULL_WIND_VECTOR = [NaN, NaN, null];

	var builder;
	var grid;
	var date;
	var λ0, φ0, Δλ, Δφ, ni, nj;

	var bilinearInterpolateVector = function bilinearInterpolateVector(x, y, g00, g10, g01, g11) {
		var rx = 1 - x;
		var ry = 1 - y;
		var a = rx * ry,
		    b = x * ry,
		    c = rx * y,
		    d = x * y;
		var u = g00[0] * a + g10[0] * b + g01[0] * c + g11[0] * d;
		var v = g00[1] * a + g10[1] * b + g01[1] * c + g11[1] * d;
		var tmp = g00[2] * a + g10[2] * b + g01[2] * c + g11[2] * d;
		return [u, v, tmp];
	};

	var createWindBuilder = function createWindBuilder(uComp, vComp, temp) {
		var uData = uComp.data,
		    vData = vComp.data;
		return {
			header: uComp.header,
			data: function data(i) {
				return [uData[i], vData[i], temp.data[i]];
			},
			interpolate: bilinearInterpolateVector
		};
	};

	var createBuilder = function createBuilder(data) {
		var uComp = null,
		    vComp = null,
		    temp = null,
		    scalar = null;

		data.forEach(function (record) {
			switch (record.header.parameterCategory + "," + record.header.parameterNumber) {
				case "2,2":
					uComp = record;break;
				case "2,3":
					vComp = record;break;
				case "0,0":
					temp = record;break;
				default:
					scalar = record;
			}
		});

		return createWindBuilder(uComp, vComp, temp);
	};

	var buildGrid = function buildGrid(data, callback) {
		builder = createBuilder(data);
		var header = builder.header;

		λ0 = header.lo1;
		φ0 = header.la1;

		Δλ = header.dx;
		Δφ = header.dy;

		ni = header.nx;
		nj = header.ny;

		date = new Date(header.refTime);
		date.setHours(date.getHours() + header.forecastTime);

		grid = [];
		var p = 0;
		var isContinuous = Math.floor(ni * Δλ) >= 360;

		for (var j = 0; j < nj; j++) {
			var row = [];
			for (var i = 0; i < ni; i++, p++) {
				row[i] = builder.data(p);
			}
			if (isContinuous) {
				row.push(row[0]);
			}
			grid[j] = row;
		}

		callback({
			date: date,
			interpolate: interpolate
		});
	};

	var interpolate = function interpolate(λ, φ) {
		if (!grid) return null;

		var i = floorMod(λ - λ0, 360) / Δλ;
		var j = (φ0 - φ) / Δφ;

		var fi = Math.floor(i),
		    ci = fi + 1;
		var fj = Math.floor(j),
		    cj = fj + 1;

		var row;
		if (row = grid[fj]) {
			var g00 = row[fi];
			var g10 = row[ci];
			if (isValue(g00) && isValue(g10) && (row = grid[cj])) {
				var g01 = row[fi];
				var g11 = row[ci];
				if (isValue(g01) && isValue(g11)) {
					return builder.interpolate(i - fi, j - fj, g00, g10, g01, g11);
				}
			}
		}
		return null;
	};

	var isValue = function isValue(x) {
		return x !== null && x !== undefined;
	};

	var floorMod = function floorMod(a, n) {
		return a - n * Math.floor(a / n);
	};

	var clamp = function clamp(x, range) {
		return Math.max(range[0], Math.min(x, range[1]));
	};

	var isMobile = function isMobile() {
		return (/android|blackberry|iemobile|ipad|iphone|ipod|opera mini|webos/i.test(navigator.userAgent)
		);
	};

	var distort = function distort(projection, λ, φ, x, y, scale, wind, windy) {
		var u = wind[0] * scale;
		var v = wind[1] * scale;
		var d = distortion(projection, λ, φ, x, y, windy);

		wind[0] = d[0] * u + d[2] * v;
		wind[1] = d[1] * u + d[3] * v;
		return wind;
	};

	var distortion = function distortion(projection, λ, φ, x, y, windy) {
		var τ = 2 * Math.PI;
		var H = Math.pow(10, -5.2);
		var hλ = λ < 0 ? H : -H;
		var hφ = φ < 0 ? H : -H;

		var pλ = project(φ, λ + hλ, windy);
		var pφ = project(φ + hφ, λ, windy);

		var k = Math.cos(φ / 360 * τ);
		return [(pλ[0] - x) / hλ / k, (pλ[1] - y) / hλ / k, (pφ[0] - x) / hφ, (pφ[1] - y) / hφ];
	};

	var createField = function createField(columns, bounds, callback) {

		function field(x, y) {
			if (!columns) return [NaN, NaN, null];
			var column = columns[Math.round(x)];
			return column && column[Math.round(y)] || NULL_WIND_VECTOR;
		}

		field.release = function () {
			columns = [];
		};

		field.randomize = function (o) {
			var x, y;
			var safetyNet = 0;
			do {
				x = Math.round(Math.floor(Math.random() * bounds.width) + bounds.x);
				y = Math.round(Math.floor(Math.random() * bounds.height) + bounds.y);
			} while (field(x, y)[2] === null && safetyNet++ < 30);
			o.x = x;
			o.y = y;
			return o;
		};

		callback(bounds, field);
	};

	var buildBounds = function buildBounds(bounds, width, height) {
		var upperLeft = bounds[0];
		var lowerRight = bounds[1];
		var x = Math.round(upperLeft[0]);
		var y = Math.max(Math.floor(upperLeft[1], 0), 0);
		var xMax = Math.min(Math.ceil(lowerRight[0], width), width - 1);
		var yMax = Math.min(Math.ceil(lowerRight[1], height), height - 1);
		return { x: x, y: y, xMax: width, yMax: yMax, width: width, height: height };
	};

	var deg2rad = function deg2rad(deg) {
		return deg / 180 * Math.PI;
	};

	var rad2deg = function rad2deg(ang) {
		return ang / (Math.PI / 180.0);
	};

	var invert = function invert(x, y, windy) {
		var mapLonDelta = windy.east - windy.west;
		var worldMapRadius = windy.width / rad2deg(mapLonDelta) * 360 / (2 * Math.PI);
		var mapOffsetY = worldMapRadius / 2 * Math.log((1 + Math.sin(windy.south)) / (1 - Math.sin(windy.south)));
		var equatorY = windy.height + mapOffsetY;
		var a = (equatorY - y) / worldMapRadius;

		var lat = 180 / Math.PI * (2 * Math.atan(Math.exp(a)) - Math.PI / 2);
		var lon = rad2deg(windy.west) + x / windy.width * rad2deg(mapLonDelta);
		return [lon, lat];
	};

	var mercY = function mercY(lat) {
		return Math.log(Math.tan(lat / 2 + Math.PI / 4));
	};

	var project = function project(lat, lon, windy) {
		var ymin = mercY(windy.south);
		var ymax = mercY(windy.north);
		var xFactor = windy.width / (windy.east - windy.west);
		var yFactor = windy.height / (ymax - ymin);

		var y = mercY(deg2rad(lat));
		var x = (deg2rad(lon) - windy.west) * xFactor;
		var y = (ymax - y) * yFactor;
		return [x, y];
	};

	var interpolateField = function interpolateField(grid, bounds, extent, callback) {

		var projection = {};

		var mapArea = (extent.south - extent.north) * (extent.west - extent.east);
		var velocityScale = VELOCITY_SCALE * Math.pow(mapArea, 0.3);

		var columns = [];
		var x = bounds.x;

		function interpolateColumn(x) {
			var column = [];
			for (var y = bounds.y; y <= bounds.yMax; y += 2) {
				var coord = invert(x, y, extent);
				if (coord) {
					var λ = coord[0],
					    φ = coord[1];
					if (isFinite(λ)) {
						var wind = grid.interpolate(λ, φ);
						if (wind) {
							wind = distort(projection, λ, φ, x, y, velocityScale, wind, extent);
							column[y + 1] = column[y] = wind;
						}
					}
				}
			}
			columns[x + 1] = columns[x] = column;
		}

		for (; x < bounds.width; x += 2) {
			interpolateColumn(x);
		}
		createField(columns, bounds, callback);
	};

	var particles, animationLoop;
	var animate = function animate(bounds, field, extent) {

		function asColorStyle(r, g, b, a) {
			return "rgba(" + 243 + ", " + 243 + ", " + 238 + ", " + a + ")";
		}

		function hexToR(h) {
			return parseInt(cutHex(h).substring(0, 2), 16);
		}
		function hexToG(h) {
			return parseInt(cutHex(h).substring(2, 4), 16);
		}
		function hexToB(h) {
			return parseInt(cutHex(h).substring(4, 6), 16);
		}
		function cutHex(h) {
			return h.charAt(0) == "#" ? h.substring(1, 7) : h;
		}

		function windTemperatureColorScale(minTemp, maxTemp) {

			var result = ["rgb(36,104, 180)", "rgb(60,157, 194)", "rgb(128,205,193 )", "rgb(151,218,168 )", "rgb(198,231,181)", "rgb(238,247,217)", "rgb(255,238,159)", "rgb(252,217,125)", "rgb(255,182,100)", "rgb(252,150,75)", "rgb(250,112,52)", "rgb(245,64,32)", "rgb(237,45,28)", "rgb(220,24,32)", "rgb(180,0,35)"];
			result.indexFor = function (m) {
				return Math.max(0, Math.min(result.length - 1, Math.round((m - minTemp) / (maxTemp - minTemp) * (result.length - 1))));
			};
			return result;
		}

		var colorStyles = windTemperatureColorScale(MIN_TEMPERATURE_K, MAX_TEMPERATURE_K);
		var buckets = colorStyles.map(function () {
			return [];
		});
		var mapArea = (extent.south - extent.north) * (extent.west - extent.east);
		var particleCount = Math.round(bounds.width * bounds.height * PARTICLE_MULTIPLIER * Math.pow(mapArea, 0.24));
		if (isMobile()) {
			particleCount /= PARTICLE_REDUCTION;
		}

		particles = particles || [];
		if (particles.length > particleCount) particles = particles.slice(0, particleCount);
		for (var i = particles.length; i < particleCount; i++) {
			particles.push(field.randomize({ age: ~~(Math.random() * MAX_PARTICLE_AGE) + 0 }));
		}

		function evolve() {
			buckets.forEach(function (bucket) {
				bucket.length = 0;
			});
			particles.forEach(function (particle) {
				if (particle.age > MAX_PARTICLE_AGE) {
					field.randomize(particle).age = ~~(Math.random() * MAX_PARTICLE_AGE / 2);
				}
				var x = particle.x;
				var y = particle.y;
				var v = field(x, y);
				var m = v[2];
				if (m === null) {
					particle.age = MAX_PARTICLE_AGE;
				} else {
					var xt = x + v[0];
					var yt = y + v[1];
					if (field(xt, yt)[0] !== null) {
						particle.xt = xt;
						particle.yt = yt;
						buckets[colorStyles.indexFor(m)].push(particle);
					} else {
						particle.x = xt;
						particle.y = yt;
					}
				}
				particle.age += 1;
			});
		}

		var g = params.canvas.getContext("2d");
		g.lineWidth = PARTICLE_LINE_WIDTH;

		function draw() {
			g.save();
			g.globalAlpha = .16;
			g.globalCompositeOperation = 'destination-out';
			g.fillStyle = '#000';
			g.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
			g.restore();

			buckets.forEach(function (bucket, i) {
				if (bucket.length > 0) {
					g.beginPath();
					g.strokeStyle = colorStyles[i];
					bucket.forEach(function (particle) {
						g.moveTo(particle.x, particle.y);
						g.lineTo(particle.xt, particle.yt);
						particle.x = particle.xt;
						particle.y = particle.yt;
					});
					g.stroke();
				}
			});
		}

		var then = Date.now();
		(function frame() {
			animationLoop = requestAnimationFrame(frame);
			var now = Date.now();
			var delta = now - then;
			if (delta > FRAME_TIME) {
				then = now - delta % FRAME_TIME;
				evolve();
				draw();
			}
		})();
	};

	var updateData = function updateData(data, bounds, width, height, extent) {
		delete params.data;
		params.data = data;
		if (extent) start(bounds, width, height, extent);
	};

	var start = function start(bounds, width, height, extent) {
		var mapBounds = {
			south: deg2rad(extent[0][1]),
			north: deg2rad(extent[1][1]),
			east: deg2rad(extent[1][0]),
			west: deg2rad(extent[0][0]),
			width: width,
			height: height
		};
		stop();
		buildGrid(params.data, function (grid) {
			interpolateField(grid, buildBounds(bounds, width, height), mapBounds, function (bounds, field) {
				windy.field = field;
				animate(bounds, field, mapBounds);
			});
		});
	};

	var stop = function stop() {
		if (windy.field) windy.field.release();
		if (animationLoop) cancelAnimationFrame(animationLoop);
	};

	var shift = function shift(dx, dy) {
		var canvas = params.canvas,
		    w = canvas.width,
		    h = canvas.height,
		    ctx = canvas.getContext("2d");
		if (w > dx && h > dy) {
			var clamp = function clamp(high, value) {
				return Math.max(0, Math.min(high, value));
			};
			var imageData = ctx.getImageData(clamp(w, -dx), clamp(h, -dy), clamp(w, w - dx), clamp(h, h - dy));
			ctx.clearRect(0, 0, w, h);
			ctx.putImageData(imageData, clamp(w, dx), clamp(h, dy));
			for (var i = 0, pLength = particles.length; i < pLength; i++) {
				particles[i].x += dx;
				particles[i].y += dy;
			}
		}
	};

	var windy = {
		params: params,
		start: start,
		stop: stop,
		update: updateData,
		shift: shift,
		createField: createField,
		interpolatePoint: interpolate
	};

	return windy;
};

window.requestAnimationFrame = function () {
	return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function (callback) {
		return window.setTimeout(callback, 1000 / FRAME_RATE);
	};
}();

if (!window.cancelAnimationFrame) {
	window.cancelAnimationFrame = function (id) {
		clearTimeout(id);
	};
}
L.Control.WindPosition = L.Control.extend({

	options: {
		position: 'bottomleft',
		emptyString: 'Unavailable'
	},

	onAdd: function onAdd(map) {
		this._container = L.DomUtil.create('div', 'leaflet-control-wind-position');
		L.DomEvent.disableClickPropagation(this._container);
		map.on('mousemove', this._onMouseMove, this);
		this._container.innerHTML = this.options.emptyString;
		return this._container;
	},

	onRemove: function onRemove(map) {
		map.off('mousemove', this._onMouseMove, this);
	},

	vectorToSpeed: function vectorToSpeed(uMs, vMs) {
		var windAbs = Math.sqrt(Math.pow(uMs, 2) + Math.pow(vMs, 2));
		return windAbs;
	},

	vectorToDegrees: function vectorToDegrees(uMs, vMs) {
		var windAbs = Math.sqrt(Math.pow(uMs, 2) + Math.pow(vMs, 2));
		var windDirTrigTo = Math.atan2(uMs / windAbs, vMs / windAbs);
		var windDirTrigToDegrees = windDirTrigTo * 180 / Math.PI;
		var windDirTrigFromDegrees = windDirTrigToDegrees + 180;
		return windDirTrigFromDegrees.toFixed(3);
	},

	_onMouseMove: function _onMouseMove(e) {

		var self = this;
		var pos = this.options.WindJSLeaflet._map.containerPointToLatLng(L.point(e.containerPoint.x, e.containerPoint.y));
		var gridValue = this.options.WindJSLeaflet._windy.interpolatePoint(pos.lng, pos.lat);
		var htmlOut = "";

		if (gridValue && !isNaN(gridValue[0]) && !isNaN(gridValue[1]) && gridValue[2]) {

			var vMs = gridValue[1];
			vMs = vMs > 0 ? vMs = vMs - vMs * 2 : Math.abs(vMs);

			htmlOut = "<strong style='color: white;'>풍향: " + self.vectorToDegrees(gridValue[0], vMs) + "°, </strong>" + 
				"<strong style='color: white;'>풍속: " + self.vectorToSpeed(gridValue[0], vMs).toFixed(1) + "m/s, </strong>" + 
				"<strong style='color: white;'>온도: " + (gridValue[2] - 273.15).toFixed(1) + "°C</strong>";
		} else {
			htmlOut = "NA";
		}

		self._container.innerHTML = htmlOut;
		if ($('.leaflet-control-wind-position').index() == 0) {
			$('.leaflet-control-wind-position').insertAfter('.leaflet-control-mouseposition');
		}
	}

});

L.Map.mergeOptions({
	positionControl: false
});

L.Map.addInitHook(function () {
	if (this.options.positionControl) {
		this.positionControl = new L.Control.MousePosition();
		this.addControl(this.positionControl);
	}
});

L.control.windPosition = function (options) {
	return new L.Control.WindPosition(options);
};

(function (root, factory) {
	if ((typeof exports === 'undefined' ? 'undefined' : _typeof(exports)) === 'object') {

		module.exports = factory(require('wind-js-leaflet'));
	} else if (typeof define === 'function' && define.amd) {
		define(['wind-js-leaflet'], function (WindJSLeaflet) {
			return root.returnExportsGlobal = factory(window);
		});
	} else {
		window.WindJSLeaflet = factory(window);
	}
})(undefined, function (window) {

	'use strict';

	var WindJSLeaflet = {
		_map: null,
		_data: null,
		_options: null,
		_canvasLayer: null,
		_windy: null,
		_context: null,
		_timer: 0,
		_mouseControl: null,

		init: function init(options) {

			WindJSLeaflet._checkWind(options).then(function () {

				WindJSLeaflet._map = options.map;
				WindJSLeaflet._options = options;

				WindJSLeaflet._canvasLayer = L.canvasLayer().delegate(WindJSLeaflet);
				WindJSLeaflet._options.layerControl.addOverlay(WindJSLeaflet._canvasLayer, options.overlayName || 'wind');

				WindJSLeaflet._map.on('overlayremove', function (e) {
					if (e.layer == WindJSLeaflet._canvasLayer) {
						WindJSLeaflet._destroyWind();
					}
				});
			}).catch(function (err) {
				console.log('err');
				WindJSLeaflet._options.errorCallback(err);
			});
		},

		setTime: function setTime(timeIso) {
			WindJSLeaflet._options.timeISO = timeIso;
		},

		_checkWind: function _checkWind(options) {
			return new Promise(function (resolve, reject) {
				if (options.localMode) resolve(true);
				$.ajax({
					type: 'GET',
					url: options.pingUrl,
					error: function error(err) {
						reject(err);
					},
					success: function success(data) {
						resolve(data);
					}
				});
			});
		},

		_getRequestUrl: function _getRequestUrl() {

			if (!this._options.useNearest) {
				return this._options.latestUrl;
			}

			var params = {
				"timeIso": this._options.timeISO || new Date().toISOString(),
				"searchLimit": this._options.nearestDaysLimit || 7 
			};

			return this._options.nearestUrl + '?' + $.param(params);
		},

		_loadLocalData: function _loadLocalData() {

			console.log('using local data..');

			$.getJSON('../static/json/wind.json', function (data) {
				WindJSLeaflet._data = data;
				WindJSLeaflet._initWindy(data);
			});
		},

		_loadWindData: function _loadWindData() {

			if (this._options.localMode) {
				this._loadLocalData();
				return;
			}

			var request = this._getRequestUrl();
			console.log(request);

			$.ajax({
				type: 'GET',
				url: request,
				error: function error(err) {
					console.log('error loading data');
					WindJSLeaflet._options.errorCallback(err) || console.log(err);
					WindJSLeaflet._loadLocalData();
				},
				success: function success(data) {
					console.log("data suc");
					WindJSLeaflet._data = data;
					WindJSLeaflet._initWindy(data);
				}
			});
		},

		onDrawLayer: function onDrawLayer(overlay, params) {
			if (!WindJSLeaflet._windy) {
				WindJSLeaflet._loadWindData();
				return;
			}

			if (this._timer) clearTimeout(WindJSLeaflet._timer);

			this._timer = setTimeout(function () {

				var bounds = WindJSLeaflet._map.getBounds();
				var size = WindJSLeaflet._map.getSize();

				WindJSLeaflet._windy.start([[0, 0], [size.x, size.y]], size.x, size.y, [[bounds._southWest.lng, bounds._southWest.lat], [bounds._northEast.lng, bounds._northEast.lat]]);
			}, 750);
		},

		_initWindy: function _initWindy(data) {

			this._windy = new Windy({ canvas: WindJSLeaflet._canvasLayer._canvas, data: data });

			this._context = this._canvasLayer._canvas.getContext('2d');
			this._canvasLayer._canvas.classList.add("wind-overlay");
			this.onDrawLayer();

			this._map.on('dragstart', WindJSLeaflet._windy.stop);
			this._map.on('zoomstart', WindJSLeaflet._clearWind);
			this._map.on('resize', WindJSLeaflet._clearWind);

			this._initMouseHandler();
		},

		_initMouseHandler: function _initMouseHandler() {
			if (!this._mouseControl && this._options.displayValues) {
				var options = this._options.displayOptions || {};
				options['WindJSLeaflet'] = WindJSLeaflet;
				this._mouseControl = L.control.windPosition(options).addTo(this._map);
			}
		},

		_clearWind: function _clearWind() {
			if (this._windy) this._windy.stop();
			if (this._context) this._context.clearRect(0, 0, 3000, 3000);
		},

		_destroyWind: function _destroyWind() {
			if (this._timer) clearTimeout(this._timer);
			if (this._windy) this._windy.stop();
			if (this._context) this._context.clearRect(0, 0, 3000, 3000);
			if (this._mouseControl) this._map.removeControl(this._mouseControl);
			this._mouseControl = null;
			this._windy = null;
			this._map.removeLayer(this._canvasLayer);
		}

	};

	return WindJSLeaflet;
});