@echo off
cd /d "%~dp0api"
set PATH=%PATH%;C:\Ruby40-x64\bin;C:\Program Files\PostgreSQL\18\bin
ridk.cmd exec bundle exec rails server
