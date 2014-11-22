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

var EXPORTED_SYMBOLS	= [ "helper_functions" ];

const Ci				= Components.interfaces;
const Cc				= Components.classes;
const Cu				= Components.utils;
const Cr				= Components.results;
const CONSOLE			= Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);

Cu.import("resource://gre/modules/FileUtils.jsm");

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
