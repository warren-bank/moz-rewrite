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

var EXPORTED_SYMBOLS	= [ "HTTP_Request_Replay" ];

const Ci				= Components.interfaces;
const Cc				= Components.classes;
const Cu				= Components.utils;
const Cr				= Components.results;

Cu.import("resource://Moz-Rewrite/Class.js");
Cu.import("resource://Moz-Rewrite/helper_functions.js");

var HTTP_Request_Replay = Class.extend({
	"init": function(request_persistence){
		this.prefs					= helper_functions.get_prefs('request_persistence.replay.');
		this.log					= helper_functions.wrap_console_log(('HTTP_request_replay: '), false);
		this.debug					= null;
		this.binary_executable		= null;
		this.download_directory		= null;
		this.request_persistence	= request_persistence;
	},

	"at_startup": function(){
		var self = this;

		try {
			// (re)initialize state
			self.binary_executable	= null;
			self.download_directory	= null;

			// check that this stream is enabled
			if (! self.request_persistence.is_enabled()){return;}

			// (re)initialize debugging logger
			(function(){
				var is_disabled;
				is_disabled			= ( (helper_functions.get_prefs()).getBoolPref("debug") == false );
				self.debug			= helper_functions.wrap_console_log('HTTP_request_replay: ', is_disabled);
			})();

			// get file/directory handles
			self.download_directory	= self.get_file_handle('download_directory.path');
		}
		catch(e){
			self.log('(at_startup|error): ' + e.message);
		}
	},

	"get_file_handle": function(pref_path){
		var self = this;

		return helper_functions.get_file_from_preference(pref_path, self.prefs, self.log, self.debug);
	},

	"validate_file_handles": function(download_file){
		var self = this;

		return (
			(download_file) ?
			(
				(helper_functions.is_file_handle_usable(download_file,           ['isFile','isReadable','isWritable'])) &&
				(helper_functions.is_file_handle_usable(self.binary_executable,  ['isFile','isExecutable']))
			) :
			(
				(helper_functions.is_file_handle_usable(self.download_directory, ['isDirectory','isReadable','isWritable'])) &&
				(helper_functions.is_file_handle_usable(self.binary_executable,  ['isFile','isExecutable']))
			)
		);
	},

	"replay_request_id": function(id, download_file){
		/* --------------------------------------
		 * since there's no way to capture stdout,
		 * the method signature does NOT include a `user_callback` function.
		 * --------------------------------------
		 */
		var self = this;
		var callback;

		self.debug() && self.debug('(replay_request_id|checkpoint|1): ' + 'beginning sanity checks..');

		// validate file/directory handles
		if (! self.validate_file_handles(download_file)){return;}

		self.debug() && self.debug('(replay_request_id|checkpoint|2): ' + 'file handles are OK..');

		callback = function(request){
			self.replay_request(request, download_file);
		};
		self.request_persistence.get_saved_request(id, callback);
	},

	"replay_request": function(request, download_file){
		// abstract function

		/* --------------------------------------
		 * since there's no way to capture stdout,
		 * the method signature does NOT include a `user_callback` function.
		 * --------------------------------------
		 */
	},

	"run_process" : function(executable_file, command_line_args){
		var self = this;
		/* --------------------------------------
		 * on the topic of capturing stdout from `nsIProcess`:
		 *     https://developer.mozilla.org/en-US/Add-ons/Code_snippets/Running_applications
		 *     https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIProcess#run()
		 *
		 * according to these threads:
		 *     http://forums.mozillazine.org/viewtopic.php?f=19&p=9726071
		 *     https://groups.google.com/forum/#!topic/mozilla.dev.extensions/DoDETBB6WbA
		 * it simply isn't possible.
		 * --------------------------------------
		 */
		var process;

		try {
			command_line_args	= command_line_args || [];
			process				= Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
			process.init(executable_file);
			process.run(false, command_line_args, command_line_args.length);

			self.debug() && self.debug('(run_process|checkpoint|1): ' + 'process now running = ' + executable_file.leafName);
		}
		catch(e){
			self.log('(run_process|error): ' + e.message);
		}
	},

	"at_shutdown": function(){
		this.binary_executable		= null;
		this.download_directory		= null;
		this.debug					= null;
	}

});
