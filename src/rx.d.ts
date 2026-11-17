// For plain TypeScript (`tsrs`, Vitest): a test imports an `.rx` entry, whose default export builds the app's view.
// `rx-tsc` and the editor see the real module instead.
declare module "*.rx" {
  const main: (app: unknown) => () => unknown;
  export default main;
}
