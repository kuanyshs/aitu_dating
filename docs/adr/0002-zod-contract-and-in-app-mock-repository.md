# Zod contract as the source of truth, in-app mock repository

Domain and API shapes are defined once as Zod schemas in a React-Native-free `contracts` module; TypeScript types are inferred from them, forms and mock responses are validated by them, and an OpenAPI document for the Cloud Code backend will be generated from them later rather than maintained by hand. The mock backend is an in-app implementation of the same repository interface the Cloud Code adapter will implement, shaped per role (guest and expired get the safe view) before anything reaches the UI, and one contract test suite runs against every implementation.

## Considered Options

- Hand-maintained OpenAPI YAML with generated types: the supplied YAML was incomplete and would drift from the mock.
- Mocking at the HTTP layer (MSW): needs polyfills in React Native and adds a transport the prototype does not otherwise need.
