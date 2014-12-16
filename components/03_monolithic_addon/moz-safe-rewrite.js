/*
 * --------------------------------------------------------
 * project
 *     name:    moz-safe-rewrite
 *     summary: Firefox add-on that functions as a light-weight (pseudo) rules-engine for easily modifying HTTP headers in either direction
 *     url:     https://github.com/warren-bank/moz-rewrite-amo
 * author
 *     name:    Warren R Bank
 *     email:   warren.r.bank@gmail.com
 *     url:     https://github.com/warren-bank
 * copyright
 *     notice:  Copyright (c) 2014, Warren Bank
 * license
 *     name:    GPLv2
 *     url:     http://www.gnu.org/licenses/gpl-2.0.txt
 * --------------------------------------------------------
 */

// ------------------------------------------------------------------------------------------------ global constants

const Ci			= Components.interfaces;
const Cc			= Components.classes;
const Cu			= Components.utils;
const Cr			= Components.results;

const OS			= Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService);
const CONSOLE		= Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");

// ------------------------------------------------------------------------------------------------ global helper functions

var helper_functions = {

	"console_log": function(text){
		CONSOLE.logStringMessage(text);
	},

	"wrap_console_log": function(prefix, is_disabled){
		var wrapper;

		wrapper			= function(text){
			if (
				(typeof text === 'string') &&
				(text) &&
				(! is_disabled)
			){
				helper_functions.console_log(prefix + text);
			}
			return (! is_disabled);
		};

		return wrapper;
	},

	"get_prefs": function(sub_branch_name) {
		var branch_name;

		branch_name		= "extensions.Moz-Safe-Rewrite." + (sub_branch_name? sub_branch_name : '');

		return Cc["@mozilla.org/preferences-service;1"]
				.getService(Ci.nsIPrefService)
				.getBranch(branch_name);
	},

	"get_object_constructor_name": function(o, lc){
		var name;

		if (
			(typeof o === 'object') &&
			(o !== null) &&
			(typeof o.constructor === 'function') &&
			(typeof o.constructor.name === 'string') &&
			(o.constructor.name)
		){
			name		= lc? o.constructor.name.toLowerCase() : o.constructor.name;
		}
		else {
			name		= null;
		}

		return name;
	}

};

// ------------------------------------------------------------------------------------------------ generic/minimal base class to assist with OO inheritance

/* Simple JavaScript Inheritance
 * By John Resig http://ejohn.org/
 * MIT Licensed.
 */
// http://ejohn.org/blog/simple-javascript-inheritance/
// Inspired by base2 and Prototype
var Class = (function(){
	var base_class;
	var initializing = false, fnTest = /xyz/.test(function(){xyz;}) ? /\b_super\b/ : /.*/;

	// The base Class implementation (does nothing)
	base_class = function(){};

	// Create a new Class that inherits from this class
	base_class.extend = function(prop) {
		var _super = this.prototype;

		// Instantiate a base class (but only create the instance,
		// don't run the init constructor)
		initializing = true;
		var prototype = new this();
		initializing = false;

		// Copy the properties over onto the new prototype
		for (var name in prop) {
			// Check if we're overwriting an existing function
			prototype[name] = typeof prop[name] == "function" &&
				typeof _super[name] == "function" && fnTest.test(prop[name]) ?
				(function(name, fn){
					return function() {
						var tmp = this._super;

						// Add a new ._super() method that is the same method
						// but on the super-class
						this._super = _super[name];

						// The method only need to be bound temporarily, so we
						// remove it when we're done executing
						var ret = fn.apply(this, arguments);
						this._super = tmp;

						return ret;
					};
				})(name, prop[name]) :
				prop[name];
		}

		// The dummy class constructor
		function Class() {
			// All construction is actually done in the init method
			if ( !initializing && this.init )
				this.init.apply(this, arguments);
		}

		// Populate our constructed prototype object
		Class.prototype = prototype;

		// Enforce the constructor to be what we expect
		Class.prototype.constructor = Class;

		// And make this class extendable
		Class.extend = arguments.callee;

		return Class;
	};
	return base_class;
})();

