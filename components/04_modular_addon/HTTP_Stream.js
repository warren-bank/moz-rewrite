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

var EXPORTED_SYMBOLS	= [ "HTTP_Stream" ];

const Ci				= Components.interfaces;
const Cc				= Components.classes;
const Cu				= Components.utils;
const Cr				= Components.results;

Cu.import("resource://Moz-Rewrite/Class.js");
Cu.import("resource://Moz-Rewrite/helper_functions.js");

Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");

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
