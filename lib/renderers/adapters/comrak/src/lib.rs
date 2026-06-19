use comrak::{markdown_to_html, Options};
use napi_derive::napi;

/// Renders Markdown to HTML with the official comrak crate, configured to match
/// GitHub: GFM extensions on (tables, strikethrough, task lists, autolinks,
/// tagfilter, footnotes) with raw HTML passed through. Exposed to Node as
/// `render()`.
#[napi]
pub fn render(markdown: String) -> String {
    let mut options = Options::default();
    options.extension.table = true;
    options.extension.strikethrough = true;
    options.extension.tasklist = true;
    options.extension.autolink = true;
    options.extension.tagfilter = true;
    options.extension.footnotes = true;
    options.render.r#unsafe = true;
    markdown_to_html(&markdown, &options)
}
