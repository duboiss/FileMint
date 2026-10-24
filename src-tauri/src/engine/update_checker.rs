use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub has_update: bool,
    pub latest_version: String,
    pub release_notes_url: String,
}

#[derive(Deserialize)]
struct GitHubRelease {
    tag_name: String,
    html_url: String,
}

pub async fn check_for_updates(current_version: &str) -> Option<UpdateInfo> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .user_agent("FileMint-Update-Check/1.0")
        .build()
        .ok()?;

    let response = client
        .get("https://api.github.com/repos/duboiss/FileMint/releases/latest")
        .send()
        .await
        .ok()?;

    if !response.status().is_success() {
        return None;
    }

    let release: GitHubRelease = response.json().await.ok()?;
    let latest_tag = release.tag_name.trim_start_matches('v');

    let has_update = is_newer_version(latest_tag, current_version);

    Some(UpdateInfo {
        has_update,
        latest_version: latest_tag.to_string(),
        release_notes_url: release.html_url,
    })
}

fn is_newer_version(latest: &str, current: &str) -> bool {
    let parse_parts =
        |s: &str| -> Vec<u32> { s.split('.').filter_map(|p| p.parse::<u32>().ok()).collect() };

    let latest_parts = parse_parts(latest);
    let current_parts = parse_parts(current);

    latest_parts > current_parts
}
