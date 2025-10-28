declare module 'amadeus' {
  class Amadeus {
    constructor(opts: { clientId: string; clientSecret: string; hostname?: 'test' | 'production' | string });
    referenceData: any;
    shopping: any;
    eReputation: any;
    client: any;
  }
  export = Amadeus;
}


