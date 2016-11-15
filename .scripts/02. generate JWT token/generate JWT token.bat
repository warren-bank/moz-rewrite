@echo off

call "%~dp0.\credentials.bat"

call npm install
cls

node index.js >"%~dp0.\token.txt"
