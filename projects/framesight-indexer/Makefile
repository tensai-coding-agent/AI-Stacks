.PHONY: build run test clean docker-build docker-run lint fmt check

# Default target
all: build

# Build the project
build:
	cargo build --release --features api

# Run the indexer locally
run:
	cargo run --release --features api

# Run tests
test:
	cargo test --features api

# Clean build artifacts
clean:
	cargo clean
	rm -rf target/

# Docker commands
docker-build:
	docker build -t framesight-indexer:latest .

docker-run: docker-build
	docker-compose up -d

docker-stop:
	docker-compose down

docker-logs:
	docker-compose logs -f indexer

# Code quality
lint:
	cargo clippy --features api -- -D warnings

fmt:
	cargo fmt

check:
	cargo check --features api

# Development helpers
dev-setup:
	cp .env.example .env
	@echo "Please edit .env with your RPC endpoints"

db-start:
	docker run -d --name timescaledb-dev \
		-e POSTGRES_USER=framesight \
		-e POSTGRES_PASSWORD=framesight \
		-e POSTGRES_DB=framesight \
		-p 5432:5432 \
		timescale/timescaledb:latest-pg15 || echo "Database may already be running"

db-stop:
	docker stop timescaledb-dev || true
	docker rm timescaledb-dev || true

db-shell:
	psql postgres://framesight:framesight@localhost:5432/framesight

# Help
help:
	@echo "Available targets:"
	@echo "  build        - Build the release binary"
	@echo "  run          - Run the indexer locally"
	@echo "  test         - Run tests"
	@echo "  clean        - Clean build artifacts"
	@echo "  docker-build - Build Docker image"
	@echo "  docker-run   - Run with docker-compose"
	@echo "  docker-stop  - Stop docker-compose services"
	@echo "  docker-logs  - View indexer logs"
	@echo "  lint         - Run clippy lints"
	@echo "  fmt          - Format code"
	@echo "  check        - Check code without building"
	@echo "  dev-setup    - Copy .env.example to .env"
	@echo "  db-start     - Start local TimescaleDB"
	@echo "  db-stop      - Stop local TimescaleDB"
	@echo "  db-shell     - Connect to database shell"
