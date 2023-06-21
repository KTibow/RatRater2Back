export const SCAN_COMMAND = {
  name: "scan",
  description: "Scan a jar to see if it's a rat",
  options: [
    {
      type: 11, // ATTACHMENT
      name: "file",
      description: "The file to scan",
      required: true,
    },
  ],
};
