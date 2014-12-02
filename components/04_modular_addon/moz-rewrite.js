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

const Ci	= Components.interfaces;
const Cc	= Components.classes;
const Cu	= Components.utils;
const Cr	= Components.results;
const OS	= Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService);

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

Cu.import("resource://Moz-Rewrite/helper_functions.js");
Cu.import("resource://Moz-Rewrite/HTTP_Request_Persistence.js");
Cu.import("resource://Moz-Rewrite/HTTP_Request_Stream.js");
Cu.import("resource://Moz-Rewrite/HTTP_Response_Stream.js");

// ------------------------------------------------------------------------------------------------ "Moz_Rewrite" XPCOM component boilerplate

function Moz_Rewrite() {
	this.wrappedJSObject			= this;
	this.prefs						= helper_functions.get_prefs();
	this.log						= helper_functions.wrap_console_log('moz-rewrite: ', false);
	this.debug						= null;
	this.observers					= [];
	this.HTTP_Request_Persistence	= new HTTP_Request_Persistence();
	this.HTTP_Request_Stream		= new HTTP_Request_Stream(this.HTTP_Request_Persistence, false);
	this.HTTP_Response_Stream		= new HTTP_Response_Stream(this.HTTP_Request_Persistence, false);
}

Moz_Rewrite.prototype = {

	// properties required for XPCOM registration:
	"classID"					: Components.ID("{1f5c019c-16d0-4c8e-a397-effac1253135}"),
	"contractID"				: "@github.com/moz-rewrite;1",
	"classDescription"			: "A light-weight (pseudo) rules-engine to easily modify HTTP headers in either direction",

	"_xpcom_factory"			: {
		"createInstance"		: function (outer, iid) {
			if (outer != null)
				throw Cr.NS_ERROR_NO_AGGREGATION;
			if (!Moz_Rewrite.instance)
				Moz_Rewrite.instance = new Moz_Rewrite();
			return Moz_Rewrite.instance.QueryInterface(iid);
		},
		"QueryInterface"		: XPCOMUtils.generateQI([
				Ci.nsISupports,
				Ci.nsIModule,
				Ci.nsIFactory
		])
	},

	// [optional] an array of categories to register this component in.
	"_xpcom_categories"			: [
		{"category": "app-startup", "service": true},
		{"category": "profile-after-change"}
	],

	// QueryInterface implementation, e.g. using the generateQI helper
	"QueryInterface"			: XPCOMUtils.generateQI([
		Ci.nsIObserver,
		Ci.nsISupports
	]),

	"observe"					: function(subject, topic, data){
		// sanity check
		if (typeof topic !== 'string'){return;}

		var self = this;

		switch(topic.toLowerCase()){

			case 'profile-after-change':
				self.at_startup();
				break;

			case 'profile-before-change':
				self.at_shutdown();
				break;

			case 'nspref:changed':
				// addon preferences have been changed.
				// perform a complete restart.

				// adding a timer to create a little separation (between shutdown and startup) may be unnecessary,
				// but I want to make sure that no stale notifications are received.

				self.at_shutdown();
				//self.at_startup();

				(function(){
					var timeout, event, delay;
					timeout	= Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
					event	= {
						"notify": function(){
							self.at_startup();
						}
					};
					delay	= 1000;
					timeout.initWithCallback(event, delay, Ci.nsITimer.TYPE_ONE_SHOT);
				})();
				break;

			case 'http-on-modify-request':
				(function(){
					try {
						var httpChannel = subject.QueryInterface(Ci.nsIHttpChannel);

						self.HTTP_Request_Stream.process_channel(httpChannel);
					}
					catch(e){
						self.log('(observe|request|error): ' + e.message);
					}
				})();
				break;

			case 'http-on-examine-response':
				(function(){
					try {
						var httpChannel = subject.QueryInterface(Ci.nsIHttpChannel);

						self.HTTP_Response_Stream.process_channel(httpChannel);
					}
					catch(e){
						self.log('(observe|response|error): ' + e.message);
					}
				})();
				break;
		}
	},

	"at_startup":				function(){
		var self = this;
		var initialize_common_objects = false;
		try {
			//self.debug = helper_functions.wrap_console_log('moz-rewrite: ', ( self.prefs.getBoolPref("debug") == false ));

			if (self.prefs.getBoolPref("request.enabled")){
				OS.addObserver(self, "http-on-modify-request", false);
				self.observers.push("http-on-modify-request");
				self.HTTP_Request_Stream.at_startup();
				self.HTTP_Request_Stream.set_case_sensitivity( self.prefs.getBoolPref("case_sensitive") );
				initialize_common_objects = true;
			}
			if (self.prefs.getBoolPref("response.enabled")){
				OS.addObserver(self, "http-on-examine-response", false);
				self.observers.push("http-on-examine-response");
				self.HTTP_Response_Stream.at_startup();
				self.HTTP_Response_Stream.set_case_sensitivity( self.prefs.getBoolPref("case_sensitive") );
				initialize_common_objects = true;
			}
			if (initialize_common_objects){
				self.HTTP_Request_Persistence.at_startup();
			}
			if (!("addObserver" in self.prefs)){
				self.prefs.QueryInterface(Ci.nsIPrefBranch2);
			}
			self.prefs.addObserver("", self, false);
			OS.addObserver(self, "profile-before-change", false);
		}
		catch(e){
            self.log("(at_startup|error): couldn't add observers: " + e.message);
        }
	},

	"at_shutdown":				function(){
		var self = this;
		try {
			OS.removeObserver(self, "profile-before-change", false);
			self.prefs.removeObserver("", self);

			while(self.observers && self.observers.length){
				OS.removeObserver(self, self.observers.shift(), false);
			}

			self.HTTP_Response_Stream.at_shutdown();
			self.HTTP_Request_Stream.at_shutdown();
			self.HTTP_Request_Persistence.at_shutdown();

			OS.addObserver(self, "profile-after-change", false);
			self.debug = null;
		}
		catch(e){
            self.log("(at_shutdown|error): couldn't remove observers: " + e.message);
        }
	}

};

// ------------------------------------------------------------------------------------------------ "XPCOMUtils" registration:

if (XPCOMUtils.generateNSGetFactory)
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([Moz_Rewrite]);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule([Moz_Rewrite]);
