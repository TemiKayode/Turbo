use std::io::Write;

use actix_multipart::Multipart;
use actix_web::{post, web, App, HttpResponse, HttpServer, Responder};
use futures_util::TryStreamExt as _;

#[post("/upload")]
async fn upload(mut payload: Multipart) -> impl Responder {
    // For demo: stream file to memory then (optionally) push to S3 (stub)
    let mut filename = String::from("unknown.bin");
    let mut bytes: Vec<u8> = Vec::new();

    while let Ok(Some(mut field)) = payload.try_next().await {
        let cd = field.content_disposition();
        if let Some(name) = cd.get_filename() {
            filename = name.to_string();
        }
        while let Some(chunk) = field.try_next().await.unwrap_or(None) {
            bytes.write_all(&chunk).ok();
        }
    }

    // TODO: Initialize S3 client and put_object (env driven). Stub response for now.
    let resp = serde_json::json!({
        "filename": filename,
        "size": bytes.len(),
        "status": "stored",
    });
    HttpResponse::Ok().json(resp)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let addr = "0.0.0.0:8090";
    println!("file-upload listening on {}", addr);
    HttpServer::new(|| App::new().service(upload))
        .bind(addr)?
        .run()
        .await
}


