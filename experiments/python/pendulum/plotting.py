"""Small reusable Matplotlib helpers for experiment scripts."""


def toggleable_legend(ax, lines):
    """Toggle traces by clicking either their legend swatch or label.

    Keep current axis limits unchanged so inspecting a zoomed-in region is not
    disrupted. Return the callback and legend for testing or further scripting.
    """
    legend = ax.legend(handles=lines, loc="best", title="Click a trace to toggle")
    artists = {}
    for line, swatch, label in zip(lines, legend.legend_handles, legend.get_texts()):
        for artist in (swatch, label):
            artist.set_picker(True)
            artists[artist] = (line, swatch, label)

    def on_pick(event):
        selected = artists.get(event.artist)
        if selected is None:
            return
        line, swatch, label = selected
        visible = not line.get_visible()
        line.set_visible(visible)
        swatch.set_alpha(1.0 if visible else 0.25)
        label.set_alpha(1.0 if visible else 0.25)
        ax.figure.canvas.draw_idle()

    ax.figure.canvas.mpl_connect("pick_event", on_pick)
    return on_pick, legend
