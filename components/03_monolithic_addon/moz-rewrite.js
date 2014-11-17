/*
 * --------------------------------------------------------
 * project
 *     name:    moz-rewrite
 *     summary: Firefox add-on that functions as a light-weight (pseudo) rules-engine for easily modifying HTTP headers in either direction
 *     url:     https://github.com/warren-bank/moz-rewrite
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

		branch_name		= "extensions.Moz-Rewrite." + (sub_branch_name? sub_branch_name : '');

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
	},

	"extend_object": function(o1, o2){
		var key;
		for (key in o2){
			o1[key] = o2[key];
		}
		return o1;
	},

	"get_object_summary": function(o1, raw){
		var o2, key;
		o2 = {};
		for (key in o1){
			o2[key] = (typeof o1[key]);
		}
		return (raw? o2 : JSON.stringify(o2));
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
// ------------------------------------------------------------------------------------------------ "Base_Sandbox":

var Base_Sandbox = Class.extend({

	"init": function(){
		this.log	= helper_functions.wrap_console_log(('Sandbox: '), false);
		this.debug	= null;
	},

	"get_local_variables": function(){
		this.debug('(get_local_variables|Base_Sandbox|checkpoint|01)');
		return {};
	},

	"combine_local_variables": function(super_vars, vars){
		if ( this.debug() ){
			this.debug('(combine_local_variables|inherited variables|checkpoint|01): ' + helper_functions.get_object_summary(super_vars));
			this.debug('(combine_local_variables|local variables|checkpoint|02): ' + helper_functions.get_object_summary(vars));
		}
		return helper_functions.extend_object(super_vars, vars);
	},

	"call": function(f){
		var self = this;
		var code, result;

		if (typeof f === 'function'){
			code	= f.toSource() + '()';
			self.debug() && self.debug('(call|checkpoint|01): ' + code);

			result	= self.eval(code);
		}
		else {
			result	= null;
		}
		return result;
	},

	"eval": function(code){
		var self = this;

		// want to execute (source) code while having arbitrary variables in the local scope
		var local_variables, names, values, name, wrapper_function, result;

		try {
			local_variables = self.get_local_variables();
			names	= [];
			values	= [];
			for (name in local_variables){
				names.push(name);
				values.push( local_variables[name] );
			}
			wrapper_function = '(function(' + names.join(',') + '){ return (' + code + '); })';
			wrapper_function = eval( wrapper_function );
			result = wrapper_function.apply(self, values);
		}
		catch(e){
			self.log('(call|error): ' + e.message);
			result = null;
		}
		finally {
			self.cleanup();
		}
		return result;
	},

	"cleanup": function(){
	}

});

// ------------------------------------------------------------------------------------------------ "Shared_Sandbox":

var Shared_Sandbox = Base_Sandbox.extend({

	"init": function(){
		this._super();
	},

	"get_local_variables": function(){
		this.debug('(get_local_variables|Shared_Sandbox|checkpoint|01)');
		var self = this;

		return this.combine_local_variables(this._super(), {
			"md2"			: function(x){ return self.crypto('md2',    x); },
			"md5"			: function(x){ return self.crypto('md5',    x); },
			"sha1"			: function(x){ return self.crypto('sha1',   x); },
			"sha256"		: function(x){ return self.crypto('sha256', x); },
			"sha384"		: function(x){ return self.crypto('sha384', x); },
			"sha512"		: function(x){ return self.crypto('sha512', x); },
			"format_date"	: self.format_date,
			"btoa"			: self.btoa,
			"atob"			: self.atob,

			// aliases
			"base64_encode"	: self.btoa,
			"base64_decode"	: self.atob
		});
	},

	"crypto": function (algorithm, str){
		var converter, result, data, ch, type, getChecksumType, hash, toHexString, s;

		getChecksumType	= function(checksum){
			switch(checksum) {
				case 'md2'   : return 1; break;
				case 'md5'   : return 2; break;
				case 'sha1'  : return 3; break;
				case 'sha256': return 4; break;
				case 'sha384': return 5; break;
				case 'sha512': return 6; break;
				default: return false;
			}
		};

		toHexString		= function(charCode){
			// return the two-digit hexadecimal code for a byte
			return ("0" + charCode.toString(16)).slice(-2);
		};

		converter	= Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter);
		converter.charset = "UTF-8";

		result		= {};
		data		= converter.convertToByteArray(str, result);
		type		= getChecksumType(algorithm);
		ch			= Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);

		ch.init(type);
		ch.update(data, data.length);
		hash		= ch.finish(false);

		// convert the binary hash data to a hex string.
		s			= [toHexString(hash.charCodeAt(i)) for (i in hash)].join("");
		return s;
	},

	"format_date": function(d, fallback_output_mode){
		// see:
		//     http://tools.ietf.org/html/rfc2616#section-3.3
		//         "Date/Time Formats" used in HTTP headers, definition of: "HTTP-date"
		//     http://tools.ietf.org/html/rfc2616#section-14.29
		//         example: "Last-Modified" header

		var timestamp, gmt_date_string;

		// string input: convert from one date format into another
		if (
			(typeof d === 'string') &&
			(d !== '')
		){
			timestamp = Date.parse(d);
			if (! isNaN(timestamp)){
				d = new Date(timestamp);
			}
		}

		// process a Date object
		if (
			(helper_functions.get_object_constructor_name(d, true) === 'date')
		){
			gmt_date_string = d.toUTCString();
		}

		// fallback output:
		if (! gmt_date_string){
			switch(fallback_output_mode){
				case 1:
					// string: now()
					gmt_date_string = (new Date()).toUTCString();
					break;
				case 0:
				default:
					// boolean: FALSE
					gmt_date_string = false;
					break;
			}
		}

		return gmt_date_string;
	},

	"get_hiddenDOMWindow": function(){
		var hShellService, HiddenWindow;

		hShellService	= Cc["@mozilla.org/appshell/appShellService;1"].getService(Ci.nsIAppShellService);
		HiddenWindow	= hShellService.hiddenDOMWindow;
		return HiddenWindow;
	},

	"btoa": function(x){
		var self = this;
		var win  = self.get_hiddenDOMWindow();
		return win.btoa(x);
	},

	"atob": function(x){
		var self = this;
		var win  = self.get_hiddenDOMWindow();
		return win.atob(x);
	}

});

// ------------------------------------------------------------------------------------------------ "HTTP_Request_Sandbox":

var HTTP_Request_Sandbox = Shared_Sandbox.extend({

	"init": function(){
		this._super();

		this.request		= null;
		this.redirectTo		= null;
		this.cancel			= null;
	},

	"get_local_variables": function(){
		this.debug('(get_local_variables|HTTP_Request_Sandbox|checkpoint|01)');
		var self = this;
		var noop = function(){};

		return this.combine_local_variables(this._super(), {
			"request"		: (self.request    ||   {}),
			"redirectTo"	: (self.redirectTo || noop),
			"cancel"		: (self.cancel     || noop)
		});
	},

	"cleanup": function(){
		this._super();

		this.request		= null;
		this.redirectTo		= null;
		this.cancel			= null;
	}

});

// ------------------------------------------------------------------------------------------------ "HTTP_Response_Sandbox":

var HTTP_Response_Sandbox = Shared_Sandbox.extend({

	"init": function(){
		this._super();

		this.request	= null;
		this.response	= null;
	},

	"get_local_variables": function(){
		this.debug('(get_local_variables|HTTP_Response_Sandbox|checkpoint|01)');
		var self = this;

		return this.combine_local_variables(this._super(), {
			"request"	: (self.request  || {}),
			"response"	: (self.response || {})
		});
	},

	"cleanup": function(){
		this._super();

		this.request	= null;
		this.response	= null;
	}

});

// ------------------------------------------------------------------------------------------------ "HTTP_Stream":

var HTTP_Stream = Class.extend({
	"init": function(auto_init){
		this.prefs			= helper_functions.get_prefs( (this.type + '.') );
		this.log			= helper_functions.wrap_console_log(('HTTP_' + this.type + '_stream: '), false);
		this.rules_file		= null;
		this.rules_data		= null;
		this.has_functions	= false;
		this.watch_timer	= null;
		this.debug			= null;
		this.sandbox		= null;		// abstract: Shared_Sandbox

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
			self.has_functions	= false;
			self.watch_timer	= null;

			// check that this stream is enabled
			if (! self.is_enabled()){return;}

			// (re)initialize debugging loggers
			(function(){
				var is_disabled;
				is_disabled			= ( (helper_functions.get_prefs()).getBoolPref("debug") == false );
				self.debug			= helper_functions.wrap_console_log(('HTTP_' + self.type + '_stream: '), is_disabled);
				self.sandbox.debug	= helper_functions.wrap_console_log(('HTTP_' + self.type + '_sandbox: '), is_disabled);
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
					special_dirs_pattern	= /^{([^}]+)}(.*)$/;
					matches					= special_dirs_pattern.exec(rules_file_path);
					if (matches === null){
						rules_file			= new FileUtils.File(rules_file_path);
					}
					else {
						special_dir			= matches[1];
						relative_path		= matches[2];

						rules_file			= FileUtils.getFile(special_dir, relative_path.split(new RegExp('[/\\]')), true);
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
			rules_data = self.sandbox.eval(file_text);
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
				// at the same time, look for the presence of javascript function(s) and update `has_functions`
				self.validate_rules_data(rules_data);
			}
		}
		catch(e){
			self.log('(evaluate_rules_file|parsing|error): ' + e.message);
			self.rules_data		= null;
			self.has_functions	= false;
		}
	},

	"validate_rules_data": function(raw_rules_data){
		var self = this;

		// * validate: `raw_rules_data`
		// * update: `rules_data`, `has_functions`
		//   - a function can only occur in place of:
		//       rule.headers
		//       rule.headers[key]
		//       rule.stop

		var sanitized_rules_data = [];
		var js_found = false;
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

			// rule.url is: regexp
			if (
				(helper_functions.get_object_constructor_name(rule.url, true) !== 'regexp')
			){continue nextRule;}
			sanitized_rule.url = rule.url;

			// rule.stop is: [undefined, boolean, function]
			switch(typeof rule.stop){
				case 'undefined':
					rule.stop = false;
					break;
				case 'boolean':
					break;
				case 'function':
					js_found = true;
					break;
				default:
					continue nextRule;
			}
			sanitized_rule.stop = rule.stop;

			// rule.headers is: [object, function]
			switch(typeof rule.headers){
				case 'object':
					count = 0;
					sanitized_rule.headers = {};
					nextHeader: for (header_key in rule.headers){
						header_value = rule.headers[header_key];

						// header_value is: [boolean false, object null, string non-empty, function]
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
							case 'function':
								js_found = true;
								break;
							default:
								continue nextHeader;
						}

						count++;
						sanitized_rule.headers[header_key] = header_value;
					}

					if (! count){continue nextRule;}
					break;
				case 'function':
					js_found = true;
					sanitized_rule.headers = rule.headers;
					break;
				default:
					continue nextRule;
			}

			// if the loop iteration has reaches this point, then `sanitized_rule` is valid
			sanitized_rules_data.push(sanitized_rule);
		}

		if (sanitized_rules_data.length){
			self.rules_data		= sanitized_rules_data;
			self.has_functions	= js_found;
		}
		else {
			self.rules_data		= null;
			self.has_functions	= false;
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
					self.has_functions	= false;
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
		self.has_functions	= false;
		self.watch_timer	= null;

		self.debug			= null;
		self.sandbox.debug	= null;
	},

	"process_channel":	function(httpChannel){
		// abstract function
	},

	"get_request_data": function(httpChannel){
		var self = this;

		// available while processing both requests and responses
		var request_data;

		try {
			request_data				= {};
			request_data.original_uri	= self.get_uri_components(httpChannel.originalURI);
			request_data.uri			= self.get_uri_components(httpChannel.URI);
			request_data.referrer		= self.get_uri_components(httpChannel.referrer);
			request_data.method			= httpChannel.requestMethod;
			request_data.headers		= {
				"unmodified"			: self.get_HTTP_headers(httpChannel, false),
				"updated"				: {}
			};
		}
		catch(e){
		//	request_data = null;
			self.log('(get_request_data|error): ' + e.message);
		}
		finally {
			return request_data;
		}
	},

	"get_uri_components": function(uri){
		var self = this;
		var components, url;

		try {
			components			= {
				"href"			: (uri.spec),
				"protocol"		: (uri.scheme + ':'),
				"username"		: (uri.username),
				"password"		: (uri.password),
				"host"			: (uri.host),
				"port"			: ((uri.port == -1)? '' : ('' + uri.port)),
				"path"			: (uri.path),
				"query"			: '',
				"hash"			: ((uri.ref)? ('#' + uri.ref) : ''),
				"file_ext"		: ''
			};

			url					= uri.QueryInterface(Ci.nsIURL);
			components.path		= url.filePath;
			components.query	= url.query;
			components.file_ext	= url.fileExtension;
		}
		catch(e){
			self.log('(get_uri_components|url|error): ' + 'uri is not a valid url: ' + uri.asciiSpec);
			self.log('(get_uri_components|url|error): ' + e.message);
		}
		finally {
			return components;
		}
	},

	"get_HTTP_headers": function(httpChannel, get_response){
		var headers;

		// https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIHttpChannel#visitRequestHeaders()
		// https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIHttpHeaderVisitor
		var visitor, the_visitor;
		try {
			visitor = function(){
				this.headers = {};
			};
			visitor.prototype = {
				"visitHeader": function(header_key, header_value){
					// sanity check
					if (
						(typeof header_key !== 'string') ||
						(header_key === '') ||
						(typeof header_value !== 'string') ||
						(header_value === '')
					){return;}

					this.headers[ header_key.toLowerCase() ] = header_value;
				}
			};
			the_visitor = new visitor();

			if (get_response){
				httpChannel.visitResponseHeaders(the_visitor);
			}
			else {
				httpChannel.visitRequestHeaders(the_visitor);
			}
			headers = the_visitor.headers;
		}
		catch(e){
			headers = null;
			self.log('(get_request_headers|error): ' + e.message);
		}
		finally {
			return headers;
		}
	},

	"process_channel_rules_data": function(url, post_rule_callback){
		var self = this;
		var updated_headers = {};

		// sanity check: is there any work to do?
		if (! self.rules_data){return;}

		var run_function = function(f){
			// sanity check
			if (
				(typeof f !== 'function') ||
				(! self.sandbox)
			){return null;}

			var result;

			try {
				result = self.sandbox.call(f);
				self.debug() && self.debug('(process_channel_rules_data|sandbox|call(f)|checkpoint|01): ' + 'f = ' + f.toSource() + '; result = ' + JSON.stringify(result));
			}
			catch(e){
				result = null;
				self.log('(process_channel_rules_data|sandbox|error): ' + e.message);
			}
			finally {
				return result;
			}
		};

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
					case 'function':
						local_headers	= run_function( rule.headers );
						break;
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
						case 'function':
							local_header_value	= run_function( local_headers[header_key] );
							break;
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

					// call callback function now, or wait until all headers in the current rule are processed?
					// I vote for now..
					if (typeof post_rule_callback === 'function'){
						post_rule_callback(updated_headers);
					}
				}

				switch(typeof rule.stop){
					case 'function':
						local_stop		= run_function( rule.stop );
						break;
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
		this.sandbox	= new HTTP_Request_Sandbox();
	},

	"process_channel":	function(httpChannel){
		var self = this;
		var url, post_rule_callback, updated_headers, header_key, header_value;

		// sanity check: is there any work to do?
		if (! self.rules_data){return;}

		try {
			// get URL of the requested page, to match against regex patterns in the rules data
			url = httpChannel.URI.spec;

			// can we get away without initializing all of the variables that need to be in scope when embedded javascript functions are called?
			if (self.has_functions){

				// add per-request variables
				self.sandbox.request	= self.get_request_data(httpChannel);

				// add request-only functions
				self.sandbox.redirectTo = function(string_url){
					self.redirect_to(httpChannel, string_url);
				};
				self.sandbox.cancel = function(){
					httpChannel.cancel(Cr.NS_BINDING_ABORTED);
				};

				// process the rules data
				post_rule_callback = function(updated_headers){
					if (self.sandbox.request && self.sandbox.request.headers){
						self.sandbox.request.headers.updated = updated_headers;
					}
				};
			}

			updated_headers = self.process_channel_rules_data(url, post_rule_callback);

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
	},

	"redirect_to": function(httpChannel, string_url){
		var self = this;
		try {
			var wm, win;

			httpChannel.cancel(Cr.NS_BINDING_ABORTED);

			wm	= Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
			win	= wm.getMostRecentWindow(null);
			win.content.location = string_url;
		}
		catch(e){
            self.log("(redirect_to|error): couldn't assign URL to window.location: " + e.message);
        }
	}

});

// ------------------------------------------------------------------------------------------------ "HTTP_Response_Stream":

var HTTP_Response_Stream = HTTP_Stream.extend({
	"init": function(auto_init){
		this.type		= 'response';
		this._super(auto_init);
		this.sandbox	= new HTTP_Response_Sandbox();
	},

	"at_startup":	function(){
		this._super();

		var self = this;
		if ( self.debug() ){
			// testing
			var f, vars, result;
			f = function(){
				return JSON.stringify(response);
			};
			self.sandbox.response = {"a":5};
			vars	= self.sandbox.get_local_variables();
			result	= self.sandbox.call(f);
			self.debug('(at_startup|testing|sandbox|checkpoint|01): ' + 'variables in local scope: ' + helper_functions.get_object_summary(vars));
			self.debug('(at_startup|testing|sandbox|checkpoint|02): ' + 'output of calling a function to print the "response" variable: ' + JSON.stringify(result));
		}
	},

	"get_response_data": function(httpChannel){
		var self = this;
		var response_data;

		try {
			response_data					= {};
			response_data.status_code		= httpChannel.responseStatus;
			response_data.charset			= httpChannel.contentCharset;
			response_data.content_length	= httpChannel.contentLength;
			response_data.content_type		= httpChannel.contentType;
			response_data.headers			= {
				"unmodified"				: self.get_HTTP_headers(httpChannel, true),
				"updated"					: {}
			};
		}
		catch(e){
		//	response_data = null;
			self.log('(get_response_data|error): ' + e.message);
		}
		finally {
			return response_data;
		}
	},

	"process_channel":	function(httpChannel){
		var self = this;
		var url, post_rule_callback, updated_headers, header_key, header_value;

		// sanity check: is there any work to do?
		if (! self.rules_data){return;}

		try {
			// get URL of the requested page, to match against regex patterns in the rules data
			url = httpChannel.URI.spec;

			// can we get away without initializing all of the variables that need to be in scope when embedded javascript functions are called?
			if (self.has_functions){

				// add per-request variables
				self.sandbox.request	= self.get_request_data(httpChannel);
				self.sandbox.response	= self.get_response_data(httpChannel);

				// process the rules data
				post_rule_callback = function(updated_headers){
					if (self.sandbox.response && self.sandbox.response.headers){
						self.sandbox.response.headers.updated = updated_headers;
					}
				};
			}

			updated_headers = self.process_channel_rules_data(url, post_rule_callback);

			if (updated_headers){
				nextHeader: for (header_key in updated_headers){
					header_value	= updated_headers[header_key];

					if (header_value === false){
						continue nextHeader;
					}
					else if (header_value === null){
						header_value = '';
						httpChannel.setResponseHeader(header_key, header_value, false);
					}
					else if (typeof header_value === 'string'){
						httpChannel.setResponseHeader(header_key, header_value, false);
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
	this.log					= helper_functions.wrap_console_log('moz-rewrite: ', false);
	this.debug					= null;
	this.observers				= [];
	this.HTTP_Request_Stream	= new HTTP_Request_Stream(false);
	this.HTTP_Response_Stream	= new HTTP_Response_Stream(false);
}

Moz_Rewrite.prototype = {

	// properties required for XPCOM registration:
	"classID"					: Components.ID("{1f5c019c-16d0-4c8e-a397-effac1253135}"),
	"contractID"				: "@github.com/moz-rewrite;1",
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
			//self.debug = helper_functions.wrap_console_log('moz-rewrite: ', ( self.prefs.getBoolPref("debug") == false ));

			if (self.prefs.getBoolPref("request.enabled")){
				OS.addObserver(self, "http-on-modify-request", false);
				self.observers.push("http-on-modify-request");
				self.HTTP_Request_Stream.at_startup();
			}
			if (self.prefs.getBoolPref("response.enabled")){
				OS.addObserver(self, "http-on-examine-response", false);
				self.observers.push("http-on-examine-response");
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
