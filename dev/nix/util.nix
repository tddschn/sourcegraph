{
  # utility function to add some best-effort flags for emitting static objects instead of dynamic
  makeStatic = pkg: pkg.overrideAttrs (oldAttrs: {
    configureFlags = (oldAttrs.configureFlags or [ ]) ++ [ "--without-shared" "--disable-shared" "--enable-static" ];
  });
}
