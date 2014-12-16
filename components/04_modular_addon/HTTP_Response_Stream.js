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

var EXPORTED_SYMBOLS	= [ "HTTP_Response_Stream" ];

const Ci				= Components.interfaces;
const Cc				= Components.classes;
const Cu				= Components.utils;
const Cr				= Components.results;

Cu.import("resource://Moz-Safe-Rewrite/HTTP_Stream.js");

var HTTP_Response_Stream = HTTP_Stream.extend({
	"init": function(auto_init){
		this.type		= 'response';
		this._super(auto_init);
	},

	"process_channel":	function(httpChannel){
		var self = this;
		var url, updated_headers, header_key, header_value;

		// sanity check: is there any work to do?
		if (! self.rules_data){return;}

		try {
			// get URL of the requested page, to match against regex patterns in the rules data
			url = httpChannel.URI.spec;

			updated_headers = self.process_channel_rules_data(url);

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
