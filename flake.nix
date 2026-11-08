{
  description = "Pendulum STM32 development environment";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/1d060086d60cb76a40cf37109f979d88a5bd6396";
  outputs = { self, nixpkgs }:
    let
      systems = [ "aarch64-darwin" "x86_64-darwin" "x86_64-linux" "aarch64-linux" ];
      eachSystem = nixpkgs.lib.genAttrs systems;
    in {
      devShells = eachSystem (system:
        let pkgs = import nixpkgs { inherit system; };
        in { default = pkgs.mkShell {
          packages = with pkgs; [ just cmake ninja gcc-arm-embedded openocd git nodejs_22
            (python3.withPackages (ps: with ps; [ sphinx myst-parser furo ]))
          ];
        }; });
    };
}
