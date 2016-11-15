@echo off

rem :: https://blog.mozilla.org/addons/2015/11/20/signing-api-now-available/
rem ::
rem :: http://addons-server.readthedocs.io/en/latest/topics/api/signing.html
rem ::
rem :: https://curl.haxx.se/docs/manpage.html#-F

call "%~dp0.\config.bat"

cd /D "%~dp0."

curl "%api_url%" --insecure -g -XPUT --form "upload=@%unsigned_xpi%" -H "Authorization: JWT %JWT_token%" -o "%status_txt%"
