import test from "node:test";
import assert from "node:assert/strict";
import { Parser, crc32, encode, telemetry } from "../server/protocol";

test("CRC, all payload lengths, fragmented/concatenated frames and resynchronization", () => {
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
  for (let length = 0; length <= 236; length++) {
    const packet = {
      type: 49,
      id: 0xfedcba98,
      session: 0x123456789abcdef0n,
      payload: Buffer.from(Array.from({ length }, (_, i) => i)),
    };
    const encoded = encode(packet),
      parser = new Parser();
    assert.ok(encoded.length <= 259);
    const decoded = Array.from(encoded).flatMap((byte) =>
      parser.push(Buffer.from([byte])),
    );
    assert.deepEqual(decoded, [packet]);
    assert.deepEqual(parser.push(Buffer.concat([encoded, encoded])), [
      packet,
      packet,
    ]);
    const corrupt = Buffer.from(encoded);
    corrupt[Math.floor(corrupt.length / 2)] ^= 64;
    assert.equal(parser.push(corrupt).length, 0);
    assert.deepEqual(parser.push(encoded), [packet]);
  }
  const parser = new Parser();
  parser.push(Buffer.alloc(600, 1));
  parser.push(Buffer.from([0]));
  assert.equal(
    parser.push(
      encode({ type: 3, id: 1, session: 1n, payload: Buffer.alloc(0) }),
    ).length,
    1,
  );
  assert.ok(parser.errors > 0);
});
test("64-bit telemetry precision and unavailable values survive JSON", () => {
  const p = Buffer.alloc(64);
  p.writeBigUInt64LE(9007199254740993n, 0);
  p.writeUInt32LE(4, 12);
  p.writeBigInt64LE(-9007199254740993n, 16);
  const t = telemetry(p, 1n);
  assert.equal(t.time_us, "9007199254740993");
  assert.equal(t.step_position_pulses, "-9007199254740993");
  assert.equal(t.angle_rad, null);
});
