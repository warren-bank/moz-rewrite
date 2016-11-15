@echo off

call "%~dp0.\config.bat"

cd /D "%~dp0."

node "%~n0.js" >"%url_txt%"
