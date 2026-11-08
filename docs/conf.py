"""Sphinx site configuration; Markdown in this directory is the source of truth."""
project = "Inverted Pendulum"
author = "Kevin Kuney"
copyright = "2026, Kevin Kuney"
extensions = ["myst_parser", "sphinx.ext.githubpages"]
source_suffix = {".md": "markdown"}
root_doc = "index"
exclude_patterns = ["requirements.txt"]
myst_enable_extensions = ["colon_fence", "deflist"]
myst_heading_anchors = 4
html_theme = "furo"
html_title = "Inverted Pendulum"
html_static_path = ["_static"]
html_css_files = ["custom.css"]
html_theme_options = {
    "light_css_variables": {"color-brand-primary": "#17664d", "color-brand-content": "#17664d"},
    "dark_css_variables": {"color-brand-primary": "#7ee5bf", "color-brand-content": "#7ee5bf"},
}
# Relative asset links let the same output work at / and /inverted-pendulum/.
html_show_sphinx = False
