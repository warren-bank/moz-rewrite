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

var EXPORTED_SYMBOLS	= [ "helper_functions" ];

const Ci				= Components.interfaces;
const Cc				= Components.classes;
const Cu				= Components.utils;
const Cr				= Components.results;
const CONSOLE			= Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);

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
