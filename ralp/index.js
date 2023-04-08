/**
 * Runs analysis on a file based on given obfuscation flags.
 * @param {{ zip: any, files: string[] }} file
 * @param {{[name: string]: { path: [string, string?], minFiles?: number, find?: any }}} obfuscationFlags
 * @param {(analysis: any) => void} setAnalysis
 * @param {(progress: any) => void} setProgress
 */
export const runAnalysis = async (file, obfuscationFlags, mainFlags, setAnalysis, setProgress) => {
  const { zip, files } = file;
  const obfuscation = {},
    flags = [];
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
    const contents = await zip.files[manifest].async("string");
    try {
      // TODO
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
  if (manifest) tasks.push(manifestTask);

  await Promise.all(tasks);
};
