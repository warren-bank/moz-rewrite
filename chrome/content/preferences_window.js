var prefwindow = {
	"open_file_find_dialog": function(element_id, dialog_title){
		var fpClass, file_picker, result, chosen_file, chosen_filepath, element;

		fpClass		= Components.interfaces.nsIFilePicker;
		file_picker	= Components.classes["@mozilla.org/filepicker;1"].createInstance(fpClass);
		file_picker.init(window, dialog_title, fpClass.modeOpen);

		file_picker.appendFilter("javascript", "*.js; *.txt");

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
