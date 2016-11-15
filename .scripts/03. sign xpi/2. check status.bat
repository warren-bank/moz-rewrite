@echo off

rem :: https://blog.mozilla.org/addons/2015/11/20/signing-api-now-available/
rem ::
rem :: http://addons-server.readthedocs.io/en/latest/topics/api/signing.html

call "%~dp0.\config.bat"

cd /D "%~dp0."

curl "%api_url%" --insecure -g -H "Authorization: JWT %JWT_token%" -o "%status_txt%"
