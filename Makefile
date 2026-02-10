SHELL := /bin/bash

.PHONY: install build typecheck lint test coverage clean cli

install:
	npm install

build:
	npm run build

typecheck:
	npm run typecheck

lint:
	npm run lint

test:
	npm test

coverage:
	npm run test:coverage

cli:
	npm run cli -- --help

clean:
	rm -rf dist coverage

