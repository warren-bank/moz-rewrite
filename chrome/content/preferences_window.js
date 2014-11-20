var prefwindow = {
	"open_file_find_dialog": function(element_id, dialog_title, filters, mode){
		var fpClass, file_picker, i, result, chosen_file, chosen_filepath, element;

		// default filter: if input value isn't an array. allow empty arrays to pass through.
		if (
			(typeof filters !== 'object') ||
			(filters === null) ||
			(typeof filters.length !== 'number')
		){
			filters	= [
				["javascript", "*.js; *.txt"]
			];
		}

		// default mode
		mode		= mode || 'modeOpen';

		fpClass		= Components.interfaces.nsIFilePicker;
		file_picker	= Components.classes["@mozilla.org/filepicker;1"].createInstance(fpClass);
		file_picker.init(window, dialog_title, fpClass[mode]);

		for (i=0; i<filters.length; i++){
			switch(typeof filters[i]){
				case 'string':
					// https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIFilePicker#Filter_constants
					// ex: 'filterApps'
					file_picker.appendFilters( fpClass[ filters[i] ] );
					break;
				case 'object':
					// sanity check
					if (
						(filters[i] !== null) &&
						(typeof filters[i].length === 'number')
					){
						if (
							(filters[i].length === 1)
						){
							file_picker.appendFilters( fpClass[ filters[i][0] ] );
						}
						else if (
							(filters[i].length === 2)
						){
							file_picker.appendFilter( filters[i][0], filters[i][1] );
						}
					}
					break;
			}
		}

		result		= file_picker.show();
		if (result != fpClass.returnCancel){
			chosen_file			= file_picker.file;
			chosen_filepath		= chosen_file.path;
			element				= window.document.getElementById(element_id);
			element.value		= chosen_filepath;

			try {
				// https://developer.mozilla.org/en-US/Add-ons/Inline_Options#Setting_element_changed_notifications
				// http://mxr.mozilla.org/mozilla-release/source/toolkit/mozapps/extensions/content/setting.xml
				// http://forums.mozillazine.org/viewtopic.php?f=19&t=1295865

				(function(){
					var event = document.createEvent("Event");
					event.initEvent("change", true, false);
					element.dispatchEvent(event);
				})();
			}
			catch(e){}
		}
	}
};
