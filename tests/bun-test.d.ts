//THE PART OF bun:test THESE TESTS USE. Bun ships the real types in the
//bun-types package, which this project does not install: without this file
//vue-tsc cannot resolve the module and the tests go unchecked.
declare module "bun:test" {
  interface Matchers {
    not: Matchers
    toBe(expected: unknown): void
    toEqual(expected: unknown): void
    toContainEqual(expected: unknown): void
    toHaveLength(length: number): void
    toBeNull(): void
    toBeUndefined(): void
    toBeCloseTo(expected: number, digits?: number): void
    toBeGreaterThan(expected: number): void
    toBeLessThan(expected: number): void
    toBeLessThanOrEqual(expected: number): void
    toThrow(expected?: string | RegExp): void
  }
  export function describe(name: string, body: () => void): void
  export function test(name: string, body: () => void | Promise<void>): void
  export function expect(actual: unknown): Matchers
  export const mock: {
    module(specifier: string, factory: () => Record<string, unknown>): void
  }
}
