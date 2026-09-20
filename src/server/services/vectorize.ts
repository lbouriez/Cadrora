export interface VectorDeleteService {
  deleteMany(ids: string[]): Promise<void>;
}

export class CloudflareVectorDeleteService implements VectorDeleteService {
  constructor(private readonly index?: VectorizeIndex) {}

  async deleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    if (!this.index) throw new Error('FACE_INDEX_UNAVAILABLE');

    for (let offset = 0; offset < ids.length; offset += 1_000) {
      await this.index.deleteByIds(ids.slice(offset, offset + 1_000));
    }
  }
}
