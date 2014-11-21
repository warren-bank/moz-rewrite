[{
	"url": /^.*$/,
	"headers": function(){
		if (request.method.toLowerCase() === 'post'){
			save();
		}
		return {};
	}
}]