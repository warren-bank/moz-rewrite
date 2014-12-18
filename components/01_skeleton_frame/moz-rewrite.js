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

const Ci			= Components.interfaces;
const Cc			= Components.classes;
const Cu			= Components.utils;
const Cr			= Components.results;

const IOS			= Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
const OS			= Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService);
const CONSOLE		= Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

var console_log		= function(text){
	CONSOLE.logStringMessage("moz-rewrite: " + text);
};

var get_prefs		= function() {
	var branch_name = "extensions.Moz-Rewrite.";

	return Cc["@mozilla.org/preferences-service;1"]
				.getService(Ci.nsIPrefService)
				.getBranch(branch_name);
};

// ------------------------------------------------------------------------------------------------ "Moz_Rewrite" XPCOM component boilerplate

function Moz_Rewrite() {
	this.wrappedJSObject		= this;
	this.log					= console_log;
	this.prefs					= get_prefs();
	this.observers				= [];
}

Moz_Rewrite.prototype = {

	// properties required for XPCOM registration:
	"classID"					: Components.ID("{6929f616-1eaf-43ca-aeeb-1109026ebc0e}"),
	"contractID"				: "@github.com/moz-rewrite/js/sandbox/nullprincipal;1",
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

			case 'http-on-modify-request':
				(function(){
					try {
						var httpChannel;

						httpChannel		= subject.QueryInterface(Ci.nsIHttpChannel);

						// do something..
						// for example, always redirect Yahoo search engine queries to Google

						var uri, url, query, search_term, string_url;

						uri				= httpChannel.URI;
						if (uri.host.toLowerCase() !== 'search.yahoo.com'){return;}

						url				= uri.QueryInterface(Components.interfaces.nsIURL);
						query			= url.query;

						search_term		= ( /(?:^|&)p=(.*?)(?:&|$)/i ).exec(query);
						if (search_term === null){return;}
						search_term		= search_term[1];
						string_url		= 'https://www.google.com/search?q=' + search_term;

						self.redirect_to(httpChannel, string_url, 2);
					}
					catch(e){
						self.log('(observe|request|error): ' + e.message);
					}
				})();
				break;

			case 'http-on-examine-response':
			case 'http-on-examine-cached-response':
			case 'http-on-examine-merged-response':
				(function(){
					try {
						var httpChannel;

						httpChannel		= subject.QueryInterface(Ci.nsIHttpChannel);

						// do something..
						// for example, add a 'content-disposition' header with a silly name to all .zip downloads

						var content_type, content_disposition;

						content_type	= httpChannel.contentType;

						if (content_type === 'application/zip'){
							content_disposition	= 'attachment; filename=moz_rewrite_says_hello_world.zip';
							httpChannel.setResponseHeader('content-disposition', content_disposition, false);
						}
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
		try {
			if (self.prefs.getBoolPref("request.enabled")){
				OS.addObserver(self, "http-on-modify-request", false);
				self.observers.push("http-on-modify-request");
			}
			if (self.prefs.getBoolPref("response.enabled")){
				OS.addObserver(self, "http-on-examine-response", false);
				self.observers.push("http-on-examine-response");
				OS.addObserver(self, "http-on-examine-cached-response", false);
				self.observers.push("http-on-examine-cached-response");
				OS.addObserver(self, "http-on-examine-merged-response", false);
				self.observers.push("http-on-examine-merged-response");
			}
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

			while(self.observers && self.observers.length){
				OS.removeObserver(self, self.observers.shift(), false);
			}

			OS.addObserver(self, "profile-after-change", false);
		}
		catch(e){
            self.log("(at_shutdown|error): couldn't remove observers: " + e.message);
        }
	},

	"redirect_to":				function(http_channel, string_url, method){
		switch(method){
			case 1:
				(function(){
					var new_uri;
					new_uri		= IOS.newURI(string_url, null, null);
					http_channel.redirectTo(new_uri);
				})();
				break;
			case 2:
				(function(){
					var wm, win;

					http_channel.cancel(Cr.NS_BINDING_ABORTED);

					wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
								.getService(Components.interfaces.nsIWindowMediator);
					win = wm.getMostRecentWindow(null);
					win.content.location = string_url;
				})();
				break;
			case 3:
				(function(){
					var utils, gBrowser, domWin, browser, new_uri;

					utils		= require('sdk/window/utils');
					gBrowser	= utils.getMostRecentBrowserWindow().gBrowser;
					domWin		= http_channel.notificationCallbacks.getInterface(Ci.nsIDOMWindow);
					browser		= gBrowser.getBrowserForDocument(domWin.top.document);
					new_uri		= IOS.newURI(string_url, null, null);
					browser.loadURI(new_uri);
				})();
				break;
			case 4:
				(function(){
				})();
				break;
			default:
				break;
		}
	}

};

// ------------------------------------------------------------------------------------------------ "XPCOMUtils" registration:

if (XPCOMUtils.generateNSGetFactory)
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([Moz_Rewrite]);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule([Moz_Rewrite]);
