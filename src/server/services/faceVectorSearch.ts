export const FACE_VECTOR_DIMENSIONS = 128;
export const FACE_QUERY_TOP_K = 100;
export const FACE_COSINE_THRESHOLD = 0.363;

export interface FaceVectorMetadata {
  eventId: string;
  faceId: string;
  generation: number;
  partitionId: string;
  photoId: string;
}

export interface FaceVectorMatch {
  score: number;
  vectorId: string;
}

export interface FaceVectorQueryResult {
  matches: FaceVectorMatch[];
  saturated: boolean;
}

export interface FaceVectorService {
  available(): boolean;
  delete(id: string): Promise<void>;
  query(embedding: number[], eventId: string, generation: number, partitionId?: string): Promise<FaceVectorQueryResult>;
  upsert(id: string, embedding: number[], metadata: FaceVectorMetadata): Promise<void>;
}

export function faceNamespace(eventId: string, generation: number): string {
  return `face:${eventId}:generation:${generation}`;
}

export class CloudflareFaceVectorService implements FaceVectorService {
  constructor(private readonly index?: VectorizeIndex) {}

  available(): boolean {
    return Boolean(this.index);
  }

  async delete(id: string): Promise<void> {
    if (!this.index) throw new Error('FACE_INDEX_UNAVAILABLE');
    await this.index.deleteByIds([id]);
  }

  async upsert(id: string, embedding: number[], metadata: FaceVectorMetadata): Promise<void> {
    if (!this.index) throw new Error('FACE_INDEX_UNAVAILABLE');
    if (embedding.length !== FACE_VECTOR_DIMENSIONS || embedding.some((value) => !Number.isFinite(value))) {
      throw new Error('INVALID_FACE_EMBEDDING');
    }
    await this.index.upsert([{
      id,
      namespace: faceNamespace(metadata.eventId, metadata.generation),
      values: embedding,
      metadata: {
        partition_id: metadata.partitionId,
      },
    }]);
  }

  async query(
    embedding: number[],
    eventId: string,
    generation: number,
    partitionId?: string,
  ): Promise<FaceVectorQueryResult> {
    if (!this.index) throw new Error('FACE_INDEX_UNAVAILABLE');
    const filter: VectorizeVectorMetadataFilter | undefined = partitionId ? { partition_id: partitionId } : undefined;
    const result = await this.index.query(embedding, {
      topK: FACE_QUERY_TOP_K,
      namespace: faceNamespace(eventId, generation),
      returnMetadata: 'none',
      returnValues: false,
      ...(filter ? { filter } : {}),
    });
    return {
      saturated: result.matches.length >= FACE_QUERY_TOP_K,
      matches: result.matches
        .filter((match) => match.score >= FACE_COSINE_THRESHOLD)
        .map((match) => ({ vectorId: match.id, score: match.score })),
    };
  }
}
