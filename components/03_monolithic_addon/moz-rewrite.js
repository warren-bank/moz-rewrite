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

	"get_object_keys": function(o){
		var keys, key;
		keys = [];
		for (key in o){
			keys.push(key);
		}
		return keys;
	},

	"get_object_summary": function(o1, raw){
		var o2, key;
		o2 = {};
		for (key in o1){
			o2[key] = (typeof o1[key]);
		}
		return (raw? o2 : JSON.stringify(o2));
	},

	"get_file_from_preference": function(pref_path, prefs_branch, logger, wrapped_debug_logger){
		var file_handle = null;
		var debug, file_path;

		try {
			if (prefs_branch.prefHasUserValue(pref_path)) {
				debug			= wrapped_debug_logger && wrapped_debug_logger() && function(index, text){
									wrapped_debug_logger('(get_file_from_preference|checkpoint|' + index + '): ' + text);
								};
				file_path		= prefs_branch.getCharPref(pref_path);
				file_handle		= helper_functions.get_file_from_path(file_path, debug);
			}
		}
		catch(e){
			logger && logger('(get_file_from_preference|error): ' + e.message);
			file_handle = null;
		}
		finally {
			return file_handle;
		}
	},

	// throws Exception
	"get_file_from_path": function(file_path, debug){
		var special_dirs_pattern, matches, special_dir, relative_path;
		var file_handle				= null;

		// trim leading/trailing whitespace
		file_path					= file_path.replace(/^\s+/,'').replace(/\s+$/,'');

		if (file_path){
			special_dirs_pattern	= /^\{([^\}]+)\}[\/\\]?(.*)$/;
			matches					= special_dirs_pattern.exec(file_path);
			if (matches === null){
				file_handle			= new FileUtils.File(file_path);
			}
			else {
				special_dir			= matches[1];
				relative_path		= matches[2];

				if (typeof debug === 'function'){
					debug('01', 'special directory (root) path = "' + special_dir + '"');
					debug('02', 'relative (file) path = "' + relative_path + '"');
				}

				file_handle			= FileUtils.getFile(special_dir, relative_path.split(/[\/\\]/), true);
			}

			if (
				(! file_handle.exists()) ||
				(! file_handle.isReadable())
			){
				throw new Error('file either does not exist or cannot be accessed' + ((file_handle && file_handle.path)? (': ' + file_handle.path) : ''));
			}
		}

		return file_handle;
	},

	"is_file_handle_usable": function(file_handle, methods){
		var usable = true;
		var i, method_name;

		usable = usable && (
			(file_handle !== null) &&
			(file_handle.exists())
		);

		if (usable && methods){
			for (i=0; i<methods.length; i++){
				method_name	= methods[i];
				if (typeof file_handle[method_name] === 'function'){
					usable	= usable && (file_handle[method_name])();
					if (! usable) break;
				}
			}
		}

		return usable;
	}

};

// ------------------------------------------------------------------------------------------------ sandbox helper functions

