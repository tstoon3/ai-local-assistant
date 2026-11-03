
use serde::{Deserialize, Serialize};

const OLLAMA_URL: &str = "http://127.0.0.1:11434";
const MODEL_NAME: &str = "qwen3:1.7b";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct OllamaChatResponse {
    message: ChatMessage,
}

#[derive(Debug, Deserialize)]
struct OllamaTagsResponse {
    models: Vec<OllamaModel>,
}

#[derive(Debug, Deserialize)]
struct OllamaModel {
    name: String,
}

#[derive(Debug, Serialize)]
struct OllamaStatus {
    connected: bool,
    model_available: bool,
    models: Vec<String>,
    error: Option<String>,
}

// ตรวจสอบว่า Ollama ทำงานและมีโมเดลที่ต้องการหรือไม่
#[tauri::command]
async fn check_ollama() -> OllamaStatus {
    let client = reqwest::Client::new();

    let response = client
        .get(format!("{}/api/tags", OLLAMA_URL))
        .send()
        .await;

    match response {
        Ok(response) => {
            match response.json::<OllamaTagsResponse>().await {
                Ok(data) => {
                    let models: Vec<String> = data.models
                        .into_iter()
                        .map(|model| model.name)
                        .collect();

                    let model_available =
                        models.iter().any(|name| name == MODEL_NAME);

                    OllamaStatus {
                        connected: true,
                        model_available,
                        models,
                        error: None,
                    }
                }
                Err(error) => OllamaStatus {
                    connected: false,
                    model_available: false,
                    models: vec![],
                    error: Some(error.to_string()),
                },
            }
        }
        Err(error) => OllamaStatus {
            connected: false,
            model_available: false,
            models: vec![],
            error: Some(error.to_string()),
        },
    }
}

// ส่งประวัติข้อความไปยัง Ollama
#[tauri::command]
async fn ollama_chat(
    messages: Vec<ChatMessage>,
) -> Result<String, String> {
    if messages.is_empty() {
        return Err("ไม่มีข้อความสำหรับส่ง".to_string());
    }

    let client = reqwest::Client::new();

    let request_body = serde_json::json!({
        "model": MODEL_NAME,
        "messages": messages,
        "stream": false
    });

    let response = client
        .post(format!("{}/api/chat", OLLAMA_URL))
        .json(&request_body)
        .send()
        .await
        .map_err(|error| format!("เชื่อมต่อ Ollama ไม่สำเร็จ: {}", error))?;

    let response = response
        .error_for_status()
        .map_err(|error| format!("Ollama API Error: {}", error))?;

    let result = response
        .json::<OllamaChatResponse>()
        .await
        .map_err(|error| format!("อ่านคำตอบจาก Ollama ไม่สำเร็จ: {}", error))?;

    Ok(result.message.content)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            check_ollama,
            ollama_chat
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
