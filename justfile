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

# Install the local console's locked dependencies.
web-install:
    npm --prefix web ci

# Start the local server and frontend at http://localhost:3000.
web:
    npm --prefix web run dev

# Build the same portable C device core as a native test peer.
native:
    cmake -S simulation/native -B build/host -G Ninja
    cmake --build build/host

# Preview the console using the native C peer instead of USB hardware.
web-mock: native
    npm --prefix web run dev:mock

# Start a local C simulator on a real virtual serial port and launch the console.
web-sim: native
    npm --prefix web run dev:serial-sim

# Build the production frontend and type-check server/client code.
web-build:
    npm --prefix web run build

# Verify the C core and the complete native-peer/WebSocket bridge.
test: native
    ctest --test-dir build/host --output-on-failure
    npm --prefix web test
    PYTHONPATH=experiments/python python3 -m pytest -q experiments/tests

# Build the searchable Sphinx documentation; warnings fail the build.
docs-build:
    sphinx-build -n -W --keep-going -b html docs build/docs/html

# Build and serve documentation at http://localhost:8000.
docs: docs-build
    python3 -m http.server 8000 --bind 127.0.0.1 --directory build/docs/html

# Run deterministic controller/plant scenarios without starting the web app.
test-controller: native
    ctest --test-dir build/host --output-on-failure -R '^(scenarios|v3|recovery|policy-reference)$'

# Build the native batch API and plot the default v3 experiment.
plot-v3: native
    python3 experiments/scripts/plot_v3.py

# Run Python binding and experiment regression tests.
test-experiments: native
    PYTHONPATH=experiments/python python3 -m pytest -q experiments/tests
