{ pkgs ? import <nixpkgs> {} }:
let
  soupault = pkgs.symlinkJoin {
    name = "soupault-wrapped";
    paths = [ pkgs.soupault ];
    buildInputs = [ pkgs.makeWrapper ];
    postBuild = ''
      wrapProgram $out/bin/soupault \
        --prefix PATH : ${pkgs.lib.makeBinPath [
          pkgs.cmark
          pkgs.nodejs
        ]}
    '';
  };
in
pkgs.mkShell {
  buildInputs = [
    pkgs.yarn
    soupault
  ];
}
