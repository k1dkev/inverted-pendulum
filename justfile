# Show available commands.
default:
    @just --list

# Configure the NUCLEO-F767ZI Debug build.
configure:
    cmake --preset stm32-debug

# Build ELF, HEX, BIN, and map files.
build: configure
    cmake --build --preset stm32-debug

# Build, flash through ST-LINK, verify, and reset the board.
flash: configure
    cmake --build --preset flash

# Start OpenOCD for an ARM GDB connection on localhost:3333.
debug-server: configure
    cmake --build --preset debug-server

# Remove compiled outputs while keeping downloaded dependencies.
clean: configure
    cmake --build --preset stm32-debug --target clean
