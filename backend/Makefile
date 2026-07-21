.PHONY: fmt check test

fmt:
	uv run ruff format .
	uv run ruff check --fix .

check:
	uv run ruff format --check .
	uv run ruff check .
	uv run mypy src
	@uv run pytest; \
	status=$$?; \
	if [ $$status -eq 0 ] || [ $$status -eq 5 ]; then exit 0; else exit $$status; fi

test:
	uv run pytest --cov=flight_replay --cov-report=term-missing
