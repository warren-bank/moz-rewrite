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

var EXPORTED_SYMBOLS	= [ "HTTP_Request_Persistence" ];

const Ci				= Components.interfaces;
const Cc				= Components.classes;
const Cu				= Components.utils;
const Cr				= Components.results;

Cu.import("resource://gre/modules/NetUtil.jsm");

Cu.import("resource://Moz-Rewrite/Class.js");
Cu.import("resource://Moz-Rewrite/helper_functions.js");

var HTTP_Request_Persistence = Class.extend({
	"init": function(){
		this.prefs					= helper_functions.get_prefs('request_persistence.');
		this.log					= helper_functions.wrap_console_log(('HTTP_request_persistence: '), false);
		this.debug					= null;
		this.save_file				= null;
		this.is_locked				= false;
		this.request_queue			= [];
		this.read_queue				= [];
	},

	"at_startup": function(){
		var self = this;

		try {
			// (re)initialize state
			self.save_file			= null;
			self.request_queue		= [];
			self.is_locked			= false;
			self.read_queue			= [];

			// check that this stream is enabled
			if (! self.is_enabled()){return;}

			// (re)initialize debugging logger
			(function(){
				var is_disabled;
				is_disabled			= ( (helper_functions.get_prefs()).getBoolPref("debug") == false );
				self.debug			= helper_functions.wrap_console_log('HTTP_request_persistence: ', is_disabled);
			})();

			// get file/directory handles
			self.save_file			= self.get_file_handle('save_file.path');
		}
		catch(e){
			self.log('(at_startup|error): ' + e.message);
		}
	},

	"is_enabled": function(){
		return this.prefs.getBoolPref("enabled");
	},

	"get_file_handle": function(pref_path){
		var self = this;

		return helper_functions.get_file_from_preference(pref_path, self.prefs, self.log, self.debug);
	},

	"unlock": function(){
		var self = this;

		self.is_locked = false;

		if (self.read_queue.length > 0){
			self.process_read_queue();
		}
		else if (self.request_queue.length > 0){
			self.process_request_queue();
		}
	},

	"save": function(request){
		var self = this;

		self.request_queue.push(request);
		if (! self.is_locked){
			self.process_request_queue();
		}
	},

	"process_request_queue": function(){
		var self = this;

		self.is_locked = true;

		var done = function(stop_processing){
			if (stop_processing){
				self.save_file			= null;
				self.request_queue		= [];
				self.unlock();
				return false;
			}
			else if (self.request_queue.length === 0) {
				self.unlock();
				return true;
			}
			else {
				return self.process_request_queue();
			}
		};

		var request, temp_file, temp_FileOutputStream, temp_UTF8_ConverterOutputStream;
		var maximum_capacity, line_counter;
		var save_LineInputStream, line, has_more;

		self.debug() && self.debug('(save|process_request_queue|checkpoint|1): ' + 'beginning sanity checks..');

		if (! helper_functions.is_file_handle_usable(self.save_file, ['isFile','isReadable','isWritable'])){return done(true);}

		if (self.request_queue.length === 0){return done();}

		self.debug() && self.debug('(save|process_request_queue|checkpoint|2): ' + 'sanity checks passed');

		var do_cleanup = function(){
			var close_stream = function(s){
				if (
					(s) &&
					(typeof s === 'object') &&
					(typeof s.close === 'function')
				){
					try {
						s.close();
					}
					catch(e){}
				}
			};

			close_stream(temp_FileOutputStream);
			close_stream(temp_UTF8_ConverterOutputStream);
			close_stream(save_LineInputStream);

			temp_FileOutputStream			= null;
			temp_UTF8_ConverterOutputStream	= null;
			save_LineInputStream			= null;
		};

		try {
			request							= self.request_queue.shift();

			// assign the request a unique `id` value (integer, 15 significant digits)
			request.id						= Math.floor( Math.random() * Math.pow(10,15) );

			// https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIFile
			// https://developer.mozilla.org/en-US/Add-ons/Code_snippets/File_I_O#Writing_a_File
			// https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIFileOutputStream
			temp_file = self.save_file.parent.clone();
			temp_file.append(self.save_file.leafName + '.temp');
			temp_FileOutputStream			= Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);

			self.debug() && self.debug('(save|process_request_queue|checkpoint|3): ' + 'temporary filepath = ' + temp_file.path);

			// https://developer.mozilla.org/en-US/docs/PR_Open#Parameters
			temp_FileOutputStream.init(temp_file, 0x02 | 0x08 | 0x20 | 0x40, 0600, 0);

			self.debug() && self.debug('(save|process_request_queue|checkpoint|4): ' + 'temporary file has been created = ' + temp_file.exists());

			temp_UTF8_ConverterOutputStream	= Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
			temp_UTF8_ConverterOutputStream.init(temp_FileOutputStream, "UTF-8", 0, 0);

			// prepend serialized data for the newest request
			temp_UTF8_ConverterOutputStream.writeString( JSON.stringify(request) + ',' + "\n" );

			maximum_capacity				= self.prefs.getIntPref('save_file.maximum_capacity');
			line_counter					= 1;

			if (
				(self.save_file.fileSize > 0) &&
				(
					(maximum_capacity === 0) ||
					(maximum_capacity > line_counter)
				)
			){
				// https://developer.mozilla.org/en-US/Add-ons/Code_snippets/File_I_O#Line_by_line
				save_LineInputStream		= Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
				save_LineInputStream.init(self.save_file, 0x01, 0400, 0);
				save_LineInputStream.QueryInterface(Ci.nsILineInputStream);

				do {
					line					= {"value": ""};
					has_more				= save_LineInputStream.readLine(line);
					if (line.value){
						temp_UTF8_ConverterOutputStream.writeString( line.value + "\n" );
						line_counter++;
					}
				} while(
					(has_more) &&
					(
						(maximum_capacity === 0) ||
						(maximum_capacity > line_counter)
					)
				);
			}

			self.debug() && self.debug('(save|process_request_queue|checkpoint|5): ' + line_counter + ' serialized HTTP Request objects have been written to the temporary file');

			// close all file streams
			do_cleanup();

			// replace save_file with temp_file
			// https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIFile#renameTo()
			self.save_file.remove(false);
			temp_file.renameTo( self.save_file.parent, self.save_file.leafName );

			// are file_handles equivalent now?
			if ( self.debug() ){
				(function(){
					var is_equivalent = self.save_file.equals(temp_file);
					self.debug('(save|process_request_queue|checkpoint|6): ' + 'the save_file and temp_file file handles are now equivalent = ' + is_equivalent);

					if (! is_equivalent){
						self.debug('(save|process_request_queue|checkpoint|7): ' + 'path to save_file = ' + self.save_file.path);
						self.debug('(save|process_request_queue|checkpoint|8): ' + 'path to temp_file = ' + temp_file.path);
					}
				})();
			}

			return done();
		}
		catch(e){
			self.log('(save|process_request_queue|error): ' + e.message);
			do_cleanup();
			return done(true);
		}
	},

	"get_saved_request": function(id, user_callback){
		var self = this;
		var callback;

		callback = function(data){
			var i, request;

			if (data === null){
				return user_callback(null);
			}

			for (i=0; i<data.length; i++){
				request = data[i];
				if (
					(request && request.id) &&
					(request.id === id)
				){
					return user_callback(request);
				}
			}
			return user_callback(null);
		};

		self.get_saved_requests(callback);
	},

	"get_saved_requests": function(callback){
		var self = this;

		self.read_queue.push(callback);
		if (! self.is_locked){
			self.process_read_queue();
		}
	},

	"process_read_queue": function(){
		var self = this;

		self.is_locked = true;

		var broadcast = function(data){
			var callback;

			while(self.read_queue.length > 0){
				callback = self.read_queue.shift();
				callback(data);
			}

			self.unlock();
			return true;
		};

		self.debug() && self.debug('(get_saved_requests|process_read_queue|checkpoint|1): ' + 'beginning sanity checks..');

		if (! helper_functions.is_file_handle_usable(self.save_file, ['isFile','isReadable'])){return broadcast(null);}

		if (self.read_queue.length === 0){return broadcast(null);}

		self.debug() && self.debug('(get_saved_requests|process_read_queue|checkpoint|2): ' + 'sanity checks passed');

		NetUtil.asyncFetch(self.save_file, function(inputStream, status) {
			var data;

			if (!Components.isSuccessCode(status)) {
				return broadcast(null);
			}

			try {
				data = NetUtil.readInputStreamToString(inputStream, inputStream.available());
				if (! data){
					return broadcast(null);
				}
				// rather than trimming the trailing ','.. it's simpler to just push() an empty object
				data = '[' + data + '{}]';
				data = JSON.parse(data);

				if (helper_functions.get_object_constructor_name(data, true) !== 'array'){
					return broadcast(null);
				}

				// remove the trailing empty object
				data.pop();
				if (data.length === 0){
					return broadcast(null);
				}

				// there's valid data in the array
				self.debug() && self.debug('(get_saved_requests|process_read_queue|asyncFetch|checkpoint|3): ' + data.length + ' HTTP Request objects have been read from save_file');
				return broadcast(data);
			}
			catch(e){
				self.log('(get_saved_requests|process_read_queue|asyncFetch|error): ' + e.message);
				return broadcast(null);
			}
		});

	},

	"at_shutdown": function(){
		this.save_file				= null;
		this.request_queue			= [];
		this.is_locked				= false;
		this.read_queue				= [];
		this.debug					= null;
	}

});
