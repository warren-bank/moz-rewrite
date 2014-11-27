var moz_rewrite_request_persistence_dialog = {

/* ----------------------------------------------
/* comment out when not testing..
 * ----------------------------------------------
 *-/
	"debug": function(msg){
		const CONSOLE = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);

		CONSOLE.logStringMessage(msg);
	},

	"debug_on_load": function(){
		var self = moz_rewrite_request_persistence_dialog;
		var parent_node = self.get_parent_node();

		self.add_request({"id":11111, "url":"http://aaa.aaa/aaa?aaa=aaa&aa=aa&a=a"}, parent_node);
		self.add_request({"id":22222, "url":"http://bbb.bbb/bbb?bbb=bbb&bb=bb&b=b"}, parent_node);
		self.add_request({"id":33333, "url":"http://ccc.ccc/ccc?ccc=ccc&cc=cc&c=c"}, parent_node);
		self.add_request({"id":44444, "url":"http://ddd.ddd/ddd?ddd=ddd&dd=dd&d=d"}, parent_node);
		self.add_request({"id":55555, "url":"http://eee.eee/eee?eee=eee&ee=ee&e=e&more=00000000000000000000000000000000000000000000000000000000000"}, parent_node);
	},
/* ---------------------------------------------- */

	"load_requests": function(){
		var self = moz_rewrite_request_persistence_dialog;
		var request_persistence, callback;

		Components.utils.import("resource://Moz-Rewrite/HTTP_Request_Persistence.js");
		request_persistence = new HTTP_Request_Persistence();
		request_persistence.at_startup();

		callback = function(requests){
			self.requests				= requests;
			self.request_persistence	= request_persistence;

			var parent_node, i, request;

			parent_node = self.get_parent_node();

			for (var i=0; i<requests.length; i++){
				request = requests[i];
				self.add_request(request, parent_node);
			}

			self.resize_recenter_dialog_window();
		};
		request_persistence.get_saved_requests(callback);
	},

	"add_request": function(request, parent_node){
		const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
		var self = moz_rewrite_request_persistence_dialog;
		var label, child_node;

		label = self.get_truncated_request_url(request, 150);

		child_node = document.createElementNS(XUL_NS, 'checkbox');
		child_node.setAttribute('checked', 'false');
		child_node.setAttribute('label', label);
		child_node.setAttribute('id', ('' + request.id));

		parent_node.appendChild(child_node);
	},

	"resize_recenter_dialog_window": function(){
		var width, height, window_offset;

		width = {
			"before"	: window.innerWidth
		};
		height = {
			"before"	: window.innerHeight
		};

		window.sizeToContent();

		width.after		= window.innerWidth;
		width.delta		= (width.after - width.before);

		height.after	= window.innerHeight;
		height.delta	= (height.after - height.before);

		window_offset	= {
			"x"			: Math.floor( (-1)*(width.delta  / 2) ),
			"y"			: Math.floor( (-1)*(height.delta / 2) )
		};

		window.moveBy(window_offset.x, window_offset.y);
	},

	"get_parent_node": function(){
		var parent_node = document.getElementById('moz_rewrite_persistent_requests');
		return parent_node;
	},

	"get_selected_request_ids": function(){
		var self = moz_rewrite_request_persistence_dialog;
		var ids, parent_node, checkboxes, i, checkbox, id;

		ids			= [];
		parent_node	= self.get_parent_node();
		checkboxes	= parent_node.getElementsByTagName('checkbox');

		if (checkboxes && checkboxes.length){
			for (i=0; i<checkboxes.length; i++){
				checkbox	= checkboxes[i];
				if (checkbox.checked){
					id		= checkbox.getAttribute('id');
					if (id){
						id	= parseInt(id, 10);
						if (! isNaN(id)){
							ids.push(id);
						}
					}
				}
			}
		}
		return ids;
	},

	"get_interactive_mode": function(){
		var checkbox, result, dialog_title_prefix;

		checkbox			= document.getElementById('moz_rewrite_interactive_mode');
		result				= (!! checkbox.checked);
		dialog_title_prefix	= (result) ? (checkbox.getAttribute('dialog_title_prefix')) : null;

		return [result, dialog_title_prefix];
	},

	"get_replayer": function(type){
		var self = moz_rewrite_request_persistence_dialog;
		var replayer;

		replayer = null;

		// sanity check
		if (
			(! type) ||
			(typeof type !== 'string')
		){return replayer;}

		type = type.toLowerCase();

		// cache setup
		if (! self.replayer_cache){self.replayer_cache = {};}

		if (
				(typeof self.replayer_cache[type] === 'object')
		//	&&	(self.replayer_cache[type] instanceof HTTP_Request_Replay)
		){
			replayer = self.replayer_cache[type];
		}
		else {
			switch (type){
				case 'wget':
					Components.utils.import("resource://Moz-Rewrite/HTTP_Request_Replay_wget.js");
					if (typeof HTTP_Request_Replay_wget === 'function'){
						self.replayer_cache[type]	= new HTTP_Request_Replay_wget( self.request_persistence );
						self.replayer_cache[type].at_startup();
						replayer					= self.replayer_cache[type];
					}
					break;
				default:
					break;
			}
		}

		return replayer;
	},

	"get_truncated_request_url": function(request, max_length){
		return (
			(request.url.length > max_length)? (request.url.substring(0, (max_length-2)) + '..') : request.url
		);
	},

	"find_request_by_id": function(id){
		var self = moz_rewrite_request_persistence_dialog;
		var request, i;

		request = null;
		if (self.requests && self.requests.length){
			for (i=0; i<self.requests.length; i++){
				if (self.requests[i]['id'] === id){
					request = self.requests[i];
					break;
				}
			}
		}
		return request;
	},

	"find_download_file": function(dialog_title){
		var fpClass, file_picker, result, download_file;

		fpClass				= Components.interfaces.nsIFilePicker;
		file_picker			= Components.classes["@mozilla.org/filepicker;1"].createInstance(fpClass);
		file_picker.init(window, dialog_title, fpClass.modeOpen);

		result				= file_picker.show();
		if (result !== fpClass.returnCancel){
			download_file	= file_picker.file;
		}

		return download_file;
	},

	"on_load": function(){
		var self = moz_rewrite_request_persistence_dialog;

		self.debug && self.debug('dialog is loaded..');
		self.debug_on_load && self.debug_on_load();

		self.load_requests();
	},

	"on_replay": function(type){
		var self = moz_rewrite_request_persistence_dialog;

		self.debug && self.debug('starting replay using: "' + type + '"');

		var selected_request_ids, interactive_mode, dialog_title_prefix, replayer, i, id, request, download_file, dialog_title;

		selected_request_ids	= self.get_selected_request_ids();
		if (! selected_request_ids){return;}

		interactive_mode		= self.get_interactive_mode();
		dialog_title_prefix		= interactive_mode[1];
		interactive_mode		= interactive_mode[0];

		replayer				= self.get_replayer(type);
		if (! replayer){return;}

		for (i=0; i<selected_request_ids.length; i++){
			id					= selected_request_ids[i];
			request				= self.find_request_by_id(id);
			if (request){
				download_file	= null;

				if (interactive_mode){
					dialog_title	= dialog_title_prefix + self.get_truncated_request_url(request, 70);
					download_file	= self.find_download_file(dialog_title);
				}

				replayer.replay_request(request, download_file);
			}
		}
	},

	"on_unload": function(){
		var self = moz_rewrite_request_persistence_dialog;

		self.debug && self.debug('dialog is closing..');

		var type;
		for (type in self.replayer_cache){
			self.replayer_cache[type].at_shutdown();
			self.replayer_cache[type] = undefined;
		}

		self.request_persistence.at_shutdown();
		self.request_persistence = undefined;
	}

};

window.addEventListener("load",   moz_rewrite_request_persistence_dialog.on_load,   false);
window.addEventListener("unload", moz_rewrite_request_persistence_dialog.on_unload, false);
