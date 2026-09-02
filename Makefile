# Developer commands — these wrap the same tooling CI uses, they do not
# duplicate/reimplement it. If a step here and the corresponding step in
# .github/workflows/build-test-publish.yml ever diverge, that workflow file
# is the source of truth (fix this Makefile to match it, not the reverse).

.PHONY: dev-backend dev-frontend test test-http build-deploy clean

dev-backend:
	@if [ ! -f src/backend/config.php ]; then \
		echo "src/backend/config.php not found — copy src/backend/config.example.php,"; \
		echo "fill in a local/test DB, and set basePath to '' for this local server."; \
		exit 1; \
	fi
	cd src/backend && php -S localhost:8000 -t .

dev-frontend:
	cd src/frontend && npm start

# Runs everything that needs no DB/server: PHP engine smoke tests (pure
# calculation logic) + frontend typecheck. This is the fast, always-runnable
# subset — see test-http for the full HTTP regression.
test:
	@echo "== PHP engine smoke tests (no DB required) =="
	cd src/backend && php tests/smoke_test.php
	@echo "== Frontend typecheck =="
	cd src/frontend && npx tsc --noEmit

# Full HTTP API regression against a real running server + DB, exactly
# like the "Run PHP HTTP API tests" step in CI. Requires src/backend/config.php
# to point at a real, schema-loaded, seeded DB first (see docs/DEPLOY.md
# steps 3/5/6, against a local/test DB rather than production).
test-http:
	@if [ ! -f src/backend/config.php ]; then \
		echo "src/backend/config.php not found — see docs/DEPLOY.md steps 3/5/6"; \
		echo "to point this at a local test DB with schema+seed applied first."; \
		exit 1; \
	fi
	cd src/backend/api && (php -S 127.0.0.1:8080 index.php & echo $$! > /tmp/audit-api-test.pid)
	sleep 1
	cd src/backend && php tests/http_api_test.php http://127.0.0.1:8080 ; \
		kill $$(cat /tmp/audit-api-test.pid) 2>/dev/null ; rm -f /tmp/audit-api-test.pid

# Mirrors the CI "Assemble deployment artifact" step exactly, so you can
# inspect the real single-folder tree locally before it's ever published.
# EXPO_PUBLIC_API_URL should be set to the real production API URL for a
# build that's actually meant to ship (see docs/DEPLOY.md step 8).
build-deploy:
	cd src/frontend && npm ci && npx expo export --platform web --clear
	rm -rf _deploy
	mkdir -p _deploy/api _deploy/data _deploy/db _deploy/engine _deploy/tests
	cp -R src/frontend/dist/. _deploy/
	cp -R src/backend/api/. _deploy/api/
	cp -R src/backend/data/. _deploy/data/
	cp -R src/backend/db/. _deploy/db/
	cp -R src/backend/engine/. _deploy/engine/
	cp -R src/backend/tests/. _deploy/tests/
	cp src/backend/.htaccess _deploy/.htaccess
	cp src/backend/config.example.php _deploy/config.example.php
	cp src/backend/seed.php _deploy/seed.php
	@echo "Deployment tree assembled at _deploy/ — inspect it, do not push it anywhere manually; CI owns publishing to macerti/duration_calculator."

clean:
	rm -rf _deploy src/frontend/dist