/*
 * quick test:
 */
(false) && (function(){
	var Person = Class.extend({
		init: function(isDancing){
			this.dancing = isDancing;
		}
	});

	var Ninja = Person.extend({
		init: function(){
			this._super( false );
		}
	});

	var p = new Person(true);
	console.log( 'person is dancing: ' + p.dancing ); // => true

	var n = new Ninja();
	console.log( 'ninja is dancing: ' + n.dancing ); // => false
})();

// ------------------------------------------------------------------------------------------------ worker classes: encapsulated logic, instantiated/called by XPCOM component
// ------------------------------------------------------------------------------------------------ "HTTP_Stream":

var HTTP_Stream = Class.extend({
	"init": function(auto_init){
		this.prefs			= helper_functions.get_prefs( (this.type + '.') );
		this.log			= helper_functions.wrap_console_log(('HTTP_' + this.type + '_stream: '), false);
		this.rules_file		= null;
		this.rules_data		= null;
		this.watch_timer	= null;
		this.debug			= null;

		if (auto_init){
			this.at_startup();
		}
	},

	"at_startup":	function(){
		var self = this;

		try {
			// sanity check
			if (
				(! self.type) ||
				(typeof self.type !== 'string') ||
				(['request','response'].indexOf(self.type) === -1)
			){
				throw new Error('HTTP_Stream: bad type');
			}

			// (re)initialize state
			self.rules_file		= null;
			self.rules_data		= null;
			self.watch_timer	= null;

			// check that this stream is enabled
			if (! self.is_enabled()){return;}

			// (re)initialize debugging loggers
			(function(){
				var is_disabled;
				is_disabled			= ( (helper_functions.get_prefs()).getBoolPref("debug") == false );
				self.debug			= helper_functions.wrap_console_log(('HTTP_' + self.type + '_stream: '), is_disabled);
			})();

			// get the rules file
			self.rules_file = self.get_rules_file();
			if (self.rules_file === null){return;}

			// read the contents of the rules file, and evaluate into javascript
			self.read_rules_file();

			// watch the rules file for updates
			self.watch_rules_file();
		}
		catch(e){
			self.log('(at_startup|error): ' + e.message);
		}
	},

	"is_enabled":	function(){
		return this.prefs.getBoolPref("enabled");
	},

	"get_rules_file_watch_interval":	function(){
		return this.prefs.getIntPref("rules_file.watch_interval");
	},

	"get_rules_file":	function(){
		var self = this;
		var rules_file = null;
		var rules_file_path, special_dirs_pattern, matches, special_dir, relative_path;

		try {
			if (self.prefs.prefHasUserValue("rules_file.path")) {
				rules_file_path		= self.prefs.getCharPref("rules_file.path");

				// trim leading/trailing whitespace
				rules_file_path		= rules_file_path.replace(/^\s+/,'').replace(/\s+$/,'');

				if (rules_file_path){
					special_dirs_pattern	= /^\{([^\}]+)\}[\/\\]?(.*)$/;
					matches					= special_dirs_pattern.exec(rules_file_path);
					if (matches === null){
						rules_file			= new FileUtils.File(rules_file_path);
					}
					else {
						special_dir			= matches[1];
						relative_path		= matches[2];

						if ( self.debug() ){
							self.debug('(get_rules_file|checkpoint|01): ' + 'special directory (root) path = "' + special_dir + '"');
							self.debug('(get_rules_file|checkpoint|02): ' + 'relative (file) path = "' + relative_path + '"');
						}

						rules_file			= FileUtils.getFile(special_dir, relative_path.split(/[\/\\]/), true);
					}

					if (
						(! rules_file.exists()) ||
						(! rules_file.isFile()) ||
						(! rules_file.isReadable())
					){
						throw new Error('file either does not exist or cannot be accessed' + ((rules_file && rules_file.path)? (': ' + rules_file.path) : ''));
					}
				}
			}
		}
		catch(e){
			self.log('(get_rules_file|prefs|error): ' + e.message);
			rules_file = null;
		}
		finally {
			return rules_file;
		}
	},

	"read_rules_file":	function(){
		var self = this;
		var file_text;

		try {
			NetUtil.asyncFetch(self.rules_file, function(inputStream, status) {
				if (!Components.isSuccessCode(status)) {
					throw new Error('status code is not successful');
				}

				file_text	= NetUtil.readInputStreamToString(inputStream, inputStream.available());
				self.debug() && self.debug('(read_rules_file|checkpoint|01): ' + file_text);

				self.evaluate_rules_file(file_text);
			});
		}
		catch(e){
			self.log('(read_rules_file|error): ' + e.message);
		}
	},

	"evaluate_rules_file":	function(file_text){
		var self = this;
		var rules_data;

		try {
			rules_data = JSON.parse(file_text);
			self.debug() && self.debug('(evaluate_rules_file|checkpoint|01): ' + JSON.stringify(rules_data));

			// sanity check
			if (
				(helper_functions.get_object_constructor_name(rules_data, true) !== 'array')
			){
				// not an array
				throw new Error('rules data set is a non-array data type: ' + (typeof rules_data));
			}
			else if (
				(rules_data.length === 0)
			){
				// empty array
				throw new Error('rules data set is an empty array');
			}
			else {
				// `rules_data` is a non-empty array
				// walk the data set to validate proper format.
				// at the same time, convert `url` attribute values into RegExp objects
				self.validate_rules_data(rules_data);
			}
		}
		catch(e){
			self.log('(evaluate_rules_file|parsing|error): ' + e.message);
			self.rules_data		= null;
		}
	},

	"validate_rules_data": function(raw_rules_data){
		var self = this;

		// * validate: `raw_rules_data`
		// * update: `rules_data`

		var sanitized_rules_data = [];
		var empty_string_pattern = /^\s+$/;
		var i, rule, sanitized_rule, count, header_key, header_value;

		nextRule: for (i=0; i<raw_rules_data.length; i++){
			rule = raw_rules_data[i];
			sanitized_rule = {};

			// rule is: object
			if (
				(typeof rule !== 'object') ||
				(rule === null)
			){continue nextRule;}

			try {
				rule.url = new RegExp(rule.url, 'i');
			}
			catch(e){}

			// rule.url is: regexp
			if (
				(helper_functions.get_object_constructor_name(rule.url, true) !== 'regexp')
			){continue nextRule;}
			sanitized_rule.url = rule.url;

			// rule.stop is: [undefined, boolean]
			switch(typeof rule.stop){
				case 'undefined':
					rule.stop = false;
					break;
				case 'boolean':
					break;
				default:
					continue nextRule;
			}
			sanitized_rule.stop = rule.stop;

			// rule.headers is: [object]
			switch(typeof rule.headers){
				case 'object':
					count = 0;
					sanitized_rule.headers = {};
					nextHeader: for (header_key in rule.headers){
						header_value = rule.headers[header_key];

						// header_value is: [boolean false, object null, string non-empty]
						switch(typeof header_value){
							case 'boolean':
								if (
									(header_value !== false)
								){continue nextHeader;}
								break;
							case 'object':
								if (
									(header_value !== null)
								){continue nextHeader;}
								break;
							case 'string':
								if (
									(header_value === '') ||
									(empty_string_pattern.test(header_value))
								){continue nextHeader;}
								break;
							default:
								continue nextHeader;
						}

						count++;
						sanitized_rule.headers[header_key] = header_value;
					}

					if (! count){continue nextRule;}
					break;
				default:
					continue nextRule;
			}

			// if the loop iteration has reaches this point, then `sanitized_rule` is valid
			sanitized_rules_data.push(sanitized_rule);
		}

		if (sanitized_rules_data.length){
			self.rules_data		= sanitized_rules_data;
		}
		else {
			self.rules_data		= null;
		}
	},

	"watch_rules_file":	function(){
		var self = this;
		var watch_interval = self.get_rules_file_watch_interval();
		var last_modified_timestamp;
		var timer_callback;

		// sanity check
		if (
			(typeof watch_interval !== 'number') ||
			(watch_interval <= 0)
		){return;}

		last_modified_timestamp = self.rules_file.lastModifiedTime;

		// https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsITimer
		// https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsITimerCallback
		self.watch_timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);

		timer_callback = {
			"notify": function(){
				// sanity check that file still exists
				if (
					(self.rules_file === null) ||
					(! self.rules_file.exists()) ||
					(! self.rules_file.isFile()) ||
					(! self.rules_file.isReadable())
				){
					// tempted to call:
					//     self.at_shutdown()
					// but want to preserve: timer, rules_file.
					// Just clear the rules data and continue to watch.
					// May want to adjust the interval of the timer. (ex: 10x the value stored in prefs)
					self.rules_data		= null;
					return;
				}

				var lmt = self.rules_file.lastModifiedTime;
				if (lmt !== last_modified_timestamp){
					last_modified_timestamp = lmt;
					self.read_rules_file();
				}
			}
		};

		self.watch_timer.initWithCallback(
			timer_callback,
			watch_interval,
			Ci.nsITimer.TYPE_REPEATING_SLACK
		);
	},

	"at_shutdown":	function(){
		var self = this;

		if (self.watch_timer){
			self.watch_timer.cancel();
		}

		self.rules_file		= null;
		self.rules_data		= null;
		self.watch_timer	= null;

		self.debug			= null;
	},

	"process_channel":	function(httpChannel){
		// abstract function
	},

	"process_channel_rules_data": function(url){
		var self = this;
		var updated_headers = {};

		// sanity check: is there any work to do?
		if (! self.rules_data){return;}

		var empty_string_pattern = /^\s+$/;
		var i, rule, local_headers, header_key, local_header_value, local_stop;

		nextRule: for (i=0; i<self.rules_data.length; i++){
			rule				= self.rules_data[i];
			local_headers		= null;
			local_header_value	= null;
			local_stop			= null;

			if (rule.url.test(url)){
				// matching rule

				switch(typeof rule.headers){
					case 'object':
						local_headers	= rule.headers;
						break;
					default:
						local_headers	= null;
						continue nextRule;
				}
				if (
					(typeof local_headers !== 'object') ||
					(local_headers === null)
				){continue nextRule;}

				nextHeader: for (header_key in local_headers){
					switch(typeof local_headers[header_key]){
						default:
							local_header_value	= local_headers[header_key];
							break;
					}
					switch(typeof local_header_value){
						case 'boolean':
							if (
								(local_header_value !== false)
							){continue nextHeader;}
							break;
						case 'object':
							if (
								(local_header_value !== null)
							){continue nextHeader;}
							break;
						case 'string':
							if (
								(local_header_value === '') ||
								(empty_string_pattern.test(local_header_value))
							){continue nextHeader;}
							break;
						default:
							continue nextHeader;
					}

					// header value is valid
					updated_headers[ header_key.toLowerCase() ] = local_header_value;
				}

				switch(typeof rule.stop){
					case 'boolean':
						local_stop		= rule.stop;
						break;
					default:
						local_stop		= false;
				}
				if (
					(typeof local_stop === 'boolean') &&
					(local_stop === true)
				){break nextRule;}

			}
		}

		return updated_headers;
	}

});

