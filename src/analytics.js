
/*! CCL-Tracker v0.1 | Ioannis Charalampidis, Citizen Cyberlab EU Project | GNU GPL v2.0 License */

/**
 * Pick an initiator function according to AMD or stand-alone loading
 */
( window.define == undefined ? function(fn) { window.analytics = fn(); } : window.define )(function() {

	/**
	 * Generate a tracking ID (An extension over GUID v4)
	 */
	function trackid() {
	  function s4() {
		return Math.floor((1 + Math.random()) * 0x10000)
			.toString(16)
			.substring(1);
		}
		var tid = "";
		for (var i=0; i<8; i++) {
			tid += s4();
		}
		return tid;
	}
	
	/**
	 * Analytics are initialized only on demand
	 */
	var Analytics = function() {

		// Prepare analytics stack
		this.stack = [];
		// Start by disabled
		this.enabled = false;
		// Start by being not expired
		this.expired = false;
		// Timestamp when the analytics class was initialized
		this.initializedAt = Date.now();
		// Wait 10 seconds until an analytics listener appears
		this.timeoutTime = this.initializedAt + 10000;
		// The analytics listener
		this.listener = null;
		// The debug flag
		this.debug = false;

		// Tracking session ID
		this.trackingID = null;

		// Timers
		this.timers = { };
		this.timerAccummulators = { };

		// Global properties
		this.globals = { };

		// Start probe timer
		this.probeTimer = setInterval(this.probeListener.bind(this), 100);

		// Initialize or resume a tracking session
		this.trackingID = this.getCookie("_ccl_tracking_id")
		if (!this.trackingID) {
			// Generate a tracking ID
			this.trackingID = trackid();
			// Store it as cookie
			this.createCookie("_ccl_tracking_id", this.trackingID, 365);
		}

		// Include trackid as a parameter
		this.globals['trackid'] = this.trackingID;

	}
	
	/**
	 * Create a cookie on the browser cookie store
	 */
	Analytics.prototype.createCookie = function(name, value, days) {
		var expires;
		if (days) {
			var date = new Date();
			date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
			expires = "; expires=" + date.toGMTString();
		}
		else {
			expires = "";
		}
		document.cookie = name + "=" + value + expires + "; path=/";
	}

	/**
	 * Fetch a cookie from browser cookie store
	 */
	Analytics.prototype.getCookie = function(c_name) {
		if (document.cookie.length > 0) {
			c_start = document.cookie.indexOf(c_name + "=");
			if (c_start != -1) {
				c_start = c_start + c_name.length + 1;
				c_end = document.cookie.indexOf(";", c_start);
				if (c_end == -1) {
					c_end = document.cookie.length;
				}
				return unescape(document.cookie.substring(c_start, c_end));
			}
		}
		return "";
	}

	/**
	 * Disable the analytics functionality entirely
	 */
	Analytics.prototype.disable = function() {
		// Mark as disabled and expired
		this.expired = true;
		this.enabled = false;
	}

	/**
	 * Trigger an analytics action
	 */
	Analytics.prototype.probeListener = function() {
		// Check if we are enabled or expired
		if (this.enabled || this.expired) return;

		// Check if we expired
		if (Date.now() > this.timeoutTime) {
			clearInterval(this.probeTimer);
			this.expired = true;
			this.stack = [];
			console.warn("Analytics: No back-end registered on time")
			return;
		}

		// Don't continue if there is no analytics listener
		if (!window.analyticsListener) return;

		// Stop probe timer
		clearInterval(this.probeTimer);
		// Keep reference of analytics listener
		this.listener = window.analyticsListener;
		// We are now enabled
		this.enabled = true;
		// Log
		if (this.debug)
			console.log("Analytics: Registered back-end");

		// Flush stack
		for (var i=0; i<this.stack.length; i++)
			this.send(this.stack[i][0], this.stack[i][1]);
		this.stack = [];

	}

	/**
	 * Trigger the analytics event
	 */
	Analytics.prototype.fireEvent = function( eventName, data, replace ) {

		// Check for listener
		this.probeListener();

		// If we are expired, exit
		if (this.expired) return;

		// Append globals
		if (!data) data={};
		for (k in this.globals)
			data[k] = this.globals[k];

		// Forward or stack it
		if (this.enabled) {
			this.send(eventName, data);
			// Debug log
		} else {
			// If action is already on stack, change it's data
			if (replace) {
				for (var i=0; i<this.stack.length; i++) {
					if (this.stack[i][0] == eventName) {
						this.stack[i] = [eventName, data];
						return;
					}
				}
			}
			// Otherwise, push on stack
			this.stack.push([eventName, data]);
			// Debug log
			if (this.debug)
				console.log("Analytics: Scheduling", eventName, data);
		}

	}

	/**
	 * Send the analytics event without the stack
	 */
	Analytics.prototype.send = function( eventName, data ) {

		// Append timestamp if missing
		if (data.ts == undefined)
			data.ts = Date.now();

		// Log seding actions
		if (this.debug)
			console.log("Analytics: Sending", eventName, data);

		// Fire the event listener
		if (this.listener) {
			try {
				// Backwards compatibility
				if (this.listener === true) {
					$(window).trigger('analytics.'+eventName, [data]);
				} else {
					// New version just calls the listener
					this.listener(eventName, data);
				}
			} catch (e) { };
		}
	}

	/**
	 * Set a global property
	 */
	Analytics.prototype.setGlobal = function( name, value ) {
		// Update global property
		this.globals[name] = value;
	}

	/**
	 * Freeze analytics timers
	 */
	Analytics.prototype.freeze = function() {
		// Snapshot all timers and place on accumulators
		for (name in this.timers) {
			// Collect duration till NOW on accummulators
			this.timerAccummulators[name] += (Date.now() - this.timers[name]);
		}
	}

	/**
	 * Thaw analytics timers
	 */
	Analytics.prototype.thaw = function() {
		// Restart all timers
		for (name in this.timers) {
			// Start counting from NOW
			this.timers[name] = Date.now();
		}
	}

	/**
	 * Start a timer with the given name
	 */
	Analytics.prototype.startTimer = function(name) {
		// If timer is already started, don't start
		if (this.timers[name] !== undefined) return;
		// Store the current time in the given timer
		this.timers[name] = Date.now();
		this.timerAccummulators[name] = 0;
	}

	/**
	 * Restart a timer with the given name
	 */
	Analytics.prototype.restartTimer = function(name) {
		// If we already have a timer, get current duration
		var duration = this.stopTimer(name);
		// Replace timer start time
		this.timers[name] = Date.now();
		this.timerAccummulators[name] = 0;
		// Return duration
		return duration;
	}

	/**
	 * Return the time on the specified timer
	 */
	Analytics.prototype.getTimer = function(name) {
		// Check for invalid timers
		if (!this.timers[name]) return 0;
		// Return duration
		return  (Date.now() - this.timers[name]) + this.timerAccummulators[name];
	}

	/**
	 * Stop a timer with the given name and return
	 * the time spent.
	 */
	Analytics.prototype.stopTimer = function(name) {
		// Check for invalid timers
		if (!this.timers[name]) return 0;
		// Stop timer and get duration
		var duration = (Date.now() - this.timers[name]) + this.timerAccummulators[name];
		delete this.timers[name];
		delete this.timerAccummulators[name];
		// Return duration
		return duration;
	}


	// Create and return an analytics instance
	var analytics = new Analytics();

	// Freeze analytics on window blur
	window.addEventListener('blur', function(ev) {
		analytics.freeze();
	});

	// Thaw analytics on window focus
	window.addEventListener('focus', function(ev) {
		analytics.thaw();
	});

	return analytics;

});
