# Build
FROM rust:1.83 as builder
WORKDIR /app
COPY Cargo.toml ./
RUN mkdir -p src && echo "fn main(){}" > src/main.rs && cargo build --release || true
COPY . .
RUN cargo build --release

# Runtime
FROM gcr.io/distroless/cc-debian12
WORKDIR /app
COPY --from=builder /app/target/release/file-upload /app/file-upload
EXPOSE 8090
USER nonroot
ENTRYPOINT ["/app/file-upload"]