// ------------------------------------------------------------------------------------------------ "HTTP_Request_Stream":

var HTTP_Request_Stream = HTTP_Stream.extend({
	"init": function(auto_init){
		this.type		= 'request';
		this._super(auto_init);
	},

	"process_channel":	function(httpChannel){
		var self = this;
		var url, updated_headers, header_key, header_value;

		// sanity check: is there any work to do?
		if (! self.rules_data){return;}

		try {
			// get URL of the requested page, to match against regex patterns in the rules data
			url = httpChannel.URI.spec;

			updated_headers = self.process_channel_rules_data(url);

			if (updated_headers){
				nextHeader: for (header_key in updated_headers){
					header_value	= updated_headers[header_key];

					if (header_value === false){
						continue nextHeader;
					}
					else if (header_value === null){
						header_value = '';
						httpChannel.setRequestHeader(header_key, header_value, false);
					}
					else if (typeof header_value === 'string'){
						httpChannel.setRequestHeader(header_key, header_value, false);
					}
				}
			}
		}
		catch(e){
			self.log('(process_channel|error): ' + e.message);
		}
	}

});

// ------------------------------------------------------------------------------------------------ "HTTP_Response_Stream":

var HTTP_Response_Stream = HTTP_Stream.extend({
	"init": function(auto_init){
		this.type		= 'response';
		this._super(auto_init);
	},

	"process_channel":	function(httpChannel){
		var self = this;
		var url, updated_headers, header_key, header_value;

		// sanity check: is there any work to do?
		if (! self.rules_data){return;}

		try {
			// get URL of the requested page, to match against regex patterns in the rules data
			url = httpChannel.URI.spec;

			updated_headers = self.process_channel_rules_data(url);

			if (updated_headers){
				nextHeader: for (header_key in updated_headers){
					header_value	= updated_headers[header_key];

					if (header_value === false){
						continue nextHeader;
					}
					if (header_value === null){
						header_value = '';
					}
					if (typeof header_value === 'string'){
						try {
							httpChannel.setResponseHeader(header_key, header_value, false);
						}
						catch(e){
							if ( self.debug() ){
								self.debug('(process_channel|error|summary): ' + 'unable to modify value of HTTP Response header = ' + header_key);
								self.debug('(process_channel|error|message): ' + e.message);
							}

							// throws Exception
							(function(){
								// apply special handlers for specific headers, which cannot be "set" using the above API method
								var channel_attribute;

								switch(header_key){
									case 'content-type':
										channel_attribute	= 'contentType';
										break;
									default:
										throw e;
								}

								try {
									// https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIChannel
									httpChannel[channel_attribute] = header_value;
								}
								catch(ee){
									if ( self.debug() ){
										self.debug('(process_channel|error|summary): ' + 'unable to modify attribute of (response) HTTP Channel = ' + channel_attribute);
										self.debug('(process_channel|error|message): ' + ee.message);
									}
									throw e;
								}
							})();

						}
					}
				}
			}
		}
		catch(e){
			self.log('(process_channel|error): ' + e.message);
		}
	}

});

