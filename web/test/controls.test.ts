import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { JogKeys } from "../client/jog";
import { Apparatus } from "../client/Apparatus";
import { telemetry } from "../server/protocol";
import { displayAngle } from "../client/angle";

test("graph references transform only the display, with explicit upright, bottom, horizontal and cosine values", () => {
  assert.equal(displayAngle(0, "upright"), 0);
  assert.equal(displayAngle(Math.PI, "bottom"), 0);
  assert.equal(displayAngle(0, "horizontal"), 90);
  assert.equal(displayAngle(Math.PI / 2, "horizontal"), 0);
  assert.equal(displayAngle(Math.PI, "horizontal"), -90);
  assert.equal(displayAngle(0, "cosine"), 1);
  assert.equal(displayAngle(Math.PI, "cosine"), -1);
  assert.equal(displayAngle(0.4, "cosine"), displayAngle(-0.4, "cosine"));
  assert.equal(displayAngle(null, "upright"), null);
  assert.equal(displayAngle(NaN, "cosine"), null);
  assert.equal(displayAngle(3 * Math.PI, "upright"), -180);
});

test("a fresh arrow immediately replaces direction; releasing it restores the other held arrow", () => {
  const keys = new JogKeys();
  assert.equal(keys.press("ArrowLeft"), -1);
  assert.equal(keys.press("ArrowRight"), 1);
  assert.equal(keys.release("ArrowRight"), -1);
  assert.equal(keys.release("ArrowLeft"), 0);
  assert.equal(keys.release("ArrowRight"), null);
  keys.press("ArrowLeft");
  keys.clear();
  assert.equal(keys.release("ArrowLeft"), null);
});
test("animation maps both hard stops and center to the labeled track", () => {
  for (const [position, svgX] of [
    [-9500, 250],
    [0, 480],
    [9500, 710],
  ]) {
    const bytes = Buffer.alloc(64);
    bytes.writeUInt32LE(4, 12);
    bytes.writeBigInt64LE(BigInt(position), 16);
    const sample = telemetry(bytes, 1n);
    const markup = renderToStaticMarkup(
      createElement(Apparatus, { sample, parameters: null }),
    );
    assert.ok(markup.includes(`data-cart-x="${svgX.toFixed(2)}"`));
    assert.ok(
      markup.includes("-190 mm") &&
        markup.includes("+190 mm") &&
        markup.includes('viewBox="0 0 960 460"'),
    );
  }
});
