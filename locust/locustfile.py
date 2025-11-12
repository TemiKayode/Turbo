from locust import HttpUser, between, task
import json


class ChatUser(HttpUser):
    wait_time = between(1, 3)
    token = None

    def on_start(self):
        email = f"user{self.environment.runner.user_count}@example.com"
        password = "password"
        # Register (best-effort)
        self.client.post("/api/register", json={"email": email, "password": password})
        # Login
        r = self.client.post("/api/login", json={"email": email, "password": password})
        if r.ok:
            self.token = r.json().get("token")

    @task
    def health(self):
        self.client.get("/api/health")


