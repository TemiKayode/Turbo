# Build stage
FROM golang:1.22 AS builder
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod tidy
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o server ./

# Runtime stage
FROM gcr.io/distroless/base-debian12
WORKDIR /app
ENV PORT=8080
COPY --from=builder /app/server /app/server
EXPOSE 8080
USER nonroot
ENTRYPOINT ["/app/server"]


