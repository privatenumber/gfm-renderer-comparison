use markdown::{to_html_with_options, Options};
use napi_derive::napi;

/// Renders Markdown to HTML with the official markdown-rs crate (wooorm's Rust
/// port of micromark/remark) in GFM mode. `Options::gfm()` enables the GFM
/// extensions, raw HTML pass-through, and the tagfilter — matching GitHub.
/// Exposed to Node as `render()`.
#[napi]
pub fn render(markdown_text: String) -> String {
    // gfm() never errors for ordinary Markdown; fall back to empty on the rare
    // failure, matching how the JS adapters swallow render errors.
    to_html_with_options(&markdown_text, &Options::gfm()).unwrap_or_default()
}
