#ifndef PENDULUM_PROTOCOL_H
#define PENDULUM_PROTOCOL_H
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define PROTO_MAX_PAYLOAD 236U
#define PROTO_MAX_FRAME 259U
typedef struct
{
    uint8_t type;
    uint16_t length;
    uint32_t id;
    uint64_t session;
    uint8_t payload[PROTO_MAX_PAYLOAD];
} packet_t;
typedef struct
{
    uint8_t bytes[PROTO_MAX_FRAME];
    size_t length;
    bool discard;
    uint32_t errors;
} parser_t;

uint32_t proto_crc(const uint8_t *data, size_t length);
size_t proto_encode(const packet_t *packet, uint8_t out[PROTO_MAX_FRAME]);
bool proto_feed(parser_t *parser, uint8_t byte, packet_t *out);
void proto_reset_frame(parser_t *parser);
uint16_t get_u16(const uint8_t *p);
uint32_t get_u32(const uint8_t *p);
uint64_t get_u64(const uint8_t *p);
float get_f32(const uint8_t *p);
void put_u16(uint8_t *p, uint16_t v);
void put_u32(uint8_t *p, uint32_t v);
void put_u64(uint8_t *p, uint64_t v);
void put_f32(uint8_t *p, float v);
#endif
