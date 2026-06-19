/*
 * Minimal N-API binding for hoedown.
 *
 * The hoedown npm package (hoedown/node-hoedown, abandoned since 2015) ships a
 * NAN v1 binding (src/binding.cc) that no longer compiles on modern Node: NAN
 * v1's macros expand to V8 APIs removed in Node 24, and they were renamed in
 * NAN v2, so there is nothing to version-bump. hoedown's actual C engine
 * (the src/hoedown C sources) is plain C99 and compiles fine, so this replaces
 * the broken glue with a tiny, ABI-stable N-API wrapper exposing a single
 * `render(markdown) -> html`. Built by the co-located build.ts (`pnpm build:hoedown`).
 *
 * SCOPE / LIMITATION: this is purpose-built for the renderer comparison, NOT a
 * drop-in replacement for node-hoedown. It hard-codes one GFM-leaning extension
 * set (see below) and the default HTML renderer flags; it does not expose
 * hoedown's full option surface (per-call extensions, render flags, TOC, inline
 * rendering, SmartyPants, nesting limits, etc.) that the original binding did.
 */
#include <stdlib.h>
#include <node_api.h>

#include "hoedown/document.h"
#include "hoedown/html.h"
#include "hoedown/buffer.h"

static napi_value Render(napi_env env, napi_callback_info info) {
	size_t argc = 1;
	napi_value argv[1];
	napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

	size_t length = 0;
	napi_get_value_string_utf8(env, argv[0], NULL, 0, &length);
	char *input = (char *) malloc(length + 1);
	napi_get_value_string_utf8(env, argv[0], input, length + 1, &length);

	/* GFM-leaning extension set (hoedown has no task lists). */
	hoedown_extensions extensions =
		HOEDOWN_EXT_TABLES | HOEDOWN_EXT_FENCED_CODE | HOEDOWN_EXT_AUTOLINK |
		HOEDOWN_EXT_STRIKETHROUGH | HOEDOWN_EXT_NO_INTRA_EMPHASIS |
		HOEDOWN_EXT_FOOTNOTES;

	hoedown_renderer *renderer = hoedown_html_renderer_new(0, 0);
	hoedown_document *document = hoedown_document_new(renderer, extensions, 16);
	hoedown_buffer *output = hoedown_buffer_new(1024);

	hoedown_document_render(document, output, (const uint8_t *) input, length);

	napi_value result;
	napi_create_string_utf8(env, (const char *) output->data, output->size, &result);

	hoedown_buffer_free(output);
	hoedown_document_free(document);
	hoedown_html_renderer_free(renderer);
	free(input);

	return result;
}

static napi_value Init(napi_env env, napi_value exports) {
	napi_value render_fn;
	napi_create_function(env, "render", NAPI_AUTO_LENGTH, Render, NULL, &render_fn);
	napi_set_named_property(env, exports, "render", render_fn);
	return exports;
}

NAPI_MODULE(hoedown, Init)
