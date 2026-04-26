#!/bin/bash
cd "$(dirname "$0")/api"

# Requires rbenv or asdf with Ruby 4.0.1 installed
# Install rbenv: brew install rbenv && rbenv install 4.0.1

bundle exec rails server
