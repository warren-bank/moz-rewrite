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

var EXPORTED_SYMBOLS	= [ "HTTP_Response_Sandbox" ];

const Ci				= Components.interfaces;
const Cc				= Components.classes;
const Cu				= Components.utils;
const Cr				= Components.results;

Cu.import("resource://Moz-Rewrite/Shared_Sandbox.js");

var HTTP_Response_Sandbox = Shared_Sandbox.extend({

	"init": function(){
		this._super();

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
