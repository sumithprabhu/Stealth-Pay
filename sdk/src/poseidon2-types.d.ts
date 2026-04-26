declare module '@zkpassport/poseidon2';
declare module '@0glabs/0g-ts-sdk' {
  export class ZgFile {
    static fromFilePath(path: string): Promise<ZgFile>;
    close(): Promise<void>;
  }
  export class Indexer {
    constructor(rpc: string);
    upload(file: ZgFile, blockchainRpc: string, signer: any, opts?: any): Promise<[any, any]>;
    download(rootHash: string, outputPath: string, verifyProof: boolean): Promise<any>;
  }
  export class MemData {}
}
