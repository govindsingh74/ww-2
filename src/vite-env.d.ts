/// <reference types="vite/client" />

declare module 'world-atlas/countries-110m.json' {
  const data: import('topojson-specification').Topology;
  export default data;
}
