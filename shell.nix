{ pkgs ? import <nixpkgs> {} }:
let
  soupault = pkgs.soupault.overrideAttrs (final: prev: {
    nativeBuildInputs = prev.nativeBuildInputs ++ [ pkgs.makeWrapper ];
    postInstall = (prev.postInstall or "") + ''
      wrapProgram $out/bin/soupault \
        --prefix PATH : ${pkgs.lib.makeBinPath [
          pkgs.cmark
          pkgs.nodejs
        ]}
    '';
  });
in
pkgs.mkShell {
  buildInputs = [
    pkgs.yarn
    soupault
  ];
}
