#include "protocol.h"
#include <float.h>

_Static_assert(sizeof(float) == 4 && FLT_RADIX == 2 && FLT_MANT_DIG == 24,
               "Protocol requires IEEE-754 binary32 floats");

uint16_t get_u16(const uint8_t *p) { return (uint16_t)(p[0] | ((uint16_t)p[1] << 8)); }
uint32_t get_u32(const uint8_t *p)
{
    return p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24);
}
uint64_t get_u64(const uint8_t *p) { return get_u32(p) | ((uint64_t)get_u32(p + 4) << 32); }
void put_u16(uint8_t *p, uint16_t v)
{
    p[0] = (uint8_t)v;
    p[1] = (uint8_t)(v >> 8);
}
void put_u32(uint8_t *p, uint32_t v)
{
    for (unsigned i = 0; i < 4; ++i)
        p[i] = (uint8_t)(v >> (i * 8));
}
void put_u64(uint8_t *p, uint64_t v)
{
    put_u32(p, (uint32_t)v);
    put_u32(p + 4, (uint32_t)(v >> 32));
}
/* Character aliasing is defined by C; avoid libc or type-punning a padded struct. */
float get_f32(const uint8_t *p)
{
    uint32_t u = get_u32(p);
    float f;
    const unsigned char *s = (const unsigned char *)&u;
    unsigned char *d = (unsigned char *)&f;
    for (unsigned i = 0; i < 4; ++i)
        d[i] = s[i];
    return f;
}
void put_f32(uint8_t *p, float f)
{
    uint32_t u;
    const unsigned char *s = (const unsigned char *)&f;
    unsigned char *d = (unsigned char *)&u;
    for (unsigned i = 0; i < 4; ++i)
        d[i] = s[i];
    put_u32(p, u);
}
uint32_t proto_crc(const uint8_t *data, size_t length)
{
    uint32_t crc = 0xffffffffU;
    for (size_t i = 0; i < length; ++i)
    {
        crc ^= data[i];
        for (unsigned b = 0; b < 8; ++b)
            crc = (crc >> 1) ^ ((crc & 1U) ? 0xedb88320U : 0U);
    }
    return crc ^ 0xffffffffU;
}
size_t proto_encode(const packet_t *p, uint8_t out[PROTO_MAX_FRAME])
{
    if (p->length > PROTO_MAX_PAYLOAD)
        return 0;
    uint8_t raw[256];
    raw[0] = 1;
    raw[1] = p->type;
    put_u16(raw + 2, p->length);
    put_u32(raw + 4, p->id);
    put_u64(raw + 8, p->session);
    for (size_t i = 0; i < p->length; ++i)
        raw[16 + i] = p->payload[i];
    size_t n = 16U + p->length;
    put_u32(raw + n, proto_crc(raw, n));
    n += 4;
    size_t code_at = 0, write = 1;
    uint8_t code = 1;
    for (size_t i = 0; i < n; ++i)
    {
        if (raw[i] == 0)
        {
            out[code_at] = code;
            code_at = write++;
            code = 1;
        }
        else
        {
            out[write++] = raw[i];
            if (++code == 255)
            {
                out[code_at] = code;
                code_at = write++;
                code = 1;
            }
        }
    }
    out[code_at] = code;
    out[write++] = 0;
    return write;
}
void proto_reset_frame(parser_t *p)
{
    p->length = 0;
    p->discard = true;
}
bool proto_feed(parser_t *p, uint8_t byte, packet_t *out)
{
    if (byte)
    {
        if (!p->discard)
        {
            if (p->length < PROTO_MAX_FRAME - 1)
                p->bytes[p->length++] = byte;
            else
            {
                p->discard = true;
                ++p->errors;
            }
        }
        return false;
    }
    if (p->discard || !p->length)
    {
        p->discard = false;
        p->length = 0;
        return false;
    }
    uint8_t raw[256];
    size_t r = 0, w = 0, n = p->length;
    p->length = 0;
    while (r < n)
    {
        uint8_t code = p->bytes[r++];
        if (code == 0 || r + (size_t)code - 1 > n)
            goto bad;
        for (unsigned i = 1; i < code; ++i)
        {
            if (w >= sizeof(raw))
                goto bad;
            raw[w++] = p->bytes[r++];
        }
        if (code != 255 && r < n)
        {
            if (w >= sizeof(raw))
                goto bad;
            raw[w++] = 0;
        }
    }
    if (w < 20 || raw[0] != 1 || get_u16(raw + 2) > PROTO_MAX_PAYLOAD ||
        w != 20U + get_u16(raw + 2) || get_u32(raw + w - 4) != proto_crc(raw, w - 4))
        goto bad;
    out->type = raw[1];
    out->length = get_u16(raw + 2);
    out->id = get_u32(raw + 4);
    out->session = get_u64(raw + 8);
    for (size_t i = 0; i < out->length; ++i)
        out->payload[i] = raw[16 + i];
    return true;
bad:
    ++p->errors;
    return false;
}
