//THE PART OF BUN'S API THE SERVER USES: the S3 client (server/storage.ts) and
//Bun.file. Bun ships the real types in bun-types, which this project does not
//install (same as tests/bun-test.d.ts).
declare module "bun" {
  interface S3Options {
    endpoint: string
    bucket: string
    accessKeyId: string
    secretAccessKey: string
  }
  interface S3Stat {
    size: number
    etag: string
    lastModified: Date
    type: string
  }
  interface S3File extends Blob {
    stat(): Promise<S3Stat>
    slice(start?: number, end?: number): S3File
  }
  interface S3ListObjectsResponse {
    contents?: Array<{ key: string; size?: number; lastModified?: string }>
    isTruncated?: boolean
    nextContinuationToken?: string
  }
  export class S3Client {
    constructor(options: S3Options)
    file(key: string): S3File
    write(key: string, data: Blob | Uint8Array | string): Promise<number>
    exists(key: string): Promise<boolean>
    delete(key: string): Promise<void>
    list(input?: { prefix?: string; continuationToken?: string; maxKeys?: number }): Promise<S3ListObjectsResponse>
  }
}

declare const Bun: {
  file(path: string): Blob
}
