include(FetchContent)
# Immutable upstream sources; hashes verify the downloaded archives.
FetchContent_Declare(st_hal
  URL https://codeload.github.com/STMicroelectronics/stm32f7xx-hal-driver/tar.gz/e1446fa12ffda80ea1016faf349e45b2047fff12
  URL_HASH SHA256=eafc8913b811037ba4ea22b8c34ced14680ada607aabf0ecfc4ae3f2dab98682
  DOWNLOAD_EXTRACT_TIMESTAMP TRUE
  SOURCE_SUBDIR __no_cmake__)
FetchContent_Declare(st_device
  URL https://codeload.github.com/STMicroelectronics/cmsis-device-f7/tar.gz/2352e888e821aa0f4fe549bd5ea81d29c67a3222
  URL_HASH SHA256=5777d4a3bd4976ba4ea91c9913fa6031458f574d3d973ad58986200244a6cdfd
  DOWNLOAD_EXTRACT_TIMESTAMP TRUE
  SOURCE_SUBDIR __no_cmake__)
FetchContent_Declare(cmsis
  URL https://codeload.github.com/ARM-software/CMSIS_5/tar.gz/2b7495b8535bdcb306dac29b9ded4cfb679d7e5c
  URL_HASH SHA256=9f7f0080795b1635b82d9f7b084d37011866cd78365749997391ba0f9602f9fe
  DOWNLOAD_EXTRACT_TIMESTAMP TRUE
  SOURCE_SUBDIR __no_cmake__)
FetchContent_MakeAvailable(st_hal st_device cmsis)

add_library(mcu_options INTERFACE)
target_compile_options(mcu_options INTERFACE
  -mcpu=cortex-m7 -mthumb -mfloat-abi=soft
  -ffunction-sections -fdata-sections -ffreestanding
  $<$<CONFIG:Debug>:-Og;-g3>
  $<$<CONFIG:Release>:-Os>)
target_compile_definitions(mcu_options INTERFACE STM32F767xx USE_HAL_DRIVER USER_VECT_TAB_ADDRESS)
target_include_directories(mcu_options INTERFACE Core/Inc)
target_include_directories(mcu_options SYSTEM INTERFACE
  ${st_hal_SOURCE_DIR}/Inc
  ${st_device_SOURCE_DIR}/Include
  ${cmsis_SOURCE_DIR}/CMSIS/Core/Include)

add_library(stm32_hal STATIC
  ${st_hal_SOURCE_DIR}/Src/stm32f7xx_hal.c
  ${st_hal_SOURCE_DIR}/Src/stm32f7xx_hal_cortex.c
  ${st_hal_SOURCE_DIR}/Src/stm32f7xx_hal_gpio.c
  ${st_hal_SOURCE_DIR}/Src/stm32f7xx_hal_rcc.c
  ${st_hal_SOURCE_DIR}/Src/stm32f7xx_hal_rcc_ex.c
  ${st_hal_SOURCE_DIR}/Src/stm32f7xx_hal_flash.c
  ${st_hal_SOURCE_DIR}/Src/stm32f7xx_hal_flash_ex.c
  ${st_hal_SOURCE_DIR}/Src/stm32f7xx_hal_pwr.c
  ${st_hal_SOURCE_DIR}/Src/stm32f7xx_hal_pwr_ex.c
  ${st_hal_SOURCE_DIR}/Src/stm32f7xx_hal_uart.c
  ${st_hal_SOURCE_DIR}/Src/stm32f7xx_hal_dma.c
  ${st_device_SOURCE_DIR}/Source/Templates/system_stm32f7xx.c)
target_link_libraries(stm32_hal PUBLIC mcu_options)

add_library(pendulum_core STATIC
  ../../lib/protocol/protocol.c ../../lib/simulation/simulation.c ../../lib/device/device.c ../../lib/policy/policy.c ../../lib/policy/recovery.c ../../lib/policy/v3.c ../../lib/telemetry/telemetry.c)
target_include_directories(pendulum_core PUBLIC ../../lib/protocol ../../lib/simulation ../../lib/device ../../lib/policy ../../lib/telemetry)
target_link_libraries(pendulum_core PUBLIC mcu_options)
target_compile_options(pendulum_core PRIVATE -Wall -Wextra -Werror)

add_executable(pendulum app/main.c Core/Src/board.c Core/Src/serial.c Core/Src/runtime.c
  ${st_device_SOURCE_DIR}/Source/Templates/gcc/startup_stm32f767xx.s)
set_target_properties(pendulum PROPERTIES SUFFIX ".elf")
target_compile_options(pendulum PRIVATE -Wall -Wextra -Werror)
target_link_libraries(pendulum PRIVATE pendulum_core stm32_hal m gcc)
set(linker_script ${CMAKE_CURRENT_SOURCE_DIR}/STM32F767ZI.ld)
set_property(TARGET pendulum APPEND PROPERTY LINK_DEPENDS ${linker_script})
target_link_options(pendulum PRIVATE
  -mcpu=cortex-m7 -mthumb -mfloat-abi=soft -nostdlib
  -T${linker_script} -Wl,--gc-sections,--print-memory-usage
  -Wl,-Map=${CMAKE_CURRENT_BINARY_DIR}/pendulum.map)
add_custom_command(TARGET pendulum POST_BUILD
  COMMAND ${CMAKE_OBJCOPY} -O ihex $<TARGET_FILE:pendulum> ${CMAKE_CURRENT_BINARY_DIR}/pendulum.hex
  COMMAND ${CMAKE_OBJCOPY} -O binary $<TARGET_FILE:pendulum> ${CMAKE_CURRENT_BINARY_DIR}/pendulum.bin
  COMMAND ${CMAKE_SIZE} $<TARGET_FILE:pendulum>
  BYPRODUCTS ${CMAKE_CURRENT_BINARY_DIR}/pendulum.hex ${CMAKE_CURRENT_BINARY_DIR}/pendulum.bin
  VERBATIM)

# OpenOCD is needed only for hardware targets; normal builds work without it.
find_program(OPENOCD_EXECUTABLE openocd)
if(NOT OPENOCD_EXECUTABLE)
  set(OPENOCD_EXECUTABLE openocd)
endif()
add_custom_target(flash
  COMMAND ${OPENOCD_EXECUTABLE} -f interface/stlink.cfg -f target/stm32f7x.cfg
    -c "program {$<TARGET_FILE:pendulum>} verify reset exit"
  DEPENDS pendulum USES_TERMINAL VERBATIM)
add_custom_target(debug-server
  COMMAND ${OPENOCD_EXECUTABLE} -f interface/stlink.cfg -f target/stm32f7x.cfg
  USES_TERMINAL VERBATIM)
