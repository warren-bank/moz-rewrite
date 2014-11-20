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

	"call": function(f, do_cleanup){
		var self = this;
		var code, result;

		if (typeof f === 'function'){
			code	= f.toSource() + '()';
			self.debug() && self.debug('(call|checkpoint|01): ' + code);

			result	= self.eval(code, do_cleanup);
		}
		else {
			result	= null;
		}
		return result;
	},

	"eval": function(code, do_cleanup){
		var self = this;
		var result = null;

		// want to execute (source) code while having arbitrary variables in the local scope
		var local_variables, names, values, name, wrapper_function;

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
			if (do_cleanup) self.cleanup();
			return result;
		}
	},

	"cleanup": function(){
	}

});