// ------------------------------------------------------------------------------------------------ "Moz_Rewrite" XPCOM component boilerplate

function Moz_Rewrite() {
	this.wrappedJSObject		= this;
	this.prefs					= helper_functions.get_prefs();
	this.log					= helper_functions.wrap_console_log('moz-safe-rewrite: ', false);
	this.debug					= null;
	this.observers				= [];
	this.HTTP_Request_Stream	= new HTTP_Request_Stream(false);
	this.HTTP_Response_Stream	= new HTTP_Response_Stream(false);
}

Moz_Rewrite.prototype = {

	// properties required for XPCOM registration:
	"classID"					: Components.ID("{1f5c019c-16d0-4c8e-a397-effac1253135}"),
	"contractID"				: "@github.com/moz-rewrite-amo;1",
	"classDescription"			: "A light-weight (pseudo) rules-engine to easily modify HTTP headers in either direction",

	"_xpcom_factory"			: {
		"createInstance"		: function (outer, iid) {
			if (outer != null)
				throw Cr.NS_ERROR_NO_AGGREGATION;
			if (!Moz_Rewrite.instance)
				Moz_Rewrite.instance = new Moz_Rewrite();
			return Moz_Rewrite.instance.QueryInterface(iid);
		},
		"QueryInterface"		: XPCOMUtils.generateQI([
				Ci.nsISupports,
				Ci.nsIModule,
				Ci.nsIFactory
		])
	},

	// [optional] an array of categories to register this component in.
	"_xpcom_categories"			: [
		{"category": "app-startup", "service": true},
		{"category": "profile-after-change"}
	],

	// QueryInterface implementation, e.g. using the generateQI helper
	"QueryInterface"			: XPCOMUtils.generateQI([
		Ci.nsIObserver,
		Ci.nsISupports
	]),

	"observe"					: function(subject, topic, data){
		// sanity check
		if (typeof topic !== 'string'){return;}

		var self = this;

		switch(topic.toLowerCase()){

			case 'profile-after-change':
				self.at_startup();
				break;

			case 'profile-before-change':
				self.at_shutdown();
				break;

			case 'nspref:changed':
				// addon preferences have been changed.
				// perform a complete restart.

				// adding a timer to create a little separation (between shutdown and startup) may be unnecessary,
				// but I want to make sure that no stale notifications are received.

				self.at_shutdown();
				//self.at_startup();

				(function(){
					var timeout, event, delay;
					timeout	= Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
					event	= {
						"notify": function(){
							self.at_startup();
						}
					};
					delay	= 1000;
					timeout.initWithCallback(event, delay, Ci.nsITimer.TYPE_ONE_SHOT);
				})();
				break;

			case 'http-on-modify-request':
				(function(){
					try {
						var httpChannel = subject.QueryInterface(Ci.nsIHttpChannel);

						self.HTTP_Request_Stream.process_channel(httpChannel);
					}
					catch(e){
						self.log('(observe|request|error): ' + e.message);
					}
				})();
				break;

			case 'http-on-examine-response':
			case 'http-on-examine-cached-response':
			case 'http-on-examine-merged-response':
				(function(){
					try {
						var httpChannel = subject.QueryInterface(Ci.nsIHttpChannel);

						self.HTTP_Response_Stream.process_channel(httpChannel);
					}
					catch(e){
						self.log('(observe|response|error): ' + e.message);
					}
				})();
				break;
		}
	},

	"at_startup":				function(){
		var self = this;
		try {
			//self.debug = helper_functions.wrap_console_log('moz-safe-rewrite: ', ( self.prefs.getBoolPref("debug") == false ));

			if (self.prefs.getBoolPref("request.enabled")){
				OS.addObserver(self, "http-on-modify-request", false);
				self.observers.push("http-on-modify-request");
				self.HTTP_Request_Stream.at_startup();
			}
			if (self.prefs.getBoolPref("response.enabled")){
				OS.addObserver(self, "http-on-examine-response", false);
				self.observers.push("http-on-examine-response");
				OS.addObserver(self, "http-on-examine-cached-response", false);
				self.observers.push("http-on-examine-cached-response");
				OS.addObserver(self, "http-on-examine-merged-response", false);
				self.observers.push("http-on-examine-merged-response");
				self.HTTP_Response_Stream.at_startup();
			}
			if (!("addObserver" in self.prefs)){
				self.prefs.QueryInterface(Ci.nsIPrefBranch2);
			}
			self.prefs.addObserver("", self, false);
			OS.addObserver(self, "profile-before-change", false);
		}
		catch(e){
            self.log("(at_startup|error): couldn't add observers: " + e.message);
        }
	},

	"at_shutdown":				function(){
		var self = this;
		try {
			OS.removeObserver(self, "profile-before-change", false);
			self.prefs.removeObserver("", self);

			while(self.observers && self.observers.length){
				OS.removeObserver(self, self.observers.shift(), false);
			}

			self.HTTP_Request_Stream.at_shutdown();
			self.HTTP_Response_Stream.at_shutdown();

			OS.addObserver(self, "profile-after-change", false);
			self.debug = null;
		}
		catch(e){
            self.log("(at_shutdown|error): couldn't remove observers: " + e.message);
        }
	}

};

// ------------------------------------------------------------------------------------------------ "XPCOMUtils" registration:

if (XPCOMUtils.generateNSGetFactory)
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([Moz_Rewrite]);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule([Moz_Rewrite]);
