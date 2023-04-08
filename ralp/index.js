/**
 * Runs analysis on a file based on given obfuscation flags.
 * @param {{ zip: any, files: string[] }} file
 * @param {{[name: string]: { path?: [string, string?], check?: (contents: string) => bool, minFiles?: number, find?: any }}} obfuscationFlags
 * @param {{[name: string]: { check?: (contents: string) => bool, find?: any, link?: any }}} mainFlags
 * @param {(analysis: any) => void} setAnalysis
 * @param {(progress: any) => void} setProgress
 */
export const runAnalysis = async (file, obfuscationFlags, mainFlags, setAnalysis, setProgress) => {
  const { zip, files } = file;
  const obfuscation = {},
    flags = {};
  for (const [flag, data] of Object.entries(obfuscationFlags)) {
    if (!data.path) continue;
    const pathRegex = new RegExp(...data.path);
    try {
      const matches = files.filter((file) => pathRegex.test(file));

      if (matches.length < (data.minFiles || 1)) continue;
      obfuscation[flag] = { file: matches[0], find: data.find };
      setAnalysis({ obfuscation, flags });
    } catch (e) {
      console.error("Error while flagging for obfuscation", flag, e);
    }
  }

  let done = 0;
  const scannableFiles = file.files.filter((path) => path.endsWith(".class"));
  const tasks = scannableFiles.map(async (f) => {
    const contents = await zip.files[f].async("string");
    try {
      for (const [flag, data] of Object.entries(obfuscationFlags)) {
        if (!data.check || !data.check(contents)) continue;
        obfuscation[flag] = { file: f, find: data.find };
        setAnalysis({ obfuscation, flags });
      }
      for (const [flag, data] of Object.entries(mainFlags)) {
        if (!data.check(contents)) continue;
        if (flags[flag]) flags[flag].matches.push(f);
        else flags[flag] = { matches: [f], find: data.find, link: data.link };
        setAnalysis({ obfuscation, flags });
      }
    } catch (e) {
      console.error("Error while flagging", f, e);
    }
    done++;
    setProgress({ done, total: tasks.length });
  });

  const manifest = file.files.find((f) => /manifest\.mf$/i.test(f));
  const manifestTask = async () => {
    const contents = await zip.files[manifest].async("string");
    try {
      const protectedLine = contents.match(/^(?=.*protected).*$/im);
      if (protectedLine) {
        obfuscation["Obfuscator noted in manifest.mf"] = {
          file: manifest,
          find: { searchString: "^(?=.*protected).*$", isRegex: true },
        };
        setAnalysis({ obfuscation, flags });
      }
      done++;
      setProgress({ done, total: tasks.length });
    } catch (e) {
      console.error("Error while flagging manifest", e);
    }
  };
  if (manifest) tasks.push(manifestTask());

  await Promise.all(tasks);
};
