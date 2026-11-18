// The names of a list of files, joined with commas: what the fixtures show of a submitted value.
export function names(files) {
  return Array.isArray(files) ? files.map((file) => file.name).join(",") : "";
}

// Made-up files with these names, for fixtures that hand a root files of their own.
export function makeFiles(list) {
  return list.map((name) => new File([name], name, { type: "image/png" }));
}
