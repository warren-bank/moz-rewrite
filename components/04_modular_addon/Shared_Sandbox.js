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

var EXPORTED_SYMBOLS	= [ "Shared_Sandbox" ];

const Ci				= Components.interfaces;
const Cc				= Components.classes;
const Cu				= Components.utils;
const Cr				= Components.results;

Cu.import("resource://Moz-Rewrite/Base_Sandbox.js");
Cu.import("resource://Moz-Rewrite/helper_functions.js");

var Shared_Sandbox = Base_Sandbox.extend({

	"init": function(){
		this._super();
	},

	"get_local_variables": function(){
		this.debug('(get_local_variables|Shared_Sandbox|checkpoint|01)');
		var self = this;

		return this.combine_local_variables(this._super(), {
			"md2"			: function(x){ return self.crypto('md2',    x); },
			"md5"			: function(x){ return self.crypto('md5',    x); },
			"sha1"			: function(x){ return self.crypto('sha1',   x); },
			"sha256"		: function(x){ return self.crypto('sha256', x); },
			"sha384"		: function(x){ return self.crypto('sha384', x); },
			"sha512"		: function(x){ return self.crypto('sha512', x); },
			"format_date"	: self.format_date,
			"btoa"			: self.btoa.bind(self),
			"atob"			: self.atob.bind(self),

			// aliases
			"base64_encode"	: self.btoa.bind(self),
			"base64_decode"	: self.atob.bind(self)
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
	}

});
