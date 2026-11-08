/* STM32F767ZI: 2 MiB flash, 128 KiB DTCM, 384 KiB SRAM.
 * Data and stack use DTCM for bring-up. DMA buffers must use SRAM later.
 * No bootloader offset. */
ENTRY(Reset_Handler)
MEMORY
{
  FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 2048K
  DTCM  (xrw) : ORIGIN = 0x20000000, LENGTH = 128K
  SRAM  (xrw) : ORIGIN = 0x20020000, LENGTH = 384K
}
_estack = ORIGIN(DTCM) + LENGTH(DTCM);
_Min_Stack_Size = 0x2000;
SECTIONS
{
  .isr_vector : { . = ALIGN(4); KEEP(*(.isr_vector)) } > FLASH
  .text : { *(.text*) *(.rodata*) KEEP(*(.init)) KEEP(*(.fini)) . = ALIGN(4); } > FLASH
  .ARM.extab : { *(.ARM.extab*) } > FLASH
  .ARM.exidx : { __exidx_start = .; *(.ARM.exidx*) __exidx_end = .; } > FLASH
  .preinit_array : {
    PROVIDE_HIDDEN(__preinit_array_start = .);
    KEEP(*(.preinit_array*))
    PROVIDE_HIDDEN(__preinit_array_end = .);
  } > FLASH
  .init_array : {
    PROVIDE_HIDDEN(__init_array_start = .);
    KEEP(*(SORT(.init_array.*))) KEEP(*(.init_array))
    PROVIDE_HIDDEN(__init_array_end = .);
  } > FLASH
  .fini_array : { KEEP(*(SORT(.fini_array.*))) KEEP(*(.fini_array)) } > FLASH
  _sidata = LOADADDR(.data);
  .data : {
    . = ALIGN(4); _sdata = .; *(.data*) . = ALIGN(4); _edata = .;
  } > DTCM AT > FLASH
  .bss (NOLOAD) : {
    . = ALIGN(4); _sbss = .; *(.bss*) *(COMMON) . = ALIGN(4); _ebss = .;
  } > DTCM
  .stack_reserve (NOLOAD) : {
    . = ALIGN(8); . += _Min_Stack_Size;
  } > DTCM
  /DISCARD/ : { *(.note.GNU-stack) *(.comment) }
}
ASSERT(_ebss <= _estack - _Min_Stack_Size, "RAM overflow: no room for stack")
