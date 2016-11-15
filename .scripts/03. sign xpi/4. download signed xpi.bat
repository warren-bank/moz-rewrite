@echo off

call "%~dp0.\config.bat"

cd /D "%~dp0."

set /P download_url=<"%url_txt%"

curl "%download_url%" --insecure -g -L -H "Authorization: JWT %JWT_token%" -o "%signed_xpi%"
