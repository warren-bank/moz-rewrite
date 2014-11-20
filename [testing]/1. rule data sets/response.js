[
{
	"url": /^.*$/,
	"headers": function(){
		if (
			(response.content_type === 'application/zip') ||
			(response.headers.unmodified['content-disposition'])
		){
			self.log('saving request..');

			save();
		}
		return {};
	}
}
]