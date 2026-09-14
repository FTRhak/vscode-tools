export function componentTestTemplate(
  name: string,
  exportDefault: boolean,
): string {
  const importLine = exportDefault
    ? `import ${name} from "./${name}";`
    : `import { ${name} } from "./${name}";`;

  return `import { render } from '@testing-library/react';
${importLine}

describe("${name}", () => {
  beforeEach(() => {
    render(<${name} />);
  });

  it("exports a component", () => {
    expect(${name}).toBeDefined();
  });
});
`;
}