var cu_sandbox = {
	"new": function(sandbox_name, principal_name){
		var default_principal_name, principal, sandbox_options, sandbox;

		default_principal_name	= 'nullprincipal';
		principal_name			= principal_name? principal_name : default_principal_name;

		try {
			principal			= Cc["@mozilla.org/" + principal_name + ";1"].createInstance(Ci.nsIPrincipal);
		}
		catch(e){
			throw new Error('Sandbox: bad principal');
		}

		sandbox_options			= {
			"wantXrays"				: false,
			"wantComponents"		: false,
			"wantExportHelpers"		: false,
			"wantXHRConstructor"	: false,
			"wantGlobalProperties"	: []
		};

		if (
			(sandbox_name) &&
			(typeof sandbox_name === 'string')
		){
			sandbox_options["sandboxName"] = sandbox_name;
		}

		sandbox					= new Cu.Sandbox(principal, sandbox_options);
		return sandbox;
	},

	"add_object": function(sandbox, o, name){
		// sanity check
		if (typeof o !== 'object'){return;}

		// special case
		if (o === null){
			sandbox[name] = o;
			return;
		}

		if (typeof Cu.cloneInto === 'function'){
			// Firefox >= 29.0
			sandbox[name] = Cu.cloneInto(o, sandbox);
		}
		else if (typeof Cu.createObjectIn === 'function'){
			// Firefox >= 8.0
			sandbox[name] = Cu.createObjectIn(sandbox);

			(function(){
				var key;
				for (key in o){
					sandbox[name][key] = o[key];
				}
			})();

			if (typeof Cu.makeObjectPropsNormal === 'function'){
				Cu.makeObjectPropsNormal(sandbox[name]);
			}
		}
		else {
			// Firefox < 8.0
			sandbox[name] = o;
		}
	},

	"add_function": function(sandbox, f, name){
		// sanity check
		if (typeof f !== 'function'){return;}

		if (typeof Cu.exportFunction === 'function'){
			// Firefox >= 29.0
			sandbox[name] = Cu.exportFunction(f, sandbox);
		}
		else {
			// Firefox < 29.0
			sandbox[name] = f;
		}
	},

	"add_attributes": function(sandbox, local_variables){
		var name, val;
		for (name in local_variables){
			val = local_variables[name];
			switch(typeof val){
				case 'object':
					cu_sandbox.add_object(sandbox, val, name);
					break;
				case 'function':
					cu_sandbox.add_function(sandbox, val, name);
					break;
				default:
					sandbox[name] = val;
					break;
			}
		}
	},

	"remove_attributes": function(sandbox, names){
		var i, name;
		for (i=0; i<names.length; i++){
			name			= names[i];
			sandbox[name]	= undefined;
		}
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
		this.log		= helper_functions.wrap_console_log(('Sandbox: '), false);
		this.debug		= null;
		this.sandbox	= null;		// abstract: Cu.Sandbox
		this.cache		= null;

		this.clear_cache();
	},

	"clear_cache": function(){
		var self = this;

		self.cache = {
			"local_variables"	: null
		};
	},

	"retrieve_local_variables": function(){
		var self = this;
		var local_variables;

		if (self.cache.local_variables){
			local_variables				= self.cache.local_variables;
		}
		else {
			local_variables				= self.get_local_variables();
			self.cache.local_variables	= local_variables;
		}
		return local_variables;
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

	"call": function(f, do_cleanup){
		var self = this;
		var result = null;

		// sanity check
		if (typeof f !== 'function'){return result;}

		// want to execute function while having arbitrary variables in the local scope of the sandbox
		var local_variables, random_name, code;

		self.debug() && self.debug('(call|checkpoint|01): ' + f.toSource() + '()');

		try {
			local_variables = self.retrieve_local_variables();
			random_name		= 'function_' + (function(size){return Math.floor(Math.random() * (Math.pow(10,size)));})(10);
			code			= '(' + random_name + '()' + ')';

			local_variables[random_name] = f;

			cu_sandbox.add_attributes(self.sandbox, local_variables);
			result	= Cu.evalInSandbox(code, self.sandbox);

			local_variables[random_name] = undefined;
			self.sandbox[random_name]    = undefined;
		}
		catch(e){
			self.log('(call|error): ' + e.message);
			result = null;
		}
		finally {
			if (do_cleanup) self.cleanup();
			return result;
		}
	},

	"eval": function(code, do_cleanup){
		var self = this;
		var result = null;

		// sanity check
		if (typeof code !== 'string'){return result;}

		// want to execute code while having arbitrary variables in the local scope of the sandbox
		var local_variables;

		try {
			local_variables = self.retrieve_local_variables();
			code	= '(' + code + ')';

			cu_sandbox.add_attributes(self.sandbox, local_variables);
			result	= Cu.evalInSandbox(code, self.sandbox);
		}
		catch(e){
			self.log('(eval|error): ' + e.message);
			result = null;
		}
		finally {
			if (do_cleanup) self.cleanup();
			return result;
		}
	},

	"cleanup": function(){
		var self = this;
		var local_variables, names;

		local_variables = self.retrieve_local_variables();
		names			= helper_functions.get_object_keys(local_variables);

		cu_sandbox.remove_attributes(self.sandbox, names);
		self.clear_cache();
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
		var btoa, atob, log;

		btoa    = self.btoa.bind(self);
		atob    = self.atob.bind(self);
		log     = self.console_log.bind(self);

		return this.combine_local_variables(this._super(), {
			"md2"			: function(x){ return self.crypto('md2',    x); },
			"md5"			: function(x){ return self.crypto('md5',    x); },
			"sha1"			: function(x){ return self.crypto('sha1',   x); },
			"sha256"		: function(x){ return self.crypto('sha256', x); },
			"sha384"		: function(x){ return self.crypto('sha384', x); },
			"sha512"		: function(x){ return self.crypto('sha512', x); },

			"btoa"			: btoa,
			"atob"			: atob,
			"format_date"	: self.format_date,
			"log"			: log,

			// aliases
			"base64_encode"	: btoa,
			"base64_decode"	: atob
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
		s			= hash.split('').map(function(c, i){ return toHexString(hash.charCodeAt(i)) }).join('');
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
	},

	"get_activeDOMWindow": function(){
		var wm, win, tabbrowser, browser, ActiveWindow;

		wm				= Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
		win				= wm.getMostRecentWindow("navigator:browser");
		tabbrowser		= win.document.getElementById("content");
		browser			= tabbrowser.selectedBrowser;
		ActiveWindow	= browser.contentWindow;

		return ActiveWindow;
	},

	"console_log": function(){
		var self = this;
		var win, console, args;

		try {
			win = self.get_activeDOMWindow();
			win = win.wrappedJSObject ? win.wrappedJSObject : win;
			if (win.console){
				console = win.console;
				args = [].slice.call(arguments);

				//console.log('hello world');
				// => 'hello world'

				//args = ['hello world'];
				//console.log.apply(console, args);
				// => no output!?

				// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_operator
				//   FF27+
				console.log(...args);
			}
		}
		catch(e){
			self.log('(Shared_Sandbox|console_log|error): ' + e.message);
		}
	}

});

// ------------------------------------------------------------------------------------------------ "HTTP_Request_Sandbox":

var HTTP_Request_Sandbox = Shared_Sandbox.extend({

	"init": function(){
		this._super();

		this.sandbox		= cu_sandbox['new']('Moz-Rewrite HTTP Request Sandbox', 'nullprincipal');

		this.request		= null;
		this.redirectTo		= null;
		this.cancel			= null;
		this.save			= null;
	},

	"get_local_variables": function(){
		this.debug('(get_local_variables|HTTP_Request_Sandbox|checkpoint|01)');
		var self = this;
		var noop = function(){};

		return this.combine_local_variables(this._super(), {
			"request"		: (self.request    ||   {}),
			"redirectTo"	: (self.redirectTo || noop),
			"cancel"		: (self.cancel     || noop),
			"save"			: (self.save       || noop)
		});
	},

	"cleanup": function(){
		this._super();

		this.request		= null;
		this.redirectTo		= null;
		this.cancel			= null;
		this.save			= null;
	}

});

// ------------------------------------------------------------------------------------------------ "HTTP_Response_Sandbox":

var HTTP_Response_Sandbox = Shared_Sandbox.extend({

	"init": function(){
		this._super();

		this.sandbox	= cu_sandbox['new']('Moz-Rewrite HTTP Response Sandbox', 'nullprincipal');

		this.request	= null;
		this.response	= null;
		this.save		= null;
	},

	"get_local_variables": function(){
		this.debug('(get_local_variables|HTTP_Response_Sandbox|checkpoint|01)');
		var self = this;
		var noop = function(){};

		return this.combine_local_variables(this._super(), {
			"request"	: (self.request  || {}),
			"response"	: (self.response || {}),
			"save"		: (self.save     || noop)
		});
	},

	"cleanup": function(){
		this._super();

		this.request	= null;
		this.response	= null;
		this.save		= null;
	}

});

// ------------------------------------------------------------------------------------------------ "HTTP_Request_Persistence":

var HTTP_Request_Persistence = Class.extend({
	"init": function(){
		this.prefs					= helper_functions.get_prefs('request_persistence.');
		this.log					= helper_functions.wrap_console_log(('HTTP_request_persistence: '), false);
		this.debug					= null;
		this.save_file				= null;
		this.is_locked				= false;
		this.request_queue			= [];
		this.read_queue				= [];
	},

	"at_startup": function(){
		var self = this;

		try {
			// (re)initialize state
			self.save_file			= null;
			self.request_queue		= [];
			self.is_locked			= false;
			self.read_queue			= [];

			// check that this stream is enabled
			if (! self.is_enabled()){return;}

			// (re)initialize debugging logger
			(function(){
				var is_disabled;
				is_disabled			= ( (helper_functions.get_prefs()).getBoolPref("debug") == false );
				self.debug			= helper_functions.wrap_console_log('HTTP_request_persistence: ', is_disabled);
			})();

			// get file/directory handles
			self.save_file			= self.get_file_handle('save_file.path');
		}
		catch(e){
			self.log('(at_startup|error): ' + e.message);
		}
	},

	"is_enabled": function(){
		return this.prefs.getBoolPref("enabled");
	},

	"get_file_handle": function(pref_path){
		var self = this;

		return helper_functions.get_file_from_preference(pref_path, self.prefs, self.log, self.debug);
	},

	"unlock": function(){
		var self = this;

		self.is_locked = false;

		if (self.read_queue.length > 0){
			self.process_read_queue();
		}
		else if (self.request_queue.length > 0){
			self.process_request_queue();
		}
	},

	"save": function(request){
		var self = this;

		self.request_queue.push(request);
		if (! self.is_locked){
			self.process_request_queue();
		}
	},

	"process_request_queue": function(){
		var self = this;

		self.is_locked = true;

		var done = function(stop_processing){
			if (stop_processing){
				self.save_file			= null;
				self.request_queue		= [];
				self.unlock();
				return false;
			}
			else if (self.request_queue.length === 0) {
				self.unlock();
				return true;
			}
			else {
				return self.process_request_queue();
			}
		};

		var request, temp_file, temp_FileOutputStream, temp_UTF8_ConverterOutputStream;
		var maximum_capacity, line_counter;
		var save_LineInputStream, line, has_more;

		self.debug() && self.debug('(save|process_request_queue|checkpoint|1): ' + 'beginning sanity checks..');

		if (! helper_functions.is_file_handle_usable(self.save_file, ['isFile','isReadable','isWritable'])){return done(true);}

		if (self.request_queue.length === 0){return done();}

		self.debug() && self.debug('(save|process_request_queue|checkpoint|2): ' + 'sanity checks passed');

		var do_cleanup = function(){
			var close_stream = function(s){
				if (
					(s) &&
					(typeof s === 'object') &&
					(typeof s.close === 'function')
				){
					try {
						s.close();
					}
					catch(e){}
				}
			};

			close_stream(temp_FileOutputStream);
			close_stream(temp_UTF8_ConverterOutputStream);
			close_stream(save_LineInputStream);

			temp_FileOutputStream			= null;
			temp_UTF8_ConverterOutputStream	= null;
			save_LineInputStream			= null;
		};

		try {
			request							= self.request_queue.shift();

			// assign the request a unique `id` value (integer, 15 significant digits)
			request.id						= Math.floor( Math.random() * Math.pow(10,15) );

			// https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIFile
			// https://developer.mozilla.org/en-US/Add-ons/Code_snippets/File_I_O#Writing_a_File
			// https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIFileOutputStream
			temp_file = self.save_file.parent.clone();
			temp_file.append(self.save_file.leafName + '.temp');
			temp_FileOutputStream			= Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);

			self.debug() && self.debug('(save|process_request_queue|checkpoint|3): ' + 'temporary filepath = ' + temp_file.path);

			// https://developer.mozilla.org/en-US/docs/PR_Open#Parameters
			temp_FileOutputStream.init(temp_file, 0x02 | 0x08 | 0x20 | 0x40, 0600, 0);

			self.debug() && self.debug('(save|process_request_queue|checkpoint|4): ' + 'temporary file has been created = ' + temp_file.exists());

			temp_UTF8_ConverterOutputStream	= Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
			temp_UTF8_ConverterOutputStream.init(temp_FileOutputStream, "UTF-8", 0, 0);

			// prepend serialized data for the newest request
			temp_UTF8_ConverterOutputStream.writeString( JSON.stringify(request) + ',' + "\n" );

			maximum_capacity				= self.prefs.getIntPref('save_file.maximum_capacity');
			line_counter					= 1;

			if (
				(self.save_file.fileSize > 0) &&
				(
					(maximum_capacity === 0) ||
					(maximum_capacity > line_counter)
				)
			){
				// https://developer.mozilla.org/en-US/Add-ons/Code_snippets/File_I_O#Line_by_line
				save_LineInputStream		= Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
				save_LineInputStream.init(self.save_file, 0x01, 0400, 0);
				save_LineInputStream.QueryInterface(Ci.nsILineInputStream);

				do {
					line					= {"value": ""};
					has_more				= save_LineInputStream.readLine(line);
					if (line.value){
						temp_UTF8_ConverterOutputStream.writeString( line.value + "\n" );
						line_counter++;
					}
				} while(
					(has_more) &&
					(
						(maximum_capacity === 0) ||
						(maximum_capacity > line_counter)
					)
				);
			}

			self.debug() && self.debug('(save|process_request_queue|checkpoint|5): ' + line_counter + ' serialized HTTP Request objects have been written to the temporary file');

			// close all file streams
			do_cleanup();

			// replace save_file with temp_file
			// https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIFile#renameTo()
			self.save_file.remove(false);
			temp_file.renameTo( self.save_file.parent, self.save_file.leafName );

			// are file_handles equivalent now?
			if ( self.debug() ){
				(function(){
					var is_equivalent = self.save_file.equals(temp_file);
					self.debug('(save|process_request_queue|checkpoint|6): ' + 'the save_file and temp_file file handles are now equivalent = ' + is_equivalent);

					if (! is_equivalent){
						self.debug('(save|process_request_queue|checkpoint|7): ' + 'path to save_file = ' + self.save_file.path);
						self.debug('(save|process_request_queue|checkpoint|8): ' + 'path to temp_file = ' + temp_file.path);
					}
				})();
			}

			return done();
		}
		catch(e){
			self.log('(save|process_request_queue|error): ' + e.message);
			do_cleanup();
			return done(true);
		}
	},

	"get_saved_request": function(id, user_callback){
		var self = this;
		var callback;

		callback = function(data){
			var i, request;

			if (data === null){
				return user_callback(null);
			}

			for (i=0; i<data.length; i++){
				request = data[i];
				if (
					(request && request.id) &&
					(request.id === id)
				){
					return user_callback(request);
				}
			}
			return user_callback(null);
		};

		self.get_saved_requests(callback);
	},

	"get_saved_requests": function(callback){
		var self = this;

		self.read_queue.push(callback);
		if (! self.is_locked){
			self.process_read_queue();
		}
	},

	"process_read_queue": function(){
		var self = this;

		self.is_locked = true;

		var broadcast = function(data){
			var callback;

			while(self.read_queue.length > 0){
				callback = self.read_queue.shift();
				callback(data);
			}

			self.unlock();
			return true;
		};

		self.debug() && self.debug('(get_saved_requests|process_read_queue|checkpoint|1): ' + 'beginning sanity checks..');

		if (! helper_functions.is_file_handle_usable(self.save_file, ['isFile','isReadable'])){return broadcast(null);}

		if (self.read_queue.length === 0){return broadcast(null);}

		self.debug() && self.debug('(get_saved_requests|process_read_queue|checkpoint|2): ' + 'sanity checks passed');

		NetUtil.asyncFetch(self.save_file, function(inputStream, status) {
			var data;

			if (!Components.isSuccessCode(status)) {
				return broadcast(null);
			}

			try {
				data = NetUtil.readInputStreamToString(inputStream, inputStream.available());
				if (! data){
					return broadcast(null);
				}
				// rather than trimming the trailing ','.. it's simpler to just push() an empty object
				data = '[' + data + '{}]';
				data = JSON.parse(data);

				if (helper_functions.get_object_constructor_name(data, true) !== 'array'){
					return broadcast(null);
				}

				// remove the trailing empty object
				data.pop();
				if (data.length === 0){
					return broadcast(null);
				}

				// there's valid data in the array
				self.debug() && self.debug('(get_saved_requests|process_read_queue|asyncFetch|checkpoint|3): ' + data.length + ' HTTP Request objects have been read from save_file');
				return broadcast(data);
			}
			catch(e){
				self.log('(get_saved_requests|process_read_queue|asyncFetch|error): ' + e.message);
				return broadcast(null);
			}
		});

	},

	"at_shutdown": function(){
		this.save_file				= null;
		this.request_queue			= [];
		this.is_locked				= false;
		this.read_queue				= [];
		this.debug					= null;
	}

});

// ------------------------------------------------------------------------------------------------ "HTTP_Request_Replay":

var HTTP_Request_Replay = Class.extend({
	"init": function(request_persistence){
		this.prefs					= helper_functions.get_prefs('request_persistence.replay.');
		this.log					= helper_functions.wrap_console_log(('HTTP_request_replay: '), false);
		this.debug					= null;
		this.binary_executable		= null;
		this.download_directory		= null;
		this.request_persistence	= request_persistence;
	},

	"at_startup": function(){
		var self = this;

		try {
			// (re)initialize state
			self.binary_executable	= null;
			self.download_directory	= null;

			// check that this stream is enabled
			if (! self.request_persistence.is_enabled()){return;}

			// (re)initialize debugging logger
			(function(){
				var is_disabled;
				is_disabled			= ( (helper_functions.get_prefs()).getBoolPref("debug") == false );
				self.debug			= helper_functions.wrap_console_log('HTTP_request_replay: ', is_disabled);
			})();

			// get file/directory handles
			self.download_directory	= self.get_file_handle('download_directory.path');
		}
		catch(e){
			self.log('(at_startup|error): ' + e.message);
		}
	},

	"get_file_handle": function(pref_path){
		var self = this;

		return helper_functions.get_file_from_preference(pref_path, self.prefs, self.log, self.debug);
	},

	"validate_file_handles": function(download_file){
		var self = this;

		return (
			(download_file) ?
			(
				(helper_functions.is_file_handle_usable(download_file,           ['isFile','isReadable','isWritable'])) &&
				(helper_functions.is_file_handle_usable(self.binary_executable,  ['isFile','isExecutable']))
			) :
			(
				(helper_functions.is_file_handle_usable(self.download_directory, ['isDirectory','isReadable','isWritable'])) &&
				(helper_functions.is_file_handle_usable(self.binary_executable,  ['isFile','isExecutable']))
			)
		);
	},

	"replay_request_id": function(id, download_file){
		/* --------------------------------------
		 * since there's no way to capture stdout,
		 * the method signature does NOT include a `user_callback` function.
		 * --------------------------------------
		 */
		var self = this;
		var callback;

		self.debug() && self.debug('(replay_request_id|checkpoint|1): ' + 'beginning sanity checks..');

		// validate file/directory handles
		if (! self.validate_file_handles(download_file)){return;}

		self.debug() && self.debug('(replay_request_id|checkpoint|2): ' + 'file handles are OK..');

		callback = function(request){
			self.replay_request(request, download_file);
		};
		self.request_persistence.get_saved_request(id, callback);
	},

	"replay_request": function(request, download_file){
		// abstract function

		/* --------------------------------------
		 * since there's no way to capture stdout,
		 * the method signature does NOT include a `user_callback` function.
		 * --------------------------------------
		 */
	},

	"run_process" : function(executable_file, command_line_args){
		var self = this;
		/* --------------------------------------
		 * on the topic of capturing stdout from `nsIProcess`:
		 *     https://developer.mozilla.org/en-US/Add-ons/Code_snippets/Running_applications
		 *     https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIProcess#run()
		 *
		 * according to these threads:
		 *     http://forums.mozillazine.org/viewtopic.php?f=19&p=9726071
		 *     https://groups.google.com/forum/#!topic/mozilla.dev.extensions/DoDETBB6WbA
		 * it simply isn't possible.
		 * --------------------------------------
		 */
		var process;

		try {
			command_line_args	= command_line_args || [];
			process				= Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
			process.init(executable_file);
			process.run(false, command_line_args, command_line_args.length);

			self.debug() && self.debug('(run_process|checkpoint|1): ' + 'process now running = ' + executable_file.leafName);
		}
		catch(e){
			self.log('(run_process|error): ' + e.message);
		}
	},

	"at_shutdown": function(){
		this.binary_executable		= null;
		this.download_directory		= null;
		this.debug					= null;
	}

});

// ------------------------------------------------------------------------------------------------ "HTTP_Request_Replay_wget":

var HTTP_Request_Replay_wget = HTTP_Request_Replay.extend({
	"at_startup": function(){
		this._super();
		var self = this;

		// sanity check
		if (! self.download_directory){return;}

		try {
			// get file/directory handles
			self.binary_executable = self.get_file_handle('run.wget.executable_file.path');
		}
		catch(e){
			self.log('(at_startup|error): ' + e.message);
		}
	},

	"replay_request": function(request, download_file){
		var self = this;

		self.debug() && self.debug('(replay_request|checkpoint|1): ' + 'beginning sanity checks..');

		// validate file/directory handles
		if (! self.validate_file_handles(download_file)){return;}

		self.debug() && self.debug('(replay_request|checkpoint|2): ' + 'file handles are OK..');

		if (
			(! request) ||
			(! request.url)
		){return;}

		self.debug() && self.debug('(replay_request|checkpoint|3): ' + 'HTTP request is OK..');

		var wget_options, command_line_args, header_name, header_value;

		var push_args = function(args){
			for (var i=0; i<args.length; i++){
				command_line_args.push(args[i]);
			}
		};

		wget_options			= self.prefs.getCharPref('run.wget.options');
		command_line_args		= wget_options.split(/\s+/);

		/* --------------------------------------
		 * references:
		 *     http://www.gnu.org/software/wget/manual/wget.html
		 * topics:
		 *   - https://forums.mozilla.org/viewtopic.php?t=9784&p=20984
		 *     important takeaways:
		 *       - switch and value are separate array elements
		 *       - do NOT wrap long filepaths in quotes
		 *   - http://en.wikipedia.org/wiki/POST_%28HTTP%29#Use_for_submitting_web_forms
		 *     important takeaways:
		 *       - POST data is already URL encoded
		 * --------------------------------------
		 */

		if (download_file){
			// output filepath
			push_args([ '-O', (download_file.path) ]);
		}
		else {
			// output directory
			push_args([ '-P', (self.download_directory.path) ]);
		}

		// HTTP request headers
		if (request.headers){
			for (header_name in request.headers){
				header_value	= request.headers[header_name];

				push_args([ '--header', (header_name + ': ' + header_value) ]);
			}
		}

		// POST message body
		if (request.post_data){
			push_args([ '--method', 'POST' ]);
			push_args([ '--post-data', (request.post_data) ]);
		}

		// URL
		push_args([ (request.url) ]);

		self.debug() && self.debug('(replay_request|checkpoint|4): ' + 'spawning process => "' + self.binary_executable.path + '" "' + command_line_args.join('" "') + '"');

		self.run_process(self.binary_executable, command_line_args);
	}

});

// ------------------------------------------------------------------------------------------------ "HTTP_Stream":

var HTTP_Stream = Class.extend({
	"init": function(request_persistence, auto_init){
		this.prefs					= helper_functions.get_prefs( (this.type + '.') );
		this.log					= helper_functions.wrap_console_log(('HTTP_' + this.type + '_stream: '), false);
		this.request_persistence	= request_persistence;		// dynamically injected by Moz_Rewrite
		this.sandbox				= null;						// abstract: Shared_Sandbox
		this.rules_file				= null;
		this.rules_data				= null;
		this.has_functions			= false;
		this.watch_timer			= null;
		this.debug					= null;
		this.is_case_sensitive		= null;

		if (auto_init){
			this.at_startup();
		}
	},

	"at_startup": function(){
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

	"set_case_sensitivity": function(case_sensitive){
		this.is_case_sensitive = case_sensitive;
	},

	"is_enabled": function(){
		return this.prefs.getBoolPref("enabled");
	},

	"get_rules_file_watch_interval": function(){
		return this.prefs.getIntPref("rules_file.watch_interval");
	},

	"get_rules_file": function(){
		var self = this;
		var rules_file = null;
		var debug, rules_file_path;

		try {
			if (self.prefs.prefHasUserValue("rules_file.path")) {
				debug				= self.debug() && function(index, text){
										self.debug('(get_rules_file|checkpoint|' + index + '): ' + text);
									};
				rules_file_path		= self.prefs.getCharPref("rules_file.path");
				rules_file			= helper_functions.get_file_from_path(rules_file_path, debug);
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

	"read_rules_file": function(){
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

	"evaluate_rules_file": function(file_text){
		var self = this;
		var rules_data;

		try {
			rules_data = self.sandbox.eval(file_text, true);
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

	"watch_rules_file": function(){
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

	"at_shutdown": function(){
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

	"process_channel": function(httpChannel){
		// abstract function
	},

	"get_request_data": function(httpChannel){
		var self = this;

		// available while processing both requests and responses
		var request_data;

		try {
			request_data					= {};
			request_data.window_location	= self.get_window_components();
			request_data.original_uri		= self.get_uri_components(httpChannel.originalURI);
			request_data.uri				= self.get_uri_components(httpChannel.URI);
			request_data.referrer			= self.get_uri_components(httpChannel.referrer);
			if (! request_data.referrer){
				request_data.referrer		= request_data.window_location;
			}
			request_data.method				= httpChannel.requestMethod;
			request_data.headers			= {
				"unmodified"				: self.get_HTTP_headers(httpChannel, false),
				"updated"					: {}
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

	"get_window_components": function(){
		var self = this;
		var wm, win, location, components;

		var lc = function(str){
			if (typeof str !== 'string'){return '';}
			else if (str === ''){return '';}
			else if (self.is_case_sensitive) {return str;}
			else {return str.toLowerCase();}
		};

		try {
			// https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIWindowMediator#getMostRecentWindow()
			// https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIDOMWindow
			// https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIDOMWindowInternal
			// https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIDOMLocation
			// http://dxr.mozilla.org/mozilla-central/source/dom/interfaces/base/nsIDOMLocation.idl
			// https://developer.mozilla.org/en-US/docs/Web/API/Location

			wm					= Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
			win					= wm.getMostRecentWindow("navigator:browser");
			location			= win.content.location;

			components			= {
				"href"			: lc(location.href),
				"protocol"		: lc(location.protocol),
				"username"		: lc(location.username),
				"password"		: lc(location.password),
				"host"			: lc(location.host),
				"port"			: lc(location.port),
				"path"			: lc(location.pathname),
				"query"			: lc(location.search),
				"hash"			: lc(location.hash),
				"file_ext"		: ''
			};

			// determine file extension
			(function(){
				var pieces, last_piece;

				pieces			= components.path.split('/');
				if (! pieces.length){return;}

				last_piece		= pieces.pop();
				// empty string when last character in path is: '/'
				if (! last_piece){return;}

				pieces			= last_piece.split('.');
				if (pieces.length < 2){return;}

				last_piece		= pieces.pop();
				components["file_ext"] = last_piece;
			})();
		}
		catch(e){
			self.log('(get_window_components|error): ' + e.message);
		}
		finally {
			return components;
		}
	},

	"get_uri_components": function(uri){
		var self = this;
		var components, url;

		var lc = function(str){
			if (typeof str !== 'string'){return '';}
			else if (str === ''){return '';}
			else if (self.is_case_sensitive) {return str;}
			else {return str.toLowerCase();}
		};

		try {
			components			= {
				"href"			: lc(uri.spec),
				"protocol"		: lc(uri.scheme + ':'),
				"username"		: lc(uri.username),
				"password"		: lc(uri.password),
				"host"			: lc(uri.host),
				"port"			: ((uri.port == -1)? '' : ('' + uri.port)),
				"path"			: lc(uri.path),
				"query"			: '',
				"hash"			: lc((uri.ref)? ('#' + uri.ref) : ''),
				"file_ext"		: ''
			};

			url					= uri.QueryInterface(Ci.nsIURL);
			components.path		= lc(url.filePath);
			components.query	= lc(url.query);
			components.file_ext	= lc(url.fileExtension);
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
		var self = this;
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

//					if (! self.is_case_sensitive){
						header_key = header_key.toLowerCase();
//					}
					this.headers[ header_key ] = header_value;
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

	"get_HTTP_POST_data": function(httpChannel){
		var self = this;
		var uploadChannel, uploadChannelStream, stream, postBytes, postStr;

		postStr = '';
		try {
			uploadChannel			= httpChannel.QueryInterface(Ci.nsIUploadChannel);
			uploadChannelStream		= uploadChannel.uploadStream;
			uploadChannelStream.QueryInterface(Ci.nsISeekableStream).seek(Ci.nsISeekableStream.NS_SEEK_SET, 0);
			stream					= Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream);
			stream.setInputStream(uploadChannelStream);
			postBytes				= stream.readByteArray(stream.available());
			postStr					= String.fromCharCode.apply(null, postBytes);

			uploadChannelStream		= uploadChannel.uploadStream;
			uploadChannelStream.QueryInterface(Ci.nsISeekableStream).seek(Ci.nsISeekableStream.NS_SEEK_SET, 0);
		}
		catch(e){
			postStr = '';
			self.log('(get_HTTP_POST_data|error): ' + e.message);
		}
		finally {
			return postStr;
		}
	},

	"process_channel_rules_data": function(url, post_rule_callback){
		var self = this;
		var updated_headers = {};

		// sanity check: is there any work to do?
		if (! self.rules_data){return;}

		if (! self.is_case_sensitive){
			url = url.toLowerCase();
		}

		var run_function = function(f){
			// sanity check
			if (
				(typeof f !== 'function') ||
				(! self.sandbox)
			){return null;}

			var result;

			try {
				result = self.sandbox.call(f, false);
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
//					if (! self.is_case_sensitive){
						header_key = header_key.toLowerCase();
//					}
					updated_headers[ header_key ] = local_header_value;

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
	},

	"save_request": function(httpChannel){
		var self = this;

		// sanity check
		if (
			(! self.sandbox) ||
			(! self.sandbox.request) ||
			(! self.sandbox.request.method) ||
			(! self.sandbox.request.uri) ||
			(! self.sandbox.request.uri.href) ||
			(! self.request_persistence.is_enabled())
		){return false;}

		var request	= {
			"method"	: (self.sandbox.request.method.toLowerCase()),
			"url"		: (self.sandbox.request.uri.href),
			"headers"	: {}
		};

		switch(request.method){
			case 'post':
				request['post_data'] = self.get_HTTP_POST_data(httpChannel);
			case 'get':
				helper_functions.extend_object(request.headers, self.sandbox.request.headers.unmodified);
				helper_functions.extend_object(request.headers, self.sandbox.request.headers.updated);

				self.request_persistence.save(request);
				return true;
				break;
			default:
				// noop
				return false;
				break;
		}
	}

});

// ------------------------------------------------------------------------------------------------ "HTTP_Request_Stream":

var HTTP_Request_Stream = HTTP_Stream.extend({
	"init": function(request_persistence, auto_init){
		this.type		= 'request';
		this._super(request_persistence, auto_init);
		this.sandbox	= new HTTP_Request_Sandbox();
	},

	"process_channel": function(httpChannel){
		var self = this;
		var trigger_save = false;
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

				// add persistence
				self.sandbox.save = function(){
					trigger_save = true;
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

			if (trigger_save){
				self.save_request(httpChannel);
			}
		}
		catch(e){
			self.log('(process_channel|error): ' + e.message);
		}
		finally {
			self.sandbox.cleanup();
		}
	},

	"redirect_to": function(httpChannel, string_url){
		var self = this;
		try {
			var wm, win;

			httpChannel.cancel(Cr.NS_BINDING_ABORTED);

			wm	= Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
			win	= wm.getMostRecentWindow("navigator:browser");
			win.content.location = string_url;
		}
		catch(e){
            self.log("(redirect_to|error): couldn't assign URL to window.location: " + e.message);
        }
	}

});

// ------------------------------------------------------------------------------------------------ "HTTP_Response_Stream":

var HTTP_Response_Stream = HTTP_Stream.extend({
	"init": function(request_persistence, auto_init){
		this.type		= 'response';
		this._super(request_persistence, auto_init);
		this.sandbox	= new HTTP_Response_Sandbox();
	},

	"at_startup": function(){
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
			result	= self.sandbox.call(f, true);
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

	"process_channel": function(httpChannel){
		var self = this;
		var trigger_save = false;
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

				// add persistence
				self.sandbox.save = function(){
					trigger_save = true;
				};

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

			if (trigger_save){
				self.save_request(httpChannel);
			}
		}
		catch(e){
			self.log('(process_channel|error): ' + e.message);
		}
		finally {
			self.sandbox.cleanup();
		}
	}

});

// ------------------------------------------------------------------------------------------------ "Moz_Rewrite" XPCOM component boilerplate

function Moz_Rewrite() {
	this.wrappedJSObject			= this;
	this.prefs						= helper_functions.get_prefs();
	this.log						= helper_functions.wrap_console_log('moz-rewrite: ', false);
	this.debug						= null;
	this.observers					= [];
	this.HTTP_Request_Persistence	= new HTTP_Request_Persistence();
	this.HTTP_Request_Stream		= new HTTP_Request_Stream(this.HTTP_Request_Persistence, false);
	this.HTTP_Response_Stream		= new HTTP_Response_Stream(this.HTTP_Request_Persistence, false);
}

Moz_Rewrite.prototype = {

	// properties required for XPCOM registration:
	"classID"					: Components.ID("{6929f616-1eaf-43ca-aeeb-1109026ebc0e}"),
	"contractID"				: "@github.com/moz-rewrite/js/sandbox/nullprincipal;1",
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
		var initialize_common_objects = false;
		try {
			//self.debug = helper_functions.wrap_console_log('moz-rewrite: ', ( self.prefs.getBoolPref("debug") == false ));

			if (self.prefs.getBoolPref("request.enabled")){
				OS.addObserver(self, "http-on-modify-request", false);
				self.observers.push("http-on-modify-request");
				self.HTTP_Request_Stream.at_startup();
				self.HTTP_Request_Stream.set_case_sensitivity( self.prefs.getBoolPref("case_sensitive") );
				initialize_common_objects = true;
			}
			if (self.prefs.getBoolPref("response.enabled")){
				OS.addObserver(self, "http-on-examine-response", false);
				self.observers.push("http-on-examine-response");
				OS.addObserver(self, "http-on-examine-cached-response", false);
				self.observers.push("http-on-examine-cached-response");
				OS.addObserver(self, "http-on-examine-merged-response", false);
				self.observers.push("http-on-examine-merged-response");
				self.HTTP_Response_Stream.at_startup();
				self.HTTP_Response_Stream.set_case_sensitivity( self.prefs.getBoolPref("case_sensitive") );
				initialize_common_objects = true;
			}
			if (initialize_common_objects){
				self.HTTP_Request_Persistence.at_startup();
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

			self.HTTP_Response_Stream.at_shutdown();
			self.HTTP_Request_Stream.at_shutdown();
			self.HTTP_Request_Persistence.at_shutdown();

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
