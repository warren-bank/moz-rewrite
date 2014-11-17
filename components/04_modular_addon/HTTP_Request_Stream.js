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

var EXPORTED_SYMBOLS	= [ "HTTP_Request_Stream" ];

const Ci				= Components.interfaces;
const Cc				= Components.classes;
const Cu				= Components.utils;
const Cr				= Components.results;

Cu.import("resource://Moz-Rewrite/HTTP_Stream.js");
Cu.import("resource://Moz-Rewrite/HTTP_Request_Sandbox.js");

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
