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

var EXPORTED_SYMBOLS	= [ "Base_Sandbox" ];

const Ci				= Components.interfaces;
const Cc				= Components.classes;
const Cu				= Components.utils;
const Cr				= Components.results;

Cu.import("resource://Moz-Rewrite/Class.js");
Cu.import("resource://Moz-Rewrite/helper_functions.js");
Cu.import("resource://Moz-Rewrite/cu_sandbox.js");

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
