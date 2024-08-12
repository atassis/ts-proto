import { readFile, writeFile } from "node:fs/promises";

const header =  `
| Flag  | Default | Description                                                                                              |
| ------------- | ------------- |----------------------------------------------------------------------------------------------------------|
`

async function main() {
  const file = (await readFile('./supported-options.md')).toString();
  await writeFile('./supported-options-new.md', `${header}${file.split('\n- With').map(line => `| ${line.replaceAll('\n', ' ')} | default | | `).join('\n')}`);

}

main();
