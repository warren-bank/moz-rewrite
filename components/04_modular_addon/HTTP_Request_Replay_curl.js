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

var EXPORTED_SYMBOLS	= [ "HTTP_Request_Replay_curl" ];

const Ci				= Components.interfaces;
const Cc				= Components.classes;
const Cu				= Components.utils;
const Cr				= Components.results;

Cu.import("resource://Moz-Rewrite/HTTP_Request_Replay.js");

var HTTP_Request_Replay_curl = HTTP_Request_Replay.extend({
	"at_startup": function(){
		this._super();
		var self = this;

		// sanity check
		if (! self.download_directory){return;}

		try {
			// get file/directory handles
			self.binary_executable = self.get_file_handle('run.curl.executable_file.path');
		}
		catch(e){
			self.log('(at_startup|error): ' + e.message);
		}
	},

	"replay_request": function(request){
		var self = this;

		self.debug() && self.debug('(replay_request|checkpoint|1): ' + 'beginning sanity checks..');

		// validate file/directory handles
		if (! self.validate_file_handles()){return;}

		self.debug() && self.debug('(replay_request|checkpoint|2): ' + 'file handles are OK..');

		if (
			(! request) ||
			(! request.url)
		){return;}

		self.debug() && self.debug('(replay_request|checkpoint|3): ' + 'HTTP request is OK..');

		var curl_options, command_line_args, header_name, header_value;

		var push_args = function(args){
			for (var i=0; i<args.length; i++){
				command_line_args.push(args[i]);
			}
		};

		curl_options			= self.prefs.getCharPref('run.curl.options');
		command_line_args		= curl_options.split(/\s+/);

		/* --------------------------------------
		 * references:
		 *     http://curl.haxx.se/docs/manpage.html#OPTIONS
		 *     http://curl.haxx.se/docs/manpage.html#-O
		 *     http://curl.haxx.se/docs/manual.html
		 * topics:
		 *   - https://forums.mozilla.org/viewtopic.php?t=9784&p=20984
		 *     important takeaways:
		 *       - switch and value are separate array elements
		 *       - do NOT wrap long filepaths in quotes
		 *   - http://en.wikipedia.org/wiki/POST_%28HTTP%29#Use_for_submitting_web_forms
		 *     important takeaways:
		 *       - POST data is already URL encoded
		 * --------------------------------------
		 */

		/* --------------------------------------
		 * notes:
		 * ======
		 *		-q										MUST BE FIRST PARAMETER: don't search for curlrc file
		 *		-C -									continue/resume incomplete download
		 *		--globoff								don't glob url strings
		 *		--insecure								don't check SSL certificates
		 *		--no-keepalive
		 *		--no-sessionid
		 *		--location								follow redirects
		 *		--location-trusted						send credentials to redirect
		 *		--max-redirs 5
		 *
		 *		-H "header string"
		 *		--data-binary "post data (verbatim)"	will cause method to become POST, rather than GET (default)
		 *		--url <URL>
		 *
		 *		--max-time <seconds>
		 *		--connect-timeout <seconds>
		 *
		 *		--output <file>							full path to output file
		 *		--remote-name --remote-header-name		determines filename of output file from url and/or 'content-disposition' header, but saves to CWD
		 * --------------------------------------
		 */

		/* --------------------------------------
		 * BIG problem:
		 * ============
		 * topics:
		 *   - http://codeverge.com/mozilla.dev.extensions/process-initialization-path/1111243
		 *   - http://stackoverflow.com/questions/11956753/how-to-get-set-working-directory-for-nsiprocess-runasync
		 *   - https://bugzilla.mozilla.org/show_bug.cgi?id=484246#c12
		 *     important takeaways:
		 *       - there is no way to specify the CWD for a spawned process
		 *       - it is the same as "CurWorkD" within FF
		 *       - there is no way to change "CurWorkD" (within FF) prior to calling `nsIProcess.run()`
		 * summary:
		 *   - could append a filename to `self.download_directory.path`
		 *       ex: ["--output", (self.download_directory.path + '/foo.bar')]
		 *     but there's no way to determine the correct filename
		 *   - could allow 'curl' to determine the correct filename
		 *       ex: ["--remote-name", "--remote-header-name"]
		 *     but it would be saved to "CurWorkD"
		 * ideas:
		 *   - update the dialog window ("request_persistence.xul")
		 *       * add a checkbox next to the button having download tool options
		 *       * label the checkbox: choose download filepath interactively
		 *       * pass this boolean to: `replay_request(request, is_interactive)`
		 *   - when true, this method will open a nsIFilePicker
		 *       * if the return value is an nsIFile, then set the output filepath to match
		 *       * otherwise, allow the sub-class implementation of this method to decide its own default behavior
		 *           - 'wget' could download the file to the default download directory (preference value)
		 *           - 'curl' could NOT. it would either:
		 *                * need to download to the CWD.. whatever it happens to be
		 *                * force the user to pick again.. until the value is valid
		 *                  (or some limit of attempts is reached and the method quits)
		 * --------------------------------------
		 */

		// output filename (saved to CWD)
		push_args([ '--remote-name', '--remote-header-name' ]);

		// HTTP request headers
		if (request.headers){
			for (header_name in request.headers){
				header_value	= request.headers[header_name];

				push_args([ '-H', (header_name + ': ' + header_value) ]);
			}
		}

		// POST message body
		if (request.post_data){
			push_args([ '--data-binary', (request.post_data) ]);
		}

		// URL
		push_args([ '--url', (request.url) ]);

		self.debug() && self.debug('(replay_request|checkpoint|4): ' + 'spawning process => "' + self.binary_executable.path + '" "' + command_line_args.join('" "') + '"');

		self.run_process(self.binary_executable, command_line_args);
	}

});
