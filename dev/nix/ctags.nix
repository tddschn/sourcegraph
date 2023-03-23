{ nixpkgs, utils }:
rec {
  overlay = self: super: rec {
    universal-ctags = super.universal-ctags.overrideAttrs (old: {
      version = "5.9.20220403.0";
      src = super.fetchFromGitHub {
        owner = "universal-ctags";
        repo = "ctags";
        rev = "f95bb3497f53748c2b6afc7f298cff218103ab90";
        sha256 = "sha256-pd89KERQj6K11Nue3YFNO+NLOJGqcMnHkeqtWvMFk38=";
      };
      # disable checks, else we get `make[1]: *** No rule to make target 'optlib/cmake.c'.  Stop.`
      doCheck = false;
      checkFlags = [ ];
    });
  };
  packages = nixpkgs.lib.genAttrs utils.lib.defaultSystems
    (system:
      let
        pkg = if nixpkgs.legacyPackages.${system}.hostPlatform.isMacOS then "pkgs" else "pkgsStatic";
        pkgs = (import nixpkgs { inherit system; overlays = [ overlay ]; }).${pkg};
      in
      {
        ctags = pkgs.universal-ctags.override {
          # static python is a hassle, and its only used for docs here so we dont care about
          # it being static or not
          python3 = nixpkgs.legacyPackages.${system}.python3;
        };
      }
    );
}
