{ pkgs ? import <nixpkgs> {} }:
let
  cmark = pkgs.cmark;
  soupault = pkgs.soupault.overrideAttrs (final: prev: {
    nativeBuildInputs = prev.nativeBuildInputs ++ [ pkgs.makeWrapper ];
    postInstall = (prev.postInstall or "") + ''
      wrapProgram $out/bin/soupault \
        --prefix PATH : ${pkgs.lib.makeBinPath [ cmark ]}
    '';
  });
in
pkgs.mkShell {
  buildInputs = [ soupault ];
}
