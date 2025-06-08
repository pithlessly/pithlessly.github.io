{ pkgs ? import <nixpkgs> {} }:
let
  soupault = pkgs.symlinkJoin {
    name = "soupault-wrapped";
    paths = [ pkgs.soupault ];
    buildInputs = [ pkgs.makeWrapper ];
    postBuild = ''
      wrapProgram $out/bin/soupault \
        --prefix PATH : ${pkgs.lib.makeBinPath [
          pkgs.pandoc
          pkgs.nodejs
          pkgs.highlight
        ]}
    '';
  };
in
pkgs.mkShell {
  buildInputs = [
    pkgs.yarn
    pkgs.highlight
    soupault
    pkgs.pandoc
  ];
}
