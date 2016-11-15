set unsigned_xpi=../01. build xpi/moz-rewrite-js.xpi
set status_txt=status.txt
set url_txt=url.txt
set signed_xpi=moz-rewrite-js.xpi

set /P JWT_token=<"%~dp0..\02. generate JWT token\token.txt"

set addon_id=moz-rewrite-js@warren-bank.github.com
set addon_version=1.02
set api_url=https://addons.mozilla.org/api/v3/addons/%addon_id%/versions/%addon_version%/
