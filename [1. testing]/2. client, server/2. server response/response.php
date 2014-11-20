<?php
	if (
		(! empty($_POST)) &&
		(! empty($_POST['abc'])) &&
		($_POST['abc'] == '123')
	){
		header('content-type: application/zip');
		header('content-disposition: attachment; filename=demo.zip');
		print 'message received';
	}
	else {
		print 'message lost';
	}
?>