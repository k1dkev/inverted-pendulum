/* Minimal initialization used by ST's startup assembly. This freestanding
 * C firmware has no libc dependency. Retain initializer support for future
 * toolchain-generated init functions; C++ and a hosted runtime are not enabled.
 */
typedef void (*initializer_t)(void);
#include <stddef.h>
/* libm's domain/error reporting. Single-threaded firmware; no libc heap/IO. */
int *__errno(void)
{
    static int math_errno;
    return &math_errno;
}

void *memset(void *destination, int value, size_t length)
{
    unsigned char *p = destination;
    for (size_t i = 0; i < length; ++i)
        p[i] = (unsigned char)value;
    return destination;
}

void *memcpy(void *destination, const void *source, size_t length)
{
    unsigned char *d = destination;
    const unsigned char *s = source;
    for (size_t i = 0; i < length; ++i)
        d[i] = s[i];
    return destination;
}
extern initializer_t __preinit_array_start[], __preinit_array_end[];
extern initializer_t __init_array_start[], __init_array_end[];

void __libc_init_array(void)
{
    for (initializer_t *fn = __preinit_array_start; fn < __preinit_array_end; ++fn)
    {
        (*fn)();
    }
    for (initializer_t *fn = __init_array_start; fn < __init_array_end; ++fn)
    {
        (*fn)();
    }
}
