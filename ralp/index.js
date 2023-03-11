export default testMatch = (match, path, contents) => {
  if (match.type == "name" || match.type == "contents") {
    /** @type string */
    const testStr = match.type == "name" ? path : contents;
    if (!testStr) return false;
    if (match.regex) {
      const regex = new RegExp(match.regex[0], match.regex[1]);
      return regex.test(testStr);
    } else if (match.contains) {
      return testStr.includes(testStr);
    }
  } else if (match.type == "and") {
    return match.match.every((m) => testMatch(m, path, contents));
  } else if (match.type == "or") {
    return match.match.some((m) => testMatch(m, path, contents));
  }
  throw new Error("invalid match type for match " + JSON.stringify(match));
};
