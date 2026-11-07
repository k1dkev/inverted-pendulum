/* Minimal initialization used by ST's startup assembly. This freestanding
 * C firmware has no libc dependency. Retain initializer support for future
 * toolchain-generated init functions; C++ and a hosted runtime are not enabled.
 */
typedef void (*initializer_t)(void);
extern initializer_t __preinit_array_start[], __preinit_array_end[];
extern initializer_t __init_array_start[], __init_array_end[];

void __libc_init_array(void)
{
    for (initializer_t *fn = __preinit_array_start; fn < __preinit_array_end; ++fn) {
        (*fn)();
    }
    for (initializer_t *fn = __init_array_start; fn < __init_array_end; ++fn) {
        (*fn)();
    }
}
