use napi_derive::napi;
use pulldown_cmark::{html, Options, Parser};

/// Renders Markdown to HTML with the official pulldown-cmark crate, configured
/// as close to GitHub as its options allow: all GFM extensions on, soft line
/// breaks (no `<br>`), no smart punctuation. Exposed to Node as `render()`.
#[napi]
pub fn render(markdown: String) -> String {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TASKLISTS);
    options.insert(Options::ENABLE_FOOTNOTES);
    options.insert(Options::ENABLE_HEADING_ATTRIBUTES);
    options.insert(Options::ENABLE_GFM);

    let parser = Parser::new_ext(&markdown, options);
    let mut output = String::new();
    html::push_html(&mut output, parser);
    output
}
