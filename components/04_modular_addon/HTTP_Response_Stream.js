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

var EXPORTED_SYMBOLS	= [ "HTTP_Response_Stream" ];

const Ci				= Components.interfaces;
const Cc				= Components.classes;
const Cu				= Components.utils;
const Cr				= Components.results;

Cu.import("resource://Moz-Rewrite/HTTP_Stream.js");
Cu.import("resource://Moz-Rewrite/HTTP_Response_Sandbox.js");
Cu.import("resource://Moz-Rewrite/helper_functions.js");

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
