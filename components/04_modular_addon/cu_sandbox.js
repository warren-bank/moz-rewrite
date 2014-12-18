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

var EXPORTED_SYMBOLS	= [ "cu_sandbox" ];

const Ci				= Components.interfaces;
const Cc				= Components.classes;
const Cu				= Components.utils;
const Cr				= Components.results;

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
			"sandboxPrototype"		: {},
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
